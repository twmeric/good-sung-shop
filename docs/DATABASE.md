# Good Sung Shop (好餸社企) — 數據庫架構文檔

> **數據庫**: Cloudflare D1 (SQLite)  
> **文件編碼**: UTF-8  
> **總表數**: 14 張核心表 + 1 張輔助表

---

## 目錄

1. [數據類型對照表](#1-數據類型對照表)
2. [枚舉與參考值](#2-枚舉與參考值)
3. [訂單狀態流程](#3-訂單狀態流程)
4. [數據表詳解](#4-數據表詳解)
   - [order_records](#41-order_records)
   - [verification_sessions](#42-verification_sessions)
   - [admin_users](#43-admin_users)
   - [campaigns](#44-campaigns)
   - [broadcast_campaigns](#45-broadcast_campaigns)
   - [broadcast_batches](#46-broadcast_batches)
   - [broadcast_logs](#47-broadcast_logs)
   - [referral_records](#48-referral_records)
   - [cms_products](#49-cms_products)
   - [package_configs](#410-package_configs)
   - [admin_audit_logs](#411-admin_audit_logs)
   - [system_settings](#412-system_settings)
   - [whatsapp_messages](#413-whatsapp_messages)
5. [關係圖](#5-關係圖)

---

## 1. 數據類型對照表

### DB (snake_case) ↔ Frontend (camelCase)

D1 返回的欄位名為 `snake_case`，經 `snakeToCamel()` 函數轉換後供前端使用：

| DB 欄位名 | Frontend 欄位名 | 類型 | 說明 |
|-----------|-----------------|------|------|
| `total_price` | `totalPrice` | `INTEGER` | 價格以「分」為單位存儲，顯示時除以 100 |
| `payment_confirmed` | `paymentConfirmed` | `INTEGER` | 0 = 未確認, 1 = 已確認 |
| `order_completed` | `orderCompleted` | `INTEGER` | 0 = 未完成, 1 = 已完成 |
| `is_active` | `isActive` | `INTEGER` | 0 = 停用, 1 = 啟用 |
| `created_at` | `createdAt` | `INTEGER` | Unix Timestamp (秒) |
| `updated_at` | `updatedAt` | `INTEGER` | Unix Timestamp (秒) |
| `config_json` | `configJson` | `TEXT` | JSON 字符串 |
| `product_code` | `productCode` | `TEXT` | 產品編碼 |
| `stock_quantity` | `stockQuantity` | `INTEGER` | 庫存數量 |
| `sort_order` | `sortOrder` | `INTEGER` | 排序權重 |
| `image_url` | `imageUrl` | `TEXT` | 圖片 URL |
| `max_select` | `maxSelect` | `INTEGER` | 最大可選數量 |
| `original_price` | `originalPrice` | `INTEGER` | 原價 |
| `campaign_name` | `campaignName` | `TEXT` | 活動名稱 |
| `referral_code` | `referralCode` | `TEXT` | 推薦碼 |
| `delivery_date` | `deliveryDate` | `TEXT` | 配送日期 (YYYY-MM-DD) |
| `delivery_time` | `deliveryTime` | `TEXT` | 配送時段 |
| `order_num` | `orderNum` | `TEXT` | 訂單編號 (XX1234) |
| `payment_proof` | `paymentProof` | `TEXT` | 付款證明 URL |
| `scenario_key` | `scenarioKey` | `TEXT` | 活動場景鍵 |
| `config_key` | `configKey` / `typeKey` | `TEXT` | 套餐配置鍵 |
| `dish_count` | `dishCount` | `INTEGER` | 菜式數量 |
| `soup_count` | `soupCount` | `INTEGER` | 湯品數量 |
| `message_content` | `messageContent` | `TEXT` | 訊息內容 |
| `target_count` | `targetCount` | `INTEGER` | 目標數量 |
| `sent_count` | `sentCount` | `INTEGER` | 已發送數量 |
| `failed_count` | `failedCount` | `INTEGER` | 失敗數量 |
| `rate_min_seconds` | `rateMinSeconds` | `INTEGER` | 最小發送間隔 |
| `rate_max_seconds` | `rateMaxSeconds` | `INTEGER` | 最大發送間隔 |
| `wave_size` | `waveSize` | `INTEGER` | 波次大小 |
| `wave_interval_seconds` | `waveIntervalSeconds` | `INTEGER` | 波次間隔 |
| `error_message` | `errorMessage` | `TEXT` | 錯誤訊息 |
| `display_name` | `displayName` | `TEXT` | 顯示名稱 |
| `password_hash` | — | `TEXT` | 密碼哈希 (不返回前端) |
| `admin_username` | `adminUsername` | `TEXT` | 管理員用戶名 |
| `admin_role` | `adminRole` | `TEXT` | 管理員角色 |
| `target_type` | `targetType` | `TEXT` | 操作目標類型 |
| `target_id` | `targetId` | `TEXT` | 操作目標 ID |
| `ip_address` | `ipAddress` | `TEXT` | IP 地址 |

---

## 2. 枚舉與參考值

### 2.1 角色枚舉 (`admin_users.role`)

| 值 | 說明 | 權限 |
|----|------|------|
| `super_admin` | 系統管理員 | 全部 |
| `admin` | 客服管理員 | 訂單、產品、套餐、媒體 |
| `supplier` | 產品供應商 | 產品、媒體 |

### 2.2 產品分類 (`cms_products.category`)

| 值 | 說明 | 編碼前綴 |
|----|------|----------|
| `dish` | 菜式 | `D` (例: D001) |
| `soup` | 湯品 | `S` (例: S001) |
| `package` | 套餐 | `P` (例: P001) |

### 2.3 配送區域 (`order_records.region`)

| 值 | 說明 |
|----|------|
| `HK` | 港島 |
| `KLN` | 九龍 |
| `NT` | 新界 |

### 2.4 配送時段 (`order_records.delivery_time`)

| 值 | 說明 |
|----|------|
| `10:00-13:00` | 上午時段 |
| `14:00-18:00` | 下午時段 |
| `18:00-20:00` | 傍晚時段 |

### 2.5 廣播批次狀態 (`broadcast_batches.status`)

| 值 | 說明 |
|----|------|
| `pending` | 待發送 |
| `completed` | 已完成 |

### 2.6 廣播日誌狀態 (`broadcast_logs.status`)

| 值 | 說明 |
|----|------|
| `pending` | 待發送 |
| `sent` | 已發送 |
| `failed` | 發送失敗 |

### 2.7 產品庫存狀態 (前端計算)

| 狀態 | 條件 |
|------|------|
| `in_stock` | `stock_quantity >= 15` |
| `low_stock` | `0 < stock_quantity < 15` |
| `out_of_stock` | `stock_quantity <= 0` |

---

## 3. 訂單狀態流程

```
                    ┌─────────────────┐
                    │   新訂單創建     │
                    │  created_at 寫入 │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  payment_confirmed│
                    │      = 0         │
                    │  order_completed  │
                    │      = 0         │
                    │   【待付款】      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │ 顧客上傳   │ │ 管理員確認 │ │ 無操作     │
       │ 付款證明   │ │ 已收款     │ │            │
       └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                   ┌─────────────────┐
                   │  payment_confirmed│
                   │      = 1         │
                   │  order_completed  │
                   │      = 0         │
                   │  【已確認付款】   │
                   │  (庫存自動扣減)  │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  管理員標記完成  │
                   │  POST complete  │
                   └────────┬────────┘
                            ▼
                   ┌─────────────────┐
                   │  payment_confirmed│
                   │      = 1         │
                   │  order_completed  │
                   │      = 1         │
                   │   【已完成】     │
                   └─────────────────┘
```

> **業務規則**: 訂單必須 `payment_confirmed = 1` 才能標記為完成。標記完成時檢查此條件，否則返回 400 錯誤。

---

## 4. 數據表詳解

---

### 4.1 `order_records`

**用途**: 存儲所有顧客訂單資訊

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `items` | `TEXT` | NO | — | 訂單項目 JSON 字符串，格式為 `OrderItem[]` |
| `total_price` | `INTEGER` | NO | — | 總金額 (港幣分) |
| `region` | `TEXT` | NO | — | 配送區域 (`HK`/`KLN`/`NT`) |
| `address` | `TEXT` | NO | — | 詳細地址 |
| `estate` | `TEXT` | YES | `NULL` | 屋苑名稱 |
| `delivery_date` | `TEXT` | NO | — | 配送日期 `YYYY-MM-DD` |
| `delivery_time` | `TEXT` | NO | — | 配送時段 |
| `name` | `TEXT` | NO | — | 顧客姓名 |
| `phone` | `TEXT` | NO | — | 顧客電話 (已規範化為 852XXXXXXXX) |
| `email` | `TEXT` | YES | `NULL` | 電郵地址 |
| `remarks` | `TEXT` | YES | `NULL` | 訂單備註 |
| `referral_code` | `TEXT` | YES | `NULL` | 推薦碼 (填寫的電話後 8 位) |
| `campaign_name` | `TEXT` | YES | `'good-sung-default'` | 活動名稱 |
| `payment_confirmed` | `INTEGER` | NO | `0` | 付款確認狀態 (0/1) |
| `order_completed` | `INTEGER` | NO | `0` | 訂單完成狀態 (0/1) |
| `payment_proof` | `TEXT` | YES | `NULL` | 付款證明 R2 URL |
| `order_num` | `TEXT` | YES | `NULL` | 訂單編號 (例: `AB1234`) |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 (Unix 秒) |

#### `items` JSON 結構範例

```json
[
  {
    "packageType": "2-dish-1-soup",
    "selectedDishes": ["宮保雞丁", "蒜蓉炒菜心"],
    "selectedSoup": "老火湯",
    "quantity": 2,
    "unitPrice": 99,
    "subtotal": 198
  }
]
```

#### 索引

- 隱式主鍵索引: `id`
- 建議索引: `phone` (用於推薦碼查找), `created_at` (用於排序), `order_num` (唯一查詢)

#### 樣本數據

| id | items | total_price | region | address | estate | delivery_date | delivery_time | name | phone | payment_confirmed | order_completed | order_num |
|----|-------|-------------|--------|---------|--------|---------------|---------------|------|-------|-------------------|-----------------|-----------|
| 1 | `[{...}]` | 198 | `KLN` | `彩虹邨金碧樓 12樓 1205室` | `彩虹邨` | `2026-04-26` | `10:00-13:00` | `陳大文` | `85291234567` | 0 | 0 | `AB1234` |

---

### 4.2 `verification_sessions`

**用途**: 存儲驗證碼會話 (防機器人 + 身份驗證)

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `code` | `TEXT` | NO | — | 主鍵，6 位英數驗證碼 |
| `phone` | `TEXT` | YES | `NULL` | 綁定電話 |
| `ip` | `TEXT` | YES | `NULL` | IP 地址 |
| `verified` | `INTEGER` | NO | `0` | 是否已驗證 (0/1) |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |
| `verified_at` | `INTEGER` | YES | `NULL` | 驗證時間 |
| `expires_at` | `INTEGER` | YES | `NULL` | 過期時間 (Unix 秒) |

#### 樣本數據

| code | phone | verified | created_at | expires_at |
|------|-------|----------|------------|------------|
| `A3B7C9` | `85291234567` | 1 | `1713964800` | `1713965100` |

---

### 4.3 `admin_users`

**用途**: 後台管理員帳號

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `username` | `TEXT` | NO | — | 登入用戶名 (唯一) |
| `password_hash` | `TEXT` | NO | — | SHA-256 哈希密碼 |
| `role` | `TEXT` | NO | `'admin'` | 角色 (`super_admin`/`admin`/`supplier`) |
| `display_name` | `TEXT` | YES | `NULL` | 顯示名稱 |
| `phone` | `TEXT` | YES | `NULL` | 電話 (用於 WhatsApp 發送憑證) |
| `is_active` | `INTEGER` | NO | `1` | 是否啟用 (0/1) |
| `token` | `TEXT` | YES | `NULL` | 當前 Session Token |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |
| `updated_at` | `INTEGER` | NO | `unixepoch()` | 更新時間 |

#### 索引

- `username`: `UNIQUE`
- `token`: 用於快速查詢登入用戶

#### 預設數據 (initDB 時自動創建)

| username | role | display_name | password_hash (SHA-256) |
|----------|------|--------------|------------------------|
| `superadmin` | `super_admin` | 系統管理員 | `a8989a80...fee4` |
| `admin` | `admin` | 客服管理員 | `7e9c6265...d2d` |
| `supplier` | `supplier` | 產品供應商 | `c6242a62...a11` |

---

### 4.4 `campaigns`

**用途**: 落地頁活動配置

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `scenario_key` | `TEXT` | NO | — | 場景鍵 (唯一，例: `good-sung-default`) |
| `name` | `TEXT` | NO | — | 活動名稱 |
| `config_json` | `TEXT` | YES | `'{}'` | 活動配置 JSON |
| `is_active` | `INTEGER` | NO | `1` | 是否啟用 |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |

#### 樣本數據

| id | scenario_key | name | config_json | is_active |
|----|--------------|------|-------------|-----------|
| 1 | `good-sung-default` | 預設活動 | `{"heroTitle":"新鮮餸菜包"}` | 1 |

---

### 4.5 `broadcast_campaigns`

**用途**: 廣播推廣活動模板

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `name` | `TEXT` | NO | — | 活動名稱 |
| `message_content` | `TEXT` | NO | — | WhatsApp 訊息內容 |
| `created_by` | `INTEGER` | YES | `NULL` | 創建者 admin_users.id |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |
| `updated_at` | `INTEGER` | NO | `unixepoch()` | 更新時間 |

#### 關係

- `created_by` → `admin_users.id`

#### 樣本數據

| id | name | message_content | created_by |
|----|------|-----------------|------------|
| 1 | `復活節推廣` | `【好餸社企】復活節特惠...` | 1 |

---

### 4.6 `broadcast_batches`

**用途**: 廣播發送批次，記錄發送進度與速率配置

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `campaign_id` | `INTEGER` | NO | — | 關聯 broadcast_campaigns.id |
| `name` | `TEXT` | NO | — | 批次名稱 |
| `target_count` | `INTEGER` | NO | `0` | 目標總數 |
| `sent_count` | `INTEGER` | NO | `0` | 已發送數 |
| `failed_count` | `INTEGER` | NO | `0` | 失敗數 |
| `status` | `TEXT` | NO | `'pending'` | 狀態 (`pending`/`completed`) |
| `rate_min_seconds` | `INTEGER` | NO | `25` | 最小發送間隔 (秒) |
| `rate_max_seconds` | `INTEGER` | NO | `120` | 最大發送間隔 (秒) |
| `wave_size` | `INTEGER` | NO | `50` | 每波數量 |
| `wave_interval_seconds` | `INTEGER` | NO | `300` | 波次間隔 (秒) |
| `created_by` | `INTEGER` | YES | `NULL` | 創建者 admin_users.id |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |
| `updated_at` | `INTEGER` | NO | `unixepoch()` | 更新時間 |

#### 關係

- `campaign_id` → `broadcast_campaigns.id`
- `created_by` → `admin_users.id`

---

### 4.7 `broadcast_logs`

**用途**: 單條廣播發送記錄

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `batch_id` | `INTEGER` | NO | — | 關聯 broadcast_batches.id |
| `campaign_id` | `INTEGER` | NO | — | 關聯 broadcast_campaigns.id |
| `customer_phone` | `TEXT` | NO | — | 目標電話 |
| `customer_name` | `TEXT` | YES | `NULL` | 目標姓名 |
| `message_content` | `TEXT` | NO | — | 發送內容 |
| `status` | `TEXT` | NO | `'pending'` | 狀態 (`pending`/`sent`/`failed`) |
| `error_message` | `TEXT` | YES | `NULL` | 錯誤訊息 |
| `sent_at` | `INTEGER` | YES | `NULL` | 發送時間 |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |

#### 關係

- `batch_id` → `broadcast_batches.id`
- `campaign_id` → `broadcast_campaigns.id`

#### 索引

- 建議: `batch_id` + `status` 複合索引

---

### 4.8 `referral_records`

**用途**: 推薦人記錄 (老客帶新客獎勵機制)

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `referrer_phone` | `TEXT` | NO | — | 推薦人電話 |
| `referee_order_id` | `INTEGER` | NO | — | 被推薦人訂單 ID |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |
| `referee_phone` | `TEXT` | YES | `NULL` | 被推薦人電話 |

#### 關係

- `referee_order_id` → `order_records.id`

---

### 4.9 `cms_products`

**用途**: CMS 產品目錄 (菜式、湯品、套餐)

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `category` | `TEXT` | NO | — | 分類 (`dish`/`soup`/`package`) |
| `product_code` | `TEXT` | YES | `NULL` | 產品編碼 (D001, S001, P001) |
| `name` | `TEXT` | NO | — | 產品名稱 |
| `description` | `TEXT` | YES | `NULL` | 產品描述 |
| `price` | `INTEGER` | YES | `NULL` | 售價 (分) |
| `original_price` | `INTEGER` | YES | `NULL` | 原價 (分) |
| `is_active` | `INTEGER` | NO | `1` | 是否上架 (0/1) |
| `stock_quantity` | `INTEGER` | NO | `0` | 庫存數量 |
| `sort_order` | `INTEGER` | NO | `0` | 排序權重 |
| `image_url` | `TEXT` | YES | `NULL` | 圖片 URL |
| `max_select` | `INTEGER` | NO | `1` | 最大可選數 (套餐用) |
| `updated_by` | `INTEGER` | YES | `NULL` | 最後更新者 admin_users.id |
| `updated_at` | `INTEGER` | NO | `unixepoch()` | 更新時間 |

#### 關係

- `updated_by` → `admin_users.id`

#### 預設數據 (initDB 時自動創建)

| category | product_code | name | description | price | max_select |
|----------|--------------|------|-------------|-------|------------|
| `dish` | `D001` | 宮保雞丁 | 微辣開胃 | — | 1 |
| `dish` | `D002` | 麻婆豆腐 | 經典川菜 | — | 1 |
| `soup` | `S001` | 老火湯 | — | — | 1 |
| `package` | `P001` | 2餸1湯 | — | 99 | 2 |
| `package` | `P002` | 3餸1湯 | — | 129 | 3 |

> 菜式和湯品的 `price` 通常為 `NULL`，價格在套餐 (`package`) 中定義。

---

### 4.10 `package_configs`

**用途**: 套餐配置規則 (與 `cms_products` 中的 `package` 類別互補)

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `config_key` | `TEXT` | NO | — | 配置鍵 (唯一，例: `2-dish-1-soup`) |
| `name` | `TEXT` | NO | — | 顯示名稱 |
| `dish_count` | `INTEGER` | NO | `2` | 包含菜式數 |
| `soup_count` | `INTEGER` | NO | `1` | 包含湯品數 |
| `price` | `INTEGER` | NO | — | 套餐價格 (分) |
| `is_active` | `INTEGER` | NO | `1` | 是否啟用 |
| `sort_order` | `INTEGER` | NO | `0` | 排序權重 |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 創建時間 |
| `updated_at` | `INTEGER` | NO | `unixepoch()` | 更新時間 |

#### 索引

- `config_key`: `UNIQUE`

#### 預設數據

| config_key | name | dish_count | soup_count | price |
|------------|------|------------|------------|-------|
| `2-dish-1-soup` | 2餸1湯 | 2 | 1 | 99 |
| `3-dish-1-soup` | 3餸1湯 | 3 | 1 | 129 |

---

### 4.11 `admin_audit_logs`

**用途**: 管理員操作審計日誌

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `admin_id` | `INTEGER` | YES | `NULL` | 管理員 ID |
| `admin_username` | `TEXT` | YES | `NULL` | 管理員用戶名 |
| `admin_role` | `TEXT` | YES | `NULL` | 管理員角色 |
| `action` | `TEXT` | NO | — | 操作類型 (`CREATE`/`UPDATE`/`DELETE`/`LOGIN`/`COMPLETE`/`SEND_WHATSAPP`) |
| `target_type` | `TEXT` | YES | `NULL` | 目標類型 (`order`/`product`/`user`/`setting`/`broadcast_campaign`/`message`) |
| `target_id` | `TEXT` | YES | `NULL` | 目標 ID |
| `details` | `TEXT` | YES | `NULL` | 詳情 JSON |
| `ip_address` | `TEXT` | YES | `NULL` | IP 地址 |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 操作時間 |

#### 樣本數據

| id | admin_username | admin_role | action | target_type | target_id | details | created_at |
|----|----------------|------------|--------|-------------|-----------|---------|------------|
| 1 | `superadmin` | `super_admin` | `LOGIN` | `user` | `1` | `{}` | `1713964800` |
| 2 | `admin` | `admin` | `UPDATE` | `order` | `15` | `{"paymentConfirmed":1}` | `1713964900` |

---

### 4.12 `system_settings`

**用途**: 系統級鍵值配置

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `key` | `TEXT` | NO | — | 主鍵 |
| `value` | `TEXT` | NO | — | 配置值 |
| `description` | `TEXT` | YES | `NULL` | 描述 |
| `updated_by` | `INTEGER` | YES | `NULL` | 最後更新者 |
| `updated_at` | `INTEGER` | NO | `unixepoch()` | 更新時間 |

#### 樣本數據

| key | value | description |
|-----|-------|-------------|
| `bank_account` | `DBS A/C - 016-000227829` | 銀行帳號 |
| `fps_id` | `FPS - 108810334` | FPS 識別碼 |
| `min_days_advance` | `2` | 最小提前下單天數 |

---

### 4.13 `whatsapp_messages`

**用途**: WhatsApp 對話歷史記錄

#### 欄位定義

| 欄位名 | 類型 | 可空 | 默認值 | 說明 |
|--------|------|------|--------|------|
| `id` | `INTEGER` | NO | `AUTOINCREMENT` | 主鍵 |
| `phone` | `TEXT` | NO | — | 對話電話 |
| `message` | `TEXT` | NO | — | 訊息內容 |
| `sender` | `TEXT` | NO | — | 發送者 (`user` / `bot`) |
| `created_at` | `INTEGER` | NO | `unixepoch()` | 時間戳 |

#### 樣本數據

| id | phone | message | sender | created_at |
|----|-------|---------|--------|------------|
| 1 | `85291234567` | `你好，我想查詢訂單` | `user` | `1713964800` |
| 2 | `85291234567` | `請問您的訂單編號是？` | `bot` | `1713964810` |

---

## 5. 關係圖

```
┌─────────────────────┐
│   admin_users       │
│   ───────────       │
│   PK: id            │
│   username (UQ)     │
│   token             │
│   role              │
└──────┬──────┬───────┘
       │      │
       │      └──────────┐
       │                 │
       ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│ admin_audit_logs│  │ broadcast_batches│
│ ─────────────── │  │ ──────────────── │
│ FK: admin_id    │  │ FK: created_by   │
│ admin_username  │  │ FK: campaign_id ─┼──→ broadcast_campaigns
│ action          │  │ target_count     │    PK: id
│ target_type     │  │ status           │
└─────────────────┘  └────────┬─────────┘
                              │
                              ▼
                       ┌───────────────┐
                       │ broadcast_logs│
                       │ ───────────── │
                       │ FK: batch_id  │
                       │ FK: campaign_id│
                       │ status        │
                       └───────────────┘

┌─────────────────────┐
│   order_records     │
│   ─────────────     │
│   PK: id            │
│   order_num         │
│   phone             │
│   items (JSON)      │
│   payment_confirmed │
│   order_completed   │
│   payment_proof     │
└──────┬──────────────┘
       │
       │ 1:N
       ▼
┌─────────────────────┐
│   referral_records  │
│   ────────────────  │
│   PK: id            │
│   FK: referee_order_id
│   referrer_phone    │
└─────────────────────┘

┌─────────────────────┐
│   cms_products      │
│   ─────────────     │
│   PK: id            │
│   category          │
│   product_code      │
│   name              │
│   stock_quantity    │
│   is_active         │
└─────────────────────┘

┌─────────────────────┐
│   package_configs   │
│   ───────────────   │
│   PK: id            │
│   config_key (UQ)   │
│   dish_count        │
│   soup_count        │
│   price             │
└─────────────────────┘

┌─────────────────────┐
│   whatsapp_messages │
│   ────────────────  │
│   PK: id            │
│   phone             │
│   message           │
│   sender            │
└─────────────────────┘

┌─────────────────────┐
│   system_settings   │
│   ───────────────   │
│   PK: key           │
│   value             │
└─────────────────────┘

┌─────────────────────┐
│   campaigns         │
│   ─────────         │
│   PK: id            │
│   scenario_key (UQ) │
│   config_json       │
└─────────────────────┘

┌─────────────────────┐
│ verification_sessions│
│ ─────────────────── │
│ PK: code            │
│ phone               │
│ verified            │
└─────────────────────┘
```

> **說明**: 本系統採用輕量級關聯設計，大部分表之間為鬆散耦合。`broadcast_batches` 與 `broadcast_logs` 為強關聯，`order_records` 與 `referral_records` 為弱關聯。`whatsapp_messages` 為獨立日誌表，無外鍵約束。
