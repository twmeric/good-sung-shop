# 好餸社企 — 部署指南

## 架構概覽

```
Cloudflare Pages (Frontend)     Cloudflare Worker (Backend)
      React SPA  ───────────────►  Hono API + D1 + KV + R2
      OrderLanding                 /api/public/orders
      Admin Dashboard              /api/public/admin/*
                                   /api/webhooks/whatsapp
```

---

## 1. 前置要求

- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare 帳號
- GitHub 帳號 (用於 CI/CD)

---

## 2. 創建 Cloudflare 資源

### 2.1 D1 數據庫

```bash
wrangler d1 create good-sung-db
# 記錄返回的 database_id
```

### 2.2 KV Namespace

```bash
wrangler kv namespace create "CMS_DATA"
# 記錄返回的 id
```

### 2.3 R2 Bucket

```bash
wrangler r2 bucket create payment-proofs
```

---

## 3. Worker 配置

編輯 `worker/wrangler.toml`:

```toml
name = "good-sung-shop"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "good-sung-db"
database_id = "your-database-id-here"

[[kv_namespaces]]
binding = "CMS_DATA"
id = "your-kv-namespace-id-here"

[[r2_buckets]]
binding = "PAYMENT_PROOFS"
bucket_name = "payment-proofs"

[vars]
SITE_URL = "https://goodstore.jkdcoding.com"
ADMIN_PHONE = "85298536993"

# Secrets (不要用 wrangler.toml 存敏感信息):
# ADMIN_TOKEN_SECRET
# CLOUDWAPI_API_KEY
# CLOUDWAPI_SENDER
```

---

## 4. 設置 Secrets

```bash
cd worker

# Admin Token (隨機 64 位十六進制字符串)
wrangler secret put ADMIN_TOKEN_SECRET

# CloudWAPI API Key
wrangler secret put CLOUDWAPI_API_KEY

# CloudWAPI 發送方號碼 (如: 85262322466)
wrangler secret put CLOUDWAPI_SENDER
```

---

## 5. 部署 Worker

```bash
cd worker
wrangler deploy
```

Worker 首次啟動時會自動執行 `initDB()` 創建所有數據表並種子默認數據。

---

## 6. 前端部署

### 6.1 更新 API Base URL

編輯 `src/lib/api.ts` 中的 base URL (如果本地開發需要):

```ts
const API_BASE = 'https://good-sung-shop.jimsbond007.workers.dev';
```

### 6.2 構建

```bash
npm run build
# 輸出到 dist/
```

### 6.3 部署到 Cloudflare Pages

推送到 GitHub main 分支會自動觸發 GitHub Actions 部署:

```bash
git push origin main
```

或手動上傳 `dist/` 文件夾到 Cloudflare Pages Dashboard。

---

## 7. CI/CD (GitHub Actions)

項目已配置 `.github/workflows/deploy.yml`:

- **Push 到 main** → 自動部署前端 (Pages) + 後端 (Worker)
- 需要配置 GitHub Secrets:
  - `CF_API_TOKEN` — Cloudflare API Token
  - `CF_ACCOUNT_ID` — Cloudflare Account ID

---

## 8. 初始化數據

首次部署後，訪問以下端點初始化默認數據:

```bash
curl -X POST https://your-worker.workers.dev/api/cms/reset \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

這會創建:
- 默認 CMS 產品數據
- 系統設置默認值
- 默認套餐配置 (2餸1湯, 3餸1湯)

---

## 9. WhatsApp Webhook 配置

在 CloudWAPI 控制台設置 Webhook URL:

```
https://your-worker.workers.dev/api/webhooks/whatsapp
```

---

## 10. 驗證部署

| 測試項目 | 方法 |
|---------|------|
| 首頁加載 | 訪問 Pages URL，確認 OrderLanding 顯示 |
| 套餐選擇 | 點擊 2餸1湯 / 3餸1湯，確認進入選餸頁面 |
| 選餸流程 | 選擇餸菜和湯，確認進度提示正確 |
| WhatsApp 驗證 | 點擊驗證按鈕，確認打開 WhatsApp 並成功驗證 |
| 下單 | 填寫資料後提交，確認收到 WhatsApp 通知 |
| Admin 登入 | 訪問 /admin，用 superadmin/superadmin360 登入 |
| 後台功能 | 測試訂單管理、產品管理、廣播推廣 |

---

## 文件結構總覽

```
GoodStore/
├── src/                         # 前端源碼
│   ├── pages/                   # 頁面組件
│   │   ├── OrderLanding.tsx           # ⭐ 客戶下單頁
│   │   ├── OrderConfirmation.tsx      # 訂單成功頁
│   │   ├── PaymentProofUpload.tsx     # 付款證明上傳
│   │   ├── AdminLogin.tsx             # 管理員登入
│   │   ├── AdminDashboard.tsx         # 儀表板
│   │   ├── AdminOrders.tsx            # 訂單管理
│   │   ├── AdminOrderDetail.tsx       # 訂單詳情
│   │   ├── AdminProducts.tsx          # 產品管理
│   │   ├── AdminPackageConfigs.tsx    # 套餐配置
│   │   ├── AdminMediaLibrary.tsx      # 媒體庫
│   │   ├── AdminBroadcast.tsx         # 廣播推廣
│   │   ├── AdminUsers.tsx             # 用戶管理
│   │   ├── AdminAuditLogs.tsx         # 操作日誌
│   │   ├── AdminSettings.tsx          # 系統設置
│   │   └── AdminConversations.tsx     # WhatsApp 對話
│   ├── components/AdminLayout.tsx     # 管理後台佈局
│   ├── lib/api.ts                     # API 客戶端
│   └── App.tsx                        # 路由
├── worker/                      # Cloudflare Worker
│   ├── src/index.ts             # ⭐ 完整 API (~2200行)
│   ├── wrangler.toml            # Worker 配置
│   └── package.json
├── docs/                        # 項目文檔
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   └── API.md
├── README.md                    # 項目總覽
├── AGENTS.md                    # 開發者技術參考
└── .github/workflows/deploy.yml # CI/CD
```

---

## 注意事項

1. **D1 數據庫 ID** — 必須填入 `worker/wrangler.toml`
2. **KV Namespace ID** — 必須填入 `worker/wrangler.toml`
3. **R2 Bucket** — 必須填入 `worker/wrangler.toml`
4. **Secrets** — 不要在代碼中硬編碼，必須用 `wrangler secret put`
5. **CORS** — Worker 已配置 `origin: "*"`，生產環境建議改為特定域名
6. **WhatsApp 驗證** — Webhook 必須正確配置才能接收驗證回調
