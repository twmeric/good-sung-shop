# 好餸社企後台管理系統 — 重新設計 PRD

> 版本：v1.0  
> 日期：2026-04-22  
> 狀態：待確認

---

## 一、現有系統問題診斷

### 1.1 對話管理 — 空殼功能

| 項目 | 狀態 |
|------|------|
| 前端 UI | ✅ 完整（對話列表、詳情彈窗、附件、消息氣泡） |
| 後端 API | ❌ **完全未實現** |
| `GET /api/public/admin/whatsapp/conversations` | ❌ 不存在 |
| `GET /api/public/admin/whatsapp/conversations/:phone` | ❌ 不存在 |

**問題**：用戶打開對話管理頁面永遠顯示「沒有對話記錄」或報 404。

**根本原因**：對話數據源不明確。SaleSmartly 已經有完整的對話界面，我們是否需要自建對話存儲？還是應該直接跳轉到 SaleSmartly 後台？

### 1.2 行銷活動管理 — 半吊子功能

| 模組 | 前端 | 後端 | 狀態 |
|------|------|------|------|
| 活動 CRUD（創建/編輯/刪除） | ✅ | ✅ | 可用 |
| WhatsApp 模板管理 | ✅ | ❌ | **空殼** |
| 活動設置（Landing Page / Referral） | ✅ | ⚠️ | 配置可存，但與業務邏輯脫節 |

**問題 1：模板 API 不存在**
- `/api/public/admin/whatsapp/templates` (GET/POST/PUT/DELETE) 全部未實現
- 前端雖然有完整的模板創建/編輯/預覽 UI，但永遠無法保存或讀取

**問題 2：推薦計劃配置與實際業務脫節**
- 活動設置中可配置 `referralDiscountPercentage`、`referralRewardPoints` 等
- 但實際訂單流程中，推薦碼是基於「電話後 4 位」的硬編碼邏輯
- 用戶輸入的 `referralCode` 與 campaigns 表的配置完全無關
- 無法做到「活動 A 用 10% 折扣，活動 B 用 15% 折扣」

**問題 3：活動與訂單無關聯**
- `order_records` 有 `campaign_name` 字段，但：
  - 前台下單時沒有選擇/傳入 campaign 的邏輯
  - 沒有外鍵關聯 campaigns 表
  - 所有訂單都是 `'good-sung-default'`
- **結果**：無法分析「哪個活動帶來多少訂單、多少營業額」

### 1.3 認證系統 — 過於簡陋

| 問題 | 現狀 |
|------|------|
| 用戶管理 | ❌ 沒有。只有 hardcoded `admin/admin360` |
| 角色區分 | ❌ 沒有。單一 token，所有人權限一樣 |
| 密碼安全 | ⚠️ Worker 有 bcrypt，但前端登入繞過了 API 直接比對 hardcoded |
| 操作追蹤 | ❌ 沒有。誰改了什麼訂單無從查證 |

### 1.4 產品管理 — 完全缺失

| 問題 | 現狀 |
|------|------|
| 菜品/湯品/套餐資料 | ❌ 全部硬編碼在 `OrderLanding.tsx` |
| Supplier 無法管理產品 | ❌ 沒有產品管理頁面 |
| 產品啟用/停用 | ❌ 無法動態控制 |
| 產品圖片 | ❌ 無 |

### 1.5 數據分析 — 完全缺失

| 需求 | 現狀 |
|------|------|
| 銷售報表 | ❌ 無 |
| 客戶行為追踪 | ❌ 無 |
| 活動 ROI 分析 | ❌ 無 |
| 熱門菜品排行 | ❌ 無 |
| 客戶留存率 | ❌ 無 |
| 數據導出 | ❌ 無 |

---

## 二、重新設計核心原則

### 2.1 數據驅動（Data-Driven）

> **每一個業務操作都必須產生可分析的數據。**

- 客戶在前台的每一次點擊、瀏覽、放棄，都要記錄
- 每一筆訂單必須與活動、渠道、客戶關聯
- 後台每一次修改都要留痕（Audit Log）

### 2.2 客戶行為追踪（Customer Behavior Tracking）

建立完整的客戶旅程數據鏈：

```
訪客進入 → 瀏覽活動頁 → 選套餐 → 選餸菜 → 入購物車
    ↓         ↓          ↓        ↓         ↓
  session   page_view   event    event    cart_add
    ↓         ↓          ↓        ↓         ↓
填地址 → WhatsApp驗證 → 提交訂單 → 付款 → 完成
  ↓         ↓          ↓        ↓      ↓
form_start verify_start order    payment  done
```

