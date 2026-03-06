import { useState, useEffect } from 'react';
import { Save, UserPlus, Key, Store, MapPin, Phone, Hash, Loader2, Trash2, Shield, ChefHat, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import './Settings.css';

interface BusinessSettings {
    id: string | number;
    name: string;
    address: string;
    phone: string;
    branch_name: string;
}

interface User {
    id: string;
    username: string;
    role: 'admin' | 'cajero' | 'cocina';
    pin_code: string;
}

const Settings = () => {
    const [business, setBusiness] = useState<BusinessSettings>({
        id: 'default',
        name: 'Soro Station',
        address: '',
        phone: '',
        branch_name: 'Sucursal Principal'
    });

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingBusiness, setIsSavingBusiness] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);

    // New user form
    const [newUser, setNewUser] = useState({
        username: '',
        role: 'cajero' as const,
        pin_code: ''
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Load business settings
            const { data: bData, error: bError } = await supabase
                .from('business_settings')
                .select('*')
                .limit(1)
                .single();

            if (bData && !bError) {
                setBusiness(bData);
            }

            // Load users
            const { data: uData, error: uError } = await supabase
                .from('users')
                .select('*')
                .order('role', { ascending: true });

            if (uData && !uError) {
                const rolePriority = { cajero: 1, cocina: 2, admin: 3 };
                const sorted = [...uData].sort((a, b) => {
                    const pA = rolePriority[a.role as keyof typeof rolePriority] || 99;
                    const pB = rolePriority[b.role as keyof typeof rolePriority] || 99;
                    if (pA !== pB) return pA - pB;
                    return a.username.localeCompare(b.username);
                });
                setUsers(sorted);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveBusiness = async () => {
        setIsSavingBusiness(true);
        try {
            const { error } = await supabase
                .from('business_settings')
                .upsert({
                    id: business.id || 'default',
                    name: business.name,
                    address: business.address,
                    phone: business.phone,
                    branch_name: business.branch_name
                });

            if (error) throw error;
            toast.success('Configuración del negocio guardada ✅');
        } catch (error: any) {
            toast.error('Error al guardar: ' + error.message);
        }
        setIsSavingBusiness(false);
    };

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.pin_code) {
            toast.error('Nombre y PIN son obligatorios');
            return;
        }
        if (newUser.pin_code.length !== 4) {
            toast.error('El PIN debe ser de 4 dígitos');
            return;
        }

        setIsAddingUser(true);
        try {
            const { error } = await supabase
                .from('users')
                .insert([newUser]);

            if (error) throw error;
            toast.success('Usuario agregado correctamente 🎉');
            setNewUser({ username: '', role: 'cajero', pin_code: '' });
            fetchData();
        } catch (error: any) {
            toast.error('Error al agregar usuario: ' + error.message);
        }
        setIsAddingUser(false);
    };

    const handleDeleteUser = async (userToDelete: User) => {
        if (userToDelete.role === 'admin') {
            toast.error('Por seguridad, no se puede eliminar una cuenta de Administrador.');
            return;
        }

        if (!window.confirm(`¿Estás seguro de que deseas eliminar a "${userToDelete.username}"?`)) return;

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userToDelete.id);

            if (error) throw error;
            toast.success('Usuario eliminado');
            fetchData();
        } catch (error: any) {
            toast.error('Error al eliminar: ' + error.message);
        }
    };

    const handleUpdatePin = async (id: string, newPin: string) => {
        if (newPin.length !== 4) return;

        try {
            const { error } = await supabase
                .from('users')
                .update({ pin_code: newPin })
                .eq('id', id);

            if (error) throw error;
            toast.success('PIN actualizado');
            fetchData();
        } catch (error: any) {
            toast.error('Error al actualizar PIN');
        }
    };

    if (isLoading) {
        return (
            <div className="settings-loading">
                <Loader2 size={40} className="animate-spin text-primary" />
                <p>Cargando configuración...</p>
            </div>
        );
    }

    return (
        <div className="settings-layout animate-fade-in">
            <header className="settings-header">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Configuración</h1>
                    <p className="text-secondary">Administra los detalles de tu negocio y el acceso del personal</p>
                </div>
            </header>

            <div className="settings-grid">
                {/* Business Section */}
                <section className="settings-section glass-panel">
                    <div className="section-header">
                        <Store size={22} className="text-primary" />
                        <h2>Datos del Negocio</h2>
                    </div>
                    <div className="section-body">
                        <div className="input-group">
                            <label><Store size={14} /> Nombre del Restaurante</label>
                            <input
                                className="input-field"
                                value={business.name}
                                onChange={e => setBusiness({ ...business, name: e.target.value })}
                                placeholder="Ej: Soro Station"
                            />
                        </div>
                        <div className="input-group">
                            <label><MapPin size={14} /> Dirección</label>
                            <input
                                className="input-field"
                                value={business.address}
                                onChange={e => setBusiness({ ...business, address: e.target.value })}
                                placeholder="Calle, Número, Colonia..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group">
                                <label><Phone size={14} /> WhatsApp / Teléfono</label>
                                <input
                                    className="input-field"
                                    value={business.phone}
                                    onChange={e => setBusiness({ ...business, phone: e.target.value })}
                                    placeholder="000 000 0000"
                                />
                            </div>
                            <div className="input-group">
                                <label><Hash size={14} /> Nombre de Sucursal</label>
                                <input
                                    className="input-field"
                                    value={business.branch_name}
                                    onChange={e => setBusiness({ ...business, branch_name: e.target.value })}
                                    placeholder="Ej: Central"
                                />
                            </div>
                        </div>
                        <button
                            className="btn btn-primary mt-4 w-full lg:w-auto"
                            onClick={handleSaveBusiness}
                            disabled={isSavingBusiness}
                        >
                            {isSavingBusiness ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Guardar Cambios</>}
                        </button>
                    </div>
                </section>

                {/* User Management Section */}
                <section className="settings-section glass-panel">
                    <div className="section-header">
                        <Shield size={22} className="text-purple-400" />
                        <h2>Gestión de Personal</h2>
                    </div>
                    <div className="section-body">
                        <div className="add-user-box bg-[rgba(255,255,255,0.03)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)] mb-6">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <UserPlus size={16} /> Agregar Nuevo Usuario
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input
                                    className="input-field text-sm"
                                    placeholder="Nombre de Usuario"
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                />
                                <div className="role-select-wrapper">
                                    <Shield size={14} className="select-icon" />
                                    <select
                                        className="role-select"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                                    >
                                        <option value="cajero">Cajero</option>
                                        <option value="cocina">Cocina</option>
                                    </select>
                                </div>
                                <input
                                    className="input-field text-sm"
                                    placeholder="PIN (4 dígitos)"
                                    maxLength={4}
                                    value={newUser.pin_code}
                                    onChange={e => setNewUser({ ...newUser, pin_code: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>
                            <button
                                className="btn btn-outline btn-sm mt-3"
                                onClick={handleAddUser}
                                disabled={isAddingUser}
                            >
                                {isAddingUser ? <Loader2 className="animate-spin" size={14} /> : 'Crear Usuario'}
                            </button>
                        </div>

                        <div className="users-list">
                            <h3 className="text-xs uppercase tracking-wider text-secondary font-bold mb-3">Usuarios Activos</h3>
                            <div className="space-y-3">
                                {users.map(user => (
                                    <div key={user.id} className="user-item flex items-center justify-between p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className={`role-icon-small ${user.role}`}>
                                                {user.role === 'admin' && <Shield size={14} />}
                                                {user.role === 'cocina' && <ChefHat size={14} />}
                                                {user.role === 'cajero' && <ShoppingCart size={14} />}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm">{user.username}</div>
                                                <div className="text-[10px] uppercase text-secondary font-bold">{user.role}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="pin-input-container">
                                                <Key size={12} className="text-secondary mr-2" />
                                                <input
                                                    className="pin-edit-field"
                                                    defaultValue={user.pin_code}
                                                    onBlur={(e) => handleUpdatePin(user.id, e.target.value)}
                                                    maxLength={4}
                                                />
                                            </div>
                                            {user.role !== 'admin' && (
                                                <button
                                                    className="delete-action-btn"
                                                    onClick={() => handleDeleteUser(user)}
                                                    title="Eliminar usuario"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Settings;
