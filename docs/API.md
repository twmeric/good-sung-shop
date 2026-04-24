# Good Sung Shop (好餸社企) — API 接口參考文檔

> **Base URL**: `https://good-sung-shop.jimsbond007.workers.dev`  
> **編碼**: UTF-8  
> **數據格式**: JSON (除檔案上傳外)  
> **CORS**: `origin: "*"`，允許 `Authorization` Header

---

## 目錄

1. [通用規範](#1-通用規範)
2. [公開 API (顧客端)](#2-公開-api-顧客端)
3. [Admin - 認證](#3-admin---認證)
4. [Admin - 訂單管理](#4-admin---訂單管理)
5. [Admin - 產品管理](#5-admin---產品管理)
6. [Admin - 套餐配置](#6-admin---套餐配置)
7. [Admin - 媒體庫](#7-admin---媒體庫)
8. [Admin - 廣播推廣](#8-admin---廣播推廣)
9. [Admin - 用戶管理](#9-admin---用戶管理)
10. [Admin - 系統設置 & 審計日誌](#10-admin---系統設置--審計日誌)
11. [Admin - WhatsApp 對話](#11-admin---whatsapp-對話)
12. [Webhooks](#12-webhooks)

---

## 1. 通用規範

### 1.1 認證方式

- **公開 API**: 無需認證
- **管理 API**: `Authorization: Bearer {token}`
  - `token` 來自 `POST /api/public/admin/login` 響應，存於 `localStorage.admin_token`
  - Worker 會查詢 `admin_users.token` 驗證有效性

### 1.2 通用響應格式

```ts
// 成功響應
{ "success": true, ...data }

// 錯誤響應
{ "error": "錯誤描述", "detail?": "詳細信息" }
```

### 1.3 HTTP 狀態碼

| 狀態碼 | 含義 |
|--------|------|
| `200` | 成功 |
| `201` | 創建成功 |
| `400` | 請求參數錯誤 |
| `401` | 未認證 (Token 無效或缺失) |
| `403` | 無權限 (角色不符) |
| `404` | 資源不存在 |
| `409` | 資源衝突 (如用戶名已存在) |
| `500` | 服務器內部錯誤 |

### 1.4 數據轉換規則

- D1 欄位名為 `snake_case`
- 返回前端前經 `snakeToCamel()` 轉換
- 價格統一以「分」為單位存儲 (顯示時 ÷100)
- 時間戳為 Unix Timestamp (秒)

---

## 2. 公開 API (顧客端)

### 2.1 獲取產品列表

```http
GET /api/public/products
```

**Auth**: 不需要

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `category` | `string` | 否 | 篩選分類: `dish` / `soup` / `package` |

**Response `200`**:

```json
[
  {
    "id": 1,
    "category": "dish",
    "productCode": "D001",
    "name": "宮保雞丁",
    "description": "微辣開胃",
    "price": null,
    "originalPrice": null,
    "isActive": 1,
    "stockQuantity": 50,
    "sortOrder": 0,
    "imageUrl": null,
    "maxSelect": 1,
    "stockStatus": "in_stock",
    "lowStockWarning": false
  }
]
```

> 注意: 公開接口會額外返回 `stockStatus` (`in_stock`/`low_stock`/`out_of_stock`) 和 `lowStockWarning`。

---

### 2.2 獲取套餐配置

```http
GET /api/public/package-configs
```

**Auth**: 不需要

**Response `200`**:

```json
[
  {
    "id": 1,
    "typeKey": "2-dish-1-soup",
    "name": "2餸1湯",
    "price": 99,
    "dishCount": 2,
    "soupCount": 1,
    "isActive": 1,
    "sortOrder": 0
  }
]
```

> 僅返回 `is_active = 1` 的配置。

---

### 2.3 獲取活動配置

```http
GET /api/public/campaigns/:key
```

**Auth**: 不需要

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `key` | `string` | 活動場景鍵，例: `good-sung-default` |

**Response `200`**:

```json
{
  "scenarioKey": "good-sung-default",
  "name": "預設活動",
  "config": {
    "heroTitle": "新鮮餸菜包",
    "heroSubtitle": "支持 SEN 青年就業"
  }
}
```

**Error Codes**:
- `404` — 活動不存在
- `403` — 活動已停用 (`is_active !== 1`)

---

### 2.4 創建訂單

```http
POST /api/public/orders
```

**Auth**: 不需要

**Request Body**:

```json
{
  "items": [
    {
      "packageType": "2-dish-1-soup",
      "selectedDishes": ["宮保雞丁", "蒜蓉炒菜心"],
      "selectedSoup": "老火湯",
      "quantity": 2,
      "unitPrice": 99,
      "subtotal": 198
    }
  ],
  "totalPrice": 198,
  "region": "KLN",
  "address": "彩虹邨金碧樓 12樓 1205室",
  "estate": "彩虹邨",
  "deliveryDate": "2026-04-26",
  "deliveryTime": "10:00-13:00",
  "name": "陳大文",
  "phone": "91234567",
  "email": "chan@example.com",
  "remarks": "請放門口",
  "referralCode": "91234567",
  "campaignName": "good-sung-default"
}
```

**Response `200`**:

```json
{
  "id": 42,
  "orderNum": "AB1234",
  "createdAt": 1713964800
}
```

**Side Effects**:
- 自動規範化電話為 `852XXXXXXXX`
- 生成訂單編號 (2 位大寫字母 + 4 位數字，排除 I/L/O/Z)
- 發送 WhatsApp 通知給顧客和管理員
- 處理推薦碼邏輯 (如有)

**Error Codes**:
- `500` — 服務器內部錯誤 (詳情見 `detail`)

---

### 2.5 請求驗證碼 (Anti-Spam)

```http
POST /api/public/verify/request
```

**Auth**: 不需要

**Request Body**:

```json
{
  "code": "A3B7C9"
}
```

**Response `200`**:

```json
{ "success": true }
```

> 創建驗證會話，5 分鐘過期。顧客需將此驗證碼發送至 WhatsApp Business 號完成驗證。

---

### 2.6 查詢驗證狀態

```http
GET /api/public/verify/status?code=A3B7C9
```

**Auth**: 不需要

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `code` | `string` | 是 | 6 位驗證碼 |

**Response `200`**:

```json
{
  "verified": true,
  "phone": "85291234567"
}
```

或過期:

```json
{
  "verified": false,
  "expired": true
}
```

---

### 2.7 發送 OTP (WhatsApp)

```http
POST /api/public/verify/send-otp
```

**Auth**: 不需要

**Request Body**:

```json
{
  "phone": "91234567"
}
```

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 生成 6 位數字 OTP
- 存儲到 KV (`otp_{phone}`)，5 分鐘過期
- 通過 WhatsApp 發送 OTP 訊息

**Error Codes**:
- `400` — 電話號碼格式錯誤 (需 8 位香港手機號)
- `500` — 發送失敗

---

### 2.8 驗證 OTP

```http
POST /api/public/verify/check-otp
```

**Auth**: 不需要

**Request Body**:

```json
{
  "phone": "91234567",
  "code": "123456"
}
```

**Response `200`**:

```json
{
  "verified": true,
  "phone": "85291234567"
}
```

或失敗:

```json
{
  "verified": false,
  "error": "驗證碼不正確，請重新輸入"
}
```

**Side Effects**:
- 驗證成功後在 KV 存儲 `verified_{phone}`，7 天過期

---

### 2.9 上傳付款證明

```http
POST /api/public/payment-proof/upload
```

**Auth**: 不需要

**Request Body**: `multipart/form-data`

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `file` | `File` | 是 | 檔案 (JPG/PNG/PDF)，最大 5MB |
| `orderNum` | `string` | 是 | 訂單編號 |

**Response `200`**:

```json
{
  "success": true,
  "url": "https://.../api/public/payment-proof/proof-AB1234-1713964800000.jpg"
}
```

**Side Effects**:
- 上傳檔案至 R2
- 更新 `order_records.payment_proof`
- WhatsApp 通知管理員

**Error Codes**:
- `400` — 缺少檔案或訂單編號 / 不支援的檔案類型 / 檔案過大

---

### 2.10 查看付款證明

```http
GET /api/public/payment-proof/:key
```

**Auth**: 不需要

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `key` | `string` | R2 檔案鍵 |

**Response**: 直接返回圖片/PDF 二進制流，帶 `Cache-Control: public, max-age=86400`

---

### 2.11 獲取媒體檔案

```http
GET /media/:name
```

**Auth**: 不需要

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `name` | `string` | 媒體檔案名 |

**Response**: 直接返回檔案二進制流

---

## 3. Admin - 認證

### 3.1 管理員登入

```http
POST /api/public/admin/login
```

**Auth**: 不需要

**Request Body**:

```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Response `200`**:

```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...",
  "user": {
    "id": 2,
    "username": "admin",
    "role": "admin",
    "display_name": "客服管理員"
  }
}
```

**Side Effects**:
- 生成新 token 並寫入 `admin_users.token`
- 記錄審計日誌 (`action: "LOGIN"`)

**Error Codes**:
- `401` — 用戶名或密碼錯誤
- `500` — 登入失敗

---

### 3.2 獲取當前用戶資訊

```http
GET /api/public/admin/auth/me
```

**Auth**: `Bearer {token}`

**Response `200`**:

```json
{
  "id": 2,
  "username": "admin",
  "role": "admin",
  "display_name": "客服管理員"
}
```

---

## 4. Admin - 訂單管理

### 4.1 獲取所有訂單

```http
GET /api/public/admin/orders
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Response `200`**:

```json
[
  {
    "id": 1,
    "items": "[{...}]",
    "totalPrice": 198,
    "region": "KLN",
    "address": "彩虹邨金碧樓...",
    "estate": "彩虹邨",
    "deliveryDate": "2026-04-26",
    "deliveryTime": "10:00-13:00",
    "name": "陳大文",
    "phone": "85291234567",
    "email": null,
    "remarks": null,
    "referralCode": null,
    "campaignName": "good-sung-default",
    "paymentConfirmed": 0,
    "orderCompleted": 0,
    "paymentProof": null,
    "orderNum": "AB1234",
    "createdAt": 1713964800
  }
]
```

> 按 `created_at DESC` 排序。`items` 為 JSON 字符串。

---

### 4.2 獲取單個訂單

```http
GET /api/public/admin/orders/:id
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | `number` | 訂單 ID |

**Response `200`**: 單個訂單對象

**Error Codes**:
- `404` — 訂單不存在

---

### 4.3 更新訂單

```http
PUT /api/public/admin/orders/:id
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | `number` | 訂單 ID |

**Request Body**: 部分更新，支援 camelCase 欄位名

```json
{
  "paymentConfirmed": 1,
  "orderCompleted": 0,
  "remarks": "已聯絡顧客"
}
```

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 如果 `paymentConfirmed` 從 `0` 變為 `1`：
  - 發送 WhatsApp 付款確認給顧客
  - 自動扣減對應產品庫存 (`cms_products.stock_quantity`)
  - 如果庫存歸零，自動下架 (`is_active = 0`)
- 記錄審計日誌 (`action: "UPDATE"`, `target_type: "order"`)

---

### 4.4 標記訂單完成

```http
POST /api/public/admin/orders/:id/complete
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | `number` | 訂單 ID |

**Response `200`**:

```json
{
  "success": true,
  "orderCompleted": 1
}
```

**業務規則**:
- 訂單必須 `payment_confirmed = 1` 才能標記完成
- 記錄審計日誌 (`action: "COMPLETE"`)

**Error Codes**:
- `400` — 訂單必須先付款才能標記完成
- `404` — 訂單不存在

---

### 4.5 刪除訂單

```http
DELETE /api/public/admin/orders/:id
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | `number` | 訂單 ID |

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 記錄審計日誌 (`action: "DELETE"`)

---

## 5. Admin - 產品管理

### 5.1 獲取產品列表

```http
GET /api/public/admin/products
```

**Auth**: `Bearer {token}` (所有角色)

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `category` | `string` | 否 | 篩選分類 |

**Response `200`**:

```json
[
  {
    "id": 1,
    "category": "dish",
    "productCode": "D001",
    "name": "宮保雞丁",
    "description": "微辣開胃",
    "price": null,
    "originalPrice": null,
    "isActive": 1,
    "stockQuantity": 50,
    "sortOrder": 0,
    "imageUrl": null,
    "maxSelect": 1,
    "updatedBy": 1,
    "updatedAt": 1713964800
  }
]
```

> 注意: Admin 接口返回原始欄位，不含 `stockStatus`。

---

### 5.2 創建產品

```http
POST /api/public/admin/products
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**:

```json
{
  "category": "dish",
  "name": "新菜式",
  "description": "美味可口",
  "price": null,
  "originalPrice": null,
  "is_active": true,
  "stock_quantity": 100,
  "sort_order": 0,
  "image_url": null,
  "max_select": 1
}
```

**Response `201`**:

```json
{
  "success": true,
  "id": 15
}
```

**Side Effects**:
- 自動生成 `product_code` (如未提供): `D`/`S`/`P` + 3位數字
- 記錄審計日誌 (`action: "CREATE"`, `target_type: "product"`)

---

### 5.3 更新產品

```http
PUT /api/public/admin/products/:id
```

**Auth**: `Bearer {token}` (所有角色)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | `number` | 產品 ID |

**Request Body**: 部分更新

```json
{
  "name": "新名稱",
  "price": 129,
  "stock_quantity": 80,
  "is_active": true
}
```

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 自動更新 `updated_by` 和 `updated_at`
- 記錄審計日誌

---

### 5.4 切換產品狀態

```http
POST /api/public/admin/products/:id/toggle
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**:

```json
{
  "is_active": false
}
```

**Response `200`**:

```json
{ "success": true }
```

---

### 5.5 刪除產品

```http
DELETE /api/public/admin/products/:id
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 記錄審計日誌 (`action: "DELETE"`)

---

## 6. Admin - 套餐配置

### 6.1 獲取套餐配置

```http
GET /api/public/admin/package-configs
```

**Auth**: `Bearer {token}` (所有角色)

**Response `200`**:

```json
[
  {
    "id": 1,
    "typeKey": "2-dish-1-soup",
    "name": "2餸1湯",
    "price": 99,
    "dishCount": 2,
    "soupCount": 1,
    "isActive": 1,
    "sortOrder": 0,
    "createdAt": 1713964800,
    "updatedAt": 1713964800
  }
]
```

---

### 6.2 創建套餐配置

```http
POST /api/public/admin/package-configs
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**:

```json
{
  "typeKey": "4-dish-1-soup",
  "name": "4餸1湯",
  "dishCount": 4,
  "soupCount": 1,
  "price": 159,
  "isActive": true,
  "sortOrder": 2
}
```

**Response `201`**:

```json
{
  "success": true,
  "id": 3
}
```

> 支援 `camelCase` 和 `snake_case` 兩種欄位名。

---

### 6.3 更新套餐配置

```http
PUT /api/public/admin/package-configs/:id
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**: 部分更新 (支援雙欄位名)

```json
{
  "name": "豪華2餸1湯",
  "price": 109,
  "isActive": true
}
```

**Response `200`**:

```json
{ "success": true }
```

---

### 6.4 切換套餐狀態

```http
POST /api/public/admin/package-configs/:id/toggle
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**:

```json
{
  "isActive": false
}
```

**Response `200`**:

```json
{ "success": true }
```

---

### 6.5 刪除套餐配置

```http
DELETE /api/public/admin/package-configs/:id
```

**Auth**: `Bearer {token}` (super_admin, admin)

**Response `200`**:

```json
{ "success": true }
```

---

## 7. Admin - 媒體庫

### 7.1 上傳媒體

```http
POST /api/public/admin/media/upload
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**: `multipart/form-data`

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `file` | `File` | 是 | 圖片檔案 |

**Response `200`**:

```json
{
  "success": true,
  "url": "https://good-sung-shop.jimsbond007.workers.dev/media/1713964800_abc123.jpg",
  "key": "media/1713964800_abc123.jpg"
}
```

**限制**:
- 僅允許 `image/*` 類型

---

### 7.2 獲取媒體列表

```http
GET /api/public/admin/media
```

**Auth**: `Bearer {token}` (所有角色)

**Response `200`**:

```json
[
  {
    "key": "media/1713964800_abc123.jpg",
    "name": "1713964800_abc123.jpg",
    "size": 204800,
    "uploaded": "2026-04-24T12:00:00.000Z",
    "url": "https://good-sung-shop.jimsbond007.workers.dev/media/1713964800_abc123.jpg"
  }
]
```

---

### 7.3 刪除媒體

```http
DELETE /api/public/admin/media/:name
```

**Auth**: `Bearer {token}` (所有角色)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `name` | `string` | 媒體檔案名 |

**Response `200`**:

```json
{ "success": true }
```

---

## 8. Admin - 廣播推廣

### 8.1 獲取顧客列表

```http
GET /api/public/admin/customers
```

**Auth**: `Bearer {token}` (super_admin only)

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `paymentStatus` | `string` | 否 | `all` / `paid` |
| `estate` | `string` | 否 | 屋苑名稱篩選 |
| `daysSinceLastOrder` | `string` | 否 | 最近下單天數 |

**Response `200`**:

```json
[
  {
    "name": "陳大文",
    "phone": "85291234567",
    "estate": "彩虹邨",
    "lastOrderAt": 1713964800,
    "totalOrders": 3,
    "totalSpent": 594
  }
]
```

> 按電話分組聚合。

---

### 8.2 獲取廣播活動列表

```http
GET /api/public/admin/broadcast-campaigns
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
[
  {
    "id": 1,
    "name": "復活節推廣",
    "messageContent": "【好餸社企】復活節特惠...",
    "createdBy": 1,
    "createdAt": 1713964800,
    "updatedAt": 1713964800
  }
]
```

---

### 8.3 創建廣播活動

```http
POST /api/public/admin/broadcast-campaigns
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**:

```json
{
  "name": "母親節推廣",
  "messageContent": "【好餸社企】母親節限定套餐..."
}
```

**Response `201`**:

```json
{
  "success": true,
  "id": 2
}
```

---

### 8.4 更新廣播活動

```http
PUT /api/public/admin/broadcast-campaigns/:id
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**: 部分更新

```json
{
  "name": "母親節推廣 (更新)",
  "messageContent": "【好餸社企】母親節限定套餐現已開售..."
}
```

**Response `200`**:

```json
{ "success": true }
```

---

### 8.5 刪除廣播活動

```http
DELETE /api/public/admin/broadcast-campaigns/:id
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
{ "success": true }
```

---

### 8.6 創建發送批次

```http
POST /api/public/admin/broadcast-batches
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**:

```json
{
  "campaignId": 1,
  "name": "第一批次",
  "phones": ["85291234567", "85292345678"],
  "names": ["陳大文", "李小明"],
  "rateMinSeconds": 25,
  "rateMaxSeconds": 120,
  "waveSize": 50,
  "waveIntervalSeconds": 300
}
```

**Response `200`**:

```json
{
  "batchId": 10,
  "targetCount": 2
}
```

**Side Effects**:
- 創建 `broadcast_batches` 記錄
- 為每個 phone 創建 `broadcast_logs` 記錄 (status = `pending`)

---

### 8.7 獲取批次列表

```http
GET /api/public/admin/broadcast-batches
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
[
  {
    "id": 10,
    "campaignId": 1,
    "name": "第一批次",
    "targetCount": 100,
    "sentCount": 45,
    "failedCount": 2,
    "status": "pending",
    "campaignName": "復活節推廣",
    "createdAt": 1713964800
  }
]
```

---

### 8.8 獲取單個批次

```http
GET /api/public/admin/broadcast-batches/:id
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
{
  "id": 10,
  "campaignId": 1,
  "name": "第一批次",
  "targetCount": 100,
  "sentCount": 45,
  "failedCount": 2,
  "status": "pending",
  "rateMinSeconds": 25,
  "rateMaxSeconds": 120,
  "waveSize": 50,
  "waveIntervalSeconds": 300,
  "campaignName": "復活節推廣",
  "createdAt": 1713964800,
  "updatedAt": 1713964800
}
```

---

### 8.9 獲取批次發送日誌

```http
GET /api/public/admin/broadcast-batches/:id/logs
```

**Auth**: `Bearer {token}` (super_admin only)

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | `string` | 否 | `all` / `pending` / `sent` / `failed` |

**Response `200`**:

```json
[
  {
    "id": 1,
    "batchId": 10,
    "campaignId": 1,
    "customerPhone": "85291234567",
    "customerName": "陳大文",
    "messageContent": "【好餸社企】復活節特惠...",
    "status": "sent",
    "errorMessage": null,
    "sentAt": 1713964900,
    "createdAt": 1713964800
  }
]
```

---

### 8.10 發送單條廣播

```http
POST /api/public/admin/broadcast-send
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**:

```json
{
  "logId": 1,
  "phone": "85291234567",
  "message": "【好餸社企】復活節特惠..."
}
```

**Response `200`**:

```json
{
  "success": true
}
```

**Side Effects**:
- 調用 `sendWhatsAppMessage()`
- 更新 `broadcast_logs.status` 和 `broadcast_batches` 計數器
- 如果全部發送完成，自動更新批次狀態為 `completed`

---

## 9. Admin - 用戶管理

### 9.1 獲取用戶列表

```http
GET /api/admin/users
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
[
  {
    "id": 1,
    "username": "superadmin",
    "role": "super_admin",
    "display_name": "系統管理員",
    "phone": "85298536993",
    "is_active": 1,
    "created_at": 1713964800,
    "updated_at": 1713964800
  }
]
```

> 注意: 不包含 `password_hash`。

---

### 9.2 創建用戶

```http
POST /api/admin/users
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**:

```json
{
  "username": "newadmin",
  "password": "securePass123",
  "role": "admin",
  "display_name": "新管理員",
  "phone": "85291234567",
  "is_active": true
}
```

**Response `201`**:

```json
{ "success": true }
```

**Side Effects**:
- 密碼經 SHA-256 哈希存儲
- 如果提供 `phone`，自動發送 WhatsApp 通知新用戶登入資料
- 記錄審計日誌

**Error Codes**:
- `400` — 缺少必填欄位
- `409` — 用戶名已存在

---

### 9.3 更新用戶

```http
PUT /api/admin/users/:id
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**: 部分更新

```json
{
  "display_name": "更新後名稱",
  "phone": "85292345678",
  "role": "admin",
  "is_active": true,
  "password": "newPassword123"
}
```

**Response `200`**:

```json
{ "success": true }
```

> 提供 `password` 時會自動哈希並更新。

---

### 9.4 刪除用戶

```http
DELETE /api/admin/users/:id
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
{ "success": true }
```

**業務規則**:
- 不能刪除自己 (`user.id === id` 返回 400)

---

### 9.5 發送登入憑證

```http
POST /api/admin/users/send-credentials
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**:

```json
{
  "userIds": [2, 3]
}
```

**Response `200`**:

```json
{
  "success": true,
  "total": 2,
  "sent": 2,
  "failed": 0,
  "results": [
    {
      "id": 2,
      "username": "admin",
      "phone": "85291234567",
      "role": "admin",
      "sent": true,
      "error": null
    }
  ]
}
```

**Side Effects**:
- 為每個用戶生成隨機 8 位密碼
- 更新 `password_hash`
- 通過 WhatsApp 發送新憑證
- 僅對 `role IN ('admin', 'supplier')` 且 `phone` 不為空的用戶生效

---

## 10. Admin - 系統設置 & 審計日誌

### 10.1 獲取系統設置

```http
GET /api/admin/settings
```

**Auth**: `Bearer {token}` (super_admin only)

**Response `200`**:

```json
{
  "bank_account": {
    "value": "DBS A/C - 016-000227829",
    "description": "銀行帳號",
    "updatedAt": 1713964800
  },
  "fps_id": {
    "value": "FPS - 108810334",
    "description": null,
    "updatedAt": 1713964800
  }
}
```

---

### 10.2 更新系統設置

```http
PUT /api/admin/settings
```

**Auth**: `Bearer {token}` (super_admin only)

**Request Body**:

```json
{
  "bank_account": {
    "value": "HSBC A/C - 123-456789-001",
    "description": "銀行帳號"
  },
  "min_days_advance": {
    "value": "3"
  }
}
```

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 使用 `INSERT ... ON CONFLICT(key) DO UPDATE` (Upsert)
- 記錄審計日誌 (`action: "UPDATE"`, `target_type: "setting"`)

---

### 10.3 獲取審計日誌

```http
GET /api/admin/audit-logs
```

**Auth**: `Bearer {token}` (super_admin only)

**Query Parameters**:

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `limit` | `number` | 否 | 每頁數量，默認 50，最大 200 |
| `offset` | `number` | 否 | 偏移量，默認 0 |
| `action` | `string` | 否 | 篩選操作類型 |
| `target_type` | `string` | 否 | 篩選目標類型 |
| `admin_username` | `string` | 否 | 篩選管理員 |
| `start_date` | `string` | 否 | 開始日期 `YYYY-MM-DD` |
| `end_date` | `string` | 否 | 結束日期 `YYYY-MM-DD` |

**Response `200`**:

```json
[
  {
    "id": 1,
    "admin_id": 1,
    "admin_username": "superadmin",
    "admin_role": "super_admin",
    "action": "LOGIN",
    "target_type": "user",
    "target_id": "1",
    "details": "{}",
    "ip_address": null,
    "created_at": 1713964800
  }
]
```

---

## 11. Admin - WhatsApp 對話

### 11.1 獲取對話列表

```http
GET /api/public/admin/whatsapp/conversations
```

**Auth**: `Bearer {token}` (所有角色)

**Response `200`**:

```json
{
  "conversations": [
    {
      "phone": "85291234567",
      "lastMessageAt": 1713964800,
      "messageCount": 15
    }
  ]
}
```

---

### 11.2 獲取單個對話

```http
GET /api/public/admin/whatsapp/conversations/:phone
```

**Auth**: `Bearer {token}` (所有角色)

**Path Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `phone` | `string` | 電話號碼，例: `85291234567` |

**Response `200`**:

```json
{
  "phone": "85291234567",
  "messages": [
    {
      "id": 1,
      "phone": "85291234567",
      "message": "你好，我想查詢訂單",
      "sender": "user",
      "createdAt": 1713964800
    },
    {
      "id": 2,
      "phone": "85291234567",
      "message": "請問您的訂單編號是？",
      "sender": "bot",
      "createdAt": 1713964810
    }
  ]
}
```

> 最多返回 100 條訊息，按時間倒序。

---

### 11.3 發送 WhatsApp 訊息

```http
POST /api/public/admin/whatsapp/send
```

**Auth**: `Bearer {token}` (所有角色)

**Request Body**:

```json
{
  "phone": "85291234567",
  "message": "您好，您的訂單已確認。"
}
```

**Response `200`**:

```json
{ "success": true }
```

**Side Effects**:
- 發送 WhatsApp 訊息
- 存入 `whatsapp_messages` 表 (`sender: 'bot'`)
- 記錄審計日誌 (`action: "SEND_WHATSAPP"`)

**Error Codes**:
- `400` — 缺少 phone 或 message
- `500` — 發送失敗

---

## 12. Webhooks

### 12.1 WhatsApp Webhook

```http
POST /api/webhooks/whatsapp
```

**Auth**: 不需要 (由 WhatsApp Provider 調用)

**Request Body**: 取決於 Provider 格式，支援多種格式:

- **CloudWAPI**: `{ phone, message, ... }`
- **SaleSmartly**: `{ event: "message", data: { channel_uid, msg, ... } }`
- **標準 WhatsApp API**: `{ entry: [{ changes: [{ value: { messages: [{ from, text: { body } }] } }] }] }`

**Response `200`**:

```json
{
  "status": "success",
  "message": "received",
  "phone": "85291234567"
}
```

或驗證成功:

```json
{
  "status": "success",
  "message": "verified",
  "code": "A3B7C9"
}
```

**處理邏輯**:

1. 從多種格式中提取 `phone` 和 `message`
2. 檢查是否為驗證碼 (6 位英數組合，可選前綴「驗證碼:」)
3. 如果是驗證碼:
   - 更新 D1 `verification_sessions` (`verified = 1`)
   - 更新 KV `verify_{code}`
   - 回覆顧客「驗證成功」WhatsApp 訊息
4. 如果不是驗證碼:
   - 存入 `whatsapp_messages` 表 (`sender: 'user'`)

---

## 附錄：前端 API 調用範例

```ts
import { apiFetch } from "@/lib/api";

// GET 請求
const res = await apiFetch("/api/public/admin/orders");
const orders = await res.json();

// POST 請求
const res = await apiFetch("/api/public/admin/products", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "新產品", category: "dish" }),
});

// 上傳檔案
const formData = new FormData();
formData.append("file", file);
formData.append("orderNum", "AB1234");
const res = await fetch(`${API_BASE}/api/public/payment-proof/upload`, {
  method: "POST",
  body: formData,
});
```
