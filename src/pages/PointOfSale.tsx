import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Printer, ShoppingCart, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useRole } from '../context/RoleContext';
import './PointOfSale.css';

interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    image: string;
    image_url?: string | null;
    discount_pct?: number | null;
}

interface CartItem extends Product {
    quantity: number;
}

interface BusinessSettings {
    name: string;
    address: string;
    phone: string;
    branch_name: string;
}

const PointOfSale = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>(['Todos']);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentModal, setPaymentModal] = useState<'cash' | 'card' | null>(null);
    const [amountReceived, setAmountReceived] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState('');
    const [lastSoldItems, setLastSoldItems] = useState<CartItem[]>([]);
    const [lastSoldTotal, setLastSoldTotal] = useState(0);
    const [business, setBusiness] = useState<BusinessSettings>({
        name: 'Soro Station',
        address: '',
        phone: '',
        branch_name: 'Sucursal Principal'
    });

    const { currentUser } = useRole();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const { data: catData } = await supabase
                .from('categories')
                .select('name')
                .order('display_order', { ascending: true });

            if (catData) {
                setCategories(['Todos', ...catData.map(c => c.name)]);
            }

            const { data: prodData, error: prodError } = await supabase
                .from('products')
                .select('*')
                .eq('is_active', true);

            if (prodError) {
                toast.error('Error cargando catálogo desde BD');
            } else if (prodData) {
                setProducts(prodData);
            }

            // Fetch Business Settings
            const { data: bData } = await supabase
                .from('business_settings')
                .select('*')
                .limit(1)
                .single();

            if (bData) {
                setBusiness(bData);
            }

            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filteredProducts = products.filter((p) => {
        const matchCategory = activeCategory === 'Todos' || p.category === activeCategory;
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    const addToCart = (product: Product) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    const newQ = item.quantity + delta;
                    return newQ > 0 ? { ...item, quantity: newQ } : item;
                }
                return item;
            })
        );
    };

    const removeFromCart = (id: string) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
    };

    const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const handleOpenPayment = (type: 'cash' | 'card') => {
        if (total === 0) {
            toast.error('Agrega productos al carrito primero');
            return;
        }
        setPaymentModal(type);
        setAmountReceived('');
        setAuthCode('');
    };

    const handlePrint = useCallback((itemsToPrint: CartItem[], totalRecord: number) => {
        if (itemsToPrint.length === 0) return;

        // Use the passed items instead of current cart (which might be cleared)
        setLastSoldItems(itemsToPrint);
        setLastSoldTotal(totalRecord);

        // Update date/time just before printing
        const now = new Date();
        setCurrentDateTime(now.toLocaleDateString() + ' ' + now.toLocaleTimeString());

        // Timeout to ensure state update is reflected in the DOM before printing
        setTimeout(() => {
            window.print();
        }, 500);
    }, []);

    const saveOrder = async (method: 'cash' | 'card', received?: number, change?: number, folio?: string) => {
        setIsProcessing(true);
        const branchId = '11111111-1111-1111-1111-111111111111';

        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
                branch_id: branchId,
                total: total,
                payment_method: method,
                status: 'preparando',
                transaction_code: folio,
                amount_received: received,
                change_given: change,
                attended_by: currentUser?.name
            })
            .select()
            .single();

        if (orderError) {
            toast.error('Error al guardar la orden: ' + orderError.message);
            setIsProcessing(false);
            return false;
        }

        const orderItems = cart.map(item => ({
            order_id: orderData.id,
            product_id: item.id,
            quantity: item.quantity,
            price_at_time: item.price
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            toast.error('Error al guardar platillos');
            setIsProcessing(false);
            return false;
        }

        setIsProcessing(false);
        return true;
    };

    const processCashPayment = async () => {
        const amount = parseFloat(amountReceived);
        if (isNaN(amount) || amount < total) {
            toast.error('Monto insuficiente o inválido');
        } else {
            const change = amount - total;
            const itemsCopy = [...cart]; // Copy items before clearing
            const currentTotal = total;
            const success = await saveOrder('cash', amount, change);
            if (success) {
                toast.success(`Venta exitosa. Cambio: $${change.toFixed(2)}`);
                handlePrint(itemsCopy, currentTotal);
                setPaymentModal(null);
                setCart([]);
            }
        }
    };

    const processCardPayment = async () => {
        if (authCode.trim() !== '') {
            const itemsCopy = [...cart]; // Copy items before clearing
            const currentTotal = total;
            const success = await saveOrder('card', undefined, undefined, authCode);
            if (success) {
                toast.success(`Pago con tarjeta registrado`);
                handlePrint(itemsCopy, currentTotal);
                setPaymentModal(null);
                setCart([]);
            }
        } else {
            toast.error('Ingresa un folio válido');
        }
    };

    const amountNum = parseFloat(amountReceived);
    const currentChange = (!isNaN(amountNum) && amountNum >= total) ? amountNum - total : 0;

    return (
        <div className="pos-layout">
            {/* Modal de Pago */}
            {paymentModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in">
                        <h2 className="modal-title">
                            {paymentModal === 'cash' ? '💵 Pago en Efectivo' : '💳 Pago con Tarjeta'}
                        </h2>
                        <div className="modal-body">
                            <p className="modal-total">Total: <span>${total.toFixed(2)}</span></p>

                            {paymentModal === 'cash' ? (
                                <div className="input-group">
                                    <label className="input-label">Recibido:</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="0.00"
                                        value={amountReceived}
                                        onChange={(e) => setAmountReceived(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="change-preview">
                                        <span>Cambio:</span>
                                        <span className="change-value">${currentChange.toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="input-group">
                                    <label className="input-label">No. Autorización / Folio:</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Ingrese folio"
                                        value={authCode}
                                        onChange={(e) => setAuthCode(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-outline" onClick={() => setPaymentModal(null)} disabled={isProcessing}>Cancelar</button>
                            <button className="btn btn-success" onClick={paymentModal === 'cash' ? processCashPayment : processCardPayment} disabled={isProcessing}>
                                {isProcessing ? <Loader2 size={24} className="animate-spin" /> : 'Confirmar y Ticket'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AREA DE IMPRESIÓN (Ticket 58mm mejorado) */}
            <div className="print-area">
                <div className="ticket-58mm">
                    <div className="ticket-header">
                        <h1 className="ticket-brand">{business.name.toUpperCase()}</h1>
                        {business.branch_name && <p className="ticket-info">{business.branch_name}</p>}
                        {business.address && <p className="ticket-info">{business.address}</p>}
                        {business.phone && <p className="ticket-info">Tel: {business.phone}</p>}
                        <div className="ticket-divider">--------------------------------</div>
                        <p className="ticket-info">{currentDateTime}</p>
                        <p className="ticket-info">Atendió: {currentUser?.name}</p>
                    </div>

                    <div className="ticket-divider">********************************</div>
                    <p className="ticket-title">TICKET DE VENTA</p>
                    <div className="ticket-divider">********************************</div>

                    <div className="ticket-items">
                        {lastSoldItems.map(item => (
                            <div key={item.id} className="ticket-item">
                                <span className="ticket-item-name">{item.quantity} {item.name}</span>
                                <span className="ticket-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                        {lastSoldItems.length === 0 && <p style={{ textAlign: 'center' }}>Error: No hay productos</p>}
                    </div>

                    <div className="ticket-divider">--------------------------------</div>

                    <div className="ticket-totals">
                        <div className="ticket-row">
                            <span>SUBTOTAL:</span>
                            <span>${(lastSoldTotal * 0.84).toFixed(2)}</span>
                        </div>
                        <div className="ticket-row">
                            <span>IVA (16%):</span>
                            <span>${(lastSoldTotal * 0.16).toFixed(2)}</span>
                        </div>
                        <div className="ticket-row ticket-grand">
                            <span>TOTAL:</span>
                            <span>${lastSoldTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="ticket-divider">********************************</div>
                    <p className="ticket-footer">¡Gracias por su compra!</p>
                    <p className="ticket-footer">¡Vuelva pronto!</p>
                    <div style={{ height: '30px' }}></div>
                </div>
            </div>

            {/* Menu Container */}
            <div className="pos-main glass-panel screen-only">
                <header className="pos-header">
                    <div className="search-bar">
                        <Search size={20} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar en el menú..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="categories-wrapper scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="products-grid">
                    {isLoading ? (
                        <div className="col-span-full py-20 text-center">
                            <Loader2 size={48} className="animate-spin text-primary inline-block" />
                        </div>
                    ) : filteredProducts.map((product) => {
                        const effectivePrice = product.discount_pct
                            ? product.price * (1 - product.discount_pct / 100)
                            : product.price;

                        return (
                            <div key={product.id} className="product-card" onClick={() => addToCart({ ...product, price: effectivePrice })}>
                                <div className="product-image">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="product-img" onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error';
                                        }} />
                                    ) : (
                                        <span>{product.image}</span>
                                    )}
                                </div>
                                <div className="product-info">
                                    <h3 className="product-name">{product.name}</h3>
                                    <div className="product-price-row flex items-center gap-1">
                                        <div className="product-price">${effectivePrice.toFixed(2)}</div>
                                        {product.discount_pct && (
                                            <span className="text-[10px] text-red-400 line-through opacity-50">
                                                ${product.price.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar Cart */}
            <div className="pos-cart glass-panel screen-only">
                <div className="cart-header">
                    <h2>🛒 Orden</h2>
                    <span className="order-number">M#{Math.floor(Math.random() * 100)}</span>
                </div>

                <div className="cart-items">
                    {cart.map((item) => (
                        <div key={item.id} className="cart-item">
                            <div className="item-details">
                                <span className="item-name">{item.name}</span>
                                <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                            <div className="item-actions">
                                <div className="qty-controls" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '2px 8px', gap: '8px' }}>
                                    <button onClick={() => updateQuantity(item.id, -1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Minus size={14} /></button>
                                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Plus size={14} /></button>
                                </div>
                                <button className="delete-btn" onClick={() => removeFromCart(item.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="empty-state text-center py-20 opacity-30">
                            <ShoppingCart size={48} className="inline-block" />
                            <p className="mt-2 text-sm">El carrito está vacío</p>
                        </div>
                    )}
                </div>

                <div className="cart-footer">
                    <div className="totals">
                        <div className="total-row grand-total">
                            <span>TOTAL</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="action-buttons">
                        <button className="btn btn-outline" onClick={() => handleOpenPayment('cash')} title="Efectivo">
                            <Banknote size={20} />
                        </button>
                        <button className="btn btn-primary" onClick={() => handleOpenPayment('card')} title="Tarjeta">
                            <CreditCard size={20} />
                        </button>
                        <button className="btn btn-success" onClick={() => handlePrint(cart, total)} disabled={cart.length === 0} title="Re-imprimir">
                            <Printer size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PointOfSale;
