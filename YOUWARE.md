# YOUWARE - Poon Choi SaaS Platform

This is a modern React + Hono backend application built with React 18, TypeScript, Vite, and Tailwind CSS, featuring a landing page for "Good Sung" (好餸) Poon Choi ordering with SaaS-enabled multi-scenario support. Customers can now self-serve create new campaigns/scenarios through the Admin API.

## Project Status

- **Project Type**: React + TypeScript Modern Web Application
- **Entry Point**: `src/main.tsx` (React application entry)
- **Build System**: Vite 7.0.0 (Fast development and build)
- **Styling System**: Tailwind CSS 3.4.17 (Atomic CSS framework)
- **Key Features**:
  - Poon Choi Ordering Landing Page (`src/pages/PoonChoiLanding.tsx`)
  - Admin Dashboard (`/admin`) for order management

## 新架構說明 - SaaS 多活動系統

### 架構概念

系統分為兩個獨立的部分：

**1. 前端客戶頁面（目前只有一個）**
- 訪問 https://yourdomain.com/ 進入 PoonChoiLanding.tsx（硬編碼頁面）
- 客戶填表單、選擇商品、提交訂單
- 訂單直接存到數據庫

**2. 後台管理系統**
- 訪問 https://yourdomain.com/admin 登入
- 可以創建/管理 Campaign（活動）
- 每個 Campaign 有自己的 WhatsApp 模板配置
- 這些配置用於發送不同的 WhatsApp 消息

### 當前狀態 vs 未來計劃

**目前已實現 (Phase 1)**
- ✅ 硬編碼的單一 landing page
- ✅ 後台可以創建多個 Campaign
- ✅ 每個 Campaign 可以有不同的 WhatsApp 模板

**未來計劃 (Phase 2 - 已實現 ✅)**
- ✅ 每個 Campaign 有自己的 Landing Page URL (`/campaign/:scenarioKey`)
- ✅ 訂單與 Campaign 關聯
- ✅ 不同 Campaign 可自定義頁面內容（標題、描述、英雄圖片、按鈕文本、按鈕顏色）
- ✅ 異步 WhatsApp 通知處理 (解決下單等待過久問題)

### 現階段的 Landing Page URL

目前只有一個 landing page URL：
```
https://yourdomain.com/
```

在後台創建的每個 Campaign 主要用於：
1. **WhatsApp 模板管理** - 自定義發給客戶的消息
2. **未來的 Campaign 配置存儲** - 為未來的動態頁面做準備

### 後台運作流程

**Step 1: 創建 Campaign**
```
Admin 面板 → /admin/campaigns → 點擊 Create Campaign
輸入以下信息：
- Scenario Key: "poon-choi-good-sung" (唯一識別符，將來用於 URL)
- Name: "Poon Choi - Good Sung" (顯示名稱)
- Default Language: "zh" (默認語言)
- Config: {} (未來用於存儲 landing page 自定義)
```

**Step 2: 管理 WhatsApp 模板**
```
每個 Campaign 可以創建三種 WhatsApp 消息模板：

1. Order Confirmation（訂單確認）
   - 客戶下單時自動發送
   - 支持自定義文字、變量（如 {{orderNo}}, {{total}})

2. Sharing（分享）
   - 客戶分享時發送
   - 可包含分享鏈接和推薦文案

3. Referral Success（邀請成功）
   - 被邀請人下單時發送給邀請人
   - 通知邀請獎勵信息
```

**Step 3: Campaign 設置**
```
在每個 Campaign 的 Settings 頁面可以自定義：
- Landing Page 標題、描述、英雄圖片
- 推薦計劃設置（積分、折扣、代碼前綴）
- 活動狀態（活躍/不活躍）

所有設置存儲在 Campaign 的 config JSON 字段中
```

### 如何在未來實現多個 Landing Page URL

**實現方案：**

1. **添加動態路由**
```typescript
// 在 App.tsx 中添加
<Route path="/campaigns/:scenarioKey" element={<DynamicLanding />} />
```

2. **創建動態 Landing Page 組件**
```typescript
// src/pages/DynamicLanding.tsx
import { useParams } from 'react-router-dom';
import { createEdgeSpark } from '@edgespark/client';

const DynamicLanding = () => {
  const { scenarioKey } = useParams();
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    // 從後台 API 獲取 Campaign 配置
    const fetchCampaign = async () => {
      const res = await client.api.fetch(
        `/api/public/admin/scenarios/${scenarioKey}`
      );
      const data = await res.json();
      setCampaign(data);
    };
    
    fetchCampaign();
  }, [scenarioKey]);

  // 使用 campaign.config 中的自定義設置渲染頁面
  // 例如：顯示自定義標題、圖片、文案等
};
```

