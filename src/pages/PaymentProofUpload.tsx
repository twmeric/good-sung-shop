import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, Loader, ArrowLeft } from 'lucide-react';

const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';

interface UploadStatus {
  state: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
}

const PaymentProofUpload: React.FC = () => {
  const { orderNum } = useParams<{ orderNum: string }>();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setStatus({ state: 'idle' });
    }
  };

  const handleUpload = async () => {
    if (!file || !orderNum) {
      setStatus({ state: 'error', message: '請選擇檔案' });
      return;
    }

    setUploading(true);
    setStatus({ state: 'uploading' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderNum', orderNum);

      const response = await fetch(`${API_BASE}/api/public/payment-proof/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setStatus({
          state: 'success',
          message: '付款記錄上傳成功！我們會盡快驗證及確認。'
        });
        setFile(null);
        setPreview('');
      } else {
        const error = await response.json();
        setStatus({ state: 'error', message: error.error || '上傳失敗' });
      }
    } catch (error) {
      setStatus({ state: 'error', message: '上傳過程中發生錯誤' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col p-4">
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-lg w-full">
          <div className="text-center mb-6">
            <Upload size={56} className="mx-auto text-blue-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">上傳付款記錄</h1>
            <p className="text-xl text-gray-600 mt-2">訂單號碼 #{orderNum}</p>
          </div>

          {status.state === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 flex gap-3">
              <CheckCircle className="text-green-500 flex-shrink-0" size={28} />
              <div>
                <p className="font-bold text-xl text-green-700">上傳成功！</p>
                <p className="text-lg text-green-600">{status.message}</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-3 bg-green-600 text-white text-lg font-bold py-3 px-6 rounded-xl hover:bg-green-700"
                >
                  返回首頁
                </button>
              </div>
            </div>
          )}

          {status.state === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={28} />
              <div>
                <p className="font-bold text-xl text-red-700">上傳失敗</p>
                <p className="text-lg text-red-600">{status.message}</p>
              </div>
            </div>
          )}

          {status.state !== 'success' && (
            <>
              <div className="bg-white rounded-xl border-2 border-dashed border-blue-300 p-6 mb-6">
                {preview ? (
                  <div className="text-center">
                    <img src={preview} alt="Preview" className="max-h-48 mx-auto mb-4 rounded-xl" />
                    <p className="text-lg text-gray-600 mb-4 break-words">{file?.name}</p>
                    <button onClick={() => setFile(null)} className="text-blue-500 hover:text-blue-700 text-lg font-medium">
                      更改檔案
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={48} className="mx-auto text-blue-400 mb-3" />
                    <p className="text-xl text-gray-700 font-bold mb-2">點擊選擇或拖放檔案</p>
                    <p className="text-lg text-gray-500 mb-4">JPG、PNG 或 PDF（最大 5MB）</p>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} disabled={uploading} className="hidden" id="file-input" />
                    <label htmlFor="file-input" className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold py-3 px-8 rounded-xl cursor-pointer transition-all">
                      選擇檔案
                    </label>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                <p className="font-bold text-xl text-blue-900 mb-3">付款記錄指南：</p>
                <ul className="text-lg text-gray-700 space-y-2">
                  <li>• 必須清楚顯示交易詳情</li>
                  <li>• 金額必須與訂單總額相符</li>
                  <li>• 接受截圖或照片</li>
                  <li>• 我們會盡快驗證</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-xl font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {uploading && <Loader size={24} className="animate-spin" />}
                  上傳付款記錄
                </button>
                <button
                  onClick={() => navigate('/')}
                  disabled={uploading}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={24} />
                  取消
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentProofUpload;
