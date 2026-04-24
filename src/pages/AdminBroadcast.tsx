import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CheckSquare, X, Send, Plus, Edit2, Trash2,
  Eye, ChevronRight, Users, MessageSquare, Clock, CheckCircle,
  AlertCircle, Pause, Play, ChevronDown, ChevronUp, Loader2, Tag, Settings
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../lib/api';

interface Customer {
  name: string;
  phone: string;
  estate: string;
  lastOrderAt: number | string;
  totalOrders: number;
  totalSpent: number;
}

interface Campaign {
  id: number;
  name: string;
  messageContent: string;
  createdAt: number;
}

interface Batch {
  id: number;
  campaignId: number;
  name: string;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  rateMinSeconds: number;
  rateMaxSeconds: number;
  waveSize: number;
  waveIntervalSeconds: number;
  createdAt: number;
  campaignName?: string;
}

interface BatchLog {
  id: number;
  customerPhone: string;
  customerName: string;
  messageContent: string;
  status: string;
  errorMessage: string;
  sentAt: number;
}

interface SendResult {
  phone: string;
  name: string;
  status: 'sent' | 'failed';
  error?: string;
  time: string;
}

type TabId = 'customers' | 'templates' | 'send' | 'logs';

const tabs = [
  { id: 'customers' as TabId, label: '客戶名單' },
  { id: 'templates' as TabId, label: '訊息模板' },
  { id: 'send' as TabId, label: '發送中心' },
  { id: 'logs' as TabId, label: '發送記錄' },
];

function replaceVariables(template: string, customer: { name: string }): string {
  return template.split('{{name}}').join(customer.name || '');
}

function highlightVars(text: string): React.ReactNode[] {
  const parts = text.split('{{name}}');
  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    result.push(<React.Fragment key={'p' + i}>{part}</React.Fragment>);
    if (i < parts.length - 1) {
      result.push(
        <span key={'v' + i} className="bg-orange-100 text-orange-700 px-1 rounded font-mono text-xs dark:bg-orange-900/30 dark:text-orange-300">
          {'{{name}}'}
        </span>
      );
    }
  });
  return result;
}

function formatDate(ts: number | string): string {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'string' && ts.length > 10 ? ts : Number(ts) * 1000);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('zh-HK');
}

function formatDateTime(ts: number | string): string {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'string' && ts.length > 10 ? ts : Number(ts) * 1000);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-HK', { hour: '2-digit', minute: '2-digit' });
}

function daysAgo(ts: number | string): string {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'string' && ts.length > 10 ? ts : Number(ts) * 1000);
  if (isNaN(d.getTime())) return '-';
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '今天';
  if (diff === 1) return '1天前';
  if (diff < 7) return diff + '天前';
  if (diff < 30) return Math.floor(diff / 7) + '週前';
  if (diff < 365) return Math.floor(diff / 30) + '個月前';
  return Math.floor(diff / 365) + '年前';
}

function formatMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-HK');
}