3. **生成 URL**
```
Campaign 創建後，URL 自動生成：
https://yourdomain.com/campaigns/poon-choi-good-sung
https://yourdomain.com/campaigns/holiday-special
https://yourdomain.com/campaigns/vip-exclusive

可以通過分享這些鏈接給不同的客戶群體
```

### 數據流向圖

```
Admin 創建 Campaign
    ↓
API 存儲到 whatsapp_scenarios 數據庫表
    ↓
Campaign 信息包含：
  - scenarioKey (唯一識別符)
  - name (顯示名稱)
  - config (自定義配置 JSON)
  - whatsappMessageTemplates (關聯的消息模板)
    ↓
未來：訪問 https://yourdomain.com/campaigns/{scenarioKey}
    ↓
動態 Landing Page 根據 campaignKey 加載對應的 config
    ↓
頁面顯示自定義的標題、圖片、文案等
    ↓
客戶下單時，訂單關聯到這個 Campaign
    ↓
發送 WhatsApp 消息時，使用該 Campaign 的模板
```

### 實現步驟規劃

| 步驟 | 功能 | 狀態 |
|------|------|------|
| 1 | 後台 Campaign CRUD | ✅ 已完成 |
| 2 | Campaign WhatsApp 模板管理 | ✅ 已完成 |
| 3 | Campaign 設置頁面 | ✅ 已完成 |
| 4 | 動態 Landing Page 路由 | ⏳ 待實現 |
| 5 | 訂單與 Campaign 關聯 | ⏳ 待實現 |
| 6 | 分享鏈接生成（帶 Campaign 標識） | ⏳ 待實現 |

## Lunar New Year Holiday Configuration (2026)

- **Holiday Period**: Feb 17 - Feb 22, 2026 (disabled for all deliveries)
- **Restricted Day (Feb 16)**: Day before holiday - Only allows 10:00-13:00 time slot
  - Other two time slots (14:00-18:00, 18:00-20:00) are hidden when Feb 16 is selected
  - User sees message: "2月16日只提供 10:00 - 13:00 時間段"
- **Implementation**: 
  - Function `isDateDisabled()` disables Feb 17-22 (line 55-65 in PoonChoiLanding.tsx)
  - Function `isRestrictedDay()` detects Feb 16 specifically (line 67-76)
  - Time slot dropdown conditionally renders slots based on selected date (line 413-428)

## Dynamic Landing Page - Campaign URLs (Phase 2 - In Progress)

### How It Works Now

**Navigation Routes** (in `src/App.tsx`):
- `/` - Main landing page (PoonChoiLanding) - hardcoded content
- `/campaign/:scenarioKey` - Dynamic landing page that fetches Campaign config from backend
- `/poon-choi-good-sung` - Backward compatible route (still uses PoonChoiCampaignLanding)

**Component** (`src/pages/PoonChoiCampaignLanding.tsx`):
- Fetches Campaign config from API: `GET /api/public/admin/scenarios/:scenarioKey`
- Parses `configJson.landingPageConfig` if it exists
- Falls back to defaults if config doesn't exist
- Uses dynamic `campaignName` in form submission
- Supports multi-language like the main landing page

**Backend API** (`GET /api/public/admin/scenarios/:scenarioKey`):
- Returns Scenario/Campaign object including:
  - `scenarioKey`: Unique identifier (e.g., "poon-choi-good-sung")
  - `name`: Campaign display name (e.g., "Good Sung")
  - `configJson`: JSON string containing `landingPageConfig` object with:
    - `title`: Campaign title
    - `description`: Campaign description
    - `ctaButtonText`: CTA button text
    - `ctaButtonColor`: CTA button color

**Admin Control** (`/admin/campaigns/:scenarioKey/settings`):
- Edit `landingPageConfig` in Campaign settings
- Changes are stored in `configJson` field in database
- Immediately reflects on the corresponding Campaign's landing page

### Usage Example

1. **Create a Campaign in Admin**:
   - Go to `/admin/campaigns`
   - Click "Create Campaign"
   - Set Scenario Key: "holiday-special"
   - Set Name: "Holiday Special Edition"

2. **Configure Landing Page**:
   - Go to `/admin/campaigns/holiday-special/settings`
   - Edit the Landing Page Config:
     - Title: "Holiday Special Poon Choi"
     - Description: "Limited Edition for Holidays"
     - Button Text: "Order Holiday Special"

3. **Access Campaign Landing Page**:
   - Visit: `https://yourdomain.com/campaign/holiday-special`
   - Page displays the custom title, description, and button text
   - Customers can place orders with the campaign name auto-filled

### Future Enhancements
- Campaign-specific product selections
- Campaign-specific pricing
- Campaign-specific hero images
- Campaign-specific color schemes
- Campaign-specific WhatsApp templates (already implemented)

