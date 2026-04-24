import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';
import {
  DollarSign, ShoppingCart, Users, CreditCard,
  CheckCircle, Clock, Calendar, TrendingUp, ArrowRight
} from 'lucide-react';

const isToday = (timestamp: number) => {
  const d = new Date(timestamp * 1000);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/admin'); return; }
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await apiFetch('/api/public/admin/orders');
    if (res.ok) { setOrders(await res.json()); }
    else if (res.status === 401) { localStorage.removeItem('admin_token'); navigate('/admin'); }
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) { localStorage.removeItem('admin_token'); navigate('/admin'); }
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
    { label: '客戶數', value: totalCustomers.toLocaleString(), icon: Users, gradient: 'from-purple-500 to-purple-700' },
    { label: '已付款金額', value: `HK$${paidAmount.toLocaleString()}`, icon: CreditCard, gradient: 'from-emerald-500 to-emerald-700' },
    { label: '已付款訂單', value: paidOrders.toLocaleString(), icon: CheckCircle, gradient: 'from-teal-500 to-teal-700' },
    { label: '待付款訂單', value: unpaidOrders.toLocaleString(), icon: Clock, gradient: 'from-amber-500 to-amber-700' },
    { label: '今日訂單', value: todayOrders.toLocaleString(), icon: Calendar, gradient: 'from-indigo-500 to-indigo-700' },
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
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">近7天銷售趨勢</h3>
          <div className="flex items-end gap-3 h-48">
            {salesByDay.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{day.count > 0 ? `${day.count}單` : ''}</span>
                  <div
                    className="w-full max-w-[48px] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-lg transition-all"
                    style={{ height: `${(day.amount / maxDailySales) * 140}px`, minHeight: day.amount > 0 ? '4px' : '0' }}
                    title={`HK$${day.amount.toLocaleString()}`}
                  />
                </div>
                <span className="text-xs text-gray-500">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">付款狀態分佈</h3>
          <div className="space-y-4">
            {paymentData.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-bold text-gray-800">{item.count} 單</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className={`${item.color} h-3 rounded-full transition-all`} style={{ width: `${item.width}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">付款率</span>
              <span className="text-lg font-bold text-green-600">
                {totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">最近訂單</h3>
            <button
              onClick={() => navigate('/admin/orders')}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-gray-400 text-center py-8">暫無訂單</p>
            ) : (
              recentOrders.map(order => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                      {String(order.createdAt).slice(-4)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{order.name}</div>
                      <div className="text-xs text-gray-500">{order.phone} · {order.deliveryDate}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">HK${order.totalPrice}</div>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">快捷統計</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">平均客單價</div>
              <div className="text-2xl font-bold text-gray-800">
                HK${totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">待處理訂單</div>
              <div className="text-2xl font-bold text-amber-600">{unpaidOrders}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">本週訂單</div>
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
            className="w-full mt-4 bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            前往訂單管理
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
