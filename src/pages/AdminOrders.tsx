import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';
import { Download } from 'lucide-react';

interface Order {
  id: number;
  orderNum: string;
  createdAt: number;
  name: string;
  phone: string;
  estate: string | null;
  items: any[];
  totalPrice: number;
  deliveryDate: string;
  paymentConfirmed: number;
  orderCompleted: number;
  paymentProof?: string;
  referralCode?: string;
}

interface Filters {
  searchTerm: string;
  deliveryDateStart: string;
  deliveryDateEnd: string;
  paymentStatus: string;
}

const getOrderStatus = (order: Order) => {
  if (order.paymentConfirmed === 0) {
    return { label: '待付款', color: 'bg-red-100 text-red-700' };
  }
  if (order.paymentConfirmed === 1 && order.orderCompleted === 0) {
    return { label: '已付款', color: 'bg-orange-100 text-orange-700' };
  }
  if (order.orderCompleted === 1) {
    return { label: '訂單完成', color: 'bg-green-100 text-green-700' };
  }
  return { label: '未知', color: 'bg-gray-100 text-gray-700' };
};

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
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

  const handleComplete = async (id: number) => {
    const res = await apiFetch(`/api/public/admin/orders/${id}/complete`, {
      method: 'POST'
    });
    if (res.ok) {
      fetchOrders();
    }
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

  const getReferrer = (order: Order) => {
    if (!order.referralCode) return '-';
    const referrer = orders.find(o => o.phone && o.phone.slice(-4) === order.referralCode && o.id !== order.id);
    return referrer ? referrer.name : '-';
  };

  const clearFilters = () => {
    setFilters({ searchTerm: '', deliveryDateStart: '', deliveryDateEnd: '', paymentStatus: '' });
  };

  const exportToCSV = () => {
    const headers = ['訂單號', '下單日期', '姓名', '電話', '屋苑', '地址', '配送日期', '產品詳情', '總額(HK$)', '付款狀態', '訂單狀態', '備註'];
    const rows = filteredOrders.map(order => {
      let productDetail = '';
      try {
        const items = JSON.parse(order.items || '[]');
        productDetail = items.map((item: any) => {
          const pkg = item.packageType === '2-dish-1-soup' ? '2餸1湯' : '3餸1湯';
          const dishes = (item.selectedDishes || []).join('+');
          const soup = item.selectedSoup || '';
          return `${pkg}x${item.quantity}(${dishes};${soup})`;
        }).join('; ');
      } catch { productDetail = ''; }

      const status = getOrderStatus(order);

      return [
        order.orderNum || String(order.createdAt).slice(-4),
        new Date(order.createdAt * 1000).toLocaleDateString('zh-HK'),
        order.name,
        order.phone,
        order.estate || '',
        '', // address not in current data
        order.deliveryDate,
        productDetail,
        order.totalPrice,
        order.paymentConfirmed === 1 ? '已付款' : order.paymentProof ? '待審核' : '未付款',
        status.label,
        '', // remarks not in current data
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      (order.estate && order.estate.includes(filters.searchTerm)) ||
      (order.items && JSON.stringify(order.items).toLowerCase().includes(searchLower))) &&
      deliveryDateMatch &&
      paymentStatusMatch
    );
  });

  const hasActiveFilters = filters.searchTerm || filters.deliveryDateStart || filters.deliveryDateEnd || filters.paymentStatus;

  return (
    <AdminLayout currentPage="orders" onLogout={handleLogout}>
      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">搜尋</label>
            <input
              type="text"
              placeholder="訂單號、姓名、電話..."
              className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              value={filters.searchTerm}
              onChange={e => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">配送日期範圍</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                value={filters.deliveryDateStart}
                onChange={e => handleFilterChange('deliveryDateStart', e.target.value)}
              />
              <span className="flex items-center text-gray-400 px-1">~</span>
              <input
                type="date"
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                value={filters.deliveryDateEnd}
                onChange={e => handleFilterChange('deliveryDateEnd', e.target.value)}
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">付款狀態</label>
            <select
              className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white"
              value={filters.paymentStatus}
              onChange={e => handleFilterChange('paymentStatus', e.target.value)}
            >
              <option value="">全部狀態</option>
              <option value="paid">已付款</option>
              <option value="unpaid">未付款</option>
              <option value="pending_proof">待審核</option>
            </select>
          </div>
          <div className="md:col-span-1 flex items-center justify-end gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-bold text-gray-800">{filteredOrders.length}</span> 筆
              {hasActiveFilters && <span className="text-purple-600 text-xs ml-1">（已篩選）</span>}
            </div>
            <button
              onClick={exportToCSV}
              disabled={filteredOrders.length === 0}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 border border-green-200 rounded hover:bg-green-50 disabled:opacity-40"
              title="導出當前篩選結果為 CSV"
            >
              <Download size={14} /> CSV
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 border border-purple-200 rounded hover:bg-purple-50"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="p-4">ID</th>
              <th className="p-4">訂單號</th>
              <th className="p-4">下單日期</th>
              <th className="p-4">姓名</th>
              <th className="p-4">電話</th>
              <th className="p-4">屋苑</th>
              <th className="p-4">產品</th>
              <th className="p-4">總額</th>
              <th className="p-4">配送日期</th>
              <th className="p-4">訂單狀態</th>
              <th className="p-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.map(order => {
              const status = getOrderStatus(order);
              return (
                <tr key={order.id} className="hover:bg-purple-50 transition-colors">
                  <td className="p-4 text-sm text-gray-600">{order.id}</td>
                  <td className="p-4 font-mono font-bold text-purple-600 text-sm">{String(order.createdAt).slice(-4)}</td>
                  <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{new Date(order.createdAt * 1000).toLocaleDateString('zh-HK')}</td>
                  <td className="p-4 text-sm font-medium text-gray-800">{order.name}</td>
                  <td className="p-4 text-sm text-gray-600">{order.phone}</td>
                  <td className="p-4 text-sm text-gray-600">{order.estate || '-'}</td>
                  <td className="p-4 text-sm text-gray-600 max-w-xs">
                    {(() => {
                      try {
                        const items = JSON.parse(order.items || '[]');
                        return items.map((item: any) =>
                          `${item.packageType === '2-dish-1-soup' ? '2餸1湯' : '3餸1湯'} x${item.quantity}`
                        ).join(', ');
                      } catch { return '-'; }
                    })()}
                  </td>
                  <td className="p-4 text-sm font-bold text-gray-800">HK${order.totalPrice}</td>
                  <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{order.deliveryDate}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="p-4 space-x-1">
                    <button onClick={() => navigate(`/admin/orders/${order.id}`)} className="bg-blue-500 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-600 transition-colors">詳情</button>
                    {order.paymentConfirmed === 1 && order.orderCompleted === 0 && (
                      <button onClick={() => handleComplete(order.id)} className="bg-green-500 text-white px-3 py-1.5 rounded text-xs hover:bg-green-600 transition-colors">標記完成</button>
                    )}
                    <button onClick={() => handleDelete(order.id)} className="bg-red-500 text-white px-3 py-1.5 rounded text-xs hover:bg-red-600 transition-colors">刪除</button>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-gray-500">
                  {orders.length === 0 ? '暫無訂單' : '沒有找到相符的訂單'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
