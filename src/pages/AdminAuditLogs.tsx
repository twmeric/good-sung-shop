import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface AuditLog {
  id: number;
  admin_id: number;
  admin_username: string;
  admin_role: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  ip_address: string;
  created_at: number;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  CREATE: { label: '創建', color: 'bg-green-100 text-green-800' },
  UPDATE: { label: '更新', color: 'bg-blue-100 text-blue-800' },
  DELETE: { label: '刪除', color: 'bg-red-100 text-red-800' },
  LOGIN: { label: '登入', color: 'bg-purple-100 text-purple-800' },
  LOGOUT: { label: '登出', color: 'bg-gray-100 text-gray-800' },
};

const targetTypeLabels: Record<string, string> = {
  order: '訂單',
  product: '產品',
  user: '用戶',
  campaign: '活動',
  setting: '設置',
};

const AdminAuditLogs: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
  const [filterAdmin, setFilterAdmin] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const token = localStorage.getItem('admin_token');
  const limit = 50;

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchLogs();
  }, [token, navigate, offset, filterAction, filterTarget, filterAdmin, filterStartDate, filterEndDate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      if (filterAction) params.append('action', filterAction);
      if (filterTarget) params.append('target_type', filterTarget);
      if (filterAdmin) params.append('admin_username', filterAdmin);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);

      const res = await fetch(`${API_BASE}/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        setHasMore(data.length === limit);
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      }
    } catch (e) {
      setError('獲取日誌失敗');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString('zh-HK');
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  return (
    <AdminLayout currentPage="audit-logs">
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center mb-3">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">篩選：</span>
            </div>
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setOffset(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">所有操作</option>
              <option value="CREATE">創建</option>
              <option value="UPDATE">更新</option>
              <option value="DELETE">刪除</option>
              <option value="LOGIN">登入</option>
              <option value="COMPLETE">完成</option>
            </select>
            <select
              value={filterTarget}
              onChange={e => { setFilterTarget(e.target.value); setOffset(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">所有類型</option>
              <option value="order">訂單</option>
              <option value="product">產品</option>
              <option value="user">用戶</option>
              <option value="setting">設置</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input
              type="text"
              value={filterAdmin}
              onChange={e => { setFilterAdmin(e.target.value); setOffset(0); }}
              placeholder="管理員名稱"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
            />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm text-gray-500">日期範圍：</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => { setFilterStartDate(e.target.value); setOffset(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-400">至</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => { setFilterEndDate(e.target.value); setOffset(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {(filterAction || filterTarget || filterAdmin || filterStartDate || filterEndDate) && (
              <button
                onClick={() => {
                  setFilterAction('');
                  setFilterTarget('');
                  setFilterAdmin('');
                  setFilterStartDate('');
                  setFilterEndDate('');
                  setOffset(0);
                }}
                className="text-sm text-red-500 hover:text-red-700 underline"
              >
                清除篩選
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="bg-white rounded shadow p-8 text-center text-gray-500">加載中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用戶</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">目標ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳情</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(log => {
                  const actionInfo = actionLabels[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800' };
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{log.admin_username}</div>
                        <div className="text-xs text-gray-400">{log.admin_role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {targetTypeLabels[log.target_type] || log.target_type}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">{log.target_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.details ? JSON.stringify(parseDetails(log.details)).slice(0, 80) + (JSON.stringify(parseDetails(log.details)).length > 80 ? '...' : '') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">{log.ip_address || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="p-8 text-center text-gray-500">沒有日誌記錄</div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} className="mr-1" /> 上一頁
          </button>
          <span className="text-sm text-gray-500">
            第 {offset + 1} - {offset + logs.length} 條
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={!hasMore}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            下一頁 <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLogs;