### 2.3 活動閉環（Campaign Closed Loop）

活動必須從「創建 → 投放 → 下單 → 分析」形成閉環：

```
創建活動（後台）
    ↓
生成活動連結（帶 campaign_key）
    ↓
客戶點擊連結進入前台
    ↓
下單時記錄 campaign_name
    ↓
後台報表：活動帶來多少訂單/營業額
```

---

## 三、數據架構重新設計

### 3.1 擴展 `admin_users` 表

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',      -- 'super_admin' | 'admin' | 'supplier'
  display_name TEXT,
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

**預設用戶**（migration 插入）：
- `superadmin` / 系統管理員 / `super_admin`
- `admin` / 客服小張 / `admin`
- `supplier` / 供應商李 / `supplier`

### 3.2 新增 `cms_products` 表

```sql
CREATE TABLE IF NOT EXISTS cms_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,                   -- 'dish' | 'soup' | 'package'
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER,                            -- 套餐價格
  original_price INTEGER,                   -- 原價（用於顯示折扣）
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  image_url TEXT,
  max_select INTEGER DEFAULT 1,            -- 套餐可選數量（如 2餸1湯 = 2餸+1湯）
  updated_by INTEGER,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

**用途**：
- 取代 `OrderLanding.tsx` 中的硬編碼 `DISHES`、`SOUPS`、`PACKAGES`
- Supplier 可以在後台編輯產品名稱、描述、啟用狀態
- Admin 可以調整價格、排序

### 3.3 新增 `customer_sessions` 表（客戶行為追踪）

```sql
CREATE TABLE IF NOT EXISTS customer_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,                 -- UUID，瀏覽器級別
  phone TEXT,                               -- 驗證後綁定
  first_seen INTEGER DEFAULT (unixepoch()),
  last_seen INTEGER DEFAULT (unixepoch()),
  utm_source TEXT,                          -- 流量來源
  utm_medium TEXT,
  utm_campaign TEXT,                        -- 活動 key
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT                          -- 'mobile' | 'desktop' | 'tablet'
);
```

### 3.4 新增 `customer_events` 表（行為事件）

```sql
CREATE TABLE IF NOT EXISTS customer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,                 -- 見下方事件類型
  event_data TEXT,                          -- JSON: { dishId, packageType, ... }
  page_url TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

**事件類型（event_type）**：

| 事件 | 說明 | 數據 |
|------|------|------|
| `page_view` | 瀏覽頁面 | `{ page: 'landing' \| 'dishes' \| 'cart' \| 'delivery' \| 'verify' }` |
| `package_select` | 選擇套餐 | `{ packageType: '2-dish-1-soup' \| '3-dish-1-soup', price }` |
| `dish_select` | 選擇餸菜 | `{ dishId, dishName }` |
| `soup_select` | 選擇湯 | `{ soupId, soupName }` |
| `cart_add` | 加入購物車 | `{ packageType, quantity, subtotal }` |
| `cart_remove` | 移除購物車 | `{ packageType }` |
| `form_start` | 開始填寫地址 | `{}` |
| `verify_start` | 開始 WhatsApp 驗證 | `{ method: 'wa.me' \| 'otp' }` |
| `verify_success` | 驗證成功 | `{ phone }` |
| `order_submit` | 提交訂單 | `{ orderId, totalAmount, campaignName }` |
| `payment_upload` | 上傳付款憑證 | `{ orderNum }` |
| `abandon` | 放棄（頁面關閉/超時） | `{ lastPage, durationSeconds }` |

### 3.5 新增 `admin_audit_logs` 表（操作日誌）

