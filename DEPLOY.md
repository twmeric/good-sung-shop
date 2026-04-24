# 好餸社企 — 部署指南

## 架構概覽

```
Cloudflare Pages (Frontend)     Cloudflare Worker (Backend)
      React SPA  ───────────────►  Hono API + D1 + KV
      OrderLanding                 /api/public/orders
      Admin Dashboard              /api/public/admin/*
                                   /api/cms/data
                                   /api/webhooks/whatsapp
```

---

## 1. 前端部署 (Cloudflare Pages)

```bash
# 構建
npm run build

# 上傳 dist/ 到 Cloudflare Pages
# 或使用 Wrangler / GitHub Actions 自動部署
```

---

## 2. 後端部署 (Cloudflare Worker)

### 2.1 安裝 Wrangler CLI

```bash
cd worker
npm install -g wrangler
wrangler login
```

### 2.2 創建 D1 數據庫

```bash
wrangler d1 create good-sung-db
# 記錄返回的 database_id，填入 wrangler.toml
```

### 2.3 創建 KV Namespace

```bash
wrangler kv namespace create "CMS_DATA"
# 記錄返回的 id，填入 wrangler.toml
```

### 2.4 設置 Secrets

```bash
# Admin 密碼 (admin360 的 SHA-256)
wrangler secret put ADMIN_PASSWORD_HASH
# 輸入: 8c2b6e2e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e
# 注意：這是示例，請用實際的 SHA-256 值

# 管理員 Token (隨機生成)
wrangler secret put ADMIN_TOKEN_SECRET
# 輸入: 隨機 64 位十六進制字符串

# CloudWAPI 憑證
wrangler secret put CLOUDWAPI_API_KEY
# 輸入: RQLcKDcn7BtktHSKZFopovpb0HuhvH

wrangler secret put CLOUDWAPI_SENDER
# 輸入: 85262322466
```

生成 SHA-256:
```bash
echo -n "admin360" | sha256sum
```

### 2.5 部署 Worker

```bash
wrangler deploy
```

---

## 3. 更新前端 API 地址

修改 `src/pages/OrderLanding.tsx` 和 Admin 頁面中的 `baseUrl`:

```typescript
const client = createEdgeSpark({
  baseUrl: "https://your-worker.your-subdomain.workers.dev"
});
```

或統一在 `src/config.ts` 中管理:

```typescript
export const API_BASE_URL = "https://your-worker.your-subdomain.workers.dev";
```

---

## 4. WhatsApp Webhook 配置

在 CloudWAPI 控制台中設置 Webhook URL:

```
https://your-worker.your-subdomain.workers.dev/api/webhooks/whatsapp
```

---

## 5. 初始化 CMS 數據

訪問以下端點初始化默認 CMS 數據:

```bash
curl -X POST https://your-worker.workers.dev/api/cms/reset \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 6. 驗證部署

| 測試項目 | 方法 |
|---------|------|
| 首頁加載 | 訪問 Pages URL，確認 OrderLanding 顯示 |
| 套餐選擇 | 點擊 2餸1湯 / 3餸1湯，確認進入選餸頁面 |
| 選餸流程 | 選擇餸菜和湯，確認進度提示正確 |
| 多套餐 | 點擊「再加一份」，確認可添加多個套餐 |
| WhatsApp 驗證 | 點擊驗證按鈕，確認打開 WhatsApp 並成功驗證 |
| 下單 | 填寫資料後提交，確認收到 WhatsApp 通知 |
| Admin 登入 | 訪問 /admin，用 admin/admin360 登入 |
| CMS 編輯 | 訪問 CMS API，確認可讀寫產品列表 |

---

## 7. 文件結構總覽

```
GoodStore/
├── src/
│   ├── App.tsx                    # 路由 (已更新)
│   ├── main.tsx                   # 入口 (已移除 i18n)
│   ├── pages/
│   │   ├── OrderLanding.tsx       # ⭐ 核心落地頁 (餸菜包 + 多套餐 + 驗證)
│   │   ├── OrderConfirmation.tsx  # 訂單成功頁
│   │   ├── PaymentProofUpload.tsx # 付款證明上傳
│   │   ├── AdminLogin.tsx         # 管理員登入 (admin/admin360)
│   │   ├── AdminDashboard.tsx     # 訂單列表
│   │   ├── AdminOrderDetail.tsx   # 訂單詳情
│   │   ├── AdminCampaigns.tsx     # 活動管理
│   │   └── AdminCampaignSettings.tsx # 活動設置
│   └── __generated__/
│       ├── db_schema.ts           # order_records 已重命名
│       ├── db_relations.ts        # 關聯已更新
│       └── db_raw_schema.sql      # SQL 已更新
├── worker/                        # ⭐ Cloudflare Worker
│   ├── src/
│   │   └── index.ts               # 完整 API + CMS + WhatsApp
│   ├── wrangler.toml              # 配置模板
│   └── package.json
├── backend/                       # 舊 EdgeSpark 後端 (可棄用)
└── DEPLOY.md                      # 本文件
```

---

## 注意事項

1. **D1 數據庫 ID** - 必須填入 wrangler.toml
2. **KV Namespace ID** - 必須填入 wrangler.toml
3. **Secrets** - 不要在代碼中硬編碼，必須用 `wrangler secret put`
4. **CORS** - Worker 已配置 `origin: "*"`，生產環境建議改為特定域名
5. **WhatsApp 驗證** - Webhook 必須正確配置才能接收驗證回調
