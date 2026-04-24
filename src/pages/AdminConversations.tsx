import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, MessageCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface ConversationItem {
  phone: string;
  lastMessageAt: number;
  messageCount: number;
}

interface Message {
  id: number;
  phone: string;
  message: string;
  sender: 'user' | 'bot';
  createdAt: number;
}

const AdminConversations: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchConversations();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchConversations = async () => {
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
    try {
      const res = await apiFetch(`/api/public/admin/whatsapp/conversations/${phone}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPhone(data.phone);
        setMessages(data.messages || []);
        setShowModal(true);
      }
    } catch (e) {
      console.error('Failed to open conversation:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedPhone || !replyText.trim()) return;

    setSendLoading(true);
    try {
      const res = await apiFetch('/api/public/admin/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone, message: replyText.trim() })
      });

      if (res.ok) {
        setReplyText('');
        // Refresh messages
        await openConversation(selectedPhone);
      } else {
        alert('發送失敗，請稍後再試');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      alert('發送失敗');
    } finally {
      setSendLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) {
      localStorage.removeItem('admin_token');
      navigate('/admin');
    }
  };

  const filteredConversations = conversations
    .filter(conv => conv.phone.includes(searchTerm))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

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
                    最後消息：{conv.lastMessageAt ? new Date(conv.lastMessageAt * 1000).toLocaleString('zh-HK') : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    消息數量：{conv.messageCount || 0} 條
                  </div>
                </div>
                <div className="text-purple-600 font-semibold whitespace-nowrap ml-4">查看對話 →</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversation Modal */}
      {showModal && selectedPhone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-purple-600 p-4 flex justify-between items-center border-b text-white rounded-t-lg">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <div>
                  <h2 className="text-xl font-bold">對話詳情</h2>
                  <p className="text-sm text-purple-100">📱 {selectedPhone}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-2xl hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">沒有消息</p>
              ) : (
                [...messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'bot' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.sender === 'bot'
                          ? 'bg-purple-600 text-white rounded-br-none'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <div className="text-sm mb-1 break-words">{msg.message}</div>
                      <div
                        className={`text-xs ${
                          msg.sender === 'bot' ? 'text-purple-200' : 'text-gray-400'
                        }`}
                      >
                        {msg.createdAt ? new Date(msg.createdAt * 1000).toLocaleString('zh-HK') : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t bg-white rounded-b-lg">
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="輸入回覆訊息... (按 Enter 發送)"
                  rows={2}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                  disabled={sendLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendLoading || !replyText.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendLoading ? '發送中...' : '發送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminConversations;
