import { useState, useEffect, useCallback } from 'react';
import { ChefHat, CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import './Kitchen.css';

interface OrderItem {
    quantity: number;
    price_at_time: number;
    customizations?: any[];
    products: any; // Can be object or array from Supabase join
}

interface KanbanOrder {
    id: string;
    created_at: string;
    status: string;
    total: number;
    order_number: number;
    order_items: OrderItem[];
}

const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Elapsed time since order was created
const useElapsed = (iso: string) => {
    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        const calc = () => {
            const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
            if (diff < 60) setElapsed(`${diff}s`);
            else setElapsed(`${Math.floor(diff / 60)}min`);
        };
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [iso]);
    return elapsed;
};

const OrderCard = ({
    order,
    showAction,
    updatingId,
    onMoveToLista,
}: {
    order: KanbanOrder;
    showAction: boolean;
    updatingId: string | null;
    onMoveToLista: (id: string) => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const elapsed = useElapsed(order.created_at);
    const isUrgent = (Date.now() - new Date(order.created_at).getTime()) > 10 * 60 * 1000; // >10 min = urgent

    return (
        <div className={`kanban-card glass-panel ${isUrgent && showAction ? 'kanban-urgent' : ''}`}>
            <div className="kanban-card-header" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
                <div className="kanban-card-title">
                    <span className="kanban-order-id">ORDEN #{order.order_number || order.id.substring(0, 4).toUpperCase()}</span>
                    {isUrgent && showAction && <span className="urgent-badge">⚡ Urgente</span>}
                </div>
                <div className="kanban-card-meta">
                    <span className="kanban-time">{formatTime(order.created_at)}</span>
                    <span className="kanban-elapsed">{elapsed}</span>
                    <button
                        className="expand-toggle"
                        onClick={() => setExpanded(e => !e)}
                        title={expanded ? 'Colapsar' : 'Expandir'}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="kanban-items">
                    {order.order_items?.map((item, i) => (
                        <div key={i} className="kanban-item-block">
                            <div className="kanban-item-row">
                                <span className="kanban-item-qty">{item.quantity}x</span>
                                <span className="kanban-item-name">
                                    {Array.isArray(item.products) ? item.products[0]?.name : item.products?.name ?? 'Producto'}
                                </span>
                            </div>
                            {item.customizations && item.customizations.length > 0 && (
                                <div className="kanban-item-customs">
                                    {item.customizations.map((c: any, ci: number) => {
                                        const isExtra = c.name.includes('(EXTRA)');
                                        return (
                                            <div key={ci} className={`kanban-custom-pill ${isExtra ? 'extra' : ''}`}>
                                                {c.name}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {item.products && (
                                <div className="kanban-item-description">
                                    {Array.isArray(item.products) ? item.products[0]?.description : item.products.description}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showAction ? (
                <button
                    className="btn btn-success w-full mt-3"
                    onClick={() => onMoveToLista(order.id)}
                    disabled={updatingId === order.id}
                >
                    {updatingId === order.id
                        ? <Loader2 size={18} className="animate-spin" />
                        : <><CheckCircle2 size={18} /> Marcar como Lista</>}
                </button>
            ) : (
                <div className="kanban-ready-badge">
                    <CheckCircle2 size={16} /> Esperando entrega en caja
                </div>
            )}
        </div>
    );
};

const Kitchen = () => {
    const [orders, setOrders] = useState<KanbanOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'preparando' | 'lista'>('preparando');

    const fetchOrders = useCallback(async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, created_at, status, total, order_number,
                order_items (quantity, price_at_time, customizations, products (name, image, description))
            `)
            .in('status', ['preparando', 'lista'])
            .order('created_at', { ascending: true });

        if (error) {
            console.error(error);
            toast.error('Error cargando órdenes de cocina');
        } else {
            setOrders((data as unknown as KanbanOrder[]) || []);
        }
        setIsLoading(false);
    }, []);

    const playNewOrderSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio play blocked:', e));
    };

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('kitchen-orders-v2')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'orders'
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    playNewOrderSound();
                    toast('🔔 ¡Nueva orden recibida!', { icon: '👨‍🍳', duration: 5000 });
                }
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchOrders]);

    const moveToLista = async (orderId: string) => {
        // ── Optimistic update: mover la tarjeta inmediatamente en el estado local
        setOrders(prev =>
            prev.map(o => o.id === orderId ? { ...o, status: 'lista' } : o)
        );
        setUpdatingId(orderId);

        const { error } = await supabase
            .from('orders')
            .update({ status: 'lista' })
            .eq('id', orderId);

        if (error) {
            // Revertir si falla
            toast.error('Error al actualizar la orden');
            setOrders(prev =>
                prev.map(o => o.id === orderId ? { ...o, status: 'preparando' } : o)
            );
        } else {
            toast.success('¡Orden lista para entregar! 🍽️');
        }
        setUpdatingId(null);
    };

    const preparando = orders.filter(o => o.status === 'preparando');
    const listas = orders.filter(o => o.status === 'lista');

    return (
        <div className="kitchen-layout">
            <header className="kitchen-header">
                <div className="kitchen-title-group">
                    <ChefHat size={32} className="kitchen-icon" />
                    <div>
                        <h1>Vista de Cocina</h1>
                        <p className="text-secondary">Gestión de órdenes en tiempo real</p>
                    </div>
                </div>
                <div className="kitchen-header-right">
                    <div className="kitchen-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'preparando' ? 'active' : ''}`}
                            onClick={() => setActiveTab('preparando')}
                        >
                            ⏳ Preparando ({preparando.length})
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'lista' ? 'active' : ''}`}
                            onClick={() => setActiveTab('lista')}
                        >
                            ✅ Listas ({listas.length})
                        </button>
                    </div>
                    <button className="btn btn-outline" onClick={fetchOrders} title="Actualizar">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div className="kitchen-loading">
                    <Loader2 size={48} className="animate-spin text-primary" />
                    <p className="text-secondary mt-4">Cargando órdenes de cocina...</p>
                </div>
            ) : (
                <div className="kanban-board-single">
                    {activeTab === 'preparando' ? (
                        <div className="kanban-column full-width">
                            <div className="kanban-cards">
                                {preparando.length === 0 ? (
                                    <div className="kanban-empty">
                                        <Package size={48} className="opacity-20 mb-2" />
                                        <p>No hay órdenes pendientes 🎉</p>
                                    </div>
                                ) : preparando.map(order => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        showAction={true}
                                        updatingId={updatingId}
                                        onMoveToLista={moveToLista}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="kanban-column full-width">
                            <div className="kanban-cards">
                                {listas.length === 0 ? (
                                    <div className="kanban-empty">
                                        <Package size={48} className="opacity-20 mb-2" />
                                        <p>No hay órdenes listas aún</p>
                                    </div>
                                ) : listas.map(order => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        showAction={false}
                                        updatingId={updatingId}
                                        onMoveToLista={moveToLista}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Kitchen;
