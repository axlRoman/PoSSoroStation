import { useState, useEffect } from 'react';
import { TrendingUp, Users, ShoppingBag, DollarSign, Calendar, Trash2 } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);


const CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            padding: 12,
            displayColors: false,
            callbacks: {
                label: (ctx: { parsed: { y: number | null } }) => ctx.parsed.y != null ? `$${ctx.parsed.y.toFixed(2)}` : ''
            }
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', callback: (v: number | string) => `$${Number(v).toLocaleString()}` }
        },
        x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
        }
    }
};

interface Order {
    id: string;
    created_at: string;
    total: number;
    status: string;
    attended_by?: string;
}

const getLast7Days = () => {
    const days: { label: string; iso: string }[] = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
            label: dayNames[d.getDay()],
            iso: d.toISOString().split('T')[0],
        });
    }
    return days;
};

const Dashboard = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [todaysTotal, setTodaysTotal] = useState(0);
    const [activeOrdersCount, setActiveOrdersCount] = useState(0);
    const [avgTicket, setAvgTicket] = useState(0);
    const [growth, setGrowth] = useState(0);
    const [chartData, setChartData] = useState<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const fetchDashboardData = async () => {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13); // 2 weeks

        const { data: dbOrders, error } = await supabase
            .from('orders')
            .select('id, created_at, total, status, attended_by')
            .gte('created_at', fourteenDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            return;
        }

        if (dbOrders) {
            setOrders(dbOrders.slice(0, 10)); // Top 10 for table

            const today = new Date().toISOString().split('T')[0];

            // 1. Today's metrics
            const todaySum = dbOrders
                .filter(o => o.created_at.startsWith(today) && o.status !== 'cancelado')
                .reduce((sum, o) => sum + Number(o.total), 0);
            setTodaysTotal(todaySum);

            const activeCount = dbOrders.filter(o => o.status === 'preparando' || o.status === 'lista').length;
            setActiveOrdersCount(activeCount);

            // 2. Average Ticket (Real)
            const validOrders = dbOrders.filter(o => o.status !== 'cancelado');
            if (validOrders.length > 0) {
                const totalRev = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
                setAvgTicket(totalRev / validOrders.length);
            }

            // 3. Weekly Growth (WoW)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const currentWeekData = dbOrders.filter(o => new Date(o.created_at) >= sevenDaysAgo && o.status !== 'cancelado');
            const prevWeekData = dbOrders.filter(o => new Date(o.created_at) < sevenDaysAgo && o.status !== 'cancelado');

            const currentTotal = currentWeekData.reduce((sum, o) => sum + Number(o.total), 0);
            const prevTotal = prevWeekData.reduce((sum, o) => sum + Number(o.total), 0);

            if (prevTotal > 0) {
                setGrowth(((currentTotal - prevTotal) / prevTotal) * 100);
            } else {
                setGrowth(currentTotal > 0 ? 100 : 0);
            }

            // 4. Chart grouping
            const days = getLast7Days();
            const dailyTotals = days.map(day => {
                return dbOrders
                    .filter(o => o.created_at.startsWith(day.iso) && o.status !== 'cancelado')
                    .reduce((sum, o) => sum + Number(o.total), 0);
            });

            setChartData({
                labels: days.map(d => d.label),
                datasets: [{
                    label: 'Ingresos ($)',
                    data: dailyTotals,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }]
            });
        }
    };

    useEffect(() => {
        fetchDashboardData();

        const channel = supabase
            .channel('dashboard-orders')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders'
            }, () => {
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) {
            toast.error('Error al actualizar el estado de la orden');
            fetchDashboardData();
        } else {
            toast.success(`Orden actualizada a: ${newStatus}`);
            fetchDashboardData();
        }
    };

    const deleteOrder = async (orderId: string) => {
        const confirm = window.confirm('¿Estás seguro de que deseas eliminar esta orden? Esta acción no se puede deshacer.');
        if (!confirm) return;

        try {
            await supabase.from('order_items').delete().eq('order_id', orderId);
            const { error } = await supabase.from('orders').delete().eq('id', orderId);

            if (error) throw error;

            toast.success('Orden eliminada correctamente');
            fetchDashboardData();
        } catch (error: any) {
            toast.error('Error al eliminar la orden: ' + error.message);
        }
    };

    const formatCurrency = (amt: number) => {
        return `$${amt.toFixed(2)}`;
    };

    const formatTime = (isoString: string) => {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const REAL_METRICS = [
        { id: 1, title: 'Ventas de Hoy', value: formatCurrency(todaysTotal), increase: 'Actualizado ahora', icon: <DollarSign size={24} />, color: 'var(--success-color)' },
        { id: 2, title: 'Órdenes Activas', value: activeOrdersCount.toString(), increase: 'Pendientes', icon: <ShoppingBag size={24} />, color: 'var(--primary-color)' },
        { id: 3, title: 'Ticket Promedio', value: formatCurrency(avgTicket), increase: 'Promedio histórico', icon: <Users size={24} />, color: '#8b5cf6' },
        { id: 4, title: 'Crecimiento WoW', value: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`, increase: 'vs semana anterior', icon: <TrendingUp size={24} />, color: '#f59e0b' },
    ];

    return (
        <div className="dashboard-layout">
            <header className="dashboard-header mb-6">
                <div className="flex justify-between items-center w-full">
                    <div>
                        <h1 className="text-3xl font-bold mb-1 text-white">Panel de Control</h1>
                        <p className="text-secondary text-sm">Resumen operativo y análisis de ventas real</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="dashboard-select-wrapper">
                            <Calendar size={16} className="select-icon" />
                            <select className="dashboard-select">
                                <option>Esta Semana</option>
                                <option>Este Mes</option>
                                <option>Este Año</option>
                            </select>
                        </div>
                        <div className="dashboard-select-wrapper">
                            <select className="dashboard-select">
                                <option>Todas las Sucursales</option>
                                <option>Sucursal Centro</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <div className="metrics-grid">
                {REAL_METRICS.map((metric) => (
                    <div key={metric.id} className="metric-card glass-panel border border-[rgba(255,255,255,0.05)]">
                        <div className="metric-header">
                            <h3 className="metric-title">{metric.title}</h3>
                            <div
                                className="metric-icon"
                                style={{
                                    background: `linear-gradient(135deg, ${metric.color}20 0%, ${metric.color}10 100%)`,
                                    color: metric.color,
                                    boxShadow: `0 4px 12px ${metric.color}15`
                                }}
                            >
                                {metric.icon}
                            </div>
                        </div>
                        <div className="metric-body">
                            <span className="metric-value">{metric.value}</span>
                            <span className="metric-increase" style={{ color: growth >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{metric.increase}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="glass-panel col-span-2 p-6 rounded-2xl">
                    <h2 className="text-xl font-semibold mb-4 text-white">Histórico de Ingresos — Últimos 7 Días</h2>
                    <div className="w-full" style={{ height: '300px' }}>
                        {chartData.labels.length > 0 && <Line data={chartData as any} options={CHART_OPTIONS} />}
                    </div>
                </div>

                <div className="dashboard-table glass-panel col-span-1" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="flex justify-between items-center mb-4 p-4 pb-0">
                        <h2 className="table-title mb-0">Órdenes Recientes</h2>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        <table className="orders-table w-full">
                            <thead>
                                <tr>
                                    <th>Orden UID</th>
                                    <th>Cajero</th>
                                    <th>Total</th>
                                    <th className="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id}>
                                        <td className="font-medium text-white">
                                            {order.id.substring(0, 8).toUpperCase()} <br />
                                            <span className="text-secondary text-xs">{formatTime(order.created_at)}</span>
                                        </td>
                                        <td className="text-secondary text-sm">
                                            {order.attended_by || 'Sistema'}
                                        </td>
                                        <td className="font-bold text-white">{formatCurrency(order.total)}</td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2 items-center">
                                                <select
                                                    className={`status-badge status-${order.status.toLowerCase()}`}
                                                    style={{ appearance: 'none', border: 'none', outline: 'none', textAlign: 'center', cursor: 'pointer' }}
                                                    value={order.status.toLowerCase()}
                                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                >
                                                    <option value="preparando">Prep</option>
                                                    <option value="lista">Lista</option>
                                                    <option value="entregada">OK</option>
                                                </select>
                                                <button
                                                    className="delete-action-btn"
                                                    onClick={() => deleteOrder(order.id)}
                                                    title="Eliminar orden"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center p-4 text-secondary">Aún no hay órdenes.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
