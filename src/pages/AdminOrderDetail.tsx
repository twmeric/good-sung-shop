import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Send, MessageCircle, ArrowLeft, Phone, MapPin, User, Calendar, Clock, DollarSign } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface Message {
  id: number;
  phone: string;
  message: string;
  sender: 'user' | 'bot';
  createdAt: number;
}

const AdminOrderDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/admin'); return; }
    fetchOrder();
  }, [id]);

  useEffect(() => {
    if (order?.phone) { fetchChatHistory(order.phone); }
  }, [order]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchOrder = async () => {
    const res = await apiFetch(`/api/public/admin/orders/${id}`);
    if (res.ok) { setOrder(await res.json()); }
    else if (res.status === 401) { localStorage.removeItem('admin_token'); navigate('/admin'); }
    setLoading(false);
  };

  const fetchChatHistory = async (phone: string) => {
    setChatLoading(true);
    try {
      const res = await apiFetch(`/api/public/admin/whatsapp/conversations/${phone}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) { console.error('Failed to fetch chat:', e); }
    finally { setChatLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch(`/api/public/admin/orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
    });
    if (res.ok) { alert('更新成功'); navigate('/admin/orders'); }
    else { alert('更新失敗'); }
  };

  const handleConfirmPayment = async () => {
    if (!confirm('確認已收到此訂單的付款？')) return;
    setConfirming(true);
    const updatedOrder = { ...order, paymentConfirmed: 1 };
    const res = await apiFetch(`/api/public/admin/orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedOrder)
    });
    if (res.ok) {
      setOrder(updatedOrder);
      alert('付款已確認！客戶將收到 WhatsApp 通知。');
    } else { alert('確認失敗'); }
    setConfirming(false);
  };

  const handleSendMessage = async () => {
    if (!order?.phone || !replyText.trim()) return;
    setSendLoading(true);
    try {
      const res = await apiFetch('/api/public/admin/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: order.phone, message: replyText.trim() })
      });
      if (res.ok) {
        setReplyText('');
        await fetchChatHistory(order.phone);
      } else { alert('發送失敗'); }
    } catch (e) { alert('發送失敗'); }
    finally { setSendLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) { localStorage.removeItem('admin_token'); navigate('/admin'); }
  };

  if (loading) return (
    <AdminLayout currentPage="orders" onLogout={handleLogout}>
      <div className="flex items-center justify-center h-64 text-gray-500">加載中...</div>
    </AdminLayout>
  );
  if (!order) return (
    <AdminLayout currentPage="orders" onLogout={handleLogout}>
      <div className="text-center text-gray-500 py-12">訂單不存在</div>
    </AdminLayout>
  );

  const orderItems = (() => {
    try { return JSON.parse(order.items || '[]'); } catch { return []; }
  })();

  return (
    <AdminLayout currentPage="orders" onLogout={handleLogout}>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/admin/orders')} className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> 返回訂單列表
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">訂單 #{String(order.createdAt).slice(-4)}</h1>
          {order.paymentConfirmed === 1 ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">已付款</span>
          ) : order.paymentProof ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">待審核</span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">未付款</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">下單時間：{new Date(order.createdAt * 1000).toLocaleString('zh-HK')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Order Info (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Payment Proof */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              付款記錄
            </h2>
            {order.paymentProof && (!order.uploads || order.uploads.length === 0) && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">付款憑證：</p>
                <a href={order.paymentProof} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline break-all text-sm">
                  {order.paymentProof}
                </a>
              </div>
            )}
            {order.uploads && order.uploads.length > 0 ? (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {order.uploads.map((u: any) => (
                  <div key={u.id} className="border rounded-lg overflow-hidden">
                    {u.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <a href={u.fileUrl} target="_blank" rel="noopener noreferrer">
                        <img src={u.fileUrl} alt="Proof" className="w-full h-24 object-cover hover:opacity-90" />
                      </a>
                    ) : (
                      <a href={u.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-24 text-purple-600 text-xs bg-gray-50">
                        查看文件
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : !order.paymentProof && <p className="text-gray-400 text-sm italic mb-4">暫無付款憑證</p>}

            <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  checked={order.paymentConfirmed === 1}
                  disabled={confirming}
                  onChange={async (e) => {
                    const newValue = e.target.checked ? 1 : 0;
                    if (newValue === 1 && !confirm('確認已收到付款？系統將發送 WhatsApp 通知給客戶。')) return;
                    setConfirming(true);
                    const updatedOrder = { ...order, paymentConfirmed: newValue };
                    const res = await apiFetch(`/api/public/admin/orders/${id}`, {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedOrder)
                    });
                    if (res.ok) { setOrder(updatedOrder); }
                    else { alert('更新失敗'); e.target.checked = !e.target.checked; }
                    setConfirming(false);
                  }}
                />
                <span className={`font-bold ${order.paymentConfirmed ? 'text-green-600' : 'text-gray-600'}`}>
                  {order.paymentConfirmed ? '已確認付款' : '未確認付款'}
                </span>
              </label>
              {!order.paymentConfirmed && (
                <button
                  onClick={handleConfirmPayment}
                  disabled={confirming}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {confirming ? '處理中...' : '一鍵確認付款'}
                </button>
              )}
            </div>
          </div>

          {/* Order Info (Read Only) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">訂單資料（只讀）</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> 姓名</label>
                <div className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">{order.name}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> 電話</label>
                <div className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">{order.phone}</div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> 地址</label>
                <div className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">{order.region} {order.address}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> 配送日期</label>
                <div className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">{order.deliveryDate}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> 配送時間</label>
                <div className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">{order.deliveryTime || '—'}</div>
              </div>
            </div>

            {/* Items */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">套餐內容</label>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                {orderItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.packageType === '2-dish-1-soup' ? '2餸1湯' : '3餸1湯'} x {item.quantity}</span>
                    <span className="font-medium">HK${item.subtotal}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold text-sm">
                  <span>總計</span>
                  <span>HK${order.totalPrice}</span>
                </div>
              </div>
            </div>

            {/* Admin Editable Section */}
            <form onSubmit={handleUpdate} className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">管理員編輯區</h3>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">客戶備註</label>
                <textarea className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none" rows={2} value={order.remarks || ''} onChange={e => setOrder({...order, remarks: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1 text-red-500">管理員備註</label>
                <textarea className="w-full p-2.5 border border-red-200 bg-red-50 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" rows={2} value={order.adminRemarks || ''} onChange={e => setOrder({...order, adminRemarks: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">儲存備註</button>
                <button type="button" onClick={() => navigate('/admin/orders')} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">取消</button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT: WhatsApp Chat (2/5) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-180px)] sticky top-6">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-purple-600 rounded-t-xl">
              <div className="flex items-center gap-2 text-white">
                <MessageCircle className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-sm">客戶對話</h3>
                  <p className="text-xs text-purple-100">{order.phone}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {chatLoading ? (
                <p className="text-center text-gray-400 py-8 text-sm">加載對話中...</p>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">暫無對話記錄</p>
                  <p className="text-gray-400 text-xs mt-1">客戶發送消息後會自動顯示在此</p>
                </div>
              ) : (
                [...messages].reverse().map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'bot'
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                    }`}>
                      <div className="break-words">{msg.message}</div>
                      <div className={`text-xs mt-1 ${msg.sender === 'bot' ? 'text-purple-200' : 'text-gray-400'}`}>
                        {msg.createdAt ? new Date(msg.createdAt * 1000).toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Send Log */}
            {messages.filter(m => m.sender === 'bot').length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400">
                  已發送 {messages.filter(m => m.sender === 'bot').length} 條消息 ·
                  最後發送：{
                    (() => {
                      const lastBot = [...messages].reverse().find(m => m.sender === 'bot');
                      return lastBot?.createdAt
                        ? new Date(lastBot.createdAt * 1000).toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '-';
                    })()
                  }
                </p>
              </div>
            )}

            {/* Reply Input */}
            <div className="p-3 border-t border-gray-200 bg-white rounded-b-xl">
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="輸入消息通知客戶..."
                  rows={2}
                  className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                  disabled={sendLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendLoading || !replyText.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">按 Enter 發送 · Shift+Enter 換行</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderDetail;
