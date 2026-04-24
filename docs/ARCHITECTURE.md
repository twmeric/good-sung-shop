# Good Sung Shop (好餸社企) — 系統架構文檔

> **專案**: Good Sung Shop — 社企餸菜包外賣平台  
> **技術棧**: React 18 + TypeScript + Vite 7 + Tailwind CSS 3 + React Router 6 (Frontend) / Hono + Cloudflare Worker + D1 SQLite + KV + R2 (Backend)  
> **文件編碼**: UTF-8

---

## 目錄

1. [系統總覽圖](#1-系統總覽圖)
2. [前端架構](#2-前端架構)
3. [後端架構](#3-後端架構)
4. [數據流](#4-數據流)
5. [WhatsApp 整合流程](#5-whatsapp-整合流程)
6. [安全模型](#6-安全模型)
7. [廣播推廣系統流程](#7-廣播推廣系統流程)

---

## 1. 系統總覽圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用戶層 (User Layer)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  顧客 (手機) │  │  顧客 (電腦) │  │ 管理員後台  │  │ WhatsApp Business   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘ │
└─────────┼────────────────┼────────────────┼──────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         前端層 (Frontend Layer)                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  React 18 SPA (Vite 7 + TypeScript + Tailwind CSS 3)                    ││
│  │  • React Router 6 (BrowserRouter)                                       ││
│  │  • 顧客端: OrderLanding, OrderConfirmation, PaymentProofUpload          ││
│  │  • 管理端: AdminLayout + 13 個 Admin Pages                              ││
│  │  • Dark Mode: `darkMode: 'class'` in tailwind.config.js                 ││
│  │  • 品牌色: `brand-600` = `#ea580c` (Orange)                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │  HTTPS / REST JSON
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        後端層 (Backend Layer)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Cloudflare Worker (Hono Framework) — `worker/src/index.ts` (~2300行)   ││
│  │  • CORS Middleware (`origin: "*"`)                                      ││
│  │  • Lazy DB Initialization Middleware                                    ││
│  │  • RBAC Auth Middleware (`authMiddleware(allowedRoles?)`)               ││
│  │  • `snakeToCamel()` 轉換 D1 數據格式                                    ││
│  │  • `jsonResponse()` 統一 JSON + CORS 響應                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  D1 SQLite  │  │  Cloudflare │  │  Cloudflare │
│  (關聯數據)  │  │  KV         │  │  R2         │
│             │  │ (快取/驗證)  │  │ (媒體存儲)   │
└─────────────┘  └─────────────┘  └─────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        外部服務 (External Services)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  CloudWAPI (WhatsApp API) — `sendWhatsAppMessage(env, phone, message)`  ││
│  │  • 發送端點: `https://unofficial.cloudwapi.in/send-message`             ││
│  │  • 發送者: `CLOUDWAPI_SENDER`                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 前端架構

### 2.1 技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | ~5.x | 類型安全 |
| Vite | 7 | 構建工具 / Dev Server |
| Tailwind CSS | 3 | 原子化 CSS |
| React Router | 6 | 客戶端路由 |
| Lucide React | latest | 圖標庫 |

### 2.2 路由結構 (`src/App.tsx`)

```tsx
// 顧客端路由 (公開)
/                          → OrderLanding (下單頁)
/campaign/:scenarioKey     → OrderLanding (帶 Campaign 參數)
/order/success             → OrderConfirmation (下單成功)
/payment-proof/:orderNum   → PaymentProofUpload (上傳付款證明)

// 管理端路由 (需登入 + RBAC)
/admin                     → AdminLogin (登入頁)
/admin/dashboard           → AdminDashboard  [super_admin, admin]
/admin/orders              → AdminOrders     [super_admin, admin]
/admin/orders/:id          → AdminOrderDetail [super_admin, admin]
/admin/products            → AdminProducts   [super_admin, admin, supplier]
/admin/package-configs     → AdminPackageConfigs [super_admin, admin]
/admin/media-library       → AdminMediaLibrary [super_admin, admin, supplier]
/admin/broadcast           → AdminBroadcast  [super_admin]
/admin/users               → AdminUsers      [super_admin]
/admin/settings            → AdminSettings   [super_admin]
/admin/audit-logs          → AdminAuditLogs  [super_admin]
```

### 2.3 路由守衛 (`AdminRoute`)

```tsx
function AdminRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('admin_token');
  const user = JSON.parse(localStorage.getItem('admin_user') || 'null');

  if (!token) return <Navigate to="/admin" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    if (user.role === 'supplier') return <Navigate to="/admin/products" />;
    return <Navigate to="/admin/dashboard" />;
  }
  return <>{children}</>;
}
```

### 2.4 狀態管理

本專案**未使用 Redux / Zustand**，狀態管理採用：

- **Local State**: `useState`, `useEffect` (各頁面獨立管理)
- **Global Auth State**: `localStorage` 存儲 `admin_token` + `admin_user`
- **Theme State**: `localStorage` 存儲 `admin_theme` (`dark` / `light`)
- **API Client**: `src/lib/api.ts` — 統一封裝 `fetch`，自動注入 `Bearer` Token

### 2.5 API 客戶端 (`src/lib/api.ts`)

```ts
const API_BASE = "https://good-sung-shop.jimsbond007.workers.dev";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("admin_token");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
```

> ⚠️ **重要**: 所有管理端頁面統一使用 `apiFetch()`，**不使用 EdgeSpark client**。

### 2.6 佈局系統

- **管理端佈局**: `src/components/AdminLayout.tsx`
  - 左側 Sidebar (可折疊)
  - 頂部標題欄
  - 根據 `user.role` 動態過濾選單項目
  - Dark Mode 切換按鈕 (切換 `dark` class on root)

---

## 3. 後端架構

### 3.1 技術棧

| 技術 | 用途 |
|------|------|
| Hono | 輕量級 Web 框架 (類似 Express) |
| Cloudflare Worker | Serverless 運行環境 |
| D1 SQLite | 關聯式數據庫 (14 張表) |
| Cloudflare KV | 鍵值存儲 (CMS 數據、OTP、驗證狀態) |
| Cloudflare R2 | 對象存儲 (付款證明、媒體圖片) |

### 3.2 Worker 入口 (`worker/src/index.ts`)

單一文件架構 (~2300 行)，按功能分區：

```
worker/src/index.ts
├── Types (Env, OrderItem, AdminUser)
├── CORS Config
├── Utilities (snakeToCamel, jsonResponse, hashPassword, generateToken, generateOrderNum, ...)
├── WhatsApp Helper (sendWhatsAppMessage)
├── Auth Middleware (authMiddleware)
├── DB Initialization (initDB) — 建表 + 遷移 + 預設數據
├── Audit Log Helper (logAudit)
├── CMS Defaults (DEFAULT_CMS)
├── Hono App Instance
│   ├── Lazy DB Init Middleware
│   ├── CMS API Routes
│   ├── Verification API Routes
│   ├── OTP API Routes
│   ├── Order API Routes
│   ├── Payment Proof Routes
│   ├── Admin: Orders Routes
│   ├── Admin: Auth Routes
│   ├── Admin: Products Routes
│   ├── Admin: Package Configs Routes
│   ├── Admin: Media Routes
│   ├── Public: Products / Package Configs / Campaigns
│   ├── Admin: Broadcast Routes
│   ├── Admin: Users Routes
│   ├── Admin: Settings Routes
│   ├── Admin: Audit Logs Routes
│   ├── Webhook: WhatsApp
│   ├── Admin: WhatsApp Conversations
│   └── Webhook Helpers (extractPhoneFromWebhook, extractMessageFromWebhook)
└── Default Export (fetch handler)
```

### 3.3 Middleware 鏈

```
Request
  → CORS Middleware (`app.use("/*", cors(corsConfig))`)
  → Lazy DB Init Middleware (首次請求時執行 `initDB()`)
  → Route Handler
    → Auth Middleware (如需權限檢查)
      → 業務邏輯
        → jsonResponse(data, status)
```

### 3.4 數據轉換層

D1 返回 `snake_case` 欄位名，前端期望 `camelCase`：

```ts
function snakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = snakeToCamel(value);
  }
  return result;
}
```

使用位置：所有 Admin API 的 `SELECT` 結果在返回前均經過 `snakeToCamel()` 處理。

---

## 4. 數據流

### 4.1 下單 → 付款 → 完成 完整流程

```
[顧客] 瀏覽 OrderLanding 頁面
   │
   ▼
[顧客] 選擇套餐 (2餸1湯 / 3餸1湯) + 菜式 + 湯
   │
   ▼
[顧客] 填寫配送資訊 (姓名、電話、地址、區域、日期、時段)
   │
   ▼
[顧客] 輸入驗證碼 / OTP (WhatsApp 接收)
   │
   ▼
[前端] POST /api/public/orders
   │
   ▼
[Worker] 生成訂單編號 (generateOrderNum: XX1234)
   │    寫入 D1 order_records 表
   │
   ├──→ [WhatsApp] 發送訂單確認給顧客
   ├──→ [WhatsApp] 發送訂單通知給管理員
   └──→ [Referral] 如有推薦碼，通知推薦人
   │
   ▼
[顧客] 收到 WhatsApp，內含付款資訊 + 上傳連結
   │
   ▼
[顧客] 銀行轉帳 / FPS 付款
   │
   ▼
[顧客] 點擊連結上傳付款證明 → /payment-proof/:orderNum
   │
   ▼
[前端] POST /api/public/payment-proof/upload (FormData)
   │
   ▼
[Worker] 上傳檔案到 R2 → 更新 order_records.payment_proof
   │
   └──→ [WhatsApp] 通知管理員「新付款記錄」
   │
   ▼
[管理員] 登入後台 → AdminOrders 頁面
   │
   ▼
[管理員] 查看訂單，確認收到款項
   │
   ▼
[管理員] 點擊「確認付款」→ PUT /api/public/admin/orders/:id
   │
   ▼
[Worker] 更新 payment_confirmed = 1
   │    自動扣減 cms_products 庫存
   │
   └──→ [WhatsApp] 發送付款確認通知給顧客
   │
   ▼
[管理員] 安排配送
   │
   ▼
[管理員] 點擊「標記完成」→ POST /api/public/admin/orders/:id/complete
   │
   ▼
[Worker] 更新 order_completed = 1
   │
   ▼
[訂單] 流程結束
```

### 4.2 訂單狀態機

```
┌─────────────┐     下單成功      ┌─────────────┐
│   新訂單    │ ───────────────→ │  待付款      │
│  (created)  │                  │ (pending)    │
└─────────────┘                  └──────┬──────┘
                                        │
                         上傳付款證明    │
                         管理員確認付款   │
                                        ▼
                               ┌─────────────┐
                               │  已確認付款   │
                               │ (confirmed)  │
                               └──────┬──────┘
                                      │
                         配送完成      │
                                      ▼
                               ┌─────────────┐
                               │   已完成     │
                               │ (completed)  │
                               └─────────────┘
```

> 數據庫中以兩個布林欄位表示：`payment_confirmed` (0/1) + `order_completed` (0/1)

---

## 5. WhatsApp 整合流程

### 5.1 發送流程 (CloudWAPI)

```ts
async function sendWhatsAppMessage(env: Env, phone: string, message: string) {
  const pushUrl = new URL("https://unofficial.cloudwapi.in/send-message");
  pushUrl.searchParams.append("api_key", env.CLOUDWAPI_API_KEY);
  pushUrl.searchParams.append("sender", env.CLOUDWAPI_SENDER);
  pushUrl.searchParams.append("number", phone);
  pushUrl.searchParams.append("message", message);

  const res = await fetch(pushUrl.toString(), {
    headers: { "User-Agent": "GoodSung-Worker/1.0" },
  });
  // return { success: true } or { success: false, error }
}
```

### 5.2 發送場景

| 場景 | 接收者 | 觸發條件 |
|------|--------|----------|
| 訂單確認 | 顧客 + 管理員 | `POST /api/public/orders` 成功後 |
| 付款確認 | 顧客 | `PUT /api/public/admin/orders/:id` 設置 `paymentConfirmed=1` |
| 新付款記錄 | 管理員 | `POST /api/public/payment-proof/upload` 成功後 |
| 推薦成功 | 推薦人 | 新訂單帶有 `referralCode` 且匹配成功 |
| OTP 驗證碼 | 顧客 | `POST /api/public/verify/send-otp` |
| 帳號創建通知 | 新管理員 | `POST /api/admin/users` 創建用戶時 |
| 登入資料重發 | 管理員/供應商 | `POST /api/admin/users/send-credentials` |
| 廣播推廣 | 顧客群組 | `POST /api/public/admin/broadcast-send` |
| 驗證成功確認 | 顧客 | Webhook 收到驗證碼並驗證成功後 |

### 5.3 Webhook 接收流程 (`POST /api/webhooks/whatsapp`)

```
[WhatsApp Provider] ──→ [Worker Webhook]
                              │
                              ├──→ 嘗試多種格式解析 phone / message
                              │    (支援 CloudWAPI, SaleSmartly, 標準格式)
                              │
                              ├──→ 檢測是否為驗證碼 (6位英數組合)
                              │    ├──→ 更新 D1 verification_sessions
                              │    ├──→ 更新 KV verify_{code}
                              │    └──→ 回覆顧客「驗證成功」
                              │
                              └──→ 非驗證碼訊息
                                   └──→ 存入 D1 whatsapp_messages 表
```

### 5.4 管理端對話管理

- `GET /api/public/admin/whatsapp/conversations` — 獲取所有對話列表 (按電話分組)
- `GET /api/public/admin/whatsapp/conversations/:phone` — 獲取單個對話歷史
- `POST /api/public/admin/whatsapp/send` — 管理員主動發送訊息

---

## 6. 安全模型

### 6.1 RBAC (Role-Based Access Control)

| 角色 | 權限範圍 |
|------|----------|
| `super_admin` | 全部功能 (用戶管理、廣播推廣、系統設置、操作日誌) |
| `admin` | 訂單管理、產品管理、套餐配置、媒體庫 |
| `supplier` | 僅產品管理、媒體庫 |

### 6.2 認證流程

```
[管理員] 輸入 username + password
   │
   ▼
[Worker] POST /api/public/admin/login
   │
   ├──→ 查詢 D1 admin_users 表
   ├──→ verifyPassword(password, password_hash) — SHA-256
   ├──→ 生成 token (32 bytes hex random)
   ├──→ 更新 admin_users.token
   └──→ 記錄 audit log (LOGIN)
   │
   ▼
[前端] 存儲 token 到 localStorage (admin_token)
       存儲用戶資訊到 localStorage (admin_user)
   │
   ▼
[後續請求] 所有 Admin API 攜帶 Header: Authorization: Bearer {token}
   │
   ▼
[Worker] authMiddleware()
   ├──→ 從 Header 提取 token
   ├──→ 查詢 admin_users.token 匹配用戶
   ├──→ 檢查 is_active === 1
   ├──→ 檢查 role 是否在 allowedRoles 中
   └──→ 將 adminUser 注入 Context (c.set("adminUser", user))
```

### 6.3 密碼哈希

```ts
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

> ⚠️ 注意: 當前使用 SHA-256 單次哈希，未使用 salt。生產環境建議遷移至 bcrypt/Argon2。

### 6.4 向後兼容

系統保留 `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` + `ADMIN_TOKEN_SECRET` 環境變數作為 fallback：

```ts
// 如果數據庫 token 驗證失敗，檢查硬編碼 token
if (token === env.ADMIN_TOKEN_SECRET) {
  c.set("adminUser", { id: 0, username: "admin", role: "super_admin", ... });
  await next();
  return;
}
```

---

## 7. 廣播推廣系統流程

### 7.1 核心概念

| 實體 | 說明 |
|------|------|
| `broadcast_campaigns` | 推廣活動模板 (名稱 + 訊息內容) |
| `broadcast_batches` | 發送批次 (關聯活動 + 目標名單 + 發送速率配置) |
| `broadcast_logs` | 發送日誌 (每個目標一條記錄，記錄狀態) |

### 7.2 發送流程

```
[管理員] 創建 Campaign → POST /api/public/admin/broadcast-campaigns
   │
   ▼
[管理員] 選擇目標顧客群組 (可篩選: 付款狀態、屋苑、最近下單天數)
   │
   ▼
[管理員] 創建 Batch → POST /api/public/admin/broadcast-batches
   │    { campaignId, name, phones[], names[], rateMinSeconds, rateMaxSeconds, waveSize, waveIntervalSeconds }
   │
   ▼
[Worker] 創建 batch 記錄 (status = 'pending')
   │    為每個 phone 創建 broadcast_logs 記錄 (status = 'pending')
   │
   ▼
[前端] 逐條調用發送 API → POST /api/public/admin/broadcast-send
   │    { logId, phone, message }
   │
   ▼
[Worker] 調用 sendWhatsAppMessage()
   │    更新 broadcast_logs.status = 'sent' / 'failed'
   │    更新 broadcast_batches.sent_count / failed_count
   │    檢查是否全部完成 → 更新 batch.status = 'completed'
   │
   ▼
[前端] 實時輪詢 Batch 狀態和 Logs 更新發送進度
```

### 7.3 速率控制

- `rate_min_seconds`: 每條訊息最小間隔 (預設 25 秒)
- `rate_max_seconds`: 每條訊息最大間隔 (預設 120 秒)
- `wave_size`: 每波發送數量 (預設 50)
- `wave_interval_seconds`: 波次間隔 (預設 300 秒)

> 速率控制由前端實現 (調用間隔 `setTimeout`)，後端僅存儲配置值。

---

## 附錄：關鍵文件位置

| 文件 | 路徑 |
|------|------|
| Worker 入口 | `worker/src/index.ts` |
| API 客戶端 | `src/lib/api.ts` |
| 管理端佈局 | `src/components/AdminLayout.tsx` |
| 前端路由 | `src/App.tsx` |
| Tailwind 配置 | `tailwind.config.js` |
| Worker 配置 | `worker/wrangler.toml` |
| 頁面組件 | `src/pages/*.tsx` |