## Admin Access

- **Login URL**: `/admin`
- **Default Credentials**: `twmeric` / `superwoman`
- **Features**:
  - **Campaign Management** (`/admin/campaigns`): Create, Edit, Delete campaigns; Manage WhatsApp templates per campaign
  - **Campaign Settings** (`/admin/campaigns/:scenarioKey/settings`): Edit Landing Page Config (title, description, button text)
  - **Order Management** (`/admin/dashboard`): View, Edit, Delete orders; Admin Remarks; Search by Order #/ID/Name/Phone
  - **Conversation Management** (`/admin/conversations`): View customer WhatsApp conversations

## SaaS Features - Campaign/Scenario Management

**Phase 2: Multi-Campaign Support**

Customers can now create and manage multiple campaigns (scenarios) independently. Each scenario can have:
- Custom WhatsApp message templates (order confirmation, sharing, referral)
- Custom landing page configuration
- Multi-language support (Chinese/English)
- Custom referral code strategy

### Admin API Endpoints

**Campaign Management:**
- `GET /api/public/admin/scenarios` - List all campaigns
- `POST /api/public/admin/scenarios` - Create new campaign
  ```json
  {
    "scenarioKey": "campaign_name",
    "name": "Campaign Display Name",
    "defaultLang": "zh",
    "config": { "additionalConfig": "data" }
  }
  ```
- `GET /api/public/admin/scenarios/:scenarioKey` - Get campaign details
- `PUT /api/public/admin/scenarios/:scenarioKey` - Update campaign
- `DELETE /api/public/admin/scenarios/:scenarioKey` - Delete campaign (no templates must exist)

**Template Management:**
- `GET /api/public/admin/whatsapp/templates` - List templates (with filters)
- `POST /api/public/admin/whatsapp/templates` - Create template
- `POST /api/public/admin/whatsapp/templates/:id/activate` - Activate template version
- `POST /api/public/admin/whatsapp/templates/preview` - Preview rendered template

**Authentication:**
- All admin endpoints require `Authorization: Bearer simple-admin-token` header
- Token obtained via `POST /api/public/admin/login` with credentials
- Backend auth middleware supports both Bearer token format and plain token format for compatibility
- Frontend sends: `Authorization: Bearer ${token}` (where token = "simple-admin-token")

## Notification Logic (Backend) - Multilingual Support

### Languages Supported
- **Chinese (zh)**: Default language for order notifications
- **English (en)**: English-language notifications

### Message Types
1. **Order Confirmation**: Sent to Customer + Admin (85298536993)
   - Uses `language` field from order form to determine message language
   - Includes order details, bank information, and sharing encouragement

2. **Sharing Message**: Sent to Customer + Admin (85298536993)
   - Multilingual with referral link in message
   - Uses same language as order confirmation

3. **Referral Success**: Sent to Referrer ONLY
   - Multilingual notification sent to referrer when their referral code is used
   - Uses same language as the referred order

### Implementation
- Frontend adds `language` field to formData (tracks i18n.language)
- Backend stores `language` field in `poon_choi_orders` table
- Messages selected from `languageMessages` object based on `body.language` or `currentLanguage`
- Fallback to Chinese (zh) if language not specified

## Admin Panel - Separate Pages Architecture

The admin panel now consists of four independent sections:

1. **Campaign Management** (`/admin/campaigns`)
   - Create, edit, delete campaigns (scenarios)
   - Manage WhatsApp message templates per campaign
   - Filter templates by message type
   - Preview templates with rendered variables
   - Activate/deactivate template versions
   - Access Campaign Settings page for each campaign

2. **Campaign Settings** (`/admin/campaigns/:scenarioKey/settings`)
   - Configure campaign basic information (name, language, active status)
   - Landing page customization (title, description, hero image, CTA button text/color)
   - Referral program configuration (rewards points, discount %, code prefix, minimum order)
   - Organized in tabbed interface (Basic Settings, Landing Page, Referral Program)
   - All settings persisted in campaign `config` JSON field

3. **Order Management** (`/admin/dashboard`)
   - View, edit, delete orders
   - Filter by order #, customer name, phone, product type
   - Search by delivery date and referrer

4. **WhatsApp Conversation Management** (`/admin/conversations`)
   - View all customer conversations (independent of orders)
   - Search by phone number
   - View full conversation history with timestamps
   - Browse attachments with download links
   - Support for customers who chat before placing orders

**Schema**: No schema changes required. The `whatsapp_conversations` table stores independent customer conversations with phone as primary key, separate from the `poon_choi_orders` table.

### WhatsApp Template Types

