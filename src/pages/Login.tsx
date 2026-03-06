import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Lock, Loader2, ChefHat,
    ShoppingCart, ShieldCheck, UserCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRole } from '../context/RoleContext';
import toast from 'react-hot-toast';
import './Login.css';

interface User {
    id: string;
    username: string;
    role: 'admin' | 'cajero' | 'cocina';
    pin_code: string;
}

const Login = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const { setRole } = useRole();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUsers = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('username', { ascending: true });

            if (error) {
                toast.error('Error cargando usuarios. Verifica la base de datos.');
            } else {
                setUsers(data || []);
            }
            setIsLoading(false);
        };
        fetchUsers();
    }, []);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedUser) return;

        if (pin === selectedUser.pin_code) {
            setIsLoggingIn(true);
            setRole(selectedUser.role);

            // Store simple auth in local storage
            localStorage.setItem('soro_user', JSON.stringify({
                username: selectedUser.username,
                role: selectedUser.role
            }));

            toast.success(`¡Bienvenido, ${selectedUser.username}!`);

            // Redirect based on role
            setTimeout(() => {
                if (selectedUser.role === 'admin') navigate('/dashboard');
                else if (selectedUser.role === 'cocina') navigate('/kitchen');
                else navigate('/pos');
            }, 500);
        } else {
            setPin('');
            toast.error('PIN incorrecto. Intenta de nuevo.');
        }
    };

    const handlePinClick = (num: string) => {
        if (pin.length < 4) setPin(prev => prev + num);
    };

    const clearPin = () => setPin('');

    if (isLoading) {
        return (
            <div className="login-container">
                <Loader2 size={48} className="animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="login-container animate-fade-in">
            <div className="login-box glass-panel">
                <div className="login-header">
                    <div className="login-logo">
                        <Users size={32} color="#3b82f6" />
                    </div>
                    <h1>SoroStation POS</h1>
                    <p className="text-secondary">Selecciona tu usuario para ingresar</p>
                </div>

                {!selectedUser ? (
                    <div className="user-selection-grid">
                        {users.map(u => (
                            <button
                                key={u.id}
                                className="user-card glass-panel"
                                onClick={() => setSelectedUser(u)}
                            >
                                <div className={`user-role-icon ${u.role}`}>
                                    {u.role === 'admin' && <ShieldCheck size={24} />}
                                    {u.role === 'cocina' && <ChefHat size={24} />}
                                    {u.role === 'cajero' && <ShoppingCart size={24} />}
                                </div>
                                <span className="user-name">{u.username}</span>
                                <span className="user-role-tag">{u.role}</span>
                            </button>
                        ))}
                        {users.length === 0 && (
                            <p className="text-muted text-center col-span-full">
                                No hay usuarios configurados. Agrega uno en Supabase.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="pin-entry-view animate-fade-in">
                        <button className="back-btn" onClick={() => { setSelectedUser(null); setPin(''); }}>
                            <ArrowLeft size={16} /> Cambiar usuario
                        </button>

                        <div className="selected-user-header">
                            <UserCircle size={40} className={`text-${selectedUser.role}`} />
                            <h2>{selectedUser.username}</h2>
                            <span className="badge badge-primary">{selectedUser.role}</span>
                        </div>

                        <div className="pin-display">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`}></div>
                            ))}
                        </div>

                        <form onSubmit={handleLogin} className="pin-pad">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map(key => (
                                <button
                                    key={key}
                                    type="button"
                                    className={`pin-key ${['C', 'OK'].includes(key) ? 'special' : ''}`}
                                    onClick={() => {
                                        if (key === 'C') clearPin();
                                        else if (key === 'OK') handleLogin();
                                        else handlePinClick(key);
                                    }}
                                    disabled={isLoggingIn}
                                >
                                    {key === 'OK' ? 'Entrar' : key}
                                </button>
                            ))}
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

// Internal mini-component for back button
const ArrowLeft = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
);

export default Login;
