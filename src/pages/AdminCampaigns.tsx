import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, ChevronLeft, X, Eye } from 'lucide-react';
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

interface FormData {
  scenarioKey: string;
  name: string;
  defaultLang: string;
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
    name: '',
    defaultLang: 'zh'
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
        setError('Failed to load campaigns');
      }
    } catch (e: any) {
      setError(e.message || 'Error loading campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ scenarioKey: '', name: '', defaultLang: 'zh' });
    setShowForm(true);
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setFormData({ scenarioKey: campaign.scenarioKey, name: campaign.name, defaultLang: campaign.defaultLang });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.scenarioKey || !formData.name) {
      setError('Please fill in all required fields');
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
      setSuccess(editingId ? 'Campaign updated successfully' : 'Campaign created successfully');
      setShowForm(false);
      fetchCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const errorData = await res.json();
      setError(errorData.error || 'Failed to save campaign');
    }
  };

  const handleDelete = async (scenarioKey: string) => {
    if (!confirm('Confirm delete?')) return;

    const res = await apiFetch(`/api/public/admin/scenarios/${scenarioKey}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      setSuccess('Campaign deleted successfully');
      fetchCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const errorData = await res.json();
      setError(errorData.error || 'Failed to delete campaign');
    }
  };

  const handleLogout = () => {
    if (confirm('Confirm logout?')) {
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
      console.error('Error loading templates:', e);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateFormData({ messageKey: '', messageContent: '' });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateFormData.messageKey || !templateFormData.messageContent) {
      setError('Please fill in all template fields');
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
      setSuccess('Template saved successfully');
      setShowTemplateForm(false);
      fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const errorData = await res.json();
      setError(errorData.error || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Confirm delete?')) return;

    const res = await apiFetch(`/api/public/admin/whatsapp/templates/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      setSuccess('Template deleted successfully');
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
      console.error('Error previewing template:', e);
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
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => { setActiveTab('campaigns'); setSelectedScenario(null); }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'campaigns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Campaigns
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
                Templates: {selectedScenario}
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
                New Campaign
              </button>
            </div>

            {/* Campaigns List */}
            {loading ? (
              <div className="bg-white rounded shadow p-8 text-center text-gray-500">Loading...</div>
            ) : campaigns.length === 0 ? (
              <div className="bg-white rounded shadow p-8 text-center text-gray-500">No campaigns yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                      <p className="text-sm text-gray-600 font-mono">{campaign.scenarioKey}</p>
                      <p className="text-xs text-gray-500 mt-2">Language: {campaign.defaultLang.toUpperCase()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedScenario(campaign.scenarioKey);
                          setActiveTab('templates');
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                      >
                        <Eye className="w-4 h-4 mr-1" /> Templates
                      </button>
                      <button
                        onClick={() => handleEdit(campaign)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => navigate(`/admin/campaigns/${campaign.scenarioKey}/settings`)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      >
                        ⚙️ Settings
                      </button>
                      <button
                        onClick={() => handleDelete(campaign.scenarioKey)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
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
                New Template
              </button>
            </div>

            {/* Filter */}
            <div className="mb-6">
              <select
                value={selectedFilter}
                onChange={e => setSelectedFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Templates</option>
                {Array.from(new Set(templates.map(t => t.messageKey))).map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            {/* Templates Grid */}
            <div className="space-y-4">
              {filteredTemplates.length === 0 ? (
                <div className="bg-white rounded shadow p-8 text-center text-gray-500">No templates</div>
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
                        <Eye className="w-4 h-4 inline mr-1" /> Preview
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplateId(template.id);
                          setTemplateFormData({ messageKey: template.messageKey, messageContent: template.messageContent });
                          setShowTemplateForm(true);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        <Edit2 className="w-4 h-4 inline mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="flex-1 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" /> Delete
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
              <h2 className="text-2xl font-bold mb-4">{editingId ? 'Edit Campaign' : 'New Campaign'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Key</label>
                  <input
                    type="text"
                    disabled={!!editingId}
                    placeholder="campaign_key"
                    value={formData.scenarioKey}
                    onChange={e => setFormData({ ...formData, scenarioKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    placeholder="Campaign Display Name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
                  <select
                    value={formData.defaultLang}
                    onChange={e => setFormData({ ...formData, defaultLang: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="zh">Chinese (中文)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Form Modal */}
        {showTemplateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">{editingTemplateId ? 'Edit Template' : 'New Template'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message Key</label>
                  <input
                    type="text"
                    placeholder="order_confirmation"
                    value={templateFormData.messageKey}
                    onChange={e => setTemplateFormData({ ...templateFormData, messageKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message Content</label>
                  <textarea
                    placeholder="Your message content..."
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
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Template Preview</h2>
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
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCampaigns;
