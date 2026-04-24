import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, Save, AlertCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface Campaign {
  id: number;
  scenarioKey: string;
  name: string;
  defaultLang: string;
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
  defaultLang: string;
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
    defaultLang: 'zh',
    isActive: true,
    landingPageConfig: {
      title: '',
      description: '',
      heroImage: '',
      ctaButtonText: 'Order Now',
      ctaButtonColor: '#2563EB'
    },
    referralConfig: {
      referralRewardPoints: 100,
      referrerRewardPoints: 50,
      referralDiscountPercentage: 10,
      minOrderAmountForReferral: 200,
      referralCodePrefix: 'REF'
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
        throw new Error('Failed to fetch campaign settings');
      }

      const data = await response.json();
      setCampaign(data);

      // Populate settings from campaign data
      const config = data.config || {};
      setSettings({
        name: data.name,
        defaultLang: data.defaultLang,
        isActive: data.isActive === 1,
        landingPageConfig: config.landingPageConfig || {
          title: '',
          description: '',
          heroImage: '',
          ctaButtonText: 'Order Now',
          ctaButtonColor: '#2563EB'
        },
        referralConfig: config.referralConfig || {
          referralRewardPoints: 100,
          referrerRewardPoints: 50,
          referralDiscountPercentage: 10,
          minOrderAmountForReferral: 200,
          referralCodePrefix: 'REF'
        }
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign settings');
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
            defaultLang: settings.defaultLang,
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

      setSuccess('Campaign settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save campaign settings');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading campaign settings...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Campaign not found</div>
      </div>
    );
  }

  return (
    <AdminLayout currentPage="campaigns" onLogout={handleLogout}>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Campaign Settings: {campaign.name}
        </h2>
        <p className="text-sm text-gray-500 mb-6">Scenario Key: {campaign.scenarioKey}</p>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b mb-6 rounded-t-lg">
          <nav className="flex space-x-8 px-6" aria-label="Settings Tabs">
            {(['basic', 'landing', 'referral'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'basic' && 'Basic Settings'}
                {tab === 'landing' && 'Landing Page'}
                {tab === 'referral' && 'Referral Program'}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-b-lg shadow p-6">
          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Campaign Basic Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Campaign Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Language
                  </label>
                  <select
                    value={settings.defaultLang}
                    onChange={(e) => setSettings({ ...settings, defaultLang: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="zh">Chinese (中文)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.isActive}
                    onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Campaign is Active
                  </span>
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  {settings.isActive
                    ? 'This campaign is currently active and visible to customers.'
                    : 'This campaign is inactive and not visible to customers.'}
                </p>
              </div>
            </div>
          )}

          {/* Landing Page Settings Tab */}
          {activeTab === 'landing' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Landing Page Configuration</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Title
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Good Sung Poon Choi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Description
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Campaign description and details"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CTA Button Text
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Order Now"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CTA Button Color
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
                      className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="#2563EB"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hero Image URL
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/hero-image.jpg"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: URL to hero/banner image</p>
              </div>
            </div>
          )}

          {/* Referral Settings Tab */}
          {activeTab === 'referral' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Referral Program Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referral Code Prefix
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="REF"
                    maxLength={5}
                  />
                  <p className="text-xs text-gray-500 mt-1">Prefix for generated referral codes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referral Reward Points (for referred customer)
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referrer Reward Points (for person who referred)
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referral Discount Percentage (%)
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Order Amount for Referral (HKD)
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Referral Program Summary</h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• New referrals earn {settings.referralConfig.referralRewardPoints} reward points</li>
                  <li>• Referrers earn {settings.referralConfig.referrerRewardPoints} reward points</li>
                  <li>• Referral discount: {settings.referralConfig.referralDiscountPercentage}%</li>
                  <li>• Minimum order: HKD {settings.referralConfig.minOrderAmountForReferral}</li>
                  <li>• Referral code format: {settings.referralConfig.referralCodePrefix}XXXXX</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={() => navigate('/admin/campaigns')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCampaignSettings;
