# WhatsApp Webhook API 文檔

## 服務概述

本服務提供 WhatsApp 消息集成接口，用於接收客戶消息並存儲對話記錄。系統會為每個客戶號碼維護完整的對話歷史，方便後續 LLM 調用時獲取背景信息。

---

## API 端點

### Webhook URL
```
POST https://deliciousexp.youware.app/api/webhooks/whatsapp
```

### 認證
- **方式**: 在請求頭中使用 API Key
- **Header 名稱**: `x-webhook-key`
- **API Key**: 存儲在環境變數 `WEBHOOK_KEY` 中
```
x-webhook-key: [你的-WEBHOOK_KEY]
```

---

## 請求格式

### 請求頭 (Headers)
```json
{
  "Content-Type": "application/json",
  "x-webhook-key": "your-webhook-key-here"
}
```

### 請求體 (Body)
```json
{
  "phone": "85212345678",
  "message": "您好，我想詢問關於訂單的事宜",
  "sender": "user",
  "timestamp": "2026-01-28T08:57:42Z",
  "attachments": []
}
```

### 字段説明

| 字段 | 類型 | 必填 | 說明 |
|-----|------|------|------|
| `phone` | string | ✅ | WhatsApp 客戶號碼（包含國家碼，如：852） |
| `message` | string | ✅ | 消息內容（支持中文、英文等） |
| `sender` | string | ✅ | 消息發送者，只能是 `"user"` 或 `"bot"` |
| `timestamp` | string\|number | ❌ | 時間戳（ISO 8601 格式 `2026-01-28T08:57:42Z` 或 Unix 秒數）。如不提供，系統自動使用當前時間 |
| `attachments` | array | ❌ | 附件列表，例：`[{"url": "https://...", "filename": "image.jpg", "type": "image"}]` |

---

## 響應格式

### 成功響應 (HTTP 200)

當消息成功存儲時：

```json
{
  "status": "success",
  "message": "received",
  "data_id": "85212345678"
}
```

---

### 錯誤響應

#### 1. 缺少必填字段 (HTTP 400)
```json
{
  "status": "error",
  "error_code": "INVALID_DATA",
  "message": "Missing required fields: phone, message, sender"
}
```

#### 2. 無效的電話號碼格式 (HTTP 400)
```json
{
  "status": "error",
  "error_code": "INVALID_DATA",
  "message": "Invalid phone number format"
}
```

#### 3. 無效的 sender 值 (HTTP 400)
```json
{
  "status": "error",
  "error_code": "INVALID_DATA",
  "message": "sender must be either \"user\" or \"bot\""
}
```

#### 4. 記錄已存在 (HTTP 409)
```json
{
  "status": "error",
  "error_code": "CONFLICT",
  "message": "Conversation record already exists for this phone number"
}
```

#### 5. 未授權 (HTTP 401)
```json
{
  "status": "error",
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or missing API key"
}
```

#### 6. 伺服器錯誤 (HTTP 500)
```json
{
  "status": "error",
  "error_code": "INTERNAL_ERROR",
  "message": "Server internal error"
}
```

---

## 使用範例

### cURL 範例
```bash
curl -X POST https://deliciousexp.youware.app/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-webhook-key: Bh87bC4BadSZC6D" \
  -d '{
    "phone": "85212345678",
    "message": "Hello, I want to ask about my order",
    "sender": "user"
  }'
```

### JavaScript 範例
```javascript
const response = await fetch('https://deliciousexp.youware.app/api/webhooks/whatsapp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-key': 'Bh87bC4BadSZC6D'
  },
  body: JSON.stringify({
    phone: '85212345678',
    message: 'Hello, I want to ask about my order',
    sender: 'user',
    timestamp: new Date().toISOString()
  })
});

const data = await response.json();
console.log(data);
```

---

## 管理員 API 端點

### 取得所有對話列表
```
GET /api/public/admin/whatsapp/conversations
```

**認證**: Bearer token (從 `/api/public/admin/login` 獲得)

**響應範例**:
```json
{
  "conversations": [
    {
      "phone": "85212345678",
      "last_message_at": "2026-01-28T08:57:42Z",
      "created_at": 1706428800
    }
  ]
}
```

### 取得特定客戶的對話記錄
```
GET /api/public/admin/whatsapp/conversations/:phone
```

**路徑參數**:
- `phone`: WhatsApp 客戶號碼

**響應範例**:
```json
{
  "phone": "85212345678",
  "conversationHistory": [
    {
      "timestamp": "2026-01-28T08:57:42Z",
      "sender": "user",
      "message": "Hello",
      "attachments": []
    },
    {
      "timestamp": "2026-01-28T08:58:00Z",
      "sender": "bot",
      "message": "Hi, how can I help?",
      "attachments": []
    }
  ],
  "attachments": [
    {
      "timestamp": "2026-01-28T08:57:42Z",
      "url": "https://...",
      "filename": "image.jpg",
      "type": "image"
    }
  ],
  "lastMessageAt": "2026-01-28T08:58:00Z",
  "createdAt": 1706428800
}
```

---

## 常見問題

### Q1: 如何在本地測試 Webhook？
A: 可使用 Postman 或 cURL 進行測試，確保 `x-webhook-key` Header 匹配後端配置的 `WEBHOOK_KEY` 環境變數。

### Q2: timestamp 是否必須提供？
A: 不必須。如未提供，系統會自動使用當前時間的 ISO 8601 格式。

### Q3: 是否支持批量發送消息？
A: 目前不支持。請為每條消息單獨進行 API 調用。

### Q4: 如何查詢歷史對話？
A: 使用管理員 API 端點 `GET /api/public/admin/whatsapp/conversations/:phone`。

### Q5: 附件如何存儲？
A: 附件信息（URL、文件名、類型）存儲在數據庫，不會直接存儲文件內容。