```sql
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  admin_username TEXT,
  admin_role TEXT,
  action TEXT NOT NULL,                     -- 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT'
  target_type TEXT,                         -- 'order' | 'product' | 'campaign' | 'user' | 'setting'
  target_id TEXT,
  details TEXT,                             -- JSON: { old: ..., new: ..., reason: ... }
  ip_address TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### 3.6 新增 `system_settings` 表

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by INTEGER,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

---

## 四、API 重新設計

### 4.1 認證層改造

```typescript
// 新的 authMiddleware — 支持角色檢查 + 用戶信息注入
function authMiddleware(allowedRoles?: string[]) {
  return async (c, next) => {
    const token = extractToken(c);
    const user = await validateToken(c.env.DB, token);
    
    if (!user || !user.is_active) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    
    c.set('user', user);  // 後續 handler 可讀取
    await next();
  };
}
```

**登入 API 改造**：
```typescript
POST /api/admin/auth/login
// Request:  { username, password }
// Response: { success: true, token: "jwt-token", user: { id, username, role, display_name } }
```

**獲取當前用戶**：
```typescript
GET /api/admin/auth/me
// Response: { id, username, role, display_name, permissions: [...] }
```

### 4.2 完整的 API 端點清單

| 端點 | 方法 | 角色 | 說明 |
|------|------|------|------|
| **認證** |
| `/api/admin/auth/login` | POST | public | 登入 |
| `/api/admin/auth/me` | GET | any | 當前用戶信息 |
| `/api/admin/auth/logout` | POST | any | 登出（記錄 audit log） |
| **用戶管理（Super Admin only）** |
| `/api/admin/users` | GET | super_admin | 管理員列表 |
| `/api/admin/users` | POST | super_admin | 創建管理員 |
| `/api/admin/users/:id` | PUT | super_admin | 更新管理員 |
| `/api/admin/users/:id` | DELETE | super_admin | 刪除管理員（不能刪自己） |
| **產品管理（All roles）** |
| `/api/admin/products` | GET | any | 產品列表（含啟用/停用篩選） |
| `/api/admin/products` | POST | any | 創建產品 |
| `/api/admin/products/:id` | PUT | any | 更新產品 |
| `/api/admin/products/:id/toggle` | POST | any | 啟用/停用切換 |
| `/api/admin/products/reorder` | POST | any | 批量調整排序 |
| **訂單管理（Super Admin + Admin）** |
| `/api/admin/orders` | GET | admin+ | 訂單列表（含篩選、分頁） |
| `/api/admin/orders/:id` | GET | admin+ | 訂單詳情 |
| `/api/admin/orders/:id` | PUT | admin+ | 更新訂單 |
| `/api/admin/orders/:id/status` | POST | admin+ | 快速更新狀態 |
| `/api/admin/orders/:id/confirm-payment` | POST | admin+ | 確認付款 |
| `/api/admin/orders/:id` | DELETE | super_admin | 刪除訂單 |
| `/api/admin/orders/export` | POST | admin+ | 導出 CSV/Excel |
| **活動管理（Super Admin）** |
| `/api/admin/campaigns` | GET | super_admin | 活動列表 |
| `/api/admin/campaigns` | POST | super_admin | 創建活動 |
| `/api/admin/campaigns/:key` | GET | super_admin | 活動詳情 |
| `/api/admin/campaigns/:key` | PUT | super_admin | 更新活動 |
| `/api/admin/campaigns/:key` | DELETE | super_admin | 刪除活動 |
| `/api/admin/campaigns/:key/stats` | GET | super_admin | 活動統計（訂單數、營業額、轉化率） |
| **報表（Super Admin + Admin）** |
| `/api/admin/reports/dashboard` | GET | admin+ | 儀表板 KPI |
| `/api/admin/reports/sales` | GET | admin+ | 銷售報表（日/週/月） |
| `/api/admin/reports/products` | GET | admin+ | 產品銷量排行 |
| `/api/admin/reports/customers` | GET | admin+ | 客戶分析（新客/回購） |
| `/api/admin/reports/campaigns` | GET | admin+ | 活動 ROI 分析 |
| `/api/admin/reports/funnel` | GET | admin+ | 轉化漏斗 |
| **數據追蹤（前台調用）** |
| `/api/public/track/event` | POST | public | 記錄客戶行為事件 |
| `/api/public/track/session` | POST | public | 創建/更新 session |
| **操作日誌（Super Admin）** |
| `/api/admin/audit-logs` | GET | super_admin | 操作日誌列表 |
| **系統設置（Super Admin）** |
| `/api/admin/settings` | GET | super_admin | 系統設置 |
| `/api/admin/settings` | PUT | super_admin | 更新設置 |

---

## 五、前端頁面重新設計

### 5.1 路由結構

```
/admin                          → 登入頁（AdminLogin）
/admin/dashboard                → 儀表板（Super Admin / Admin）
/admin/orders                   → 訂單管理（Super Admin / Admin）
/admin/orders/:id               → 訂單詳情（Super Admin / Admin）
/admin/products                 → 產品管理（All roles）
/admin/campaigns                → 活動管理（Super Admin）
/admin/campaigns/:key           → 活動詳情/統計（Super Admin）
/admin/reports                  → 報表中心（Super Admin / Admin）
/admin/reports/sales            → 銷售報表
/admin/reports/products         → 產品分析
/admin/reports/customers        → 客戶分析
/admin/reports/campaigns        → 活動 ROI
/admin/reports/funnel           → 轉化漏斗
/admin/users                    → 用戶管理（Super Admin）
/admin/audit-logs               → 操作日誌（Super Admin）
/admin/settings                 → 系統設置（Super Admin）
```

### 5.2 側邊欄菜單（根據角色動態渲染）

```typescript
const menuItems = [
  // 所有角色都能看到
  { id: 'products', label: '產品管理', icon: ChefHat, 
    roles: ['super_admin','admin','supplier'], path: '/admin/products' },
  
  // Admin + Super Admin
  { id: 'dashboard', label: '儀表板', icon: LayoutDashboard,
    roles: ['super_admin','admin'], path: '/admin/dashboard' },
  { id: 'orders', label: '訂單管理', icon: ShoppingCart,
    roles: ['super_admin','admin'], path: '/admin/orders' },
  { id: 'reports', label: '報表中心', icon: BarChart3,
    roles: ['super_admin','admin'], path: '/admin/reports' },
  
  // Super Admin only
  { id: 'campaigns', label: '行銷活動', icon: Briefcase,
    roles: ['super_admin'], path: '/admin/campaigns' },
  { id: 'users', label: '用戶管理', icon: Users,
    roles: ['super_admin'], path: '/admin/users' },
  { id: 'audit-logs', label: '操作日誌', icon: ClipboardList,
    roles: ['super_admin'], path: '/admin/audit-logs' },
  { id: 'settings', label: '系統設置', icon: Settings,
    roles: ['super_admin'], path: '/admin/settings' },
];
```

### 5.3 各角色首頁

| 角色 | 登入後首頁 | 界面特點 |
|------|-----------|----------|
| **Supplier** | `/admin/products` | 極簡界面，只有產品列表和編輯。看不到訂單、報表、用戶等 |
| **Admin** | `/admin/dashboard` | 完整的業務界面：儀表板、訂單、產品、報表 |
| **Super Admin** | `/admin/dashboard` | 全部功能，包括系統級設置 |

---

## 六、報表與數據分析設計

### 6.1 儀表板 KPI 卡片

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  今日訂單    │ │  待處理訂單  │ │  本月營業額  │ │  新客戶數   │
│    12       │ │     5      │ │  $45,280    │ │     8      │
│   ↑ 20%    │ │   ↑ 2      │ │   ↑ 15%    │ │   ↑ 3      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**數據來源**：
- 今日訂單：`COUNT(*) FROM order_records WHERE created_at >= today`
- 待處理：`COUNT(*) WHERE payment_confirmed = 0`
- 本月營業額：`SUM(total_price) WHERE created_at >= month_start`
- 新客戶：`COUNT(DISTINCT phone) WHERE first_order_this_month`

### 6.2 銷售報表（Sales Report）

| 維度 | 圖表類型 | 說明 |
|------|----------|------|
| 日銷售趨勢 | 折線圖 | 近 30 天每日訂單數 + 營業額 |
| 週銷售對比 | 柱狀圖 | 本週 vs 上週 |
| 月銷售總結 | 表格 | 每月訂單數、營業額、客單價 |
| 時段分析 | 熱力圖 | 一天中哪個時段最多訂單 |

### 6.3 產品分析（Product Analytics）

```
熱門餸菜排行（本月）
1. 宮保雞丁  ████████████████████  32份
2. 清蒸鱸魚  ██████████████████    28份
3. 糖醋排骨  ████████████████      25份
4. ...