Each campaign supports three message template types:
- **order_confirmation**: Sent when customer places an order
- **sharing**: Sent when customer shares the campaign with friends
- **referral_success**: Sent to referrer when their referral code is used

Each template:
- Can be created in multiple languages (Chinese/English)
- Supports multiple versions (old versions are replaced when new ones are created)
- Can use variables like `{{customerName}}`, `{{orderId}}`, `{{total}}`
- Must be explicitly activated to be used in the system

## Webhook Integration - WhatsApp

- **Webhook Path**: `/api/webhooks/whatsapp`
- **External System**: CloudWAPI (Create)
- **Database Table**: `whatsapp_conversations` - Stores conversation history by phone number with ISO 8601 timestamps
- **Authentication**: API Key validation via `x-webhook-key` header (stored in Secrets as `WEBHOOK_KEY`)
- **Purpose**: Receive messages from WhatsApp customers, store in database for LLM context retrieval
- **Timestamp Format**: ISO 8601 (YYYY-MM-DDThh:mm:ss[Z|±hh:mm]) - auto-generated if missing from request
- **Attachments**: Supported and stored in `attachments` JSON column with timestamp metadata
- **Expected Request Format**:
  ```json
  {
    "phone": "85212345678",
    "message": "customer message",
    "sender": "user|bot",
    "timestamp": "2026-01-28T08:57:42Z",
    "attachments": [{"url": "...", "filename": "...", "type": "..."}]
  }
  ```
  Note: `timestamp` is optional (ISO 8601 format preferred, but Unix timestamps accepted)
- **Admin API Endpoints**:
  - `GET /api/public/admin/whatsapp/conversations` - List all conversations with metadata
  - `GET /api/public/admin/whatsapp/conversations/:phone` - Get specific conversation with full message history and attachments
- **Response Codes**:
  - 200: Success - `{ status: "success", message: "received", data_id: "..." }`
  - 400: Invalid data - `{ status: "error", error_code: "INVALID_DATA", message: "..." }`
  - 409: Conflict - `{ status: "error", error_code: "CONFLICT", message: "..." }`
  - 401: Unauthorized - `{ status: "error", error_code: "UNAUTHORIZED", message: "..." }`
  - 500: Server error - `{ status: "error", error_code: "INTERNAL_ERROR", message: "..." }`

## Core Design Principles

### Context-Driven Design Strategy
- Scenario Analysis First: Analyze the user's specific use case, target audience, and functional requirements before making design decisions
- Contextual Appropriateness: Choose design styles that align with the content purpose
- User Journey Consideration: Design interactions and visual flow based on how users will actually engage with the content
IMPORTANT: When users don't specify UI style preferences, always default to modern and responsive UI design with minimalist aesthetic

### Modern Visual Sophistication
- Contemporary Aesthetics: Embrace contemporary design trends for modern aesthetics
- Typography Excellence: Master type scale relationships and strategic white space for premium hierarchy
- Advanced Layouts: Use CSS Grid, asymmetrical compositions, and purposeful negative space
- Strategic Color Systems: Choose palettes based on use cases and psychological impact

### Delightful Interactions
- Dynamic Over Static: Prioritize interactive experiences over passive presentations
- Micro-Interactions: Subtle hover effects, smooth transitions, and responsive feedback animations
- Animation Sophistication: Layer motion design that enhances usability without overwhelming
- Surprise Elements: Custom cursors, hidden Easter eggs, playful loading states, and unexpected interactive details (if applicable)

### Technical Excellence
- Reusable, typed React components with clear interfaces
- Leverage React 18's concurrent features to enhance user experience
- Adopt TypeScript for type-safe development experience
- Use Zustand for lightweight state management
- Implement smooth single-page application routing through React Router DOM

## Project Architecture

### Directory Structure

```
project-root/
├── index.html              # Main HTML template
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Lock file for npm dependencies
├── README.md              # Project documentation
├── YOUWARE.md             # Development guide and template documentation
├── yw_manifest.json       # Project manifest file
├── vite.config.ts         # Vite build tool configuration
├── tsconfig.json          # TypeScript configuration (main)
├── tsconfig.app.json      # TypeScript configuration for app
├── tsconfig.node.json     # TypeScript configuration for Node.js
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── dist/                  # Build output directory (generated)
└── src/                   # Source code directory
    ├── App.tsx            # Main application component
    ├── main.tsx           # Application entry point
    ├── index.css          # Global styles and Tailwind CSS imports
    ├── vite-env.d.ts      # Vite type definitions
    ├── api/               # API related code
    ├── assets/            # Static assets
    ├── components/        # Reusable components
    ├── layouts/           # Layout components
    ├── pages/             # Page components
    ├── store/             # State management
    ├── styles/            # Style files
    └── types/             # TypeScript type definitions
```
