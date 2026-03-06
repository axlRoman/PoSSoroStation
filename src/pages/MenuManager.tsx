import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Pencil, Trash2, Loader2, X, Save,
    Tag, DollarSign, FileText, Utensils, Search, ToggleLeft, ToggleRight,
    ArrowLeft, Image as ImageIcon, LayoutList
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import './MenuManager.css';

interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    image: string;
    image_url: string | null;
    description: string | null;
    discount_pct: number | null;
    is_active: boolean;
}

interface Category {
    id: string;
    name: string;
    display_order: number;
}

const EMOJI_OPTIONS = ['🍔', '🌮', '🍕', '🍣', '🥪', '🍟', '🥤', '☕', '🧃', '🍰', '🍗', '🥗', '🍝', '🌯', '💧', '🧊', '🧋', '🍷', '🍺', '🥩'];

const emptyForm = (): Omit<Product, 'id'> => ({
    name: '',
    price: 0,
    category: '',
    image: '🍔',
    image_url: null,
    description: '',
    discount_pct: null,
    is_active: true,
});

const MenuManager = () => {
    // Products state
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todos');

    // Categories state
    const [categories, setCategories] = useState<Category[]>([]);
    const [showCatManager, setShowCatManager] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [isSaving, setIsSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [imageType, setImageType] = useState<'emoji' | 'url'>('emoji');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        // Fetch Categories
        const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('*')
            .order('display_order', { ascending: true });

        if (!catError) {
            setCategories(catData || []);
        }

        // Fetch Products
        const { data: prodData, error: prodError } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (prodError) toast.error('Error cargando el menú');
        else setProducts(prodData ?? []);

        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- Product CRUD ---
    const openCreate = () => {
        if (categories.length === 0) {
            toast.error('Crea al menos una categoría primero');
            setShowCatManager(true);
            return;
        }
        setEditingProduct(null);
        setForm({ ...emptyForm(), category: categories[0].name });
        setImageType('emoji');
        setShowModal(true);
    };

    const openEdit = (p: Product) => {
        setEditingProduct(p);
        setForm({
            name: p.name,
            price: p.price,
            category: p.category,
            image: p.image,
            image_url: p.image_url,
            description: p.description ?? '',
            discount_pct: p.discount_pct,
            is_active: p.is_active,
        });
        setImageType(p.image_url ? 'url' : 'emoji');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingProduct(null);
        setForm(emptyForm());
    };

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
        if (form.price < 0) { toast.error('El precio no puede ser negativo'); return; }
        if (!form.category) { toast.error('Selecciona una categoría'); return; }
        setIsSaving(true);

        const payload = {
            name: form.name.trim(),
            price: Number(form.price),
            category: form.category,
            image: imageType === 'emoji' ? form.image : '🖼️',
            image_url: imageType === 'url' ? form.image_url : null,
            description: form.description?.trim() || null,
            discount_pct: form.discount_pct ? Number(form.discount_pct) : null,
            is_active: form.is_active,
        };

        if (editingProduct) {
            const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
            if (error) toast.error('Error al actualizar: ' + error.message);
            else { toast.success('Producto actualizado ✅'); fetchData(); closeModal(); }
        } else {
            const { error } = await supabase.from('products').insert(payload);
            if (error) toast.error('Error al crear: ' + error.message);
            else { toast.success('Producto creado 🎉'); fetchData(); closeModal(); }
        }
        setIsSaving(false);
    };

    const handleDelete = async (p: Product) => {
        setDeleteConfirm(null);
        // Try deleting from DB
        const { error } = await supabase.from('products').delete().eq('id', p.id);

        if (error) {
            // Foreign key error?
            if (error.code === '23503') {
                toast.error('No se puede eliminar porque ya tiene historial de ventas. Se ha desactivado automáticamente.');
                await supabase.from('products').update({ is_active: false }).eq('id', p.id);
                fetchData();
            } else {
                toast.error('Error al eliminar: ' + error.message);
            }
        } else {
            toast.success('Producto eliminado permanentemente');
            fetchData();
        }
    };

    const handleToggleActive = async (p: Product) => {
        const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
        if (!error) {
            setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
            toast.success(p.is_active ? 'Producto desactivado' : 'Producto activado');
        }
    };

    // --- Category CRUD ---
    const addCategory = async () => {
        if (!newCatName.trim()) return;
        const { error } = await supabase.from('categories').insert({
            name: newCatName.trim(),
            display_order: categories.length
        });
        if (error) toast.error('Error al crear categoría');
        else {
            setNewCatName('');
            fetchData();
            toast.success('Categoría agregada');
        }
    };

    const deleteCategory = async (id: string, name: string) => {
        // Check if products exist in this category
        const hasProducts = products.some(p => p.category === name);
        if (hasProducts) {
            toast.error('No puedes eliminar una categoría que tiene productos. Mueve los productos primero.');
            return;
        }

        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) toast.error('Error al eliminar categoría');
        else {
            fetchData();
            toast.success('Categoría eliminada');
        }
    };

    const filtered = products.filter(p => {
        const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    const effectivePrice = (p: Product) =>
        p.discount_pct ? p.price * (1 - p.discount_pct / 100) : p.price;

    return (
        <div className="menu-manager-layout">
            {/* VIEW SWITCHER / HEADER */}
            {!showCatManager ? (
                <>
                    <header className="menu-header">
                        <div>
                            <h1 className="menu-title"><Utensils size={26} /> Gestión de Menú</h1>
                            <p className="text-secondary">Administra platillos, precios e imágenes</p>
                        </div>
                        <div className="menu-header-actions">
                            <button className="btn btn-outline" onClick={() => setShowCatManager(true)}>
                                <LayoutList size={18} /> Categorías
                            </button>
                            <button className="btn btn-primary" onClick={openCreate}>
                                <Plus size={18} /> Nuevo Producto
                            </button>
                        </div>
                    </header>

                    {/* FILTERS */}
                    <div className="menu-filters glass-panel">
                        <div className="menu-search-wrap">
                            <Search size={16} className="search-ico" />
                            <input
                                className="menu-search"
                                placeholder="Buscar producto..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="menu-cats">
                            <button
                                className={`cat-chip ${filterCategory === 'Todos' ? 'active' : ''}`}
                                onClick={() => setFilterCategory('Todos')}
                            >Todos</button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={`cat-chip ${filterCategory === cat.name ? 'active' : ''}`}
                                    onClick={() => setFilterCategory(cat.name)}
                                >{cat.name}</button>
                            ))}
                        </div>
                        <span className="menu-count">{filtered.length} productos</span>
                    </div>

                    {/* PRODUCT GRID */}
                    {isLoading ? (
                        <div className="menu-loading"><Loader2 size={48} className="animate-spin text-primary" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="menu-empty">
                            <Utensils size={48} style={{ opacity: 0.3 }} />
                            <p>No hay productos en esta vista</p>
                            <button className="btn btn-primary mt-4" onClick={openCreate}>Crear nuevo</button>
                        </div>
                    ) : (
                        <div className="menu-grid">
                            {filtered.map(p => (
                                <div key={p.id} className={`menu-card glass-panel ${!p.is_active ? 'inactive' : ''}`}>
                                    <div className="menu-card-top">
                                        <div className="menu-visual-wrapper">
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} className="menu-card-img" />
                                            ) : (
                                                <div className="menu-emoji">{p.image}</div>
                                            )}
                                        </div>
                                        <div className="menu-card-info">
                                            <h3 className="menu-card-name" title={p.name}>{p.name}</h3>
                                            <span className="menu-cat-tag">{p.category}</span>
                                        </div>
                                        <button
                                            className="active-toggle"
                                            onClick={() => handleToggleActive(p)}
                                            title={p.is_active ? 'Ocultar en POS' : 'Mostrar en POS'}
                                        >
                                            {p.is_active
                                                ? <ToggleRight size={26} color="#10b981" />
                                                : <ToggleLeft size={26} color="#64748b" />}
                                        </button>
                                    </div>

                                    {p.description && (
                                        <p className="menu-card-desc">{p.description}</p>
                                    )}

                                    <div className="menu-card-price-row">
                                        {p.discount_pct ? (
                                            <>
                                                <span className="price-original">${p.price.toFixed(2)}</span>
                                                <span className="price-final">${effectivePrice(p).toFixed(2)}</span>
                                                <span className="discount-badge">-{p.discount_pct}%</span>
                                            </>
                                        ) : (
                                            <span className="price-final">${p.price.toFixed(2)}</span>
                                        )}
                                    </div>

                                    <div className="menu-card-actions">
                                        <button className="action-btn edit-btn" onClick={() => openEdit(p)}>
                                            <Pencil size={15} /> Editar
                                        </button>
                                        {deleteConfirm === p.id ? (
                                            <div className="delete-confirm">
                                                <span>¿Eliminar?</span>
                                                <button className="btn-del-yes" onClick={() => handleDelete(p)}>Sí</button>
                                                <button className="btn-del-no" onClick={() => setDeleteConfirm(null)}>No</button>
                                            </div>
                                        ) : (
                                            <button className="action-btn delete-btn" onClick={() => setDeleteConfirm(p.id)}>
                                                <Trash2 size={15} /> Borrar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                // --- CATEGORY MANAGER VIEW ---
                <div className="category-manager-view animate-fade-in">
                    <header className="menu-header">
                        <div>
                            <button className="btn btn-outline mb-2" onClick={() => setShowCatManager(false)}>
                                <ArrowLeft size={16} /> Volver a Pantalla de Menú
                            </button>
                            <h1 className="menu-title">Administrar Categorías</h1>
                            <p className="text-secondary">Crea secciones como "Combos", "Bebidas", "Postres", etc.</p>
                        </div>
                    </header>

                    <div className="cat-management-container glass-panel p-6">
                        <div className="add-cat-form mb-6">
                            <label className="input-label">Nueva Categoría</label>
                            <div className="flex gap-2">
                                <input
                                    className="input-field flex-1"
                                    placeholder="Ej: Snacks"
                                    value={newCatName}
                                    onChange={e => setNewCatName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addCategory()}
                                />
                                <button className="btn btn-primary" onClick={addCategory}>Agregar</button>
                            </div>
                        </div>

                        <div className="cat-list">
                            <h3 className="mb-4">Categorías Existentes</h3>
                            {categories.length === 0 && <p className="text-muted">No has creado categorías todavía.</p>}
                            <div className="cat-grid">
                                {categories.map(cat => (
                                    <div key={cat.id} className="cat-item glass-panel">
                                        <span>{cat.name}</span>
                                        <button
                                            className="action-btn delete-btn p-2"
                                            onClick={() => deleteCategory(cat.id, cat.name)}
                                            style={{ flex: 'none', width: 'auto' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRODUCT MODAL */}
            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
                    <div className="modal-content glass-panel menu-modal animate-fade-in">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingProduct ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
                            </h2>
                            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body modal-scroll">
                            <div className="modal-two-col">
                                {/* Left: Basic Info */}
                                <div className="modal-form-col">
                                    <div className="input-group">
                                        <label className="input-label"><FileText size={13} /> Nombre del Platillo *</label>
                                        <input
                                            className="input-field"
                                            placeholder="Ej: Burger Especial"
                                            value={form.name}
                                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label"><Tag size={13} /> Categoría</label>
                                        <select
                                            className="input-field"
                                            value={form.category}
                                            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        >
                                            <option value="">Selecciona Categoría</option>
                                            {categories.map(c => <option key={c.id} value={c.name} className="bg-slate-900">{c.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Descripción (ingredientes para cocina)</label>
                                        <textarea
                                            className="input-field"
                                            rows={3}
                                            placeholder="Papas, 2x carne, queso..."
                                            value={form.description ?? ''}
                                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        />
                                    </div>

                                    <div className="modal-two-col">
                                        <div className="input-group">
                                            <label className="input-label"><DollarSign size={13} /> Precio *</label>
                                            <input
                                                className="input-field"
                                                type="number"
                                                step="0.50"
                                                value={form.price || ''}
                                                onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">Descuento %</label>
                                            <input
                                                className="input-field"
                                                type="number"
                                                placeholder="0"
                                                value={form.discount_pct ?? ''}
                                                onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value === '' ? null : Number(e.target.value) }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="price-preview mt-2">
                                        {form.discount_pct ? (
                                            <span className="preview-final">Final: <strong>${(form.price * (1 - form.discount_pct / 100)).toFixed(2)}</strong></span>
                                        ) : (
                                            <span>Final: <strong>${form.price.toFixed(2)}</strong></span>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Visual Info */}
                                <div className="modal-form-col">
                                    <label className="input-label mb-3">Imagen del Producto</label>
                                    <div className="image-type-toggle mb-4">
                                        <button
                                            className={`btn btn-sm ${imageType === 'emoji' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => setImageType('emoji')}
                                            style={{ flex: 1 }}
                                        >Emoji</button>
                                        <button
                                            className={`btn btn-sm ${imageType === 'url' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => setImageType('url')}
                                            style={{ flex: 1 }}
                                        >Link Imagen</button>
                                    </div>

                                    {imageType === 'emoji' ? (
                                        <div className="emoji-grid-container">
                                            <p className="text-xs text-secondary mb-2">Selecciona un emoji:</p>
                                            <div className="emoji-grid">
                                                {EMOJI_OPTIONS.map(e => (
                                                    <button
                                                        key={e}
                                                        type="button"
                                                        className={`emoji-btn ${form.image === e ? 'selected' : ''}`}
                                                        onClick={() => setForm(f => ({ ...f, image: e }))}
                                                    >{e}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="url-input-container">
                                            <div className="input-group">
                                                <label className="input-label text-xs">Pega el link de la imagen pública:</label>
                                                <input
                                                    className="input-field"
                                                    placeholder="https://..."
                                                    value={form.image_url || ''}
                                                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                                                />
                                            </div>
                                            <div className="image-preview-box glass-panel mt-4">
                                                {form.image_url ? (
                                                    <img src={form.image_url} alt="Preview" className="img-preview-large" onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=Error+en+Link';
                                                    }} />
                                                ) : (
                                                    <div className="img-placeholder"><ImageIcon size={32} /></div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-6">
                                        <label className="input-label flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.is_active}
                                                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                                style={{ width: 18, height: 18 }}
                                            />
                                            Visible en venta
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-outline" onClick={closeModal} disabled={isSaving}>Cancelar</button>
                            <button className="btn btn-primary lg" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Guardar Cambios</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuManager;
