import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { RoleProvider, useRole } from './context/RoleContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PointOfSale from './pages/PointOfSale';
import Kitchen from './pages/Kitchen';
import Cashier from './pages/Cashier';
import MenuManager from './pages/MenuManager';
import Login from './pages/Login';

// Helper component for protected routes
const ProtectedRoute = () => {
  const { isAuthenticated } = useRole();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

function App() {
  return (
    <RoleProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'var(--panel-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--panel-border)',
        },
        duration: 3000
      }} />
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes inside Layout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/pos" replace />} />
              <Route path="pos" element={<PointOfSale />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="kitchen" element={<Kitchen />} />
              <Route path="cashier" element={<Cashier />} />
              <Route path="menu" element={<MenuManager />} />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </RoleProvider>
  );
}

export default App;
