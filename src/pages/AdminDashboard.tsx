import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface Filters {
  searchTerm: string;
  deliveryDate: string;
  adminRemark: string;
  referrer: string;
  campaignName: string;
  paymentStatus: string;
}

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({
    searchTerm: '',
    deliveryDate: '',
    adminRemark: '',
    referrer: '',
    campaignName: '',
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

  const filteredOrders = orders.filter(order => {
    const orderNum = String(order.createdAt).slice(-4);
    const searchLower = filters.searchTerm.toLowerCase();
    const deliveryDateMatch = !filters.deliveryDate || (order.deliveryDate && order.deliveryDate.includes(filters.deliveryDate));
    const adminRemarkMatch = !filters.adminRemark || (order.adminRemarks && order.adminRemarks.toLowerCase().includes(filters.adminRemark.toLowerCase()));
    const referrerMatch = !filters.referrer || getReferrer(order).toLowerCase().includes(filters.referrer.toLowerCase());
    const campaignMatch = !filters.campaignName || (order.campaignName && order.campaignName.toLowerCase().includes(filters.campaignName.toLowerCase()));
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
      adminRemarkMatch &&
      referrerMatch &&
      campaignMatch &&
      paymentStatusMatch
    );
  });

  return (
    <AdminLayout currentPage="dashboard" onLogout={handleLogout}>
      <div className="mb-6"></div>
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <input 
          type="text"
          placeholder="搜尋訂單號、姓名、電話..." 
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.searchTerm}
          onChange={e => handleFilterChange('searchTerm', e.target.value)}
        />
        <input 
          type="text"
          placeholder="按配送日期篩選..." 
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.deliveryDate}
          onChange={e => handleFilterChange('deliveryDate', e.target.value)}
        />
        <input 
          type="text"
          placeholder="按 Campaign 篩選..." 
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.campaignName}
          onChange={e => handleFilterChange('campaignName', e.target.value)}
        />
        <input 
          type="text"
          placeholder="按管理員備註篩選..." 
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.adminRemark}
          onChange={e => handleFilterChange('adminRemark', e.target.value)}
        />
        <input 
          type="text"
          placeholder="按推薦人篩選..." 
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.referrer}
          onChange={e => handleFilterChange('referrer', e.target.value)}
        />
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

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-4">ID</th>
              <th className="p-4">訂單號</th>
              <th className="p-4">日期</th>
              <th className="p-4">Campaign</th>
              <th className="p-4">姓名</th>
              <th className="p-4">產品</th>
              <th className="p-4">總額</th>
              <th className="p-4">配送日期</th>
              <th className="p-4">推薦人</th>
              <th className="p-4">管理員備註</th>
              <th className="p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id} className="border-t hover:bg-gray-50">
                <td className="p-4">{order.id}</td>
                <td className="p-4 font-mono font-bold text-blue-600">{String(order.createdAt).slice(-4)}</td>
                <td className="p-4">{new Date(order.createdAt * 1000).toLocaleString('zh-HK')}</td>
                <td className="p-4 text-sm font-semibold text-purple-600">{order.campaignName || '-'}</td>
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
                <td className="p-4">{getReferrer(order)}</td>
                <td className="p-4 max-w-xs truncate" title={order.adminRemarks || ''}>{order.adminRemarks || '-'}</td>
                <td className="p-4 space-x-2">
                  <button onClick={() => navigate(`/admin/orders/${order.id}`)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">編輯</button>
                  <button onClick={() => handleDelete(order.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">刪除</button>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-gray-500">沒有找到相符的訂單</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