const AdminBroadcast: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('admin_token');

  const [activeTab, setActiveTab] = useState<TabId>('customers');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'paid'>('all');
  const [estateFilter, setEstateFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState<'all' | '7' | '30' | '90' | '180'>('all');

  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());

  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [campaignForm, setCampaignForm] = useState({ name: '', messageContent: '' });
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [rateMin, setRateMin] = useState(25);
  const [rateMax, setRateMax] = useState(120);
  const [waveSize, setWaveSize] = useState(50);
  const [waveIntervalMin, setWaveIntervalMin] = useState(5);
  const [batchName, setBatchName] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0, currentPhone: '' });
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [countdown, setCountdown] = useState(0);

  const queueRef = useRef<Customer[]>([]);
  const isPausedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentBatchIdRef = useRef<number | null>(null);

  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);
  const [batchDetail, setBatchDetail] = useState<Batch | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'pending' | 'sending' | 'completed'>('all');

  useEffect(() => {
    if (!token) { navigate('/admin'); return; }
    fetchCustomers();
    fetchCampaigns();
    fetchBatches();
  }, []);

  useEffect(() => {
    if (token) fetchCustomers();
  }, [paymentStatus, estateFilter, daysFilter]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const params = new URLSearchParams();
      if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
      if (estateFilter !== 'all') params.set('estate', estateFilter);
      if (daysFilter !== 'all') params.set('daysSinceLastOrder', daysFilter);
      const res = await apiFetch('/api/public/admin/customers?' + params.toString());
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
      } else if (res.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin');
      } else {
        setError('載入客戶名單失敗');
      }
    } catch (e: any) {
      setError(e.message || '載入客戶名單出錯');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await apiFetch('/api/public/admin/broadcast-campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : []);
      } else {
        setError('載入模板失敗');
      }
    } catch (e: any) {
      setError(e.message || '載入模板出錯');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await apiFetch('/api/public/admin/broadcast-batches');
      if (res.ok) {
        const data = await res.json();
        setBatches(Array.isArray(data) ? data : []);
      } else {
        setError('載入發送記錄失敗');
      }
    } catch (e: any) {
      setError(e.message || '載入發送記錄出錯');
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchBatchDetail = async (batchId: number) => {
    try {
      const res = await apiFetch('/api/public/admin/broadcast-batches/' + batchId);
      if (res.ok) {
        const data = await res.json();
        setBatchDetail(data);
      }
    } catch (e) {
      console.error('載入批次詳情出錯:', e);
    }
  };

  const fetchBatchLogs = async (batchId: number) => {
    try {
      const res = await apiFetch('/api/public/admin/broadcast-batches/' + batchId + '/logs?status=all');
      if (res.ok) {
        const data = await res.json();
        setBatchLogs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('載入批次日誌出錯:', e);
    }
  };

  const estates = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => { if (c.estate) set.add(c.estate); });
    return ['all', ...Array.from(set).sort()];
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }, [customers, search]);

  const selectedCustomers = useMemo(() => {
    return customers.filter(c => selectedPhones.has(c.phone));
  }, [customers, selectedPhones]);

  const toggleSelect = (phone: string) => {
    setSelectedPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedPhones(prev => {
      const next = new Set(prev);
      filteredCustomers.forEach(c => next.add(c.phone));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPhones(new Set());
  };

  const handleSaveCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.messageContent.trim()) {
      setError('請填寫模板名稱和內容');
      return;
    }
    const method = editingCampaignId ? 'PUT' : 'POST';
    const url = editingCampaignId
      ? '/api/public/admin/broadcast-campaigns/' + editingCampaignId
      : '/api/public/admin/broadcast-campaigns';
    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(campaignForm)
    });
    if (res.ok) {
      setSuccess(editingCampaignId ? '模板更新成功' : '模板創建成功');
      setShowCampaignForm(false);
      fetchCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || '儲存模板失敗');
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('確定要刪除此模板嗎？')) return;
    const res = await apiFetch('/api/public/admin/broadcast-campaigns/' + id, { method: 'DELETE' });
    if (res.ok) {
      setSuccess('模板刪除成功');
      fetchCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError('刪除模板失敗');
    }
  };

  const startSending = async () => {
    if (selectedCustomers.length === 0) {
      setError('請先選擇客戶');
      return;
    }
    if (!selectedCampaignId) {
      setError('請選擇訊息模板');
      return;
    }
    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    if (!campaign) {
      setError('模板不存在');
      return;
    }

    const name = batchName.trim() || campaign.name + ' ' + new Date().toLocaleDateString('zh-HK');

    try {
      const res = await apiFetch('/api/public/admin/broadcast-batches', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          name,
          phones: selectedCustomers.map(c => c.phone),
          names: selectedCustomers.map(c => c.name),
          rateMinSeconds: rateMin,
          rateMaxSeconds: rateMax,
          waveSize,
          waveIntervalSeconds: waveIntervalMin * 60
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '創建批次失敗');
        return;
      }
      const { batchId }: { batchId: number } = await res.json();
      currentBatchIdRef.current = batchId;

      queueRef.current = [...selectedCustomers];
      isPausedRef.current = false;
      setIsPaused(false);
      setIsSending(true);
      setSendProgress({ sent: 0, failed: 0, total: selectedCustomers.length, currentPhone: '' });
      setSendResults([]);
      setCountdown(0);

      processNext(batchId);
    } catch (e: any) {
      setError(e.message || '開始發送失敗');
    }
  };

  const processNext = async (batchId: number) => {
    if (isPausedRef.current) return;
    if (queueRef.current.length === 0) {
      setIsSending(false);
      setCountdown(0);
      fetchBatches();
      return;
    }

    const customer = queueRef.current[0];
    setSendProgress(p => ({ ...p, currentPhone: customer.phone }));

    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    const message = campaign ? replaceVariables(campaign.messageContent, customer) : '';

    try {
      const res = await apiFetch('/api/public/admin/broadcast-send', {
        method: 'POST',
        body: JSON.stringify({ logId: batchId, phone: customer.phone, message })
      });
      const data = await res.json().catch(() => ({ success: false, error: '解析失敗' }));
      const time = new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
      if (data.success) {
        setSendProgress(p => ({ ...p, sent: p.sent + 1 }));
        setSendResults(prev => [...prev, { phone: customer.phone, name: customer.name, status: 'sent', time }]);
      } else {
        setSendProgress(p => ({ ...p, failed: p.failed + 1 }));
        setSendResults(prev => [...prev, { phone: customer.phone, name: customer.name, status: 'failed', error: data.error, time }]);
      }
    } catch {
      const time = new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
      setSendProgress(p => ({ ...p, failed: p.failed + 1 }));
      setSendResults(prev => [...prev, { phone: customer.phone, name: customer.name, status: 'failed', error: '網絡錯誤', time }]);
    }

    queueRef.current = queueRef.current.slice(1);

    if (queueRef.current.length > 0 && !isPausedRef.current) {
      const delay = Math.random() * (rateMax - rateMin) + rateMin;
      setCountdown(Math.ceil(delay));

      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      timeoutRef.current = setTimeout(() => {
        clearInterval(countdownIntervalRef.current!);
        processNext(batchId);
      }, delay * 1000);
    } else if (queueRef.current.length === 0) {
      setIsSending(false);
      setCountdown(0);
      fetchBatches();
    }
  };

  const pauseSending = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(0);
  };

  const resumeSending = () => {
    if (!currentBatchIdRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);
    if (queueRef.current.length > 0) {
      processNext(currentBatchIdRef.current);
    } else {
      setIsSending(false);
    }
  };

  const resetSending = () => {
    pauseSending();
    queueRef.current = [];
    setIsSending(false);
    setSendProgress({ sent: 0, failed: 0, total: 0, currentPhone: '' });
    setSendResults([]);
    setCountdown(0);
  };

  const toggleExpandBatch = async (id: number) => {
    if (expandedBatchId === id) {
      setExpandedBatchId(null);
      setBatchLogs([]);
      setBatchDetail(null);
    } else {
      setExpandedBatchId(id);
      await fetchBatchDetail(id);
      await fetchBatchLogs(id);
    }
  };

  const estimatedMinutes = useMemo(() => {
    const total = selectedCustomers.length;
    if (total === 0) return 0;
    const avgDelay = (rateMin + rateMax) / 2;
    const numWaves = Math.ceil(total / waveSize);
    const totalSeconds = total * avgDelay + (numWaves - 1) * (waveIntervalMin * 60);
    return Math.ceil(totalSeconds / 60);
  }, [selectedCustomers.length, rateMin, rateMax, waveSize, waveIntervalMin]);

  const handleLogout = () => {
    if (confirm('確定要登出嗎？')) {
      localStorage.removeItem('admin_token');
      navigate('/admin');
    }
  };

  return (
    <AdminLayout currentPage="broadcast" onLogout={handleLogout}>
      <div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex justify-between items-center dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 mb-6 rounded-t-lg">
          <nav className="flex space-x-2 px-2 md:space-x-8 md:px-6 overflow-x-auto" aria-label="分頁">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ' + (
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="搜索客戶名或電話..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  >
                    <option value="all">全部付款狀態</option>
                    <option value="paid">已付款</option>
                  </select>
                  <select
                    value={estateFilter}
                    onChange={e => setEstateFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  >
                    {estates.map(e => (
                      <option key={e} value={e}>{e === 'all' ? '全部屋苑' : e}</option>
                    ))}
                  </select>
                  <select
                    value={daysFilter}
                    onChange={e => setDaysFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  >
                    <option value="all">全部時間</option>
                    <option value="7">7天內</option>
                    <option value="30">30天內</option>
                    <option value="90">90天內</option>
                    <option value="180">180天內</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    <CheckSquare className="w-4 h-4 mr-1" /> 全選
                  </button>
                  <button
                    onClick={clearSelection}
                    className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    <X className="w-4 h-4 mr-1" /> 清除選擇
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    已選擇 <span className="font-bold text-orange-600 dark:text-orange-400">{selectedPhones.size}</span> 人
                  </span>
                  <button
                    onClick={() => selectedPhones.size > 0 ? setActiveTab('send') : setError('請先選擇客戶')}
                    className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                  >
                    發送訊息給已選客戶 <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {loadingCustomers ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">加載中...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">暫無客戶</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedPhones.has(c.phone))}
                            onChange={e => e.target.checked ? selectAllFiltered() : clearSelection()}
                            className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                          />
                        </th>
                        <th className="px-4 py-3">客戶名</th>
                        <th className="px-4 py-3">電話</th>
                        <th className="px-4 py-3">屋苑</th>
                        <th className="px-4 py-3">最近下單</th>
                        <th className="px-4 py-3">總訂單</th>
                        <th className="px-4 py-3">總消費</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCustomers.map(c => (
                        <tr key={c.phone} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedPhones.has(c.phone)}
                              onChange={() => toggleSelect(c.phone)}
                              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.phone}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.estate || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{daysAgo(c.lastOrderAt)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{(c.totalOrders || 0) + '次'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatMoney(c.totalSpent || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setEditingCampaignId(null);
                  setCampaignForm({ name: '', messageContent: '' });
                  setShowCampaignForm(true);
                }}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Plus className="w-5 h-5 mr-2" /> 新增模板
              </button>
            </div>

            {loadingCampaigns ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">加載中...</div>
            ) : campaigns.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">暫無模板</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-orange-500 flex flex-col">
                    <div className="mb-3 flex items-start gap-2">
                      <Tag className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{campaign.name}</h3>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4 flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words line-clamp-6">
                        {campaign.messageContent}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      創建於 {formatDate(campaign.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewCampaign(campaign)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        <Eye className="w-4 h-4 mr-1" /> 預覽
                      </button>
                      <button
                        onClick={() => {
                          setEditingCampaignId(campaign.id);
                          setCampaignForm({ name: campaign.name, messageContent: campaign.messageContent });
                          setShowCampaignForm(true);
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> 編輯
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> 刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'send' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" /> 已選客戶
              </h3>
              {selectedCustomers.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  請先在「客戶名單」選擇客戶
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="ml-2 text-orange-600 hover:text-orange-700 underline"
                  >
                    前往選擇 →
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    已選擇 <span className="font-bold text-orange-600 dark:text-orange-400">{selectedCustomers.length}</span> 位客戶
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCustomers.slice(0, 5).map(c => (
                      <span key={c.phone} className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs dark:bg-orange-900/20 dark:text-orange-300">
                        {c.name || c.phone}
                      </span>
                    ))}
                    {selectedCustomers.length > 5 && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs dark:bg-gray-700 dark:text-gray-300">
                        ...還有 {selectedCustomers.length - 5} 人
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isSending && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-2 border-orange-200 dark:border-orange-900">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                    發送中... {sendProgress.sent + sendProgress.failed}/{sendProgress.total} 完成
                  </h3>
                  <div className="flex gap-2">
                    {isPaused ? (
                      <button onClick={resumeSending} className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                        <Play className="w-4 h-4 mr-1" /> 繼續
                      </button>
                    ) : (
                      <button onClick={pauseSending} className="flex items-center px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm">
                        <Pause className="w-4 h-4 mr-1" /> 暫停
                      </button>
                    )}
                    <button onClick={resetSending} className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                      <X className="w-4 h-4 mr-1" /> 取消
                    </button>
                  </div>
                </div>

                {!isPaused && countdown > 0 && (
                  <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    下一條訊息將於 <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{countdown}</span> 秒後發送
                  </div>
                )}

                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-4">
                  <div
                    className="bg-orange-600 h-2.5 rounded-full transition-all"
                    style={{ width: (sendProgress.total > 0 ? ((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100 : 0) + '%' }}
                  />
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sendResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <div className="flex items-center gap-2">
                        {r.status === 'sent' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {r.name || r.phone} ({r.phone})
                        </span>
                        {r.error && <span className="text-xs text-red-500 ml-1">{r.error}</span>}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{r.time}</span>
                    </div>
                  ))}
                  {queueRef.current.slice(0, 3).map(c => (
                    <div key={c.phone} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded opacity-60">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{c.name || c.phone} ({c.phone}) 等待中...</span>
                      </div>
                    </div>
                  ))}
                  {queueRef.current.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                      ...還有 {queueRef.current.length - 3} 人等待中
                    </div>
                  )}
                </div>

                {queueRef.current.length === 0 && !isPaused && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-800 dark:text-green-300 font-medium">
                      發送完成！成功 {sendProgress.sent} 條，失敗 {sendProgress.failed} 條
                    </p>
                    <button
                      onClick={() => { resetSending(); setActiveTab('logs'); }}
                      className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      查看記錄
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isSending && (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-orange-600" /> 選擇模板
                  </h3>
                  {campaigns.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400">
                      暫無模板，請先
                      <button onClick={() => setActiveTab('templates')} className="ml-1 text-orange-600 hover:text-orange-700 underline">
                        創建模板
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <select
                        value={selectedCampaignId ?? ''}
                        onChange={e => setSelectedCampaignId(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      >
                        <option value="">請選擇模板...</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {selectedCampaignId && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">模板預覽：</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                            {highlightVars(campaigns.find(c => c.id === selectedCampaignId)?.messageContent || '')}
                          </p>
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                            可用變量: {'{{name}}'} = 客戶名稱
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-orange-600" /> 發送設置
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">速率控制 (秒)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={5}
                          max={300}
                          value={rateMin}
                          onChange={e => setRateMin(Math.min(Number(e.target.value), rateMax))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        />
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                        <input
                          type="number"
                          min={5}
                          max={300}
                          value={rateMax}
                          onChange={e => setRateMax(Math.max(Number(e.target.value), rateMin))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">每條隨機間隔</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">每波人數</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={waveSize}
                        onChange={e => setWaveSize(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">波間間隔 (分鐘)</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={waveIntervalMin}
                        onChange={e => setWaveIntervalMin(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">批次名稱</label>
                      <input
                        type="text"
                        value={batchName}
                        onChange={e => setBatchName(e.target.value)}
                        placeholder={(campaigns.find(c => c.id === selectedCampaignId)?.name || '批次') + ' ' + new Date().toLocaleDateString('zh-HK')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-orange-600" /> 預覽與發送
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <p className="text-sm text-orange-800 dark:text-orange-300">
                        即將發送給 <span className="font-bold">{selectedCustomers.length}</span> 位客戶，預估時間約 <span className="font-bold">{estimatedMinutes}</span> 分鐘
                      </p>
                    </div>
                    {selectedCampaignId && selectedCustomers.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">訊息預覽（已替換）：</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                          {replaceVariables(
                            campaigns.find(c => c.id === selectedCampaignId)?.messageContent || '',
                            selectedCustomers[0]
                          )}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={startSending}
                      disabled={selectedCustomers.length === 0 || !selectedCampaignId}
                      className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                    >
                      <Send className="w-5 h-5 mr-2" /> 確認發送
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex flex-wrap gap-2">
                <select
                  value={logStatusFilter}
                  onChange={e => setLogStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                >
                  <option value="all">全部狀態</option>
                  <option value="pending">待發送</option>
                  <option value="sending">發送中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {loadingBatches ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">加載中...</div>
              ) : batches.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">暫無發送記錄</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">批次名稱</th>
                        <th className="px-4 py-3">發送時間</th>
                        <th className="px-4 py-3">目標人數</th>
                        <th className="px-4 py-3">成功</th>
                        <th className="px-4 py-3">失敗</th>
                        <th className="px-4 py-3">狀態</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {batches
                        .filter(b => logStatusFilter === 'all' || b.status === logStatusFilter)
                        .map(batch => (
                        <React.Fragment key={batch.id}>
                          <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{batch.name}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(batch.createdAt)}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{batch.targetCount}</td>
                            <td className="px-4 py-3 text-green-600 dark:text-green-400">{batch.sentCount}</td>
                            <td className="px-4 py-3 text-red-600 dark:text-red-400">{batch.failedCount}</td>
                            <td className="px-4 py-3">
                              {batch.status === 'completed' ? (
                                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs dark:bg-green-900/20 dark:text-green-300">
                                  <CheckCircle className="w-3 h-3 mr-1" /> 完成
                                </span>
                              ) : batch.status === 'sending' ? (
                                <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs dark:bg-yellow-900/20 dark:text-yellow-300">
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 發送中
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs dark:bg-gray-700 dark:text-gray-300">
                                  <Clock className="w-3 h-3 mr-1" /> 待發送
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleExpandBatch(batch.id)}
                                className="text-orange-600 hover:text-orange-700 text-sm flex items-center"
                              >
                                {expandedBatchId === batch.id ? (
                                  <>收起 <ChevronUp className="w-4 h-4 ml-1" /></>
                                ) : (
                                  <>查看詳情 <ChevronDown className="w-4 h-4 ml-1" /></>
                                )}
                              </button>
                            </td>
                          </tr>
                          {expandedBatchId === batch.id && (
                            <tr>
                              <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-700/30">
                                {batchDetail && (
                                  <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                                    <p>模板：{batchDetail.campaignName || '-'}</p>
                                    <p>速率：{batchDetail.rateMinSeconds}-{batchDetail.rateMaxSeconds} 秒/條</p>
                                    <p>每波：{batchDetail.waveSize} 人，波間：{Math.round(batchDetail.waveIntervalSeconds / 60)} 分鐘</p>
                                  </div>
                                )}
                                {batchLogs.length === 0 ? (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">暫無詳細記錄</div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                        <tr>
                                          <th className="px-3 py-2 text-left">客戶</th>
                                          <th className="px-3 py-2 text-left">電話</th>
                                          <th className="px-3 py-2 text-left">狀態</th>
                                          <th className="px-3 py-2 text-left">時間</th>
                                          <th className="px-3 py-2 text-left">錯誤</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {batchLogs.map(log => (
                                          <tr key={log.id}>
                                            <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{log.customerName || '-'}</td>
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{log.customerPhone}</td>
                                            <td className="px-3 py-2">
                                              {log.status === 'sent' || log.status === 'success' ? (
                                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 成功</span>
                                              ) : (
                                                <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 失敗</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{formatDateTime(log.sentAt)}</td>
                                            <td className="px-3 py-2 text-red-500 text-xs">{log.errorMessage}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {showCampaignForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {editingCampaignId ? '編輯模板' : '新增模板'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模板名稱</label>
                  <input
                    type="text"
                    value={campaignForm.name}
                    onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">訊息內容</label>
                  <textarea
                    rows={6}
                    value={campaignForm.messageContent}
                    onChange={e => setCampaignForm(p => ({ ...p, messageContent: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    可用變量: {'{{name}}'} = 客戶名稱
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowCampaignForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveCampaign}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}

        {previewCampaign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full relative">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">模板預覽</h2>
              <button
                onClick={() => setPreviewCampaign(null)}
                className="absolute top-4 right-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-gray-800 dark:text-white whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {replaceVariables(previewCampaign.messageContent, { name: '陳大文' })}
              </div>
              <button
                onClick={() => setPreviewCampaign(null)}
                className="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
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

export default AdminBroadcast;
