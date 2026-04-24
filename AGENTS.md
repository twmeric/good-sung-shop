# AGENTS.md — Good Sung Shop (好餸社企)

> 本文件是給 **AI 編碼助手和後續開發者** 的技術參考。閱讀本文件後，你應該能在 5 分鐘內理解整個項目的結構和開發規範。

---

## 📍 快速導航

| 要找什麼 | 去哪裡 |
|---------|--------|
| **客戶下單頁面** | `src/pages/OrderLanding.tsx` |
| **管理後台佈局** | `src/components/AdminLayout.tsx` |
| **API 客戶端** | `src/lib/api.ts` |
| **所有後端 API** | `worker/src/index.ts` (單文件, ~2200 行) |
| **數據庫表結構** | `worker/src/index.ts` → `initDB()` 函數 |
| **路由配置** | `src/App.tsx` |
| **Tailwind 主題色** | `tailwind.config.js` |
| **Worker 配置** | `worker/wrangler.toml` |
| **完整架構文檔** | `docs/ARCHITECTURE.md` |
| **完整數據庫文檔** | `docs/DATABASE.md` |
| **完整 API 文檔** | `docs/API.md` |
| **部署指南** | `DEPLOY.md` |

---

## 🏗️ 架構核心

### 前端
- **React 18 SPA**，Vite 構建，部署到 **Cloudflare Pages**
- **React Router 6** 處理路由
- **Tailwind CSS** 樣式，`darkMode: 'class'` 支持暗黑模式
- **品牌色**: `brand-600` = `#ea580c` (橙色)，所有 admin 頁面使用橙色主題
- **API 調用**: 統一使用 `apiFetch()` (見 `src/lib/api.ts`)，**不要用 EdgeSpark 的 `client.api.fetch`**

### 後端
- **Hono** 框架，單一文件 `worker/src/index.ts` (~2200 行)
- **Cloudflare D1** (SQLite) 存儲業務數據
- **Cloudflare KV** 存儲系統設置
- **Cloudflare R2** 存儲付款憑證和媒體庫圖片
- **CloudWAPI** 發送 WhatsApp 消息

### 認證模型
- 登入時後端生成 token 存入 `admin_users.token`
- 前端將 token 存於 `localStorage.admin_token`
- 每次 API 請求帶 `Authorization: Bearer {token}` Header
- `authMiddleware(allowedRoles?)` 驗證 token 和角色權限
- 角色: `super_admin` > `admin` > `supplier`

---

## 🗄️ 數據庫約定

### 命名規則
- **DB 層**: `snake_case` (`order_num`, `payment_confirmed`)
- **前端**: `camelCase` (`orderNum`, `paymentConfirmed`)
- **轉換**: Worker 使用 `snakeToCamel()` 函數自動轉換後返回

### 核心表 (14張)

| 表名 | 用途 |
|------|------|
| `order_records` | 訂單數據 |
| `verification_sessions` | WhatsApp 驗證碼會話 |
| `admin_users` | 管理員/供應商帳號 (RBAC) |
| `campaigns` | 活動配置 (OrderLanding 動態標題用) |
| `broadcast_campaigns` | 廣播訊息模板 |
| `broadcast_batches` | 廣播發送批次 |
| `broadcast_logs` | 單條發送記錄 |
| `referral_records` | 推薦關係 |
| `cms_products` | 產品/餸菜/湯 |
| `package_configs` | 套餐配置 (2餸1湯/3餸1湯) |
| `admin_audit_logs` | 操作審計 |
| `system_settings` | 系統設置 (key-value) |
| `whatsapp_messages` | WhatsApp 對話記錄 |

---

## 🔌 API 約定

### 路由前綴規則
- `/api/public/*` — 公開 API (顧客端 + 部分 admin)
- `/api/admin/*` — 純管理 API (super_admin only)
- `/api/webhooks/*` — Webhook 接收端

### 統一響應格式
```ts
// 成功
{ "success": true, "id": 123 }

// 失敗
{ "error": "錯誤信息" }
```

### 關鍵端點速查
```
POST /api/public/orders              # 顧客下單
GET  /api/public/admin/orders        # admin 訂單列表
PUT  /api/public/admin/orders/:id    # 更新訂單 (確認付款等)
GET  /api/public/products            # 產品列表 (顧客端)
GET  /api/public/package-configs     # 套餐列表 (顧客端)
POST /api/public/admin/broadcast-send # 發送單條 WhatsApp
POST /api/webhooks/whatsapp          # CloudWAPI Webhook
```

---

## 🎨 前端開發規範

### 顏色規範
- **Admin 主色**: `bg-orange-600`, `text-orange-600`, `hover:bg-orange-700`
- **成功**: `bg-green-600`, `text-green-600`
- **危險**: `bg-red-600`, `text-red-600`
- **信息**: `bg-blue-600`, `text-blue-600`
- **暗黑模式**: 所有 `bg-white` 卡片必須加 `dark:bg-gray-800`

