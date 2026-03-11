import { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle2, Loader2, Bell, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import './Cashier.css';

interface CashierOrder {
    id: string;
    created_at: string;
    total: number;
    payment_method: string;
    status: string;
    order_number?: number;
    order_items: {
        quantity: number;
        customizations?: any[];
        products: { name: string; description: string | null } | null;
    }[];
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatCurrency = (n: number) => `$${Number(n).toFixed(2)}`;

const Cashier = () => {
    const [orders, setOrders] = useState<CashierOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [newReadyCount, setNewReadyCount] = useState(0);

    const fetchOrders = useCallback(async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, created_at, total, payment_method, status, order_number,
                order_items (quantity, customizations, products (name, description))
            `)
            .in('status', ['preparando', 'lista', 'entregada'])
            .order('created_at', { ascending: !!0 })
            .limit(30);

        if (error) {
            toast.error('Error cargando órdenes');
        } else {
            setOrders((data as CashierOrder[]) || []);
        }
        setIsLoading(false);
    }, []);

    const playOrderReadySound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
        audio.play().catch(e => console.log('Audio play blocked:', e));
    };

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('cashier-orders')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                // Check if a row changed to 'lista'
                const isNewlyReady = payload.eventType === 'UPDATE' &&
                    payload.old && (payload.old as CashierOrder).status === 'preparando' &&
                    payload.new && (payload.new as CashierOrder).status === 'lista';

                if (isNewlyReady) {
                    playOrderReadySound();
                    setNewReadyCount(prev => prev + 1);
                    toast.success('¡Orden lista para entregar! 🔔', { duration: 5000, icon: '🍽️' });
                }
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchOrders]);

    const markAsDelivered = async (orderId: string) => {
        setUpdatingId(orderId);
        const { error } = await supabase
            .from('orders')
            .update({ status: 'entregada' })
            .eq('id', orderId);

        if (error) {
            toast.error('Error al marcar como entregada');
        } else {
            toast.success('Orden entregada ✅');
            setNewReadyCount(prev => Math.max(0, prev - 1));
        }
        setUpdatingId(null);
    };

    const preparando = orders.filter(o => o.status === 'preparando');
    const listas = orders.filter(o => o.status === 'lista');
    const entregadas = orders.filter(o => o.status === 'entregada');

    const OrderRow = ({ order }: { order: CashierOrder }) => {
        const [isExpanded, setIsExpanded] = useState(false);

        return (
            <div className={`cashier-card ${order.status} ${isExpanded ? 'expanded' : ''}`}>
                <div className="cashier-row" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="cashier-row-id">
                        <span className="cashier-uid">ORDEN #{order.order_number || order.id.substring(0, 4).toUpperCase()}</span>
                        <span className="cashier-time">{formatTime(order.created_at)}</span>
                        <span className="text-[10px] opacity-30 ml-2">ID: {order.id.substring(0, 4)}</span>
                    </div>
                    <div className="cashier-row-meta">
                        <span className="cashier-amount">{formatCurrency(order.total)}</span>
                        <span className={`payment-chip ${order.payment_method}`}>
                            {order.payment_method === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
                        </span>
                    </div>
                    <div className="cashier-row-status">
                        <div className="flex items-center gap-3">
                            {order.status === 'lista' && (
                                <button
                                    className="btn btn-success"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        markAsDelivered(order.id);
                                    }}
                                    disabled={updatingId === order.id}
                                >
                                    {updatingId === order.id
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <><CheckCircle2 size={16} /> Entregar</>}
                                </button>
                            )}
                            {order.status === 'preparando' && (
                                <span className="status-badge status-preparando">⏳ Preparando</span>
                            )}
                            {order.status === 'entregada' && (
                                <span className="status-badge status-entregada">✅ Entregada</span>
                            )}
                            <div className="expand-indicator">
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="order-details-expanded">
                        <div className="details-header">Detalle del Pedido:</div>
                        <div className="details-items">
                            {order.order_items?.map((item, idx) => (
                                <div key={idx} className="details-item-row">
                                    <div className="item-main">
                                        <span className="item-qty">{item.quantity}x</span>
                                        <span className="item-name">{item.products?.name}</span>
                                    </div>
                                    {item.customizations && item.customizations.length > 0 && (
                                        <div className="item-addons">
                                            {item.customizations.map((c: any, ci: number) => (
                                                <span key={ci} className="addon-pill">
                                                    + {c.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {item.products?.description && (
                                        <div className="item-desc">
                                            {item.products.description}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="cashier-layout">
            <header className="cashier-header">
                <div className="cashier-title-group">
                    <Package size={30} className="text-primary" />
                    <div>
                        <h1>Vista de Caja</h1>
                        <p className="text-secondary">Control de entrega de órdenes</p>
                    </div>
                </div>
                <div className="cashier-header-actions">
                    {newReadyCount > 0 && (
                        <div className="ready-alert">
                            <Bell size={16} />
                            <span>{newReadyCount} {newReadyCount === 1 ? 'orden lista' : 'órdenes listas'}</span>
                        </div>
                    )}
                    <button className="btn btn-outline" onClick={fetchOrders}>
                        <RefreshCw size={16} /> Actualizar
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div className="cashier-loading">
                    <Loader2 size={48} className="animate-spin text-primary" />
                </div>
            ) : (
                <div className="cashier-content">
                    {/* LISTAS — Primera sección, muy visible */}
                    {listas.length > 0 && (
                        <section className="cashier-section listas-section">
                            <h2 className="section-title ready-title">
                                🍽️ Listas para Entregar
                                <span className="section-count">{listas.length}</span>
                            </h2>
                            <div className="cashier-rows">
                                {listas.map(o => <OrderRow key={o.id} order={o} />)}
                            </div>
                        </section>
                    )}

                    {/* PREPARANDO */}
                    {preparando.length > 0 && (
                        <section className="cashier-section">
                            <h2 className="section-title preparing-title">
                                ⏳ En Preparación
                                <span className="section-count">{preparando.length}</span>
                            </h2>
                            <div className="cashier-rows">
                                {preparando.map(o => <OrderRow key={o.id} order={o} />)}
                            </div>
                        </section>
                    )}

                    {/* HISTORIAL */}
                    {entregadas.length > 0 && (
                        <section className="cashier-section">
                            <h2 className="section-title delivered-title">
                                ✅ Entregadas Hoy
                                <span className="section-count">{entregadas.length}</span>
                            </h2>
                            <div className="cashier-rows">
                                {entregadas.map(o => <OrderRow key={o.id} order={o} />)}
                            </div>
                        </section>
                    )}

                    {orders.length === 0 && (
                        <div className="cashier-empty">
                            <Package size={56} />
                            <p>No hay órdenes activas</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Cashier;
