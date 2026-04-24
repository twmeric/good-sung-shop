import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, Loader2, User, ShoppingCart, Plus, Minus, Trash2, ShieldCheck, MessageCircle, Copy, Check } from 'lucide-react';
import logoImg from '../assets/delicious-express-logo.jpg';

// ============================================================
// API Base URL
// ============================================================
const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

// ============================================================
// Types
// ============================================================
interface DishItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  enabled: boolean;
}

interface SoupItem {
  id: string;
  name: string;
  imageUrl?: string;
  enabled: boolean;
}

interface OrderPackage {
  id: string;
  packageType: '2-dish-1-soup' | '3-dish-1-soup';
  selectedDishes: string[];
  selectedSoup: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface DeliveryInfo {
  address: string;
  estate: string;
  deliveryDate: string;
  name: string;
  remarks: string;
}

// ============================================================
// Data (fallback defaults)
// ============================================================
const DEFAULT_DISHES: DishItem[] = [
  { id: 'd1', name: '宮保雞丁', description: '微辣開胃', enabled: true },
  { id: 'd2', name: '麻婆豆腐', description: '經典川菜', enabled: true },
  { id: 'd3', name: '蒜蓉炒菜心', description: '清甜爽脆', enabled: true },
  { id: 'd4', name: '紅燒獅子頭', description: '軟嫩多汁', enabled: true },
  { id: 'd5', name: '清蒸鱸魚', description: '鮮甜嫩滑', enabled: true },
  { id: 'd6', name: '糖醋排骨', description: '酸甜惹味', enabled: true },
  { id: 'd7', name: '豉油王炒麵', description: '港式風味', enabled: true },
  { id: 'd8', name: '椒鹽豬扒', description: '香脆可口', enabled: true },
  { id: 'd9', name: '蠔油冬菇生菜', description: '健康素菜', enabled: true },
  { id: 'd10', name: '沙嗲牛肉', description: '濃郁香滑', enabled: true },
];

const DEFAULT_SOUPS: SoupItem[] = [
  { id: 's1', name: '老火湯', enabled: true },
  { id: 's2', name: '西洋菜湯', enabled: true },
  { id: 's3', name: '番茄薯仔湯', enabled: true },
  { id: 's4', name: '冬瓜薏米湯', enabled: true },
  { id: 's5', name: '節瓜瑤柱湯', enabled: true },
];

const DEFAULT_PACKAGES = [
  { type: '2-dish-1-soup' as const, name: '2餸1湯', price: 99, dishCount: 2, soupCount: 1 },
  { type: '3-dish-1-soup' as const, name: '3餸1湯', price: 129, dishCount: 3, soupCount: 1 },
];

interface ApiProduct {
  id: number;
  category: string;
  name: string;
  description: string | null;
  price: number | null;
  is_active: number;
  stock_quantity: number;
  sort_order: number;
  max_select: number | null;
  image_url: string | null;
}

interface PackageConfig {
  id: number;
  typeKey: string;
  name: string;
  price: number;
  dishCount: number;
  soupCount: number;
  isActive: number;
  sortOrder: number;
}

const BUSINESS_PHONE = '85262322466';

// ============================================================
// Helper: Generate random verification code
// ============================================================
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}



