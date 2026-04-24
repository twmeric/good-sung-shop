import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

const AdminOrderDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    const res = await apiFetch(`/api/public/admin/orders/${id}`);
    if (res.ok) {
      setOrder(await res.json());
    } else {
      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin');
      }
    }
    setLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch(`/api/public/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });
    if (res.ok) {
      alert('Updated successfully');
      navigate('/admin/dashboard');
    } else {
      alert('Update failed');
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirm('Confirm payment receipt for this order?')) {
      return;
    }

    setConfirming(true);
    const updatedOrder = { ...order, paymentConfirmed: 1 };

    const res = await apiFetch(`/api/public/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedOrder)
    });

    if (res.ok) {
      setOrder(updatedOrder);
      alert('Payment confirmed! Customer will be notified via WhatsApp.');
    } else {
      alert('Failed to confirm payment');
    }
    setConfirming(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!order) return <div>Order not found</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <button onClick={() => navigate('/admin/dashboard')} className="mb-4 text-blue-500">&larr; Back</button>
      <h1 className="text-2xl font-bold mb-6">Edit Order #{order.id} - {order.orderNum && `(訂單號: ${order.orderNum})`}</h1>
      
      {/* Payment Proof Section */}
      <div className="bg-white p-6 rounded shadow mb-6 border-l-4 border-green-500">
          <h2 className="text-lg font-bold mb-4 text-green-700">付款記錄 (Payment Proof)</h2>
          <div className="space-y-4">
            {/* Original single proof - Only show if no new uploads */}
            {order.paymentProof && (!order.uploads || order.uploads.length === 0) && (
              <div>
                <p className="text-sm text-gray-600 mb-2">付款憑證 (舊)：</p>
                <a href={order.paymentProof} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 underline break-all">
                  {order.paymentProof}
                </a>
              </div>
            )}
            
            {/* New uploads */}
            {order.uploads && order.uploads.length > 0 ? (
               <div>
                 <p className="text-sm text-gray-600 mb-2">上傳文件：</p>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {order.uploads.map((u: any) => (
                     <div key={u.id} className="border p-2 rounded bg-gray-50">
                        {u.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <a href={u.fileUrl} target="_blank" rel="noopener noreferrer">
                            <img src={u.fileUrl} alt="Proof" className="w-full h-32 object-cover rounded hover:opacity-90 transition-opacity" />
                          </a>
                        ) : (
                          <a href={u.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-32 text-blue-500 underline bg-gray-100 rounded">
                            View File
                          </a>
                        )}
                        <div className="text-xs text-gray-500 mt-1 truncate">{new Date(u.uploadedAt * 1000).toLocaleString()}</div>
                     </div>
                   ))}
                 </div>
               </div>
            ) : (
              !order.paymentProof && <p className="text-gray-400 italic">暫無付款憑證</p>
            )}

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600 mb-2">確認狀態：</p>
              <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                <input 
                  type="checkbox" 
                  className="w-6 h-6 text-green-600 rounded focus:ring-green-500"
                  checked={order.paymentConfirmed === 1}
                  disabled={confirming}
                  onChange={async (e) => {
                       const newValue = e.target.checked ? 1 : 0;
                       if (newValue === 1) {
                         if (!confirm('確認已收到付款？系統將發送 WhatsApp 通知給客戶。')) {
                           e.preventDefault();
                           return;
                         }
                       }
                       
                       setConfirming(true);
                       const updatedOrder = { ...order, paymentConfirmed: newValue };
                       // Call API
                       const res = await apiFetch(`/api/public/admin/orders/${id}`, {
                          method: 'PUT',
                          headers: { 
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify(updatedOrder)
                        });
                        
                        if (res.ok) {
                          setOrder(updatedOrder);
                          if (newValue === 1) alert('已確認付款並發送通知！');
                        } else {
                          alert('更新失敗');
                          // Revert UI if failed
                          e.target.checked = !e.target.checked; 
                        }
                        setConfirming(false);
                  }}
                />
                <span className={`font-bold text-lg ${order.paymentConfirmed ? 'text-green-600' : 'text-gray-600'}`}>
                  {order.paymentConfirmed ? '已確認付款 (Confirmed)' : '未確認付款 (Unconfirmed)'}
                </span>
              </label>
            </div>
          </div>
      </div>

      <form onSubmit={handleUpdate} className="bg-white p-6 rounded shadow max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">Name</label>
            <input className="w-full p-2 border rounded" value={order.name} onChange={e => setOrder({...order, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Phone</label>
            <input className="w-full p-2 border rounded" value={order.phone} onChange={e => setOrder({...order, phone: e.target.value})} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-bold mb-1">套餐內容</label>
            <div className="bg-gray-50 p-3 rounded border">
              {(() => {
                try {
                  const items = JSON.parse(order.items || '[]');
                  return items.map((item: any, idx: number) => (
                    <div key={idx} className="mb-1">
                      {item.packageType === '2-dish-1-soup' ? '2餸1湯' : '3餸1湯'} x {item.quantity} = HK${item.subtotal}
                    </div>
                  ));
                } catch { return '-'; }
              })()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Region</label>
            <input className="w-full p-2 border rounded" value={order.region} onChange={e => setOrder({...order, region: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Address</label>
            <input className="w-full p-2 border rounded" value={order.address} onChange={e => setOrder({...order, address: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Date</label>
            <input type="date" className="w-full p-2 border rounded" value={order.deliveryDate} onChange={e => setOrder({...order, deliveryDate: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Time</label>
            <input className="w-full p-2 border rounded" value={order.deliveryTime} onChange={e => setOrder({...order, deliveryTime: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Remarks</label>
          <textarea className="w-full p-2 border rounded" value={order.remarks || ''} onChange={e => setOrder({...order, remarks: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1 text-red-600">Admin Remarks</label>
          <textarea className="w-full p-2 border rounded border-red-200 bg-red-50" value={order.adminRemarks || ''} onChange={e => setOrder({...order, adminRemarks: e.target.value})} />
        </div>
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Save Changes</button>
      </form>
    </div>
  );
};

export default AdminOrderDetail;
