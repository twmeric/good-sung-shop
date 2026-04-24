import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, AlertCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface SettingItem {
  value: string;
  description: string;
}

const defaultSettings: Record<string, SettingItem> = {
  site_name: { value: '好餸社企', description: '網站名稱' },
  business_phone: { value: '85262322466', description: 'WhatsApp 業務電話' },
  admin_phone: { value: '85298536993', description: '管理員通知電話' },
  bank_account: { value: 'DBS A/C - 016-000227829', description: '銀行帳號' },
  fps_id: { value: 'FPS - 108810334', description: 'FPS 轉數快 ID' },
  company_name: { value: 'DELICIOUS EXPRESS LTD', description: '公司名稱' },
  min_days_advance: { value: '2', description: '最少提前預訂天數' },
  delivery_fee: { value: '0', description: '運費 (0 = 免運)' },
};

const AdminSettings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, SettingItem>>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchSettings();
  }, [token, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const merged = { ...defaultSettings };
        for (const [key, item] of Object.entries(data)) {
          if (merged[key]) {
            merged[key] = { ...merged[key], value: (item as any).value || item };
          } else {
            merged[key] = { value: (item as any).value || item, description: (item as any).description || '' };
          }
        }
        setSettings(merged);
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      }
    } catch (e) {
      setError('獲取設置失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload: Record<string, any> = {};
      for (const [key, item] of Object.entries(settings)) {
        payload[key] = { value: item.value, description: item.description };
      }

      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess('設置已保存！');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('保存失敗');
      }
    } catch (e) {
      setError('保存失敗');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  };

  return (
    <AdminLayout currentPage="settings">
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded shadow p-8 text-center text-gray-500">加載中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">系統設置</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(settings).map(([key, item]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {item.description}
                    <span className="ml-2 text-xs text-gray-400 font-mono">({key})</span>
                  </label>
                  <input
                    value={item.value}
                    onChange={e => updateSetting(key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? '保存中...' : '保存設置'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
