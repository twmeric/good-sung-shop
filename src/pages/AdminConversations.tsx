import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface ConversationItem {
  phone: string;
  lastMessageAt: string;
  createdAt: number;
}

const AdminConversations: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      setLoading(true);
      const res = await apiFetch('/api/public/admin/whatsapp/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin');
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (phone: string) => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await apiFetch(`/api/public/admin/whatsapp/conversations/${phone}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedConversation(data);
        setShowConversationModal(true);
      }
    } catch (e) {
      console.error('Failed to open conversation:', e);
    }
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) {
      localStorage.removeItem('admin_token');
      navigate('/admin');
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchTerm.toLowerCase();
    return conv.phone.includes(searchTerm) || conv.phone.toLowerCase().includes(searchLower);
  }).sort((a, b) => {
    const timeA = new Date(a.lastMessageAt).getTime();
    const timeB = new Date(b.lastMessageAt).getTime();
    return timeB - timeA;
  });

  return (
    <AdminLayout currentPage="conversations" onLogout={handleLogout}>
      <div className="mb-6"></div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="搜尋客戶電話號碼..."
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Conversations List */}
      {loading ? (
        <div className="bg-white rounded shadow p-8 text-center text-gray-500">
          加載中...
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="bg-white rounded shadow p-8 text-center text-gray-500">
          {conversations.length === 0 ? '沒有對話記錄' : '沒有符合條件的對話'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map(conv => (
            <div
              key={conv.phone}
              onClick={() => openConversation(conv.phone)}
              className="bg-white rounded shadow p-4 cursor-pointer hover:shadow-lg hover:bg-purple-50 transition-all border-l-4 border-purple-500"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-semibold text-lg">📱 {conv.phone}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    最後消息：{new Date(conv.lastMessageAt).toLocaleString('zh-HK')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    開始時間：{new Date(conv.createdAt * 1000).toLocaleString('zh-HK')}
                  </div>
                </div>
                <div className="text-purple-600 font-semibold whitespace-nowrap ml-4">查看對話 →</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversation Modal */}
      {showConversationModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-purple-600 p-4 flex justify-between items-center border-b text-white">
              <div>
                <h2 className="text-xl font-bold">對話詳情</h2>
                <p className="text-sm text-purple-100">📱 {selectedConversation.phone}</p>
              </div>
              <button
                onClick={() => setShowConversationModal(false)}
                className="text-2xl hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Conversation History */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3 text-gray-800">對話記錄</h3>
                <div className="bg-gray-50 rounded p-4 space-y-3 max-h-96 overflow-y-auto border border-gray-200">
                  {selectedConversation.conversationHistory && selectedConversation.conversationHistory.length > 0 ? (
                    selectedConversation.conversationHistory.map((msg: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded ${
                          msg.sender === 'user' ? 'bg-blue-100 border-l-4 border-blue-500' : 'bg-green-100 border-l-4 border-green-500'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-sm font-semibold">
                            {msg.sender === 'user' ? '👤 客戶' : '🤖 機器人'}
                          </div>
                          <span className="text-gray-600 text-xs">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-HK') : 'N/A'}
                          </span>
                        </div>
                        <div className="text-sm break-words text-gray-800">{msg.message}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">沒有消息</p>
                  )}
                </div>
              </div>

              {/* Attachments */}
              {selectedConversation.attachments && selectedConversation.attachments.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-gray-800">📎 附件 ({selectedConversation.attachments.length})</h3>
                  <div className="bg-gray-50 rounded p-4 space-y-2 border border-gray-200 max-h-64 overflow-y-auto">
                    {selectedConversation.attachments.map((att: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200 hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-800">{att.filename || `附件 ${idx + 1}`}</div>
                          <div className="text-xs text-gray-600">
                            {att.type && <span className="inline-block mr-2 bg-purple-100 text-purple-800 px-2 py-1 rounded">{att.type}</span>}
                            {att.timestamp && <span>{new Date(att.timestamp).toLocaleString('zh-HK')}</span>}
                          </div>
                        </div>
                        {att.url && (
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:underline text-sm font-semibold ml-2"
                          >
                            下載
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-purple-50 rounded p-4 border border-purple-200">
                <h3 className="font-semibold text-gray-800 mb-3">對話信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 font-semibold">建立時間</div>
                    <div className="text-gray-800">{selectedConversation.createdAt ? new Date(selectedConversation.createdAt * 1000).toLocaleString('zh-HK') : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 font-semibold">最後消息</div>
                    <div className="text-gray-800">{selectedConversation.lastMessageAt ? new Date(selectedConversation.lastMessageAt).toLocaleString('zh-HK') : 'N/A'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-600 font-semibold">消息數量</div>
                    <div className="text-gray-800">{selectedConversation.conversationHistory ? selectedConversation.conversationHistory.length : 0} 條</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminConversations;
