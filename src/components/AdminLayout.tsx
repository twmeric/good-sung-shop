import React, { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, ShoppingCart, ChefHat, Briefcase, Users, ClipboardList, Settings, Image, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
  currentPage?: string;
  onLogout?: () => void;
}

interface AdminUser {
  id: number;
  username: string;
  role: string;
  display_name: string;
}

const ALL_MENU_ITEMS = [
  { id: 'dashboard', label: '儀表板', icon: LayoutDashboard, roles: ['super_admin', 'admin'], path: '/admin/dashboard' },
  { id: 'orders', label: '訂單管理', icon: ShoppingCart, roles: ['super_admin', 'admin'], path: '/admin/orders' },
  { id: 'products', label: '產品管理', icon: ChefHat, roles: ['super_admin', 'admin', 'supplier'], path: '/admin/products' },
  { id: 'package-configs', label: '套餐配置', icon: Briefcase, roles: ['super_admin', 'admin'], path: '/admin/package-configs' },
  { id: 'media-library', label: '媒體庫', icon: Image, roles: ['super_admin', 'admin', 'supplier'], path: '/admin/media-library' },
  { id: 'broadcast', label: '廣播推廣', icon: Briefcase, roles: ['super_admin'], path: '/admin/broadcast' },
  { id: 'users', label: '用戶管理', icon: Users, roles: ['super_admin'], path: '/admin/users' },
  { id: 'audit-logs', label: '操作日誌', icon: ClipboardList, roles: ['super_admin'], path: '/admin/audit-logs' },
  { id: 'settings', label: '系統設置', icon: Settings, roles: ['super_admin'], path: '/admin/settings' },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPage, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('admin_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const menuItems = ALL_MENU_ITEMS.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  );

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      if (confirm('確定要登出嗎？')) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin');
      }
    }
  };

  const isCurrentPage = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin': return '系統管理員';
      case 'admin': return '管理員';
      case 'supplier': return '產品供應商';
      default: return role || '';
    }
  };

  return (
    <div className={`flex h-screen ${isDark ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-orange-600 to-orange-800 text-white transition-all duration-300 flex flex-col shadow-lg dark:from-gray-900 dark:to-gray-950`}
      >
        {/* Logo/Header */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-orange-500/50 dark:border-gray-700">
          <div className={`flex items-center gap-2 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="bg-white rounded-lg p-2">
              <LayoutDashboard className="text-orange-600" size={20} />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm">好餸</span>
                <span className="text-xs text-orange-200 dark:text-gray-400">管理後台</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-orange-200 hover:text-white transition-colors dark:text-gray-400"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* User Info */}
        {sidebarOpen && user && (
          <div className="px-4 py-3 border-b border-orange-500/50 dark:border-gray-700">
            <div className="text-sm font-semibold">{user.display_name || user.username}</div>
            <div className="text-xs text-orange-200 dark:text-gray-400">{getRoleLabel(user.role)}</div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = isCurrentPage(item.path);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-orange-700 shadow-md font-semibold dark:bg-gray-700 dark:text-orange-400'
                    : 'text-orange-100 hover:bg-orange-500 hover:text-white dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && (
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-sm">{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle + Logout */}
        <div className="px-3 py-4 border-t border-orange-500/50 dark:border-gray-700 space-y-2">
          <button
            onClick={() => setIsDark(!isDark)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-orange-100 hover:bg-orange-500 hover:text-white transition-all duration-200 dark:text-gray-300 dark:hover:bg-gray-700"
            title={!sidebarOpen ? (isDark ? '亮色模式' : '暗黑模式') : ''}
          >
            {isDark ? <Sun size={20} className="flex-shrink-0" /> : <Moon size={20} className="flex-shrink-0" />}
            {sidebarOpen && <span className="text-sm font-medium">{isDark ? '亮色模式' : '暗黑模式'}</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-orange-100 hover:bg-red-600 hover:text-white transition-all duration-200 dark:text-gray-300"
            title={!sidebarOpen ? '登出' : ''}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">登出</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900 dark:text-gray-300 transition-colors">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm px-6 py-4 flex items-center justify-between transition-colors">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {menuItems.find(item => isCurrentPage(item.path))?.label || '好餸 - 管理後台'}
            </h1>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {new Date().toLocaleDateString('zh-HK', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
