import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Printer, ShoppingCart, Loader2, ArrowLeft, X, LayoutList, ToggleLeft, ToggleRight, ShoppingBag } from 'lucide-react';
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
    requires_sauce?: boolean;
    includes_drink?: boolean;
}

interface CartItemCustomization {
    productId: string;
    name: string;
    price: number;
}

interface CartItem extends Product {
    quantity: number;
    customizations?: CartItemCustomization[];
    uniqueId: string; // To differentiate same product with different customizations
}

interface BusinessSettings {
    name: string;
    address: string;
    phone: string;
    branch_name: string;
}

const PointOfSale = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentModal, setPaymentModal] = useState<'cash' | 'card' | null>(null);
    const [amountReceived, setAmountReceived] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState('');
    const [lastSoldItems, setLastSoldItems] = useState<CartItem[]>([]);
    const [lastSoldTotal, setLastSoldTotal] = useState(0);
    const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [business, setBusiness] = useState<BusinessSettings>({
        name: 'Soro Station',
        address: '',
        phone: '',
        branch_name: 'Sucursal Principal'
    });

    // Customization state
    const [showCustModal, setShowCustModal] = useState(false);
    const [custProduct, setCustProduct] = useState<Product | null>(null);
    const [sauceOptions, setSauceOptions] = useState<Product[]>([]);
    const [drinkOptions, setDrinkOptions] = useState<Product[]>([]);
    const [selectedSauces, setSelectedSauces] = useState<{ id: string; isExtra: boolean }[]>([]);
    const [selectedDrink, setSelectedDrink] = useState<string | null>(null);
    const [isExtraSauceMode, setIsExtraSauceMode] = useState(false);

    const { currentUser } = useRole();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const { data: catData } = await supabase
                .from('categories')
                .select('name')
                .order('display_order', { ascending: true });

            if (catData) {
                setCategories(catData);
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
        const matchCategory = !activeCategory || p.category === activeCategory;
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    const openCustomization = (product: Product) => {
        setCustProduct(product);
        setSelectedSauces([]);
        setSelectedDrink(null);
        setIsExtraSauceMode(false);

        // Fetch options if needed
        const sauces = products.filter(p => p.category.toLowerCase().includes('salsa'));
        const drinks = products.filter(p => p.category.toLowerCase().includes('bebida'));
        setSauceOptions(sauces);
        setDrinkOptions(drinks);

        setShowCustModal(true);
    };

    const addToCart = (product: Product, customs: CartItemCustomization[] = []) => {
        const uniqueId = product.id + (customs.length > 0 ? '-' + customs.map(c => c.productId).join('-') : '');

        setCart((prev) => {
            const existing = prev.find((item) => item.uniqueId === uniqueId);
            if (existing) {
                return prev.map((item) =>
                    item.uniqueId === uniqueId ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1, customizations: customs, uniqueId }];
        });

        if (showCustModal) setShowCustModal(false);
        setActiveCategory(null); // Always return to main category grid after adding item
    };

    const confirmCustomization = () => {
        if (!custProduct) return;

        const customs: CartItemCustomization[] = [];

        // Process sauces: use isExtra flag
        selectedSauces.forEach((s) => {
            const sauce = sauceOptions.find(opt => opt.id === s.id);
            if (sauce) {
                customs.push({
                    productId: sauce.id,
                    name: s.isExtra ? `${sauce.name} (EXTRA)` : sauce.name,
                    price: s.isExtra ? sauce.price : 0
                });
            }
        });

        // Process drink
        if (selectedDrink) {
            const drink = drinkOptions.find(d => d.id === selectedDrink);
            if (drink) {
                customs.push({
                    productId: drink.id,
                    name: drink.name,
                    price: 0 // Assume included in combo
                });
            }
        }

        addToCart(custProduct, customs);
    };

    const removeFromCart = (uniqueId: string) => {
        setCart((prev) => prev.filter((item) => item.uniqueId !== uniqueId));
    };

    const updateQuantity = (uniqueId: string, delta: number) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.uniqueId === uniqueId) {
                    const newQ = item.quantity + delta;
                    return newQ > 0 ? { ...item, quantity: newQ } : item;
                }
                return item;
            })
        );
    };

    const total = cart.reduce((acc, item) => {
        const itemTotal = item.price * item.quantity;
        const custTotal = item.customizations?.reduce((sum, c) => sum + c.price, 0) || 0;
        return acc + itemTotal + (custTotal * item.quantity);
    }, 0);

    const handleOpenPayment = (type: 'cash' | 'card') => {
        if (total === 0) {
            toast.error('Agrega productos al carrito primero');
            return;
        }
        setPaymentModal(type);
        setAmountReceived('');
        setAuthCode('');
    };

    const handlePrint = useCallback((itemsToPrint: CartItem[], totalRecord: number, orderNum?: number) => {
        if (itemsToPrint.length === 0) return;

        setLastSoldItems(itemsToPrint);
        setLastSoldTotal(totalRecord);
        if (orderNum) setLastOrderNumber(orderNum);

        const now = new Date();
        setCurrentDateTime(now.toLocaleDateString() + ' ' + now.toLocaleTimeString());

        setTimeout(() => {
            window.print();
        }, 500);
    }, []);

    const saveOrder = async (method: 'cash' | 'card', received?: number, change?: number, folio?: string) => {
        setIsProcessing(true);
        const branchId = '11111111-1111-1111-1111-111111111111';

        // Get max order number for today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: lastOrder } = await supabase
            .from('orders')
            .select('order_number')
            .gte('created_at', startOfDay.toISOString())
            .not('order_number', 'is', null) // Avoid nulls from breaking calculation
            .order('order_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        const nextNum = (lastOrder?.order_number || 0) + 1;

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
                attended_by: currentUser?.name,
                order_number: nextNum
            })
            .select()
            .single();

        if (orderError) {
            toast.error('Error al guardar la orden: ' + orderError.message);
            setIsProcessing(false);
            return null;
        }

        const orderItems = cart.map(item => ({
            order_id: orderData.id,
            product_id: item.id,
            quantity: item.quantity,
            price_at_time: item.price,
            customizations: item.customizations || []
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            toast.error('Error al guardar platillos');
            setIsProcessing(false);
            return null;
        }

        setIsProcessing(false);
        return nextNum;
    };

    const processCashPayment = async () => {
        const amount = parseFloat(amountReceived);
        if (isNaN(amount) || amount < total) {
            toast.error('Monto insuficiente o inválido');
        } else {
            const change = amount - total;
            const itemsCopy = [...cart]; // Copy items before clearing
            const currentTotal = total;
            const successNum = await saveOrder('cash', amount, change);
            if (successNum) {
                toast.success(`Venta exitosa. Cambio: $${change.toFixed(2)}`);
                handlePrint(itemsCopy, currentTotal, successNum);
                setPaymentModal(null);
                setShowMobileCart(false); // Close mobile cart
                setCart([]);
                setActiveCategory(null); // Return to category selection
            }
        }
    };

    const processCardPayment = async () => {
        if (authCode.trim() !== '') {
            const itemsCopy = [...cart]; // Copy items before clearing
            const currentTotal = total;
            const successNum = await saveOrder('card', undefined, undefined, authCode);
            if (successNum) {
                toast.success(`Pago con tarjeta registrado`);
                handlePrint(itemsCopy, currentTotal, successNum);
                setPaymentModal(null);
                setShowMobileCart(false); // Close mobile cart
                setCart([]);
                setActiveCategory(null); // Return to category selection
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
                                        onKeyDown={(e) => e.key === 'Enter' && processCashPayment()}
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
                                        onKeyDown={(e) => e.key === 'Enter' && processCardPayment()}
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

            {/* Modal de Personalización */}
            {showCustModal && custProduct && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '450px' }}>
                        <div className="modal-header-cust">
                            <h2 className="modal-title">Personalizar {custProduct.name}</h2>
                            <button className="close-btn" onClick={() => setShowCustModal(false)}><X size={20} /></button>
                        </div>

                        <div className="modal-body-cust scrollbar-thin">
                            {/* Sección de Salsas */}
                            {custProduct.requires_sauce && (
                                <div className="cust-section">
                                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                        <h3>Salsas</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Salsa Extra</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsExtraSauceMode(!isExtraSauceMode)}
                                                className="active-toggle"
                                            >
                                                {isExtraSauceMode
                                                    ? <ToggleRight size={28} color="#3b82f6" />
                                                    : <ToggleLeft size={28} color="#64748b" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="options-grid">
                                        {sauceOptions.map(sauce => {
                                            const selection = selectedSauces.find(s => s.id === sauce.id && s.isExtra === isExtraSauceMode);
                                            const anySelected = selectedSauces.some(s => s.id === sauce.id);

                                            return (
                                                <button
                                                    key={sauce.id}
                                                    className={`option-btn ${selection ? 'active' : ''} ${anySelected && !selection ? 'opacity-60' : ''}`}
                                                    onClick={() => {
                                                        if (selection) {
                                                            setSelectedSauces(prev => prev.filter(s => !(s.id === sauce.id && s.isExtra === isExtraSauceMode)));
                                                        } else {
                                                            setSelectedSauces(prev => [...prev, { id: sauce.id, isExtra: isExtraSauceMode }]);
                                                        }
                                                    }}
                                                >
                                                    <div className="option-visual">
                                                        {sauce.image_url ? (
                                                            <img src={sauce.image_url} alt="" className="option-img-sm" />
                                                        ) : (
                                                            <span className="option-emoji-sm">{sauce.image}</span>
                                                        )}
                                                        {selectedSauces.some(s => s.id === sauce.id && s.isExtra) && (
                                                            <span className="extra-badge">EXTRA</span>
                                                        )}
                                                    </div>
                                                    <div className="option-content">
                                                        <span className="option-name-sm">{sauce.name}</span>
                                                        {isExtraSauceMode && <span className="extra-price">+${sauce.price}</span>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Sección de Bebidas */}
                            {custProduct.includes_drink && (
                                <div className="cust-section mt-4">
                                    <h3>Escoge tu Bebida <small>(Incluida)</small></h3>
                                    <div className="options-grid">
                                        {drinkOptions.map(drink => (
                                            <button
                                                key={drink.id}
                                                className={`option-btn ${selectedDrink === drink.id ? 'active' : ''}`}
                                                onClick={() => setSelectedDrink(drink.id)}
                                            >
                                                <div className="option-visual">
                                                    {drink.image_url ? (
                                                        <img src={drink.image_url} alt="" className="option-img-sm" />
                                                    ) : (
                                                        <span className="option-emoji-sm">{drink.image}</span>
                                                    )}
                                                </div>
                                                <div className="option-content">
                                                    <span className="option-name-sm">{drink.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer-cust mt-6">
                            <button className="btn btn-primary w-full" onClick={confirmCustomization}>
                                Agregar a la Orden
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
                    <div className="ticket-order-badge">
                        <p className="order-label">ORDEN NÚMERO</p>
                        <p className="order-number-lg">{lastOrderNumber || '00'}</p>
                    </div>
                    <p className="ticket-title">TICKET DE VENTA</p>
                    <div className="ticket-divider">********************************</div>

                    <div className="ticket-items">
                        {lastSoldItems.map((item, idx) => (
                            <div key={item.uniqueId + idx} className="ticket-item-group">
                                <div className="ticket-item">
                                    <span className="ticket-item-name">{item.quantity} {item.name}</span>
                                    <span className="ticket-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                                {item.customizations?.map((c, ci) => (
                                    <div key={ci} className="ticket-subitem">
                                        <span>+ {c.name}</span>
                                        {c.price > 0 && <span>${(c.price * item.quantity).toFixed(2)}</span>}
                                    </div>
                                ))}
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
                {activeCategory ? (
                    <>
                        <header className="pos-header">
                            <div className="flex items-center gap-4">
                                <button className="btn-back" onClick={() => setActiveCategory(null)}>
                                    <ArrowLeft size={20} />
                                </button>
                                <h2 className="text-xl font-bold">{activeCategory}</h2>
                                <div className="search-bar flex-1 ml-4">
                                    <Search size={20} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder={`Buscar en ${activeCategory}...`}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
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
                                    <div
                                        key={product.id}
                                        className="product-card"
                                        onClick={() => {
                                            if (product.requires_sauce || product.includes_drink) {
                                                openCustomization(product);
                                            } else {
                                                addToCart({ ...product, price: effectivePrice });
                                            }
                                        }}
                                    >
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
                    </>
                ) : (
                    <div className="categories-grid-selection">
                        <h2 className="grid-selection-title">Seleccione Categoría</h2>
                        <div className="categories-grid">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    className="big-category-card active"
                                    onClick={() => setActiveCategory(cat.name)}
                                >
                                    <div className="cat-icon-lg breadcrumbs-icon">
                                        <LayoutList size={40} />
                                    </div>
                                    <span className="cat-name-lg">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Botón flotante de Resumen para Móvil */}
            <button
                className="mobile-resume-fab"
                onClick={() => setShowMobileCart(true)}
            >
                <div className="fab-content">
                    <ShoppingBag size={24} />
                    <div className="fab-info">
                        <span className="fab-title">Resumen de Orden</span>
                        <span className="fab-subtitle">{cart.reduce((s, i) => s + i.quantity, 0)} productos</span>
                    </div>
                </div>
                <span className="fab-total">${total.toFixed(2)}</span>
            </button>

            {/* Sidebar Cart (Desktop) & Modal Cart (Mobile) */}
            <div
                className={`pos-cart-container ${showMobileCart ? 'active' : ''}`}
                onClick={() => setShowMobileCart(false)}
            >
                <div
                    className="pos-cart glass-panel screen-only"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="cart-header">
                        <div className="flex items-center justify-between w-full">
                            <div>
                                <h2 className="text-xl font-black">🛒 Orden</h2>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <button
                                    className="mobile-only close-cart"
                                    onClick={() => setShowMobileCart(false)}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="cart-meta-sm flex justify-between items-center mb-4">
                        <span className="order-number">NUEVA</span>
                        {cart.length > 0 && (
                            <button className="empty-cart-btn" onClick={() => {
                                if (window.confirm('¿Deseas vaciar toda la orden?')) setCart([]);
                            }}>
                                <Trash2 size={14} />
                                <span>Vaciar</span>
                            </button>
                        )}
                    </div>

                    <div className="cart-items scrollbar-thin">
                        {cart.map((item) => (
                            <div key={item.uniqueId} className="cart-item">
                                <div className="item-details">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-price">
                                        ${((item.price + (item.customizations?.reduce((s, c) => s + c.price, 0) || 0)) * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                                {item.customizations && item.customizations.length > 0 && (
                                    <div className="item-customs text-[10px] text-secondary">
                                        {item.customizations.map((c, i) => (
                                            <div key={i}>+ {c.name} {c.price > 0 ? `(+$${c.price})` : '(Grátis)'}</div>
                                        ))}
                                    </div>
                                )}
                                <div className="item-actions mt-1">
                                    <div className="qty-controls" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '2px 8px', gap: '8px' }}>
                                        <button onClick={() => updateQuantity(item.uniqueId, -1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Minus size={14} /></button>
                                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.uniqueId, 1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Plus size={14} /></button>
                                    </div>
                                    <button className="delete-btn" onClick={() => removeFromCart(item.uniqueId)}>
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
                                <span className="mobile-only text-xs">Pago Efectivo</span>
                            </button>
                            <button className="btn btn-primary" onClick={() => handleOpenPayment('card')} title="Tarjeta">
                                <CreditCard size={20} />
                                <span className="mobile-only text-xs">Pago Tarjeta</span>
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={() => {
                                    if (cart.length > 0) {
                                        handlePrint(cart, total);
                                    } else if (lastSoldItems.length > 0) {
                                        handlePrint(lastSoldItems, lastSoldTotal, lastOrderNumber || undefined);
                                    } else {
                                        toast.error('No hay nada que imprimir');
                                    }
                                }}
                                title="Re-imprimir"
                            >
                                <Printer size={20} />
                                <span className="mobile-only text-xs">Ticket</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PointOfSale;
