import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type UserRole = 'admin' | 'cajero' | 'cocina';

interface RoleUser {
    role: UserRole;
    name: string;
    initials: string;
}

const ROLE_MAPPING: Record<UserRole, Omit<RoleUser, 'role'>> = {
    admin: { name: 'Admin Global', initials: 'AD' },
    cajero: { name: 'Cajero', initials: 'CJ' },
    cocina: { name: 'Cocina', initials: 'CO' },
};

interface RoleContextType {
    currentUser: RoleUser | null;
    setRole: (role: UserRole, username?: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<RoleUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load session from localStorage
        const saved = localStorage.getItem('soro_user');
        if (saved) {
            try {
                const { role, username } = JSON.parse(saved);
                const mapping = ROLE_MAPPING[role as UserRole];
                if (mapping) {
                    setCurrentUser({
                        role: role as UserRole,
                        name: username || mapping.name,
                        initials: (username?.substring(0, 2).toUpperCase()) || mapping.initials
                    });
                }
            } catch (e) {
                console.error('Error parsing session', e);
            }
        }
        setIsLoading(false);
    }, []);

    const setRole = (role: UserRole, username?: string) => {
        const mapping = ROLE_MAPPING[role];
        const newUser = {
            role,
            name: username || mapping.name,
            initials: (username?.substring(0, 2).toUpperCase()) || mapping.initials
        };
        setCurrentUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('soro_user');
        setCurrentUser(null);
    };

    if (isLoading) return null; // Avoid flickering on fresh reload

    return (
        <RoleContext.Provider value={{
            currentUser,
            setRole,
            logout,
            isAuthenticated: !!currentUser
        }}>
            {children}
        </RoleContext.Provider>
    );
};

export const useRole = (): RoleContextType => {
    const ctx = useContext(RoleContext);
    if (!ctx) throw new Error('useRole must be used within a RoleProvider');
    return ctx;
};
