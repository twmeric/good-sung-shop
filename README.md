# 好餸社企 — Good Sung Shop

[![Deploy Status](https://github.com/twmeric/good-sung-shop/actions/workflows/deploy.yml/badge.svg)](https://github.com/twmeric/good-sung-shop/actions)

> 好餸社企是新鮮餸菜包與盆菜訂購平台，支持 SEN 青年就業。本系統包含客戶下單頁面、管理後台、WhatsApp 自動通知、庫存管理、廣播推廣等功能。

---

## 🌐 線上環境

| 環境 | 網址 |
|------|------|
| **前端 (Cloudflare Pages)** | https://goodstore.jkdcoding.com |
| **後端 API (Cloudflare Worker)** | https://good-sung-shop.jimsbond007.workers.dev |
| **管理後台** | https://goodstore.jkdcoding.com/admin |
| **GitHub 倉庫** | https://github.com/twmeric/good-sung-shop |

---

## 🏗️ 技術架構

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (Frontend)                                │
│  React 18 + Vite + Tailwind CSS                             │
│  ├─ OrderLanding.tsx    客戶下單頁面                         │
│  └─ Admin Dashboard     管理後台 (11個頁面)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│  Cloudflare Worker (Backend)                                │
│  Hono + TypeScript                                          │
│  ├─ D1 SQLite       訂單、產品、用戶、審計日誌                │
│  ├─ KV Storage      系統設置緩存                            │
│  ├─ R2 Buckets      付款憑證、媒體庫圖片                     │
│  └─ CloudWAPI       WhatsApp 消息發送                       │
└─────────────────────────────────────────────────────────────┘
```

### 技術棧

| 層級 | 技術 |
|------|------|
| **前端** | React 18, TypeScript, Vite 7, Tailwind CSS 3, React Router 6, Lucide React |
| **後端** | Hono (Cloudflare Worker), TypeScript |
| **數據庫** | Cloudflare D1 (SQLite) |
| **存儲** | Cloudflare KV, Cloudflare R2 |
| **消息** | CloudWAPI (WhatsApp) |
| **部署** | GitHub Actions → Cloudflare Pages + Worker |

---

## 📁 項目結構

```
good-sung-shop/
├── .github/workflows/       # CI/CD: deploy.yml
├── src/                     # 前端源碼
│   ├── pages/               # 頁面組件
│   │   ├── OrderLanding.tsx         # ⭐ 客戶下單頁 (核心)
│   │   ├── OrderConfirmation.tsx    # 訂單成功頁
│   │   ├── PaymentProofUpload.tsx   # 付款證明上傳
│   │   ├── AdminLogin.tsx           # 管理員登入
│   │   ├── AdminDashboard.tsx       # 儀表板 (KPI + 圖表)
│   │   ├── AdminOrders.tsx          # 訂單管理 (列表 + CSV導出)
│   │   ├── AdminOrderDetail.tsx     # 訂單詳情 (含 WhatsApp 聊天)
│   │   ├── AdminProducts.tsx        # 產品管理 (CRUD + 庫存)
│   │   ├── AdminPackageConfigs.tsx  # 套餐配置 (2餸1湯/3餸1湯)
│   │   ├── AdminMediaLibrary.tsx    # 媒體庫 (R2 圖片上傳)
│   │   ├── AdminBroadcast.tsx       # 廣播推廣 (WhatsApp 批量發送)
│   │   ├── AdminUsers.tsx           # 用戶管理 (RBAC)
│   │   ├── AdminAuditLogs.tsx       # 操作審計日誌
│   │   ├── AdminSettings.tsx        # 系統設置
│   │   └── AdminConversations.tsx   # WhatsApp 對話管理
│   ├── components/
│   │   └── AdminLayout.tsx          # 管理後台佈局 (側邊欄 + 頂欄)
│   ├── lib/
│   │   └── api.ts                   # apiFetch() — 統一 API 客戶端
│   ├── App.tsx                      # 路由配置
│   └── main.tsx                     # 入口
├── worker/
│   ├── src/
│   │   └── index.ts                 # ⭐ Worker API (單文件, ~2200行)
│   ├── wrangler.toml                # Worker 配置
│   └── package.json
├── public/                  # 靜態資源
├── docs/                    # 📖 項目文檔
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   └── API.md
├── README.md                # 本文件
├── AGENTS.md                # 🎯 AI/開發者技術參考
├── DEPLOY.md                # 🚀 部署指南
└── WHATSAPP_WEBHOOK_API.md  # WhatsApp Webhook 規範
```

---

## 🚀 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 本地開發
npm run dev
# 訪問 http://localhost:5173

# 3. 構建
npm run build

# 4. Worker 本地開發
cd worker
npm install
npx wrangler dev
```

---

## 🔑 管理後台功能

| 功能 | 路徑 | 權限 |
|------|------|------|
| 儀表板 | `/admin/dashboard` | super_admin, admin |
| 訂單管理 | `/admin/orders` | super_admin, admin |
| 產品管理 | `/admin/products` | super_admin, admin, supplier |
| 套餐配置 | `/admin/package-configs` | super_admin, admin |
| 媒體庫 | `/admin/media-library` | super_admin, admin, supplier |
| 廣播推廣 | `/admin/broadcast` | super_admin |
| 用戶管理 | `/admin/users` | super_admin |
| 操作日誌 | `/admin/audit-logs` | super_admin |
| 系統設置 | `/admin/settings` | super_admin |

---

## 📖 文檔導航

| 文檔 | 內容 |
|------|------|
| [`AGENTS.md`](./AGENTS.md) | 🎯 **AI/開發者必讀** — 技術架構、數據庫結構、API列表、開發規範 |
| [`DEPLOY.md`](./DEPLOY.md) | 🚀 部署指南 — D1/KV/R2 創建、Secrets 配置、Wrangler 部署 |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | 系統架構詳解 |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | 數據庫表結構完整文檔 |
| [`docs/API.md`](./docs/API.md) | API 端點分類文檔 |
| [`WHATSAPP_WEBHOOK_API.md`](./WHATSAPP_WEBHOOK_API.md) | WhatsApp Webhook 接口規範 |

---

## 📄 許可證

好餸社企內部系統 — 版權所有。
