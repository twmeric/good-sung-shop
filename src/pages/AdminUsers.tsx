import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Save, X, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface AdminUserItem {
  id: number;
  username: string;
  role: string;
  display_name: string;
  phone: string;
  is_active: number;
  created_at: number;
}

const roleLabels: Record<string, string> = {
  super_admin: '系統管理員',
  admin: '管理員',
  supplier: '產品供應商',
};

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin',
    display_name: '',
    phone: '',
    is_active: true,
  });

  const [editData, setEditData] = useState<Partial<AdminUserItem>>({});

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchUsers();
  }, [token, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(await res.json());
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      }
    } catch (e) {
      setError('獲取用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.username || !formData.password) {
      setError('請填寫帳號和密碼');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          is_active: formData.is_active ? 1 : 0,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ username: '', password: '', role: 'admin', display_name: '', phone: '', is_active: true });
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || '創建失敗');
      }
    } catch (e) {
      setError('創建失敗');
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        setEditingId(null);
        fetchUsers();
      }
    } catch (e) {
      setError('更新失敗');
    }
  };

  const handleToggle = async (id: number, current: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !current }),
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      setError('操作失敗');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此用戶嗎？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || '刪除失敗');
      }
    } catch (e) {
      setError('刪除失敗');
    }
  };

  const startEdit = (user: AdminUserItem) => {
    setEditingId(user.id);
    setEditData({
      display_name: user.display_name,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
    });
  };

  return (
    <AdminLayout currentPage="users">
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {showForm ? '取消' : '新增管理員'}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-bold mb-4">新增管理員</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">帳號 *</label>
                <input
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密碼 *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="admin">管理員</option>
                  <option value="supplier">產品供應商</option>
                  <option value="super_admin">系統管理員</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">顯示名稱</label>
                <input
                  value={formData.display_name}
                  onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="顯示名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
                <input
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="852xxxxxxx"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">啟用</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">創建</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
            </div>
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <div className="bg-white rounded shadow p-8 text-center text-gray-500">加載中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳號</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">電話</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{user.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{user.username}</td>
                    <td className="px-4 py-3">
                      {editingId === user.id ? (
                        <input
                          value={editData.display_name || ''}
                          onChange={e => setEditData({ ...editData, display_name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        user.display_name || '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === user.id ? (
                        <select
                          value={editData.role || ''}
                          onChange={e => setEditData({ ...editData, role: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="admin">管理員</option>
                          <option value="supplier">產品供應商</option>
                          <option value="super_admin">系統管理員</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {roleLabels[user.role] || user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === user.id ? (
                        <input
                          value={editData.phone || ''}
                          onChange={e => setEditData({ ...editData, phone: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        user.phone || '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => editingId !== user.id && handleToggle(user.id, user.is_active)}
                        className={`flex items-center gap-1 text-sm ${user.is_active ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {user.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === user.id ? (
                        <div className="flex gap-2">
                          <button onClick={handleUpdate} className="text-green-600 hover:text-green-800"><Save size={18} /></button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18} /></button>
                          <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500">沒有用戶</div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
