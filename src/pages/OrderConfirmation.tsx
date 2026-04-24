import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Home, CreditCard, Upload, Banknote, Smartphone, Copy, Check } from 'lucide-react';

const OrderConfirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const orderId = searchParams.get('orderId');
  const orderNum = searchParams.get('orderNum');
  const total = searchParams.get('total');

  const handleBack = () => {
    navigate('/');
  };

  const handleUploadProof = () => {
    navigate(`/payment-proof/${orderNum}`);
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-200 rounded-full blur-lg opacity-50"></div>
              <CheckCircle size={120} className="text-green-500 relative z-10" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-center text-gray-800 mb-3">
            訂單已確認！
          </h1>
          <p className="text-center text-xl text-gray-600 mb-8">
            感謝您的訂單，確認訊息已發送到您的 WhatsApp。
          </p>

          <div className="bg-white rounded-xl border-2 border-brand-200 p-6 mb-6 shadow">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-xl text-gray-600">訂單編號</span>
                <span className="font-bold text-2xl text-brand-600">#{orderNum}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-xl text-gray-600">總金額</span>
                <span className="font-bold text-2xl text-gray-800">HK${total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xl text-gray-600">狀態</span>
                <span className="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-full text-lg font-bold">
                  待付款
                </span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
              <CreditCard size={24} />
              請付款至以下賬戶
            </h3>
            <div className="space-y-3 text-lg text-gray-700">
              <div className="flex items-start gap-3">
                <Banknote size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">DBS 銀行戶口</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-mono">016-000227829</p>
                    <button
                      onClick={() => handleCopy('016-000227829', 'dbs')}
                      className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                      title="複製銀行戶口號碼"
                    >
                      {copiedField === 'dbs' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Smartphone size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">FPS 轉數快</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-mono">108810334</p>
                    <button
                      onClick={() => handleCopy('108810334', 'fps')}
                      className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                      title="複製 FPS 號碼"
                    >
                      {copiedField === 'fps' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">戶口名稱</p>
                  <div className="flex items-center gap-2">
                    <p>DELICIOUS EXPRESS LTD</p>
                    <button
                      onClick={() => handleCopy('DELICIOUS EXPRESS LTD', 'name')}
                      className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                      title="複製戶口名稱"
                    >
                      {copiedField === 'name' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Payment Proof */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-800 mb-3 flex items-center gap-2">
              <Upload size={24} />
              上傳付款憑證
            </h3>
            <p className="text-lg text-gray-600 mb-4">
              付款後請上傳付款記錄，我們會盡快確認您的訂單。
            </p>
            <button
              onClick={handleUploadProof}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Upload size={24} />
              上傳付款記錄
            </button>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <div className="text-lg text-gray-700 space-y-3">
              <div className="flex items-start gap-2"><CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" /> 確認訊息已發送到您的 WhatsApp（含付款資料）</div>
              <div className="flex items-start gap-2"><CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" /> 付款後請上傳付款憑證</div>
              <div className="flex items-start gap-2"><CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" /> 我們確認後會通知您</div>
            </div>
          </div>

          <button
            onClick={handleBack}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xl font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Home size={24} />
            返回首頁
          </button>
        </div>
      </div>

      <footer className="bg-gray-800 text-gray-400 py-4 text-center">
        <p className="text-xl">好餸社企十年耕耘，成就SEN青年就業之路</p>
      </footer>
    </div>
  );
};

export default OrderConfirmation;
