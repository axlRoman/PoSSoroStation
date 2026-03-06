import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Utensils, Settings, ShoppingCart, LogOut, ChefHat, Package, Store } from 'lucide-react';
import { useRole, type UserRole } from '../context/RoleContext';
import './Sidebar.css';

import type { ReactNode } from 'react';

// Which nav items each role can see
const NAV_BY_ROLE: Record<UserRole, { to: string; icon: ReactNode; label: string }[]> = {
    admin: [
        { to: '/pos', icon: <ShoppingCart size={20} />, label: 'Terminal POS' },
        { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { to: '/kitchen', icon: <ChefHat size={20} />, label: 'Cocina' },
        { to: '/cashier', icon: <Package size={20} />, label: 'Caja / Entrega' },
        { to: '/menu', icon: <Store size={20} />, label: 'Menú Admin' },
        { to: '/settings', icon: <Settings size={20} />, label: 'Configuración' },
    ],
    cajero: [
        { to: '/pos', icon: <ShoppingCart size={20} />, label: 'Terminal POS' },
        { to: '/cashier', icon: <Package size={20} />, label: 'Caja / Entrega' },
    ],
    cocina: [
        { to: '/kitchen', icon: <ChefHat size={20} />, label: 'Vista Cocina' },
    ],
};

const Sidebar = () => {
    const { currentUser, logout } = useRole();

    if (!currentUser) return null;

    const navItems = NAV_BY_ROLE[currentUser.role] || [];

    return (
        <aside className="sidebar glass-panel">
            <div className="sidebar-header">
                <div className="logo-box">
                    <Utensils size={24} color="var(--primary-color)" />
                </div>
                <h2 className="brand-name">
                    Soro<span className="text-primary">Station</span>
                </h2>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </NavLink>
                ))}

                {/* Mobile Logout Button (Visible only via CSS media queries) */}
                <button className="nav-item mobile-logout-btn" onClick={logout}>
                    <LogOut size={20} />
                    <span>Salir</span>
                </button>
            </nav>

            <div className="sidebar-footer">
                <div className="user-info">
                    <div className={`avatar ${currentUser.role}`}>{currentUser.initials}</div>
                    <div className="user-details">
                        <span className="user-name">{currentUser.name}</span>
                        <span className="user-role">{currentUser.role}</span>
                    </div>
                </div>

                <button
                    className="btn-logout"
                    title="Cerrar Sesión"
                    onClick={logout}
                >
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
