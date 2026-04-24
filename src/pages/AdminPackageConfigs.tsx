import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Edit2, Save, X, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface PackageConfig {
  id: number;
  typeKey: string;
  name: string;
  price: number;
  dishCount: number;
  soupCount: number;
  isActive: number;
  sortOrder: number;
  createdAt: number;
}

const AdminPackageConfigs: React.FC = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<PackageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<PackageConfig>>({});
  const [newConfig, setNewConfig] = useState<Partial<PackageConfig>>({
    typeKey: '',
    name: '',
    price: 0,
    dishCount: 0,
    soupCount: 0,
    sortOrder: 0,
  });

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchConfigs();
  }, [token, navigate]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/public/admin/package-configs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConfigs(await res.json());
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      }
    } catch (e) {
      setError('獲取套餐配置失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, current: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/package-configs/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: current ? 0 : 1 }),
      });
      if (res.ok) {
        fetchConfigs();
      } else {
        const data = await res.json();
        setError(data.error || '切換狀態失敗');
      }
    } catch (e) {
      setError('切換狀態失敗');
    }
  };

  const handleEdit = (config: PackageConfig) => {
    setEditingId(config.id);
    setEditForm({ ...config });
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!editForm.name) {
      setError('請填寫名稱');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/package-configs/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchConfigs();
      } else {
        const data = await res.json();
        setError(data.error || '保存失敗');
      }
    } catch (e) {
      setError('保存失敗');
    }
  };

  const handleAdd = async () => {
    if (!newConfig.typeKey || !newConfig.name) {
      setError('請填寫類型鍵和名稱');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/package-configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewConfig({ typeKey: '', name: '', price: 0, dishCount: 0, soupCount: 0, sortOrder: 0 });
        fetchConfigs();
      } else {
        const data = await res.json();
        setError(data.error || '創建失敗');
      }
    } catch (e) {
      setError('創建失敗');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此套餐配置嗎？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/package-configs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchConfigs();
      } else {
        const data = await res.json();
        setError(data.error || '刪除失敗');
      }
    } catch (e) {
      setError('刪除失敗');
    }
  };

  const isEditing = (id: number) => editingId === id;

  return (
    <AdminLayout currentPage="package-configs">
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Add Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {showAddForm ? '取消' : '新增套餐配置'}
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              新增套餐配置
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類型鍵 *</label>
                <input
                  value={newConfig.typeKey || ''}
                  onChange={e => setNewConfig({ ...newConfig, typeKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="例如：family-set"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label>
                <input
                  value={newConfig.name || ''}
                  onChange={e => setNewConfig({ ...newConfig, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="套餐名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">價格</label>
                <input
                  type="number"
                  value={newConfig.price ?? ''}
                  onChange={e => setNewConfig({ ...newConfig, price: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="HK$"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">餸菜數</label>
                <input
                  type="number"
                  value={newConfig.dishCount ?? ''}
                  onChange={e => setNewConfig({ ...newConfig, dishCount: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">湯數</label>
                <input
                  type="number"
                  value={newConfig.soupCount ?? ''}
                  onChange={e => setNewConfig({ ...newConfig, soupCount: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                <input
                  type="number"
                  value={newConfig.sortOrder ?? ''}
                  onChange={e => setNewConfig({ ...newConfig, sortOrder: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">創建</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
            </div>
          </div>
        )}

        {/* Configs Table */}
        {loading ? (
          <div className="bg-white rounded shadow p-8 text-center text-gray-500">加載中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型鍵</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">價格</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">餸菜數</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">湯數</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">排序</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {configs.map(config => (
                  <tr key={config.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {isEditing(config.id) ? (
                        <input
                          value={editForm.name || ''}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{config.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {isEditing(config.id) ? (
                        <input
                          value={editForm.typeKey || ''}
                          onChange={e => setEditForm({ ...editForm, typeKey: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{config.typeKey}</code>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing(config.id) ? (
                        <input
                          type="number"
                          value={editForm.price ?? ''}
                          onChange={e => setEditForm({ ...editForm, price: e.target.value ? parseInt(e.target.value) : 0 })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        `HK$${config.price}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing(config.id) ? (
                        <input
                          type="number"
                          value={editForm.dishCount ?? ''}
                          onChange={e => setEditForm({ ...editForm, dishCount: e.target.value ? parseInt(e.target.value) : 0 })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        config.dishCount
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing(config.id) ? (
                        <input
                          type="number"
                          value={editForm.soupCount ?? ''}
                          onChange={e => setEditForm({ ...editForm, soupCount: e.target.value ? parseInt(e.target.value) : 0 })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        config.soupCount
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing(config.id) ? (
                        <input
                          type="number"
                          value={editForm.sortOrder ?? ''}
                          onChange={e => setEditForm({ ...editForm, sortOrder: e.target.value ? parseInt(e.target.value) : 0 })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        config.sortOrder
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => !isEditing(config.id) && handleToggle(config.id, config.isActive)}
                        className={`flex items-center gap-1 text-sm font-medium ${config.isActive ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {config.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        {config.isActive ? '啟用' : '停用'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing(config.id) ? (
                        <div className="flex gap-2">
                          <button onClick={handleSave} className="text-green-600 hover:text-green-800"><Save size={18} /></button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(config)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18} /></button>
                          <button onClick={() => handleDelete(config.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {configs.length === 0 && (
              <div className="p-8 text-center text-gray-500">沒有套餐配置</div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPackageConfigs;
