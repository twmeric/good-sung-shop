import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, Save, AlertCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface Campaign {
  id: number;
  scenarioKey: string;
  name: string;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

interface LandingPageConfig {
  title: string;
  description: string;
  heroImage?: string;
  ctaButtonText: string;
  ctaButtonColor: string;
}

interface ReferralConfig {
  referralRewardPoints: number;
  referrerRewardPoints: number;
  referralDiscountPercentage: number;
  minOrderAmountForReferral: number;
  referralCodePrefix: string;
}

interface CampaignSettings {
  name: string;
  isActive: boolean;
  landingPageConfig: LandingPageConfig;
  referralConfig: ReferralConfig;
}

const AdminCampaignSettings: React.FC = () => {
  const navigate = useNavigate();
  const { scenarioKey } = useParams<{ scenarioKey: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'landing' | 'referral'>('basic');

  const [settings, setSettings] = useState<CampaignSettings>({
    name: '',
    isActive: true,
    landingPageConfig: {
      title: '',
      description: '',
      heroImage: '',
      ctaButtonText: '立即訂購',
      ctaButtonColor: '#ea580c'
    },
    referralConfig: {
      referralRewardPoints: 100,
      referrerRewardPoints: 50,
      referralDiscountPercentage: 10,
      minOrderAmountForReferral: 200,
      referralCodePrefix: 'GS'
    }
  });

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token || !scenarioKey) {
      navigate('/admin');
      return;
    }
    fetchCampaignSettings();
  }, [token, scenarioKey, navigate]);

  const fetchCampaignSettings = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(
        `/api/public/admin/scenarios/${scenarioKey}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('admin_token');
          navigate('/admin');
          return;
        }
        throw new Error('獲取活動設置失敗');
      }

      const data = await response.json();
      setCampaign(data);

      // Populate settings from campaign data
      const config = data.config || {};
      setSettings({
        name: data.name || '',
        isActive: data.isActive === 1,
        landingPageConfig: config.landingPageConfig || {
          title: '',
          description: '',
          heroImage: '',
          ctaButtonText: '立即訂購',
          ctaButtonColor: '#ea580c'
        },
        referralConfig: config.referralConfig || {
          referralRewardPoints: 100,
          referrerRewardPoints: 50,
          referralDiscountPercentage: 10,
          minOrderAmountForReferral: 200,
          referralCodePrefix: 'GS'
        }
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入活動設置失敗');
      console.error('Error fetching campaign settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!campaign || !scenarioKey) return;

    try {
      setSaving(true);
      setError(null);

      const response = await apiFetch(
        `/api/public/admin/scenarios/${scenarioKey}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: settings.name,
            isActive: settings.isActive ? 1 : 0,
            config: {
              landingPageConfig: settings.landingPageConfig,
              referralConfig: settings.referralConfig
            }
          })
        }
      );

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error('Failed to parse response:', parseErr, 'Response text:', text);
        throw new Error(`Server error: ${text}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.statusText}`);
      }

      setSuccess('設置儲存成功');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : '儲存設置失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

  if (!token) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">加載中...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600">找不到活動</div>
      </div>
    );
  }

  return (
    <AdminLayout currentPage="campaigns" onLogout={handleLogout}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate('/admin/campaigns')}
            className="text-orange-600 hover:text-orange-800 text-sm flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> 返回活動列表
          </button>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          活動設置：{campaign.name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">場景鍵：{campaign.scenarioKey}</p>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex justify-between items-center">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 mb-6 rounded-t-lg">
          <nav className="flex space-x-8 px-6" aria-label="Settings Tabs">
            {(['basic', 'landing', 'referral'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                {tab === 'basic' && '基本設置'}
                {tab === 'landing' && '落地頁'}
                {tab === 'referral' && '推薦計劃'}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-b-lg shadow p-6">
          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">活動基本設置</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    活動名稱
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                    placeholder="活動名稱"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    推廣連結
                  </label>
                  <div className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 break-all">
                    https://goodstore.jkdcoding.com/?scenarioKey={campaign.scenarioKey}
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.isActive}
                    onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    活動已啟用
                  </span>
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {settings.isActive
                    ? '此活動目前啟用中，客戶可通過推廣連結訪問。'
                    : '此活動已停用，客戶無法通過推廣連結訪問。'}
                </p>
              </div>
            </div>
          )}

          {/* Landing Page Settings Tab */}
          {activeTab === 'landing' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">落地頁配置</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  頁面標題
                </label>
                <input
                  type="text"
                  value={settings.landingPageConfig.title}
                  onChange={(e) => setSettings({
                    ...settings,
                    landingPageConfig: {
                      ...settings.landingPageConfig,
                      title: e.target.value
                    }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  placeholder="例如：新鮮餸菜包"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  頁面描述
                </label>
                <textarea
                  value={settings.landingPageConfig.description}
                  onChange={(e) => setSettings({
                    ...settings,
                    landingPageConfig: {
                      ...settings.landingPageConfig,
                      description: e.target.value
                    }
                  })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  placeholder="活動描述和詳情"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    按鈕文字
                  </label>
                  <input
                    type="text"
                    value={settings.landingPageConfig.ctaButtonText}
                    onChange={(e) => setSettings({
                      ...settings,
                      landingPageConfig: {
                        ...settings.landingPageConfig,
                        ctaButtonText: e.target.value
                      }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                    placeholder="立即訂購"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    按鈕顏色
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={settings.landingPageConfig.ctaButtonColor}
                      onChange={(e) => setSettings({
                        ...settings,
                        landingPageConfig: {
                          ...settings.landingPageConfig,
                          ctaButtonColor: e.target.value
                        }
                      })}
                      className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.landingPageConfig.ctaButtonColor}
                      onChange={(e) => setSettings({
                        ...settings,
                        landingPageConfig: {
                          ...settings.landingPageConfig,
                          ctaButtonColor: e.target.value
                        }
                      })}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                      placeholder="#ea580c"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  主圖片 URL
                </label>
                <input
                  type="url"
                  value={settings.landingPageConfig.heroImage || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    landingPageConfig: {
                      ...settings.landingPageConfig,
                      heroImage: e.target.value
                    }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  placeholder="https://example.com/hero-image.jpg"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">可選：主圖/橫幅圖片 URL</p>
              </div>
            </div>
          )}

          {/* Referral Settings Tab */}
          {activeTab === 'referral' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">推薦計劃配置</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    推薦碼前綴
                  </label>
                  <input
                    type="text"
                    value={settings.referralConfig.referralCodePrefix}
                    onChange={(e) => setSettings({
                      ...settings,
                      referralConfig: {
                        ...settings.referralConfig,
                        referralCodePrefix: e.target.value
                      }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                    placeholder="GS"
                    maxLength={5}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">生成的推薦碼前綴</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    被推薦人積分
                  </label>
                  <input
                    type="number"
                    value={settings.referralConfig.referralRewardPoints}
                    onChange={(e) => setSettings({
                      ...settings,
                      referralConfig: {
                        ...settings.referralConfig,
                        referralRewardPoints: Math.max(0, parseInt(e.target.value) || 0)
                      }
                    })}
                    min={0}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    推薦人積分
                  </label>
                  <input
                    type="number"
                    value={settings.referralConfig.referrerRewardPoints}
                    onChange={(e) => setSettings({
                      ...settings,
                      referralConfig: {
                        ...settings.referralConfig,
                        referrerRewardPoints: Math.max(0, parseInt(e.target.value) || 0)
                      }
                    })}
                    min={0}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    推薦折扣 %
                  </label>
                  <input
                    type="number"
                    value={settings.referralConfig.referralDiscountPercentage}
                    onChange={(e) => setSettings({
                      ...settings,
                      referralConfig: {
                        ...settings.referralConfig,
                        referralDiscountPercentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                      }
                    })}
                    min={0}
                    max={100}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    最低訂單金額（港幣）
                  </label>
                  <input
                    type="number"
                    value={settings.referralConfig.minOrderAmountForReferral}
                    onChange={(e) => setSettings({
                      ...settings,
                      referralConfig: {
                        ...settings.referralConfig,
                        minOrderAmountForReferral: Math.max(0, parseInt(e.target.value) || 0)
                      }
                    })}
                    min={0}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-400 mb-2">推薦計劃摘要</h3>
                <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <li>• 新被推薦人獲得 {settings.referralConfig.referralRewardPoints} 積分</li>
                  <li>• 推薦人獲得 {settings.referralConfig.referrerRewardPoints} 積分</li>
                  <li>• 推薦折扣：{settings.referralConfig.referralDiscountPercentage}%</li>
                  <li>• 最低訂單：港幣 {settings.referralConfig.minOrderAmountForReferral}</li>
                  <li>• 推薦碼格式：{settings.referralConfig.referralCodePrefix}XXXXX</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={() => navigate('/admin/campaigns')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-orange-400 font-medium"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? '儲存中...' : '儲存設置'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCampaignSettings;
