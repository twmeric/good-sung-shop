import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/public/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('admin_token', data.token);
        if (data.user) {
          localStorage.setItem('admin_user', JSON.stringify(data.user));
        }
        // Redirect based on role
        const role = data.user?.role || 'admin';
        if (role === 'supplier') {
          navigate('/admin/products');
        } else {
          navigate('/admin/dashboard');
        }
      } else {
        setError(data.error || '帳號或密碼錯誤');
      }
    } catch (e) {
      setError('網絡錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">管理員登入</h2>
        <p className="text-center text-gray-500 mb-6">好餸社企後台管理系統</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-lg">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-lg font-bold text-gray-700 mb-2">帳號</label>
          <input
            className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            type="text"
            placeholder="admin"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-700 mb-2">密碼</label>
          <input
            className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            type="password"
            placeholder="admin360"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button
          className="w-full bg-brand-600 text-white text-xl font-bold py-4 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
          disabled={loading}
        >
          {loading ? '登入中...' : '登入'}
        </button>

        <div className="mt-4 text-center text-sm text-gray-400">
          <p>預設帳號：superadmin / superadmin360</p>
          <p>admin / admin360 | supplier / supplier360</p>
        </div>
      </form>
    </div>
  );
};

export default AdminLogin;
