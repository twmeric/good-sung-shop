import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, ToggleLeft, ToggleRight, Save, X, ChefHat, Soup, Package } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface Product {
  id: number;
  category: 'dish' | 'soup' | 'package';
  name: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  is_active: number;
  stock_quantity: number;
  sort_order: number;
  image_url: string | null;
  max_select: number;
}

interface AdminUser {
  role: string;
}

const categoryLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  dish: { label: '餸菜', icon: ChefHat, color: 'text-orange-600 bg-orange-50' },
  soup: { label: '湯品', icon: Soup, color: 'text-blue-600 bg-blue-50' },
  package: { label: '套餐', icon: Package, color: 'text-green-600 bg-green-50' },
};

const AdminProducts: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'dish' | 'soup' | 'package'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    category: 'dish',
    name: '',
    description: '',
    price: null,
    is_active: 1,
    stock_quantity: 50,
    sort_order: 0,
  });

  const token = localStorage.getItem('admin_token');
  const storedUser = localStorage.getItem('admin_user');
  const user: AdminUser | null = storedUser ? JSON.parse(storedUser) : null;
  const isSupplier = user?.role === 'supplier';

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchProducts();
  }, [token, navigate]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/public/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProducts(await res.json());
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      }
    } catch (e) {
      setError('獲取產品失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, current: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/products/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !current }),
      });
      if (res.ok) fetchProducts();
    } catch (e) {
      setError('操作失敗');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const handleSave = async () => {
    if (!editForm.name) return;
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/products/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchProducts();
      }
    } catch (e) {
      setError('保存失敗');
    }
  };

  const handleAdd = async () => {
    if (!newProduct.name) return;
    try {
      const res = await fetch(`${API_BASE}/api/public/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newProduct),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewProduct({ category: 'dish', name: '', description: '', price: null, is_active: 1, stock_quantity: 50, sort_order: 0 });
        fetchProducts();
      }
    } catch (e) {
      setError('創建失敗');
    }
  };

  const filteredProducts = activeTab === 'all'
    ? products
    : products.filter(p => p.category === activeTab);

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'dish', label: '餸菜' },
    { key: 'soup', label: '湯品' },
    { key: 'package', label: '套餐' },
  ];

  return (
    <AdminLayout currentPage="products">
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b mb-6 rounded-t-lg">
          <nav className="flex space-x-1 px-2" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Add Button */}
        {!isSupplier && (
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              {showAddForm ? '取消' : '新增產品'}
            </button>
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-bold mb-4">新增產品</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類別</label>
                <select
                  value={newProduct.category}
                  onChange={e => setNewProduct({ ...newProduct, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="dish">餸菜</option>
                  <option value="soup">湯品</option>
                  <option value="package">套餐</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>
                <input
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="產品名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">價格</label>
                <input
                  type="number"
                  value={newProduct.price || ''}
                  onChange={e => setNewProduct({ ...newProduct, price: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="HK$"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <input
                  value={newProduct.description || ''}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="產品描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                <input
                  type="number"
                  value={newProduct.sort_order || 0}
                  onChange={e => setNewProduct({ ...newProduct, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">庫存</label>
                <input
                  type="number"
                  value={newProduct.stock_quantity ?? ''}
                  onChange={e => setNewProduct({ ...newProduct, stock_quantity: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="數量"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">創建</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
            </div>
          </div>
        )}

        {/* Products Table */}
        {loading ? (
          <div className="bg-white rounded shadow p-8 text-center text-gray-500">加載中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類別</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">價格</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">庫存</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map(product => {
                  const cat = categoryLabels[product.category] || categoryLabels.dish;
                  const CatIcon = cat.icon;
                  const isEditing = editingId === product.id;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${cat.color}`}>
                          <CatIcon size={14} />
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editForm.name || ''}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{product.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {isEditing ? (
                          <input
                            value={editForm.description || ''}
                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          product.description || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isEditing && product.category === 'package' ? (
                          <input
                            type="number"
                            value={editForm.price || ''}
                            onChange={e => setEditForm({ ...editForm, price: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          product.price ? `HK$${product.price}` : '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.stock_quantity ?? 0}
                            onChange={e => setEditForm({ ...editForm, stock_quantity: parseInt(e.target.value) || 0 })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className={`font-medium ${
                            product.stock_quantity === 0 ? 'text-red-600' :
                            product.stock_quantity < 15 ? 'text-orange-500' : 'text-green-600'
                          }`}>
                            {product.stock_quantity}
                            {product.stock_quantity === 0 && <span className="ml-1 text-xs">(缺貨)</span>}
                            {product.stock_quantity > 0 && product.stock_quantity < 15 && <span className="ml-1 text-xs">(即將售罄)</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => !isEditing && handleToggle(product.id, product.is_active)}
                          className={`flex items-center gap-1 text-sm font-medium ${product.is_active ? 'text-green-600' : 'text-gray-400'}`}
                        >
                          {product.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          {product.is_active ? '啟用' : '停用'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={handleSave} className="text-green-600 hover:text-green-800"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                          </div>
                        ) : (
                          <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800">
                            <Edit2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="p-8 text-center text-gray-500">沒有產品</div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProducts;