套餐偏好比例
2餸1湯 ($99)  ████████████████  65%
3餸1湯 ($129) ████████          35%
```

**數據來源**：解析 `order_records.items` JSON 字段統計。

### 6.4 活動 ROI 分析（Campaign ROI）

```
活動名稱          訪問量   訂單數   轉化率    營業額    ROI
─────────────────────────────────────────────────────────
復活節特惠         1,240    89     7.2%    $11,481   4.5x
母親節預訂           856    45     5.3%    $5,805    3.2x
新客首購折扣         623    38     6.1%    $4,182    2.8x
```

**關聯邏輯**：
- `customer_sessions.utm_campaign` = 活動 key（訪問量）
- `order_records.campaign_name` = 活動名稱（訂單數/營業額）
- ROI = 營業額 / 活動成本（活動配置中設置成本）

### 6.5 轉化漏斗（Conversion Funnel）

```
訪問首頁      1,000  ──────────────────────────  100%
    ↓
選擇套餐        680  ████████████████████        68%
    ↓
選擇餸菜        520  ███████████████             52%
    ↓
進入購物車      410  ████████████                41%
    ↓
填寫地址        280  ████████                    28%
    ↓
WhatsApp驗證    195  ██████                      19.5%
    ↓
成功下單        150  ████                        15%
```

**數據來源**：`customer_events` 表中各階段的 `event_type` 統計。

### 6.6 客戶分析（Customer Analytics）

| 指標 | 說明 |
|------|------|
| 新客 vs 回購客比例 | 首次訂單 vs 第二次以上訂單 |
| 客戶生命周期價值 (LTV) | 平均每位客戶總消費額 |
| 回購週期 | 客戶平均多久下一次單 |
| 流失客戶 | 超過 30 天未下單的客戶 |
| 推薦網絡 | 誰推薦了誰，推薦鏈圖 |

---

## 七、客戶行為追踪實現方案

### 7.1 前台埋點

在 `OrderLanding.tsx` 關鍵位置插入事件追蹤：

```typescript
// 1. 頁面瀏覽
tracker.pageView('landing', { campaign: utmCampaign });