### 暗黑模式強制規則
每個頁面新增 UI 時必須檢查:
```
bg-white      → bg-white dark:bg-gray-800
text-gray-800 → text-gray-800 dark:text-white
text-gray-600 → text-gray-600 dark:text-gray-400
border-gray-200 → border-gray-200 dark:border-gray-700
input/select  → + dark:bg-gray-800 dark:text-white dark:border-gray-600
```

### API 調用規範
```ts
// ✅ 正確 — 使用 apiFetch
import { apiFetch } from '../lib/api';
const res = await apiFetch('/api/public/admin/orders');

// ❌ 錯誤 — 不要直接用 fetch 或 EdgeSpark client
// const res = await fetch(`${API_BASE}/...`);  // 只在特殊情況使用
// const res = await client.api.fetch(...);     // 絕對不要用
```

---

## ⚙️ 常見修改場景

### 場景 1: 新增 Admin 頁面
1. 創建 `src/pages/AdminXxx.tsx`
2. 在 `src/App.tsx` 添加路由 (包裹 `<AdminRoute allowedRoles={...}>`)
3. 在 `src/components/AdminLayout.tsx` 的 `ALL_MENU_ITEMS` 添加菜單項
4. 在 Worker 添加對應 API (如果需要)

### 場景 2: 修改訂單邏輯
- 訂單創建: `worker/src/index.ts` → `POST /api/public/orders`
- 訂單列表: `worker/src/index.ts` → `GET /api/public/admin/orders`
- 訂單詳情: `worker/src/index.ts` → `GET /api/public/admin/orders/:id`
- 前端顯示: `src/pages/AdminOrders.tsx`, `src/pages/AdminOrderDetail.tsx`

### 場景 3: 新增數據庫表
1. 在 Worker `initDB()` 函數中添加 `CREATE TABLE IF NOT EXISTS` SQL
2. **不需要手動執行遷移** — Worker 啟動時自動創建
3. 添加對應的 CRUD API
4. 更新 `docs/DATABASE.md`

### 場景 4: 修改產品/庫存
- 產品 CRUD: `worker/src/index.ts` → `/api/public/admin/products/*`
- 庫存扣減: 在 `POST /api/public/orders` 的付款確認分支中 (`payment_confirmed = 1`)
- 低庫存警告: `src/pages/AdminDashboard.tsx`

### 場景 5: 修改 WhatsApp 消息內容
- 訂單確認消息: `worker/src/index.ts` → `POST /api/public/orders` 中的 `orderMsg` 變量
- 管理端發送: `src/pages/AdminOrderDetail.tsx` → WhatsApp 聊天面板
- 廣播推廣: `src/pages/AdminBroadcast.tsx`

---

## 🚨 重要坑點

1. **D1 數據遷移**: D1 不支持 ALTER TABLE 添加新列到已有數據的表。需要創建新表 → 導數據 → 刪舊表 → 重命名。

2. **Worker 單文件**: 所有 API 都在 `worker/src/index.ts` 一個文件中。新增端點直接在文件末尾添加，保持分類註釋清晰。

3. **API Base URL 硬編碼**: 部分舊頁面 (如 AdminUsers, AdminPackageConfigs) 仍直接硬編碼 `API_BASE = 'https://good-sung-shop...'`。新頁面應使用 `apiFetch()`。

4. **OrderLanding 中的 `client.api.fetch`**: 訂單提交和產品列表仍使用 EdgeSpark client。如需修改這部分，注意 `client` 的 baseUrl 配置。

5. **圖片上傳路徑**: 媒體庫上傳到 R2 的 `media/` 前綴，付款憑證上傳到 `proof-` 前綴，共用同一個 R2 bucket。

6. **訂單號生成**: `generateOrderNum()` 生成 `AB1234` 格式 (2位大寫字母+4位數字)。字母池排除 `I, L, O, Z` 避免混淆。

7. **庫存管理規則**:
   - 下單時**不扣庫存**
   - 管理員確認付款時 (`payment_confirmed = 1`) 才扣庫存
   - 庫存 < 15 顯示「即將售罄」
   - 庫存 = 0 前端自動隱藏

---

## 📝 文件編碼

所有源碼文件使用 **UTF-8** 編碼。中文內容直接使用 UTF-8，不要轉義。

---

## 🔗 外部依賴

| 服務 | 用途 | 配置位置 |
|------|------|---------|
| Cloudflare Pages | 前端托管 | GitHub Actions `.github/workflows/deploy.yml` |
| Cloudflare Worker | 後端 API | `worker/wrangler.toml` |
| Cloudflare D1 | SQLite 數據庫 | `worker/wrangler.toml` |
| Cloudflare KV | 系統設置緩存 | `worker/wrangler.toml` |
| Cloudflare R2 | 文件存儲 | `worker/wrangler.toml` |
| CloudWAPI | WhatsApp 發送 | `worker/wrangler.toml` Secrets |
