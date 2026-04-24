import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';
import {
  DollarSign, ShoppingCart, Users, CreditCard,
  CheckCircle, Clock, Calendar, TrendingUp
} from 'lucide-react';

interface Filters {
  searchTerm: string;
  deliveryDateStart: string;
  deliveryDateEnd: string;
  paymentStatus: string;
}

const isToday = (timestamp: number) => {
  const d = new Date(timestamp * 1000);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({
    searchTerm: '',
    deliveryDateStart: '',
    deliveryDateEnd: '',
    paymentStatus: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await apiFetch('/api/public/admin/orders');
    if (res.ok) {
      setOrders(await res.json());
    } else {
      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此訂單嗎？')) return;
    const res = await apiFetch(`/api/public/admin/orders/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) fetchOrders();
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) {
      localStorage.removeItem('admin_token');
      navigate('/admin');
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Find referrer by referral code (last 4 digits of phone)
  const getReferrer = (order: any) => {
    if (!order.referralCode) return '-';
    const referrer = orders.find(o => o.phone && o.phone.slice(-4) === order.referralCode && o.id !== order.id);
    return referrer ? referrer.name : '-';
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

  const filteredOrders = orders.filter(order => {
    const orderNum = String(order.createdAt).slice(-4);
    const searchLower = filters.searchTerm.toLowerCase();
    const deliveryDateMatch = !filters.deliveryDateStart && !filters.deliveryDateEnd || (
      order.deliveryDate &&
      (!filters.deliveryDateStart || order.deliveryDate >= filters.deliveryDateStart) &&
      (!filters.deliveryDateEnd || order.deliveryDate <= filters.deliveryDateEnd)
    );
    const paymentStatusMatch = !filters.paymentStatus || (
      filters.paymentStatus === 'paid' ? order.paymentConfirmed === 1 :
      filters.paymentStatus === 'unpaid' ? order.paymentConfirmed === 0 :
      filters.paymentStatus === 'pending_proof' ? (order.paymentConfirmed === 0 && order.paymentProof) :
      true
    );

    return (
      (orderNum.includes(filters.searchTerm) ||
      String(order.id).includes(filters.searchTerm) ||
      (order.name && order.name.toLowerCase().includes(searchLower)) ||
      (order.phone && order.phone.includes(filters.searchTerm)) ||
      (order.items && JSON.stringify(order.items).toLowerCase().includes(searchLower))) &&
      deliveryDateMatch &&
      paymentStatusMatch
    );
  });

  const kpiCards = [
    { label: '總銷售額', value: `HK$${totalSales.toLocaleString()}`, icon: DollarSign, gradient: 'bg-gradient-to-br from-green-500 to-green-700' },
    { label: '總訂單數', value: totalOrders.toLocaleString(), icon: ShoppingCart, gradient: 'bg-gradient-to-br from-blue-500 to-blue-700' },
    { label: '客戶數', value: totalCustomers.toLocaleString(), icon: Users, gradient: 'bg-gradient-to-br from-purple-500 to-purple-700' },
    { label: '已付款金額', value: `HK$${paidAmount.toLocaleString()}`, icon: CreditCard, gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
    { label: '已付款訂單', value: paidOrders.toLocaleString(), icon: CheckCircle, gradient: 'bg-gradient-to-br from-teal-500 to-teal-700' },
    { label: '待付款訂單', value: unpaidOrders.toLocaleString(), icon: Clock, gradient: 'bg-gradient-to-br from-amber-500 to-amber-700' },
    { label: '今日訂單', value: todayOrders.toLocaleString(), icon: Calendar, gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
    { label: '今日銷售額', value: `HK$${todaySales.toLocaleString()}`, icon: TrendingUp, gradient: 'bg-gradient-to-br from-rose-500 to-rose-700' },
  ];

  return (
    <AdminLayout currentPage="dashboard" onLogout={handleLogout}>
      {/* KPI Stats Cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`${card.gradient} rounded-xl p-4 text-white shadow-lg flex items-center justify-between`}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm">
              <card.icon className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium opacity-90">{card.label}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Section */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="搜尋訂單號、姓名、電話..."
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.searchTerm}
          onChange={e => handleFilterChange('searchTerm', e.target.value)}
        />
        <div className="flex gap-2">
          <input
            type="date"
            placeholder="開始日期"
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filters.deliveryDateStart}
            onChange={e => handleFilterChange('deliveryDateStart', e.target.value)}
          />
          <input
            type="date"
            placeholder="結束日期"
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filters.deliveryDateEnd}
            onChange={e => handleFilterChange('deliveryDateEnd', e.target.value)}
          />
        </div>
        <select
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.paymentStatus}
          onChange={e => handleFilterChange('paymentStatus', e.target.value)}
        >
          <option value="">所有付款狀態</option>
          <option value="paid">已付款 (Confirmed)</option>
          <option value="unpaid">未付款 (Unconfirmed)</option>
          <option value="pending_proof">待審核 (Pending Proof)</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-4">ID</th>
              <th className="p-4">訂單號</th>
              <th className="p-4">日期</th>
              <th className="p-4">姓名</th>
              <th className="p-4">產品</th>
              <th className="p-4">總額</th>
              <th className="p-4">配送日期</th>
              <th className="p-4">付款狀態</th>
              <th className="p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id} className="border-t hover:bg-gray-50">
                <td className="p-4">{order.id}</td>
                <td className="p-4 font-mono font-bold text-blue-600">{String(order.createdAt).slice(-4)}</td>
                <td className="p-4">{new Date(order.createdAt * 1000).toLocaleString('zh-HK')}</td>
                <td className="p-4">{order.name}</td>
                <td className="p-4">{
                  (() => {
                    try {
                      const items = JSON.parse(order.items || '[]');
                      return items.map((item: any) =>
                        `${item.packageType === '2-dish-1-soup' ? '2餸1湯' : '3餸1湯'} x${item.quantity}`
                      ).join(', ');
                    } catch { return '-'; }
                  })()
                }</td>
                <td className="p-4 font-bold">HK${order.totalPrice}</td>
                <td className="p-4">{order.deliveryDate}</td>
                <td className="p-4">
                  {order.paymentConfirmed === 1 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">已付款</span>
                  ) : order.paymentProof ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">待審核</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">未付款</span>
                  )}
                </td>
                <td className="p-4 space-x-2">
                  <button onClick={() => navigate(`/admin/orders/${order.id}`)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">編輯</button>
                  <button onClick={() => handleDelete(order.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">刪除</button>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">沒有找到相符的訂單</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
