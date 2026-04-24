import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';
import {
  DollarSign, ShoppingCart, Users, CreditCard,
  CheckCircle, Clock, Calendar, TrendingUp, ArrowRight,
  AlertTriangle, Package
} from 'lucide-react';

const isToday = (timestamp: number) => {
  const d = new Date(timestamp * 1000);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/admin'); return; }
    fetchOrders();
    fetchLowStock();
  }, []);

  const fetchOrders = async () => {
    const res = await apiFetch('/api/public/admin/orders');
    if (res.ok) { setOrders(await res.json()); }
    else if (res.status === 401) { localStorage.removeItem('admin_token'); navigate('/admin'); }
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) { localStorage.removeItem('admin_token'); navigate('/admin'); }
  };

  const fetchLowStock = async () => {
    const res = await apiFetch('/api/public/admin/products');
    if (res.ok) {
      const products = await res.json();
      const low = products.filter((p: any) => p.category !== 'package' && p.stock_quantity < 15);
      setLowStockProducts(low.sort((a: any, b: any) => a.stock_quantity - b.stock_quantity));
    }
  };

  // KPI calculations
  const totalSales = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const totalOrders = orders.length;
  const totalCustomers = new Set(orders.map(o => o.phone)).size;
  const paidAmount = orders.filter(o => o.paymentConfirmed).reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const paidOrders = orders.filter(o => o.paymentConfirmed).length;
  const unpaidOrders = orders.filter(o => !o.paymentConfirmed).length;
  const todayOrders = orders.filter(o => isToday(o.createdAt)).length;
  const todaySales = orders.filter(o => isToday(o.createdAt)).reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  // Sales trend (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const salesByDay = last7Days.map(date => ({
    date,
    label: new Date(date).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }),
    amount: orders.filter(o => {
      const orderDate = new Date(o.createdAt * 1000).toISOString().split('T')[0];
      return orderDate === date;
    }).reduce((sum, o) => sum + (o.totalPrice || 0), 0),
    count: orders.filter(o => {
      const orderDate = new Date(o.createdAt * 1000).toISOString().split('T')[0];
      return orderDate === date;
    }).length
  }));
  const maxDailySales = Math.max(...salesByDay.map(d => d.amount), 1);

  // Payment status breakdown
  const pendingProofCount = orders.filter(o => !o.paymentConfirmed && o.paymentProof).length;
  const paymentData = [
    { label: '已付款', count: paidOrders, color: 'bg-green-500', width: totalOrders ? (paidOrders / totalOrders * 100) : 0 },
    { label: '待審核', count: pendingProofCount, color: 'bg-amber-500', width: totalOrders ? (pendingProofCount / totalOrders * 100) : 0 },
    { label: '未付款', count: unpaidOrders - pendingProofCount, color: 'bg-red-500', width: totalOrders ? ((unpaidOrders - pendingProofCount) / totalOrders * 100) : 0 },
  ];

  // Recent orders (top 5)
  const recentOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const kpiCards = [
    { label: '總銷售額', value: `HK$${totalSales.toLocaleString()}`, icon: DollarSign, gradient: 'from-green-500 to-green-700' },
    { label: '總訂單數', value: totalOrders.toLocaleString(), icon: ShoppingCart, gradient: 'from-blue-500 to-blue-700' },
    { label: '客戶數', value: totalCustomers.toLocaleString(), icon: Users, gradient: 'from-orange-500 to-orange-700' },
    { label: '已付款金額', value: `HK$${paidAmount.toLocaleString()}`, icon: CreditCard, gradient: 'from-emerald-500 to-emerald-700' },
    { label: '已付款訂單', value: paidOrders.toLocaleString(), icon: CheckCircle, gradient: 'from-teal-500 to-teal-700' },
    { label: '待付款訂單', value: unpaidOrders.toLocaleString(), icon: Clock, gradient: 'from-amber-500 to-amber-700' },
    { label: '今日訂單', value: todayOrders.toLocaleString(), icon: Calendar, gradient: 'from-orange-500 to-orange-700' },
    { label: '今日銷售額', value: `HK$${todaySales.toLocaleString()}`, icon: TrendingUp, gradient: 'from-rose-500 to-rose-700' },
  ];

  return (
    <AdminLayout currentPage="dashboard" onLogout={handleLogout}>
      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`bg-gradient-to-br ${card.gradient} rounded-xl p-4 text-white shadow-lg flex items-center justify-between`}>
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm">
              <card.icon className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium opacity-90">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sales Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">近7天銷售趨勢</h3>
          <div className="flex items-end gap-3 h-48">
            {salesByDay.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">{day.count > 0 ? `${day.count}單` : ''}</span>
                  <div
                    className="w-full max-w-[48px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-lg transition-all"
                    style={{ height: `${(day.amount / maxDailySales) * 140}px`, minHeight: day.amount > 0 ? '4px' : '0' }}
                    title={`HK$${day.amount.toLocaleString()}`}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">付款狀態分佈</h3>
          <div className="space-y-4">
            {paymentData.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className="font-bold text-gray-800 dark:text-white">{item.count} 單</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div className={`${item.color} h-3 rounded-full transition-all`} style={{ width: `${item.width}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">付款率</span>
              <span className="text-lg font-bold text-green-600">
                {totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">庫存預警</h3>
            <span className="text-sm text-orange-600 font-medium">({lowStockProducts.length} 項)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {lowStockProducts.map(p => (
              <div
                key={p.id}
                onClick={() => navigate('/admin/products')}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                  p.stock_quantity === 0
                    ? 'bg-red-50 border-red-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">{p.category === 'dish' ? '餸菜' : '湯品'}</div>
                <div className="font-medium text-gray-800 dark:text-gray-300 text-sm truncate">{p.name}</div>
                <div className={`text-lg font-bold ${
                  p.stock_quantity === 0 ? 'text-red-600' : 'text-orange-600'
                }`}>
                  {p.stock_quantity}
                  <span className="text-xs font-normal ml-1">
                    {p.stock_quantity === 0 ? '(缺貨)' : '(即將售罄)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">最近訂單</h3>
            <button
              onClick={() => navigate('/admin/orders')}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-center py-8">暫無訂單</p>
            ) : (
              recentOrders.map(order => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                      {String(order.createdAt).slice(-4)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-300">{order.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{order.phone} · {order.deliveryDate}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800 dark:text-gray-300">HK${order.totalPrice}</div>
                    <div>
                      {order.paymentConfirmed === 1 ? (
                        <span className="text-xs text-green-600 font-medium">已付款</span>
                      ) : order.paymentProof ? (
                        <span className="text-xs text-amber-600 font-medium">待審核</span>
                      ) : (
                        <span className="text-xs text-red-600 font-medium">未付款</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">快捷統計</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">平均客單價</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                HK${totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">待處理訂單</div>
              <div className="text-2xl font-bold text-amber-600">{unpaidOrders}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">本週訂單</div>
              <div className="text-2xl font-bold text-blue-600">
                {orders.filter(o => {
                  const d = new Date(o.createdAt * 1000);
                  const now = new Date();
                  const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
                  return d >= weekAgo;
                }).length}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/orders')}
            className="w-full mt-4 bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            前往訂單管理
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
