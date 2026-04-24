import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Image, Copy, Check, Trash2, Loader2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface MediaItem {
  key: string;
  name: string;
  size: number;
  uploaded: string;
  url: string;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const AdminMediaLibrary: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchMedia();
  }, [token, navigate]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/public/admin/media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMediaList(data);
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      } else {
        setError('獲取媒體列表失敗');
      }
    } catch (e) {
      setError('獲取媒體列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('請選擇有效的圖片檔案（JPG、PNG、GIF、WEBP、SVG）');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress since fetch doesn't support upload progress natively
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const res = await fetch(`${API_BASE}/api/public/admin/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (res.ok) {
        await fetchMedia();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '上傳失敗');
        setUploading(false);
        setUploadProgress(0);
      }
    } catch (e) {
      setError('上傳失敗');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCopyUrl = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedKey(item.key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError('複製 URL 失敗');
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`確定要刪除「${item.name}」嗎？此操作無法復原。`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/public/admin/media/${encodeURIComponent(item.name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMediaList(prev => prev.filter(m => m.key !== item.key));
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '刪除失敗');
      }
    } catch (e) {
      setError('刪除失敗');
    }
  };

  return (
    <AdminLayout currentPage="media-library">
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Upload size={20} className="text-blue-600" />
            上傳圖片
          </h2>

          <div className="flex items-center gap-4">
            <label className="flex-1 cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              <div className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Image size={24} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploading ? '正在上傳...' : '點擊選擇圖片檔案'}
                </span>
              </div>
            </label>
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  上傳中...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            加載中...
          </div>
        ) : mediaList.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Image size={48} className="mx-auto mb-3 text-gray-300" />
            <p>尚未上傳任何圖片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mediaList.map(item => (
              <div
                key={item.key}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'flex flex-col items-center justify-center text-gray-400';
                        fallback.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span class="text-xs mt-1">無法顯示</span>`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 truncate" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatSize(item.size)} · {new Date(item.uploaded).toLocaleDateString('zh-HK')}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleCopyUrl(item)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      {copiedKey === item.key ? (
                        <>
                          <Check size={14} />
                          已複製
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          複製 URL
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMediaLibrary;
