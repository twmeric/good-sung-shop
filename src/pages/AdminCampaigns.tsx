import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, ChevronLeft, X, Eye } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface Campaign {
  id: number;
  scenarioKey: string;
  name: string;
  configJson?: string;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

interface FormData {
  scenarioKey: string;
  name: string;
}

interface NavigationTab {
  id: 'campaigns' | 'templates';
  label: string;
}

const AdminCampaigns: React.FC = () => {
  const navigate = useNavigate();
  const { scenarioKey } = useParams<{ scenarioKey?: string }>();
  
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>(scenarioKey ? 'templates' : 'campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(scenarioKey || null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    scenarioKey: '',
    name: ''
  });

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchCampaigns();
  }, [token, navigate]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/public/admin/scenarios');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : (data.scenarios || []));
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin');
      } else {
        setError('載入活動失敗');
      }
    } catch (e: any) {
      setError(e.message || '載入活動出錯');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ scenarioKey: '', name: '' });
    setShowForm(true);
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setFormData({ scenarioKey: campaign.scenarioKey, name: campaign.name });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.scenarioKey || !formData.name) {
      setError('請填寫所有必填項目');
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId
      ? `/api/public/admin/scenarios/${formData.scenarioKey}`
      : '/api/public/admin/scenarios';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      setSuccess(editingId ? '活動更新成功' : '活動創建成功');
      setShowForm(false);
      fetchCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const errorData = await res.json();
      setError(errorData.error || '儲存活動失敗');
    }
  };

  const handleDelete = async (scenarioKey: string) => {
    if (!confirm('確定要刪除嗎？')) return;

    const res = await apiFetch(`/api/public/admin/scenarios/${scenarioKey}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      setSuccess('活動刪除成功');
      fetchCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const errorData = await res.json();
      setError(errorData.error || '刪除活動失敗');
    }
  };

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) {
      localStorage.removeItem('admin_token');
      navigate('/admin');
    }
  };

  const getSelectedScenarioDetails = () => {
    return campaigns.find(c => c.scenarioKey === selectedScenario);
  };

  const selectedScenarioDetails = getSelectedScenarioDetails();

  // Template management state
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    messageKey: '',
    messageContent: ''
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    if (selectedScenario && activeTab === 'templates') {
      fetchTemplates();
    }
  }, [selectedScenario, activeTab]);

  const fetchTemplates = async () => {
    if (!selectedScenario) return;
    try {
      const res = await apiFetch(`/api/public/admin/whatsapp/templates?scenario=${selectedScenario}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : (data.templates || []));
      }
    } catch (e) {
      console.error('載入模板出錯:', e);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateFormData({ messageKey: '', messageContent: '' });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateFormData.messageKey || !templateFormData.messageContent) {
      setError('請填寫所有模板欄位');
      return;
    }

    const method = editingTemplateId ? 'PUT' : 'POST';
    const url = editingTemplateId
      ? `/api/public/admin/whatsapp/templates/${editingTemplateId}`
      : '/api/public/admin/whatsapp/templates';

    const payload = {
      ...templateFormData,
      scenario: selectedScenario
    };

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setSuccess('模板儲存成功');
      setShowTemplateForm(false);
      fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const errorData = await res.json();
      setError(errorData.error || '儲存模板失敗');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('確定要刪除嗎？')) return;

    const res = await apiFetch(`/api/public/admin/whatsapp/templates/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      setSuccess('模板刪除成功');
      fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handlePreviewTemplate = async (id: number) => {
    try {
      const res = await apiFetch(`/api/public/admin/whatsapp/templates/preview`, {
        method: 'POST',
        body: JSON.stringify({ templateId: id })
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      }
    } catch (e) {
      console.error('預覽模板出錯:', e);
    }
  };

  const filteredTemplates = selectedFilter === 'all'
    ? templates
    : templates.filter(t => t.messageKey === selectedFilter);

  return (
    <AdminLayout currentPage="campaigns" onLogout={handleLogout}>
      <div>
        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
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
          <nav className="flex space-x-8 px-6" aria-label="分頁">
            <button
              onClick={() => { setActiveTab('campaigns'); setSelectedScenario(null); }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'campaigns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              活動管理
            </button>
            {selectedScenario && (
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                訊息模板: {selectedScenario}
              </button>
            )}
          </nav>
        </div>

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <>
            {/* Create Button */}
            <div className="mb-6">
              <button
                onClick={handleCreate}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                新增活動
              </button>
            </div>

            {/* Campaigns List */}
            {loading ? (
              <div className="bg-white rounded shadow p-8 text-center text-gray-500">加載中...</div>
            ) : campaigns.length === 0 ? (
              <div className="bg-white rounded shadow p-8 text-center text-gray-500">暫無活動</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                      <p className="text-sm text-gray-600 font-mono">{campaign.scenarioKey}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        狀態：{campaign.isActive ? '啟用' : '停用'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        推廣連結：{' '}
                        <a
                          href={`https://goodstore.jkdcoding.com/?scenarioKey=${campaign.scenarioKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          https://goodstore.jkdcoding.com/?scenarioKey={campaign.scenarioKey}
                        </a>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedScenario(campaign.scenarioKey);
                          setActiveTab('templates');
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                      >
                        <Eye className="w-4 h-4 mr-1" /> 訊息模板
                      </button>
                      <button
                        onClick={() => handleEdit(campaign)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> 編輯
                      </button>
                      <button
                        onClick={() => navigate(`/admin/campaigns/${campaign.scenarioKey}/settings`)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      >
                        ⚙️ 設置
                      </button>
                      <button
                        onClick={() => handleDelete(campaign.scenarioKey)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> 刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && selectedScenario && (
          <>
            <div className="mb-6 flex gap-2">
              <button
                onClick={handleCreateTemplate}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                新增模板
              </button>
            </div>

            {/* Filter */}
            <div className="mb-6">
              <select
                value={selectedFilter}
                onChange={e => setSelectedFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">所有模板</option>
                {Array.from(new Set(templates.map(t => t.messageKey))).map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            {/* Templates Grid */}
            <div className="space-y-4">
              {filteredTemplates.length === 0 ? (
                <div className="bg-white rounded shadow p-8 text-center text-gray-500">暫無模板</div>
              ) : (
                filteredTemplates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                    <div className="mb-4">
                      <h4 className="text-lg font-bold text-gray-900">{template.messageKey}</h4>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{template.messageContent}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewTemplate(template.id)}
                        className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        <Eye className="w-4 h-4 inline mr-1" /> 預覽
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplateId(template.id);
                          setTemplateFormData({ messageKey: template.messageKey, messageContent: template.messageContent });
                          setShowTemplateForm(true);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        <Edit2 className="w-4 h-4 inline mr-1" /> 編輯
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="flex-1 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" /> 刪除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Campaign Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">{editingId ? '編輯活動' : '新增活動'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活動識別碼</label>
                  <input
                    type="text"
                    disabled={!!editingId}
                    placeholder="活動識別碼"
                    value={formData.scenarioKey}
                    onChange={e => setFormData({ ...formData, scenarioKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活動名稱</label>
                  <input
                    type="text"
                    placeholder="活動顯示名稱"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Form Modal */}
        {showTemplateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">{editingTemplateId ? '編輯模板' : '新增模板'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板識別碼</label>
                  <input
                    type="text"
                    placeholder="模板識別碼"
                    value={templateFormData.messageKey}
                    onChange={e => setTemplateFormData({ ...templateFormData, messageKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板內容</label>
                  <textarea
                    placeholder="輸入模板內容..."
                    rows={6}
                    value={templateFormData.messageContent}
                    onChange={e => setTemplateFormData({ ...templateFormData, messageContent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowTemplateForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
              <h2 className="text-2xl font-bold mb-4">模板預覽</h2>
              <button
                onClick={() => setPreviewData(null)}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {previewData.preview}
              </div>

              <button
                onClick={() => setPreviewData(null)}
                className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCampaigns;