// ============================================================
// Component
// ============================================================
const OrderLanding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scenarioKey = searchParams.get('scenarioKey') || '';

  // ── Step management ──
  const [step, setStep] = useState<'package' | 'dishes' | 'cart' | 'delivery' | 'verify' | 'submitting'>('package');

  // ── Package builder ──
  const [selectedPackage, setSelectedPackage] = useState<typeof packages[0] | null>(null);
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [selectedSoup, setSelectedSoup] = useState<string>('');
  const [packageQuantity, setPackageQuantity] = useState(1);

  // ── Cart ──
  const [cart, setCart] = useState<OrderPackage[]>([]);

  // ── Delivery ──
  const [delivery, setDelivery] = useState<DeliveryInfo>({
    address: '', estate: '善樓', deliveryDate: '', name: '', remarks: ''
  });
  const [minDateStr, setMinDateStr] = useState('');

  // ── Products from API ──
  const [dishes, setDishes] = useState<DishItem[]>(DEFAULT_DISHES);
  const [soups, setSoups] = useState<SoupItem[]>(DEFAULT_SOUPS);
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<Set<string>>(new Set());

  // ── Verification ──
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [verifyPolling, setVerifyPolling] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [useOtpMode, setUseOtpMode] = useState(false);
  const [deepLinkFailed, setDeepLinkFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Campaign config ──
  const [campaignConfig, setCampaignConfig] = useState<any>(null);

  // ── Submit ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Computed ──
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  // ── Effects ──
  useEffect(() => {
    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 2); // 提前2天預訂
    // Use local date (en-CA format = YYYY-MM-DD) instead of UTC ISO
    setMinDateStr(minDate.toLocaleDateString('en-CA'));
  }, []);

  useEffect(() => {
    // Check if already verified from localStorage
    const saved = localStorage.getItem('goodSungVerified');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.verified && data.phone && Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setIsVerified(true);
          setVerifiedPhone(data.phone);
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Fetch campaign config
  useEffect(() => {
    if (scenarioKey) {
      fetch(`${API_BASE}/api/public/campaigns/${scenarioKey}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.config) {
            setCampaignConfig(data.config);
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [scenarioKey]);

  // Fetch products from API
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/public/products`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/public/package-configs`).then(r => r.ok ? r.json() : null),
    ])
      .then(([data, pkgData]: [ApiProduct[] | null, PackageConfig[] | null]) => {
        if (data && Array.isArray(data)) {
          const lowStock = new Set<string>();
          const fetchedDishes: DishItem[] = data
            .filter(p => p.category === 'dish' && p.stock_quantity > 0)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((p) => {
              if (p.stock_quantity > 0 && p.stock_quantity < 15) {
                lowStock.add(`d${p.id}`);
              }
              return {
                id: `d${p.id}`,
                name: p.name,
                description: p.description || '',
                imageUrl: p.image_url || undefined,
                enabled: p.is_active === 1,
              };
            });
          const fetchedSoups: SoupItem[] = data
            .filter(p => p.category === 'soup' && p.stock_quantity > 0)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((p) => {
              if (p.stock_quantity > 0 && p.stock_quantity < 15) {
                lowStock.add(`s${p.id}`);
              }
              return {
                id: `s${p.id}`,
                name: p.name,
                imageUrl: p.image_url || undefined,
                enabled: p.is_active === 1,
              };
            });

          if (fetchedDishes.length > 0) setDishes(fetchedDishes);
          if (fetchedSoups.length > 0) setSoups(fetchedSoups);
          setLowStockItems(lowStock);
        }

        if (pkgData && Array.isArray(pkgData) && pkgData.length > 0) {
          const fetchedPackages = pkgData
            .filter(p => p.isActive === 1)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map(p => ({
              type: p.typeKey as '2-dish-1-soup' | '3-dish-1-soup',
              name: p.name,
              price: p.price,
              dishCount: p.dishCount,
              soupCount: p.soupCount,
            }));
          if (fetchedPackages.length > 0) setPackages(fetchedPackages);
        }

        setProductsLoaded(true);
      })
      .catch(() => { /* fallback to defaults */ });
  }, []);



  // ── Handlers ──
  const handleSelectPackage = (pkg: typeof packages[0]) => {
    setSelectedPackage(pkg);
    setSelectedDishes([]);
    setSelectedSoup('');
    setPackageQuantity(1);
    setStep('dishes');
  };

  const toggleDish = (dishId: string) => {
    if (!selectedPackage) return;
    setSelectedDishes(prev => {
      if (prev.includes(dishId)) {
        return prev.filter(id => id !== dishId);
      }
      if (prev.length >= selectedPackage.dishCount) {
        return prev; // max reached
      }
      return [...prev, dishId];
    });
  };

  const handleAddToCart = () => {
    if (!selectedPackage || selectedDishes.length !== selectedPackage.dishCount || !selectedSoup) return;
    const newItem: OrderPackage = {
      id: Math.random().toString(36).substring(2, 10),
      packageType: selectedPackage.type,
      selectedDishes: [...selectedDishes],
      selectedSoup,
      quantity: packageQuantity,
      unitPrice: selectedPackage.price,
      subtotal: selectedPackage.price * packageQuantity,
    };
    setCart(prev => [...prev, newItem]);
    setSelectedPackage(null);
    setSelectedDishes([]);
    setSelectedSoup('');
    setPackageQuantity(1);
    setStep('cart');
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getDishNames = (ids: string[]) => {
    return ids.map(id => dishes.find(d => d.id === id)?.name || id).join('、');
  };

  const getSoupName = (id: string) => soups.find(s => s.id === id)?.name || id;

  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDelivery(prev => ({ ...prev, [name]: value }));
  };

  // ── WhatsApp Verification (wa.me + SaleSmartly webhook) ──
  // Detect if user is on mobile device
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const startVerification = async () => {
    setVerifyError('');
    setDeepLinkFailed(false);
    const code = generateVerificationCode();
    setVerifyCode(code);
    setVerifyPolling(true);

    try {
      const res = await fetch(`${API_BASE}/api/public/verify/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create verification');
      }

      const message = `【好餸社企驗證】\n\n驗證碼：${code}\n\n請直接發送此訊息以完成身份驗證。`;

      // Choose best deep link format based on device
      const encodedMsg = encodeURIComponent(message);
      let deepLink: string;
      if (isMobile()) {
        // Mobile: wa.me is most reliable
        deepLink = `https://wa.me/${BUSINESS_PHONE}?text=${encodedMsg}`;
      } else {
        // Desktop: web.whatsapp.com works better for web users
        deepLink = `https://web.whatsapp.com/send?phone=${BUSINESS_PHONE}&text=${encodedMsg}`;
      }

      // Try to open WhatsApp - use location.href on mobile (more reliable), window.open on desktop
      let opened = false;
      if (isMobile()) {
        // For mobile, window.open often blocked; use location.href as primary
        window.location.href = deepLink;
        opened = true;
      } else {
        const win = window.open(deepLink, '_blank');
        opened = !!(win && !win.closed);
      }

      if (!opened) {
        setDeepLinkFailed(true);
      }

      pollVerification(code);
    } catch (err: any) {
      setVerifyError('驗證發起失敗：' + (err.message || '請重試'));
      setVerifyPolling(false);
    }
  };

  const copyVerifyMessage = () => {
    const message = `【好餸社企驗證】\n\n驗證碼：${verifyCode}\n\n請直接發送此訊息以完成身份驗證。`;
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const pollVerification = useCallback(async (code: string) => {
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setVerifyPolling(false);
        setVerifyError('驗證超時，請重新發送或使用簡訊驗證');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/public/verify/status?code=${code}`);
        if (res.ok) {
          const data = await res.json();
          if (data.verified) {
            clearInterval(interval);
            setIsVerified(true);
            setVerifiedPhone(data.phone || '');
            setVerifyPolling(false);
            localStorage.setItem('goodSungVerified', JSON.stringify({
              verified: true,
              phone: data.phone,
              timestamp: Date.now()
            }));
          }
        }
      } catch {
        // continue polling
      }
    }, 5000);
  }, []);

  // ── OTP Fallback ──
  const [otpCode, setOtpCode] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpChecking, setOtpChecking] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  const sendOTP = async () => {
    setVerifyError('');
    const phone = otpPhone.trim();
    if (!phone) {
      setVerifyError('請輸入 WhatsApp 電話號碼');
      return;
    }

    setOtpSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/verify/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '發送失敗');
      }
      setOtpSent(true);
      setOtpCooldown(60);
      setOtpCode('');
    } catch (err: any) {
      setVerifyError('發送驗證碼失敗：' + (err.message || '請重試'));
    } finally {
      setOtpSending(false);
    }
  };

  const checkOTP = async () => {
    setVerifyError('');
    const phone = otpPhone.trim();
    if (!otpCode || otpCode.length !== 6) {
      setVerifyError('請輸入 6 位驗證碼');
      return;
    }

    setOtpChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/verify/check-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otpCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '驗證失敗');
      }
      if (data.verified) {
        setIsVerified(true);
        setVerifiedPhone(data.phone);
        localStorage.setItem('goodSungVerified', JSON.stringify({
          verified: true,
          phone: data.phone,
          timestamp: Date.now()
        }));
      } else {
        setVerifyError(data.error || '驗證碼不正確');
      }
    } catch (err: any) {
      setVerifyError('驗證失敗：' + (err.message || '請重試'));
    } finally {
      setOtpChecking(false);
    }
  };

  // ── Submit Order ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      setStep('verify');
      return;
    }
    if (cart.length === 0) {
      setSubmitError('請先選擇套餐');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const referralCode = searchParams.get('ref');

    try {
      const orderItems = cart.map(item => ({
        packageType: item.packageType,
        selectedDishes: item.selectedDishes,
        selectedSoup: item.selectedSoup,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      }));

      const res = await fetch(`${API_BASE}/api/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          totalPrice: cartTotal,
          region: 'HK',
          address: delivery.address,
          estate: delivery.estate,
          deliveryDate: delivery.deliveryDate,
          deliveryTime: '',
          name: delivery.name,
          phone: verifiedPhone,
          email: null,
          remarks: delivery.remarks,
          referralCode,
          language: 'zh',
          campaignName: searchParams.get('scenarioKey') || 'good-sung-default',
        })
      });

      if (res.ok) {
        const data = await res.json();
        const orderNum = (data.orderNum || "-");
        navigate(`/order/success?orderId=${data.id}&orderNum=${orderNum}&total=${cartTotal}&lang=zh`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setSubmitError(`提交失敗 (${res.status}): ${errorData.error || '請稍後再試'}`);
      }
    } catch (error) {
      setSubmitError('網絡錯誤，請檢查連接後重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-900">
      {/* ===== Header ===== */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="好餸社企" className="h-12 w-auto rounded-lg" />
            <span className="text-xxxl font-bold text-brand-600">
              {campaignConfig?.landingPageConfig?.title || '新鮮餸菜包'}
            </span>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-2 bg-brand-100 px-4 py-2 rounded-full">
              <ShoppingCart size={24} className="text-brand-600" />
              <span className="text-xl font-bold text-brand-700">{cart.length} 份</span>
            </div>
          )}
        </div>
      </header>

      {/* ===== Hero ===== */}
      {step === 'package' && (
        <section className="bg-brand-600 text-white py-6 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xxl leading-relaxed opacity-95">
              {campaignConfig?.landingPageConfig?.description || (
                <>支持 SEN 青年就業<br />每日新鮮製作</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ===== Step 1: Select Package ===== */}
      {step === 'package' && (
        <section className="py-10 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white text-xl font-bold">1</div>
              <h3 className="text-huge font-bold text-gray-800">選擇套餐</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {packages.map(pkg => (
                <button
                  key={pkg.type}
                  onClick={() => handleSelectPackage(pkg)}
                  className="bg-white rounded-2xl shadow-lg p-8 text-left hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-brand-400"
                >
                  <div className="text-xxxl font-bold text-brand-700 mb-2">{pkg.name}</div>
                  <div className="text-huge font-bold text-brand-600 mb-4">HK${pkg.price}</div>
                  <div className="text-xl text-gray-600 space-y-1">
                    <p>• 自選 {pkg.dishCount} 款餸菜</p>
                    <p>• 自選 1 款湯</p>
                    <p>• 每日新鮮製作</p>
                  </div>
                  <div className="mt-6 bg-brand-100 text-brand-700 text-xl font-bold py-4 px-6 rounded-xl text-center">
                    點擊選擇此套餐
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Step 2: Select Dishes & Soup ===== */}
      {step === 'dishes' && selectedPackage && (
        <section className="py-10 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white text-xl font-bold">2</div>
              <h3 className="text-huge font-bold text-gray-800">
                配搭餸菜 — {selectedPackage.name}
              </h3>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow">
              <p className="text-xl text-gray-600 mb-2">
                餸菜：<span className="font-bold text-brand-600">{selectedDishes.length}</span> / {selectedPackage.dishCount} 款
                {selectedDishes.length === selectedPackage.dishCount && <CheckCircle className="inline ml-2 text-green-500" size={24} />}
              </p>
              <p className="text-xl text-gray-600">
                湯：<span className="font-bold text-brand-600">{selectedSoup ? '1' : '0'}</span> / 1 款
                {selectedSoup && <CheckCircle className="inline ml-2 text-green-500" size={24} />}
              </p>
            </div>

            {/* Dishes Grid */}
            <h4 className="text-xxxl font-bold text-gray-800 mb-4">請選擇 {selectedPackage.dishCount} 款餸菜</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {dishes.filter(d => d.enabled).map(dish => {
                const isSelected = selectedDishes.includes(dish.id);
                const isDisabled = !isSelected && selectedDishes.length >= selectedPackage.dishCount;
                const isLowStock = lowStockItems.has(dish.id);
                return (
                  <button
                    key={dish.id}
                    onClick={() => !isDisabled && toggleDish(dish.id)}
                    disabled={isDisabled}
                    className={`rounded-xl p-4 text-center transition-all border-2 relative ${
                      isSelected
                        ? 'bg-brand-100 border-brand-500 shadow-md'
                        : isDisabled
                          ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                          : 'bg-white border-gray-200 hover:border-brand-300 hover:shadow'
                    }`}
                  >
                    {isLowStock && (
                      <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
                        即將售罄
                      </span>
                    )}
                    {dish.imageUrl ? (
                      <div className="relative mb-2">
                        <img src={dish.imageUrl} alt={dish.name} className="w-full aspect-square object-cover rounded-lg" />
                        <div className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-brand-500 text-white' : 'bg-white/80 text-gray-600'}`}>
                          {isSelected ? <CheckCircle size={14} /> : <span className="text-xs">{dishes.indexOf(dish) + 1}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${isSelected ? 'bg-brand-500 text-white' : 'bg-gray-200'}`}>
                        {isSelected ? <CheckCircle size={20} /> : <span className="text-sm">{dishes.indexOf(dish) + 1}</span>}
                      </div>
                    )}
                    <div className="text-lg font-bold text-gray-800">{dish.name}</div>
                    <div className="text-sm text-gray-500">{dish.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Soup Selection */}
            <h4 className="text-xxxl font-bold text-gray-800 mb-4">請選擇 1 款湯</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {soups.filter(s => s.enabled).map(soup => {
                const isSelected = selectedSoup === soup.id;
                const isLowStock = lowStockItems.has(soup.id);
                return (
                  <button
                    key={soup.id}
                    onClick={() => setSelectedSoup(soup.id)}
                    className={`rounded-xl p-4 text-center transition-all border-2 relative ${
                      isSelected
                        ? 'bg-brand-100 border-brand-500 shadow-md'
                        : 'bg-white border-gray-200 hover:border-brand-300 hover:shadow'
                    }`}
                  >
                    {isLowStock && (
                      <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
                        即將售罄
                      </span>
                    )}
                    {soup.imageUrl ? (
                      <div className="relative mb-2">
                        <img src={soup.imageUrl} alt={soup.name} className="w-full aspect-square object-cover rounded-lg" />
                        <div className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-brand-500 text-white' : 'bg-white/80 text-gray-600'}`}>
                          {isSelected ? <CheckCircle size={14} /> : <span className="text-xs">{soups.indexOf(soup) + 1}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${isSelected ? 'bg-brand-500 text-white' : 'bg-gray-200'}`}>
                        {isSelected ? <CheckCircle size={20} /> : <span className="text-sm">{soups.indexOf(soup) + 1}</span>}
                      </div>
                    )}
                    <div className="text-lg font-bold text-gray-800">{soup.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Quantity */}
            <div className="bg-white rounded-xl p-6 mb-6 shadow">
              <label className="text-xl font-bold text-gray-800 block mb-3">份數</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setPackageQuantity(Math.max(1, packageQuantity - 1))}
                  className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-300"
                >
                  <Minus size={24} />
                </button>
                <span className="text-xxxl font-bold w-16 text-center">{packageQuantity}</span>
                <button
                  onClick={() => setPackageQuantity(packageQuantity + 1)}
                  className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-300"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep('package')}
                className="flex-1 bg-gray-200 text-gray-700 text-xl font-bold py-5 rounded-xl hover:bg-gray-300 transition-colors"
              >
                返回重新選擇套餐
              </button>
              <button
                onClick={handleAddToCart}
                disabled={selectedDishes.length !== selectedPackage.dishCount || !selectedSoup}
                className={`flex-[2] text-xl font-bold py-5 rounded-xl transition-colors ${
                  selectedDishes.length === selectedPackage.dishCount && selectedSoup
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                確認加入訂單（HK${selectedPackage.price * packageQuantity}）
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ===== Step 3: Cart Review ===== */}
      {(step === 'cart' || step === 'delivery' || step === 'verify') && (
        <section className="py-10 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white text-xl font-bold">3</div>
              <h3 className="text-huge font-bold text-gray-800">我的訂單</h3>
            </div>

            {cart.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow">
                <p className="text-xl text-gray-500 mb-4">尚未選擇任何套餐</p>
                <button
                  onClick={() => setStep('package')}
                  className="bg-brand-600 text-white text-xl font-bold py-4 px-8 rounded-xl hover:bg-brand-700"
                >
                  去選擇套餐
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {cart.map((item, idx) => (
                    <div key={item.id} className="bg-white rounded-xl p-6 shadow border-l-4 border-brand-500">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-xxxl font-bold text-gray-800">
                            {item.packageType === '2-dish-1-soup' ? '2餸1湯' : '3餸1湯'} × {item.quantity} 份
                          </div>
                          <div className="text-xl text-gray-600 mt-1">
                            餸菜：{getDishNames(item.selectedDishes)}
                          </div>
                          <div className="text-xl text-gray-600">
                            湯：{getSoupName(item.selectedSoup)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-huge font-bold text-brand-600">HK${item.subtotal}</div>
                          <button
                            onClick={() => removeCartItem(item.id)}
                            className="text-red-500 hover:text-red-700 mt-2 flex items-center gap-1 text-lg"
                          >
                            <Trash2 size={20} /> 刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-brand-50 rounded-xl p-6 mb-6 border-2 border-brand-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xxxl font-bold text-gray-800">總計</span>
                    <span className="text-giant font-bold text-brand-700">HK${cartTotal}</span>
                  </div>
                </div>

                <button
                  onClick={() => setStep('package')}
                  className="w-full bg-white border-2 border-brand-400 text-brand-700 text-xl font-bold py-4 rounded-xl hover:bg-brand-50 mb-4"
                >
                  <Plus className="inline mr-2" size={24} /> 再加一份套餐
                </button>

                {/* ===== Step 4: Delivery Form ===== */}
                {step === 'cart' && (
                  <button
                    onClick={() => setStep('delivery')}
                    className="w-full bg-brand-600 text-white text-xxl font-bold py-5 rounded-xl hover:bg-brand-700 shadow-lg"
                  >
                    下一步：填寫送貨資料
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ===== Delivery Form ===== */}
      {step === 'delivery' && cart.length > 0 && (
        <section className="py-10 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white text-xl font-bold">4</div>
              <h3 className="text-huge font-bold text-gray-800">送貨資料</h3>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setStep('verify'); }} className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
              {/* Estate */}
              <div>
                <label className="block text-xl font-bold text-gray-800 mb-2">送貨屋苑</label>
                <select
                  name="estate"
                  required
                  value={delivery.estate}
                  onChange={handleDeliveryChange}
                  className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                >
                  <option value="善樓">善樓</option>
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xl font-bold text-gray-800 mb-2">送貨地址</label>
                <input
                  type="text"
                  name="address"
                  placeholder="大廈名稱、樓層及單位"
                  required
                  value={delivery.address}
                  onChange={handleDeliveryChange}
                  className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xl font-bold text-gray-800 mb-2">送貨日期</label>
                <input
                  type="date"
                  name="deliveryDate"
                  required
                  min={minDateStr}
                  value={delivery.deliveryDate}
                  onChange={handleDeliveryChange}
                  className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
                <p className="text-lg text-brand-600 mt-1 font-medium">需提前 2 天預訂</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xl font-bold text-gray-800 mb-2">聯絡人姓名</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={delivery.name}
                  onChange={handleDeliveryChange}
                  className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xl font-bold text-gray-800 mb-2">備註（可選）</label>
                <textarea
                  name="remarks"
                  rows={3}
                  placeholder="如有特別要求請註明"
                  value={delivery.remarks}
                  onChange={handleDeliveryChange}
                  className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#25D366] text-white text-xxl font-bold py-5 rounded-xl hover:bg-[#128C7E] shadow-lg transition-colors flex items-center justify-center gap-3"
              >
                <MessageCircle size={28} />
                WhatsApp 發送
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ===== Verification Step ===== */}
      {step === 'verify' && (
        <section className="py-10 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white text-xl font-bold">5</div>
            </div>

            {isVerified ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
                <ShieldCheck size={64} className="text-green-600 mx-auto mb-4" />
                <h4 className="text-xxxl font-bold text-green-700 mb-2">驗證成功</h4>
                <p className="text-xl text-gray-700 mb-6">已綁定電話：{verifiedPhone}</p>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-brand-600 text-white text-xxl font-bold py-5 rounded-xl hover:bg-brand-700 shadow-lg disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <><Loader2 className="inline animate-spin mr-2" size={28} /> 提交中...</>
                  ) : (
                    `確認下單（HK$${cartTotal}）`
                  )}
                </button>
                {submitError && (
                  <p className="mt-4 text-xl text-red-600 bg-red-50 p-4 rounded-lg">{submitError}</p>
                )}
              </div>
            ) : !useOtpMode ? (
              // Mode 1: wa.me + SaleSmartly webhook (no phone input needed)
              <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="text-center mb-8">
                  <MessageCircle size={64} className="text-brand-600 mx-auto mb-4" />
                </div>

                {verifyPolling && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6 text-center">
                    <Loader2 className="animate-spin mx-auto mb-3 text-blue-600" size={36} />
                    <p className="text-xl text-blue-700 font-medium">正在等待驗證...</p>
                    <p className="text-lg text-blue-600 mt-1">請在 WhatsApp 中發送驗證訊息</p>
                    <p className="text-lg text-gray-500 mt-2">驗證碼：{verifyCode}</p>
                  </div>
                )}

                {deepLinkFailed && verifyPolling && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
                    <p className="text-xl text-yellow-800 font-bold mb-3 text-center">⚠️ 無法自動打開 WhatsApp</p>
                    <p className="text-lg text-yellow-700 mb-4 text-center">
                      請手動複製以下訊息，發送到 WhatsApp：
                    </p>
                    <div className="bg-white border border-yellow-300 rounded-lg p-4 mb-4 text-left">
                      <p className="text-lg text-gray-800 whitespace-pre-line">
                        【好餸社企驗證】{'\n'}驗證碼：{verifyCode}{'\n'}請直接發送此訊息以完成身份驗證。
                      </p>
                    </div>
                    <button
                      onClick={copyVerifyMessage}
                      className="w-full bg-yellow-500 text-white text-xl font-bold py-3 rounded-xl hover:bg-yellow-600 shadow-md flex items-center justify-center gap-2"
                    >
                      {copied ? <Check size={22} /> : <Copy size={22} />}
                      {copied ? '已複製！' : '複製驗證訊息'}
                    </button>
                    <p className="text-base text-yellow-700 mt-3 text-center">
                      複製後請打開 WhatsApp，搜尋 <strong>+852 6232 2466</strong>，貼上訊息並發送
                    </p>
                  </div>
                )}

                {verifyError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 text-center">
                    <p className="text-xl text-red-700">{verifyError}</p>
                  </div>
                )}

                <button
                  onClick={startVerification}
                  disabled={verifyPolling}
                  className="w-full bg-green-600 text-white text-xxl font-bold py-5 rounded-xl hover:bg-green-700 shadow-lg disabled:opacity-60 flex items-center justify-center gap-3"
                >
                  <MessageCircle size={28} />
                  {verifyPolling ? '等待驗證中...' : '打開 WhatsApp 發送'}
                </button>

                <div className="mt-6 space-y-3 text-center">
                </div>
              </div>
            ) : (
              // Mode 2: OTP fallback
              <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="text-center mb-8">
                  <MessageCircle size={64} className="text-brand-600 mx-auto mb-4" />
                  <h4 className="text-xxxl font-bold text-gray-800 mb-3">簡訊驗證（後備方案）</h4>
                  <p className="text-xl text-gray-600 leading-relaxed">
                    我們會發送 6 位數驗證碼到您的 WhatsApp。<br />
                    請輸入驗證碼完成身份驗證。
                  </p>
                </div>

                {/* Phone input for OTP mode */}
                <div className="mb-6">
                  <label className="block text-xl font-bold text-gray-800 mb-2">WhatsApp 電話</label>
                  <input
                    type="tel"
                    placeholder="例如：85251164453"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    className="w-full p-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>

                {/* Send OTP button */}
                {!otpSent ? (
                  <button
                    onClick={sendOTP}
                    disabled={otpSending || !otpPhone}
                    className="w-full bg-green-600 text-white text-xxl font-bold py-5 rounded-xl hover:bg-green-700 shadow-lg disabled:opacity-60 flex items-center justify-center gap-3"
                  >
                    {otpSending ? (
                      <><Loader2 className="animate-spin" size={28} /> 發送中...</>
                    ) : (
                      <><MessageCircle size={28} /> 發送驗證碼到 WhatsApp</>
                    )}
                  </button>
                ) : (
                  <>
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6 text-center">
                      <p className="text-xl text-blue-700 font-medium">✅ 驗證碼已發送</p>
                      <p className="text-lg text-blue-600 mt-1">請查看您的 WhatsApp 訊息</p>
                      {otpCooldown > 0 && (
                        <p className="text-lg text-gray-500 mt-2">{otpCooldown} 秒後可重新發送</p>
                      )}
                      {otpCooldown === 0 && (
                        <button
                          onClick={sendOTP}
                          disabled={otpSending}
                          className="mt-3 text-lg text-blue-600 underline hover:text-blue-800"
                        >
                          重新發送驗證碼
                        </button>
                      )}
                    </div>

                    {/* OTP Input */}
                    <div className="mb-6">
                      <label className="block text-xl font-bold text-gray-800 mb-2">輸入 6 位驗證碼</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="______"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full p-4 text-xxxl font-bold text-center tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      />
                    </div>

                    <button
                      onClick={checkOTP}
                      disabled={otpChecking || otpCode.length !== 6}
                      className="w-full bg-brand-600 text-white text-xxl font-bold py-5 rounded-xl hover:bg-brand-700 shadow-lg disabled:opacity-60"
                    >
                      {otpChecking ? (
                        <><Loader2 className="inline animate-spin mr-2" size={28} /> 驗證中...</>
                      ) : (
                        '驗證並確認'
                      )}
                    </button>
                  </>
                )}

                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setUseOtpMode(false); setVerifyError(''); }}
                    className="text-lg text-gray-500 underline hover:text-brand-600"
                  >
                    返回 WhatsApp 驗證
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Footer ===== */}
      <footer className="bg-gray-800 text-gray-400 py-4 text-center mt-10">
        <p className="text-xl">好餸社企十年耕耘，成就SEN青年就業</p>
      </footer>
    </div>
  );
};

export default OrderLanding;