// 2. 選擇套餐
tracker.event('package_select', { packageType: '2-dish-1-soup', price: 99 });

// 3. 選擇餸菜
tracker.event('dish_select', { dishId: 'd1', dishName: '宮保雞丁' });

// 4. 加入購物車
tracker.event('cart_add', { packageType, quantity, subtotal });

// 5. 提交訂單
tracker.event('order_submit', { orderId, totalAmount, campaignName });
```

### 7.2 追蹤 SDK（輕量級）

```typescript
// src/utils/tracker.ts
class Tracker {
  private sessionId: string;
  
  constructor() {
    this.sessionId = localStorage.getItem('gs_session') || this.generateId();
    localStorage.setItem('gs_session', this.sessionId);
  }
  
  async event(type: string, data?: object) {
    await fetch(`${API_BASE}/api/public/track/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        eventType: type,
        eventData: data,
        pageUrl: window.location.href,
        timestamp: Date.now()
      })
    });
  }
  
  async pageView(page: string, data?: object) {
    await this.event('page_view', { page, ...data });
  }
}

export const tracker = new Tracker();
```

---

## 八、實施路線圖

### 階段一：基礎 RBAC + 產品管理（優先級：🔴 高，預計 3-4 天）

**目標**：讓三個角色都能登入，Supplier 能管理產品，前台從數據庫讀取產品

**Worker**：
- [ ] 擴展 `admin_users` 表（加 role, display_name, is_active）
- [ ] 改造 `authMiddleware` 支持角色檢查
- [ ] 改造 `/admin/login` API，查詢數據庫驗證
- [ ] 新增 `/admin/auth/me` API
- [ ] 創建 `cms_products` 表
- [ ] 實現產品 CRUD API
- [ ] 新增 `/api/public/products` API（給前台用，無需認證）
- [ ] 導入現有硬編碼產品到數據庫

**Frontend**：
- [ ] 改造 AdminLogin，調用 API 登入
- [ ] 改造 AdminLayout，根據 role 動態渲染菜單
- [ ] 新建 `AdminProducts.tsx` 頁面
- [ ] 改造 `OrderLanding.tsx`，從 API 讀取產品
- [ ] 新增路由權限守衛

### 階段二：用戶管理 + 系統設置 + 操作日誌（優先級：🟡 中，預計 2-3 天）

**目標**：Super Admin 可以管理其他管理員，系統設置可後台化

**Worker**：
- [ ] 創建 `admin_audit_logs` 表
- [ ] 創建 `system_settings` 表
- [ ] 實現用戶管理 CRUD API（Super Admin only）
- [ ] 實現系統設置 API
- [ ] 在所有修改操作後插入 audit log

**Frontend**：
- [ ] 新建 `AdminUsers.tsx`
- [ ] 新建 `AdminSettings.tsx`
- [ ] 新建 `AdminAuditLogs.tsx`

### 階段三：儀表板 + 報表（優先級：🟡 中，預計 3-4 天）

**目標**：讓 Admin 和 Super Admin 有數據看

**Worker**：
- [ ] 實現報表 API（dashboard KPI、銷售報表、產品排行）
- [ ] 實現訂單導出 API（CSV）

**Frontend**：
- [ ] 重構 `AdminDashboard.tsx`（真正的儀表板）
- [ ] 新建 `AdminReports.tsx`（報表中心）
- [ ] 引入 Recharts 圖表庫

### 階段四：客戶行為追踪（優先級：🟢 低，預計 2-3 天）

**目標**：產生可分析的客戶行為數據

**Worker**：
- [ ] 創建 `customer_sessions` 表
- [ ] 創建 `customer_events` 表
- [ ] 實現 `/api/public/track/event` API
- [ ] 實現 `/api/public/track/session` API

**Frontend**：
- [ ] 創建 `tracker.ts` SDK
- [ ] 在 OrderLanding.tsx 關鍵位置埋點

### 階段五：活動閉環 + 對話管理決策（優先級：🟢 低，預計 2-3 天）

**目標**：活動與銷售真正關聯，決定對話管理方案

**Worker**：
- [ ] 改造訂單創建 API，記錄 `campaign_name`（從 URL parameter 讀取）
- [ ] 實現活動統計 API (`/api/admin/campaigns/:key/stats`)
- [ ] 實現轉化漏斗 API

**Frontend**：
- [ ] 改造 OrderLanding.tsx，從 URL 讀取 `?campaign=xxx`
- [ ] 新建活動統計頁面

**對話管理決策**：
- **方案 A**：跳轉到 SaleSmartly 後台（最簡單，推薦）
- **方案 B**：自建對話存儲（需要額外數據表，工作量較大）
- **方案 C**：移除對話管理菜單（SaleSmartly 已經夠用）

---

## 九、關鍵決策點（需要您確認）

### 決策 1：對話管理如何處理？

現有對話管理是一個「空殼」（前端有 UI，後端無 API）。SaleSmartly 本身已有完整的對話界面。

| 方案 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| A. 移除對話管理 | 最簡單，減少維護 | 後台缺少對話視圖 | ⭐ 推薦 |
| B. 跳轉 SaleSmartly | 利用現有功能 | 需要 SaleSmartly 帳號 | 可行 |
| C. 自建對話存儲 | 數據在自己手上 | 工作量大，需存儲所有消息 | 不推薦 |

### 決策 2：活動管理中的模板管理如何處理？

現有模板管理也是「空殼」（前端有 UI，後端無 API）。

| 方案 | 說明 | 建議 |
|------|------|------|
| A. 移除模板管理 | WhatsApp 訊息內容直接在代碼中維護 | ⭐ 推薦（目前夠用） |
| B. 實現模板 API | 讓 Super Admin 可以後台編輯 WhatsApp 訊息模板 | 未來擴展時再做 |

### 決策 3：推薦計劃是否保留？

現有推薦功能：客戶輸入朋友電話後 4 位作為推薦碼，系統發 WhatsApp 通知推薦人。

| 方案 | 說明 | 建議 |
|------|------|------|
| A. 保留現有邏輯 | 簡單粗暴，電話後 4 位 = 推薦碼 | ⭐ 推薦（目前夠用） |
| B. 與活動配置關聯 | 不同活動不同推薦獎勵 | 未來擴展 |

### 決策 4：Token 機制

| 方案 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| A. JWT | 標準、無狀態、可過期 | 需要 jwt 庫 | 可行 |
| B. Session Token（隨機字符串）| 最簡單、可撤銷 | 需要查數據庫驗證 | ⭐ 推薦 |

### 決策 5：報表導出格式

| 格式 | 用途 | 建議 |
|------|------|------|
| CSV | 通用、Excel 可打開 | ⭐ 必做 |
| Excel (.xlsx) | 帶格式、多工作表 | 可做 |
| PDF | 打印/存檔 | 未來再做 |

---

## 十、總結

### 核心價值

這次重新設計的核心不是「增加功能」，而是**讓系統產生數據洞見**：

1. **每一筆訂單都知道從哪個活動來** → 行銷 ROI 可衡量
2. **每一個客戶的旅程都被記錄** → 轉化瓶頸可定位
3. **每一個管理員的操作都被追蹤** → 責任可追究
4. **每一個產品都可後台管理** → Supplier 可獨立工作

### 建議的啟動順序

```
Week 1: 階段一（RBAC + 產品管理）→ 讓系統「能用」
Week 2: 階段二（用戶管理 + 設置 + 日誌）→ 讓系統「可控」
Week 3: 階段三（儀表板 + 報表）→ 讓系統「可看」
Week 4: 階段四（行為追踪）→ 讓系統「可分析」
```

---

> 請確認以上設計方案，特別是 **五個關鍵決策點**。確認後我會按階段開始實施。
