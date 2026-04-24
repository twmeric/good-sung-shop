import { Hono } from "hono";
import { cors } from "hono/cors";

// ============================================================
// Types
// ============================================================
interface OrderItem {
  packageType: '2-dish-1-soup' | '3-dish-1-soup';
  selectedDishes: string[];
  selectedSoup: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Env {
  DB: D1Database;
  CMS_DATA: KVNamespace;
  PAYMENT_PROOFS: R2Bucket;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_TOKEN_SECRET: string;
  CLOUDWAPI_API_KEY: string;
  CLOUDWAPI_SENDER: string;
  SITE_URL: string;
  BUSINESS_PHONE: string;
  ADMIN_PHONE: string;
}

// ============================================================
// CORS Headers
// ============================================================
const corsConfig = {
  origin: "*",
  allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
};

// ============================================================
// Utilities
// ============================================================

/**
 * Convert snake_case object keys to camelCase.
 * Used because D1 returns snake_case column names but frontend expects camelCase.
 */
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

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOrderNum(): string {
  // 2 random uppercase letters (excluding I, L, O, Z to avoid confusion with numbers) + 4 digits
  const letters = "ABCDEFGHJKMNPQRSTUVWXY";
  const letter1 = letters.charAt(Math.floor(Math.random() * letters.length));
  const letter2 = letters.charAt(Math.floor(Math.random() * letters.length));
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return letter1 + letter2 + digits;
}

function generateVerifyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================
// WhatsApp
// ============================================================
async function sendWhatsAppMessage(env: Env, phone: string, message: string) {
  try {
    const pushUrl = new URL("https://unofficial.cloudwapi.in/send-message");
    pushUrl.searchParams.append("api_key", env.CLOUDWAPI_API_KEY);
    pushUrl.searchParams.append("sender", env.CLOUDWAPI_SENDER);
    pushUrl.searchParams.append("number", phone);
    pushUrl.searchParams.append("message", message);

    const res = await fetch(pushUrl.toString(), {
      headers: { "User-Agent": "GoodSung-Worker/1.0" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[WHATSAPP] Failed: ${res.status} ${text}`);
      return { success: false, error: `${res.status} ${text}` };
    }
    return { success: true };
  } catch (e) {
    console.error(`[WHATSAPP] Error:`, e);
    return { success: false, error: String(e) };
  }
}

// ============================================================
// Auth Middleware (RBAC)
// ============================================================
interface AdminUser {
  id: number;
  username: string;
  role: string;
  display_name: string;
  is_active: number;
}

async function getUserFromToken(db: D1Database, token: string): Promise<AdminUser | null> {
  if (!token) return null;
  try {
    const row = await db.prepare(
      `SELECT id, username, role, display_name, is_active FROM admin_users WHERE token = ?`
    ).bind(token).first();
    return row as AdminUser | null;
  } catch {
    return null;
  }
}

function authMiddleware(allowedRoles?: string[]) {
  return async (c: any, next: any) => {
    const env: Env = c.env;
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    // Fallback: check hardcoded token for backward compatibility
    const user = await getUserFromToken(env.DB, token);
    if (user && user.is_active === 1) {
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      c.set("adminUser", user);
      await next();
      return;
    }

    // Backward compatibility: accept hardcoded token
    if (token === env.ADMIN_TOKEN_SECRET) {
      c.set("adminUser", { id: 0, username: "admin", role: "super_admin", display_name: "Admin", is_active: 1 });
      await next();
      return;
    }

    return jsonResponse({ error: "Unauthorized" }, 401);
  };
}

// ============================================================
// D1: Initialize Tables
// ============================================================
async function initDB(db: D1Database, env: Env) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS order_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total_price INTEGER NOT NULL,
      region TEXT NOT NULL,
      address TEXT NOT NULL,
      estate TEXT,
      delivery_date TEXT NOT NULL,
      delivery_time TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      remarks TEXT,
      referral_code TEXT,
      campaign_name TEXT DEFAULT 'good-sung-default',
      payment_confirmed INTEGER DEFAULT 0,
      order_completed INTEGER DEFAULT 0,
      payment_proof TEXT,
      order_num TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS verification_sessions (
      code TEXT PRIMARY KEY,
      phone TEXT,
      ip TEXT,
      verified INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      verified_at INTEGER,
      expires_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      display_name TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      token TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      config_json TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS referral_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_phone TEXT NOT NULL,
      referee_order_id INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      referee_phone TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS cms_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      product_code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER,
      original_price INTEGER,
      is_active INTEGER DEFAULT 1,
      stock_quantity INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      image_url TEXT,
      max_select INTEGER DEFAULT 1,
      updated_by INTEGER,
      updated_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS package_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      dish_count INTEGER NOT NULL DEFAULT 2,
      soup_count INTEGER NOT NULL DEFAULT 1,
      price INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT,
      admin_role TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_by INTEGER,
      updated_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      sender TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
  ];

  for (const sql of tables) {
    try {
      await db.prepare(sql).run();
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        console.error("[DB INIT] Table creation error:", e.message);
      }
    }
  }

  // Migrate: add columns to existing tables
  const migrations = [
    `ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'`,
    `ALTER TABLE admin_users ADD COLUMN display_name TEXT`,
    `ALTER TABLE admin_users ADD COLUMN phone TEXT`,
    `ALTER TABLE admin_users ADD COLUMN is_active INTEGER DEFAULT 1`,
    `ALTER TABLE admin_users ADD COLUMN token TEXT`,
    `ALTER TABLE admin_users ADD COLUMN created_at INTEGER DEFAULT (unixepoch())`,
    `ALTER TABLE admin_users ADD COLUMN updated_at INTEGER DEFAULT (unixepoch())`,
    `ALTER TABLE cms_products ADD COLUMN stock_quantity INTEGER DEFAULT 0`,
    `ALTER TABLE order_records ADD COLUMN estate TEXT`,
    `ALTER TABLE order_records ADD COLUMN order_completed INTEGER DEFAULT 0`,
    `ALTER TABLE cms_products ADD COLUMN product_code TEXT`,
  ];
  for (const sql of migrations) {
    try {
      await db.prepare(sql).run();
    } catch (e: any) {
      // Column may already exist, ignore
      if (!e.message?.includes("duplicate column")) {
        console.error("[DB INIT] Migration error:", e.message);
      }
    }
  }

  // Seed default admin users if table is empty
  try {
    const { results } = await db.prepare(`SELECT COUNT(*) as count FROM admin_users`).all();
    const count = (results?.[0] as any)?.count || 0;
    if (count === 0) {
      const superHash = "a8989a80609fe3f1cdb52b1cc1809da761e396dcb43bae0eaf199c27c8d4fee4";
      const adminHash = "7e9c6265daf3229a84f9d67b2308db703d301dc16db949a794b8a94388f86d2d";
      const supplierHash = "c6242a62d640474f742f579417c3b6cc9327f5158c0af3898574255b8ce9da11";
      const now = Math.floor(Date.now() / 1000);

      await db.prepare(
        `INSERT INTO admin_users (username, password_hash, role, display_name, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind("superadmin", superHash, "super_admin", "系統管理員", 1, now, now).run();

      await db.prepare(
        `INSERT INTO admin_users (username, password_hash, role, display_name, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind("admin", adminHash, "admin", "客服管理員", 1, now, now).run();

      await db.prepare(
        `INSERT INTO admin_users (username, password_hash, role, display_name, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind("supplier", supplierHash, "supplier", "產品供應商", 1, now, now).run();

      console.log("[DB INIT] Default admin users created");
    }
  } catch (e: any) {
    console.error("[DB INIT] Seed error:", e.message);
  }

  // Seed default products if cms_products is empty
  try {
    const { results } = await db.prepare(`SELECT COUNT(*) as count FROM cms_products`).all();
    const count = (results?.[0] as any)?.count || 0;
    if (count === 0) {
      const now = Math.floor(Date.now() / 1000);
      const dishes = [
        { id: "d1", name: "宮保雞丁", desc: "微辣開胃" },
        { id: "d2", name: "麻婆豆腐", desc: "經典川菜" },
        { id: "d3", name: "蒜蓉炒菜心", desc: "清甜爽脆" },
        { id: "d4", name: "紅燒獅子頭", desc: "軟嫩多汁" },
        { id: "d5", name: "清蒸鱸魚", desc: "鮮甜嫩滑" },
        { id: "d6", name: "糖醋排骨", desc: "酸甜惹味" },
        { id: "d7", name: "豉油王炒麵", desc: "港式風味" },
        { id: "d8", name: "椒鹽豬扒", desc: "香脆可口" },
        { id: "d9", name: "蠔油冬菇生菜", desc: "健康素菜" },
        { id: "d10", name: "沙嗲牛肉", desc: "濃郁香滑" },
      ];
      const soups = [
        { id: "s1", name: "老火湯" },
        { id: "s2", name: "西洋菜湯" },
        { id: "s3", name: "番茄薯仔湯" },
        { id: "s4", name: "冬瓜薏米湯" },
        { id: "s5", name: "節瓜瑤柱湯" },
      ];
      const packages = [
        { type: "2-dish-1-soup", name: "2餸1湯", price: 99, dishCount: 2 },
        { type: "3-dish-1-soup", name: "3餸1湯", price: 129, dishCount: 3 },
      ];

      for (let i = 0; i < dishes.length; i++) {
        const code = 'D' + String(i + 1).padStart(3, '0');
        await db.prepare(
          `INSERT INTO cms_products (category, product_code, name, description, is_active, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind("dish", code, dishes[i].name, dishes[i].desc, 1, i, now).run();
      }
      for (let i = 0; i < soups.length; i++) {
        const code = 'S' + String(i + 1).padStart(3, '0');
        await db.prepare(
          `INSERT INTO cms_products (category, product_code, name, is_active, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind("soup", code, soups[i].name, 1, i, now).run();
      }
      for (let i = 0; i < packages.length; i++) {
        const code = 'P' + String(i + 1).padStart(3, '0');
        await db.prepare(
          `INSERT INTO cms_products (category, product_code, name, price, is_active, sort_order, max_select, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind("package", code, packages[i].name, packages[i].price, 1, i, packages[i].dishCount, now).run();
      }
      console.log("[DB INIT] Default products seeded");
    }
  } catch (e: any) {
    console.error("[DB INIT] Product seed error:", e.message);
  }

  // Seed default package configs if table is empty
  try {
    const { results } = await db.prepare(`SELECT COUNT(*) as count FROM package_configs`).all();
    const count = (results?.[0] as any)?.count || 0;
    if (count === 0) {
      const now = Math.floor(Date.now() / 1000);
      await db.prepare(
        `INSERT INTO package_configs (config_key, name, dish_count, soup_count, price, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind("2-dish-1-soup", "2餸1湯", 2, 1, 99, 1, 0, now, now).run();
      await db.prepare(
        `INSERT INTO package_configs (config_key, name, dish_count, soup_count, price, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind("3-dish-1-soup", "3餸1湯", 3, 1, 129, 1, 1, now, now).run();
      console.log("[DB INIT] Default package configs seeded");
    }
  } catch (e: any) {
    console.error("[DB INIT] Package config seed error:", e.message);
  }
}

// ============================================================
// Audit Log Helper
// ============================================================
async function logAudit(
  db: D1Database,
  user: AdminUser | null,
  action: string,
  targetType: string,
  targetId: string,
  details?: object,
  ipAddress?: string
) {
  try {
    await db.prepare(
      `INSERT INTO admin_audit_logs (admin_id, admin_username, admin_role, action, target_type, target_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user?.id || null,
      user?.username || 'unknown',
      user?.role || 'unknown',
      action,
      targetType,
      targetId,
      details ? JSON.stringify(details) : null,
      ipAddress || null,
      Math.floor(Date.now() / 1000)
    ).run();
  } catch (e) {
    console.error("[AUDIT LOG] Failed:", e);
  }
}

// ============================================================
// CMS Defaults
// ============================================================
const DEFAULT_CMS = {
  hero: {
    title: "新鮮餸菜包",
    subtitle: "支持 SEN 青年就業",
    description: "每日新鮮製作，讓您在家輕鬆享用美味餸菜",
  },
  dishes: [
    { id: "d1", name: "宮保雞丁", description: "微辣開胃", enabled: true },
    { id: "d2", name: "麻婆豆腐", description: "經典川菜", enabled: true },
    { id: "d3", name: "蒜蓉炒菜心", description: "清甜爽脆", enabled: true },
    { id: "d4", name: "紅燒獅子頭", description: "軟嫩多汁", enabled: true },
    { id: "d5", name: "清蒸鱸魚", description: "鮮甜嫩滑", enabled: true },
    { id: "d6", name: "糖醋排骨", description: "酸甜惹味", enabled: true },
    { id: "d7", name: "豉油王炒麵", description: "港式風味", enabled: true },
    { id: "d8", name: "椒鹽豬扒", description: "香脆可口", enabled: true },
    { id: "d9", name: "蠔油冬菇生菜", description: "健康素菜", enabled: true },
    { id: "d10", name: "沙嗲牛肉", description: "濃郁香滑", enabled: true },
  ],
  soups: [
    { id: "s1", name: "老火湯", enabled: true },
    { id: "s2", name: "西洋菜湯", enabled: true },
    { id: "s3", name: "番茄薯仔湯", enabled: true },
    { id: "s4", name: "冬瓜薏米湯", enabled: true },
    { id: "s5", name: "節瓜瑤柱湯", enabled: true },
  ],
  packages: [
    { type: "2-dish-1-soup", name: "2餸1湯", price: 99, dishCount: 2, soupCount: 1 },
    { type: "3-dish-1-soup", name: "3餸1湯", price: 129, dishCount: 3, soupCount: 1 },
  ],
  delivery: {
    regions: [
      { value: "HK", label: "港島" },
      { value: "KLN", label: "九龍" },
      { value: "NT", label: "新界" },
    ],
    timeSlots: [
      { value: "10:00-13:00", label: "10:00 - 13:00" },
      { value: "14:00-18:00", label: "14:00 - 18:00" },
      { value: "18:00-20:00", label: "18:00 - 20:00" },
    ],
    minDaysAdvance: 2,
  },
  bank: {
    account: "DBS A/C - 016-000227829",
    fps: "FPS - 108810334",
    companyName: "DELICIOUS EXPRESS LTD",
  },
  whatsapp: {
    businessPhone: "85262322466",
    adminPhone: "85298536993",
  },
};

// ============================================================
// App
// ============================================================
const app = new Hono<{ Bindings: Env }>();
app.use("/*", cors(corsConfig));

// Initialize DB on first request (lazy singleton)
let dbInitialized = false;
app.use("/*", async (c, next) => {
  if (!dbInitialized) {
    try {
      await initDB(c.env.DB, c.env);
      dbInitialized = true;
    } catch (e: any) {
      console.error("[DB INIT] Error:", e);
    }
  }
  await next();
});

// --------------------------------------------------
// CMS API
// --------------------------------------------------
app.get("/api/test/d1", async (c) => {
  try {
    const row = await c.env.DB.prepare(`SELECT 1 as test`).first();
    return jsonResponse({ ok: true, row });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
});

app.get("/api/cms/data", async (c) => {
  const data = await c.env.CMS_DATA.get("cms_data", "json");
  return jsonResponse(data || DEFAULT_CMS);
});

app.post("/api/cms/data", authMiddleware(), async (c) => {
  const body = await c.req.json();
  const existing = (await c.env.CMS_DATA.get("cms_data", "json")) || {};
  const merged = { ...existing, ...body };
  await c.env.CMS_DATA.put("cms_data", JSON.stringify(merged));
  return jsonResponse({ success: true });
});

app.post("/api/cms/reset", authMiddleware(), async (c) => {
  await c.env.CMS_DATA.put("cms_data", JSON.stringify(DEFAULT_CMS));
  return jsonResponse({ success: true });
});

// --------------------------------------------------
// Verification API (Anti-Spam)
// --------------------------------------------------
app.post("/api/public/verify/request", async (c) => {
  try {
    const body = await c.req.json();
    const code = body.code;
    if (!code || code.length !== 6) {
      return jsonResponse({ error: "Invalid code" }, 400);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 300;

    try {
      await c.env.DB.prepare(
        `INSERT INTO verification_sessions (code, ip, expires_at) VALUES (?, ?, ?)`
      )
        .bind(code, "127.0.0.1", expiresAt)
        .run();
    } catch (dbErr: any) {
      console.error("[VERIFY] DB Error:", dbErr);
      await c.env.CMS_DATA.put(`verify_${code}`, JSON.stringify({ code, verified: false, expiresAt }), { expirationTtl: 300 });
    }

    return jsonResponse({ success: true });
  } catch (e: any) {
    console.error("[VERIFY] Error:", e);
    return jsonResponse({ error: "Failed to create verification", detail: e.message }, 500);
  }
});

app.get("/api/public/verify/status", async (c) => {
  try {
    const code = c.req.query("code");
    if (!code) return jsonResponse({ error: "Missing code" }, 400);

    // Try D1 first
    try {
      const row = await c.env.DB.prepare(
        `SELECT * FROM verification_sessions WHERE code = ?`
      )
        .bind(code)
        .first();

      if (row) {
        const now = Math.floor(Date.now() / 1000);
        if (row.expires_at && row.expires_at < now) {
          return jsonResponse({ verified: false, expired: true });
        }
        return jsonResponse({
          verified: row.verified === 1,
          phone: row.phone || null,
        });
      }
    } catch (dbErr) {
      console.error("[VERIFY STATUS] DB Error:", dbErr);
    }

    // Fallback to KV
    const kvData = await c.env.CMS_DATA.get(`verify_${code}`);
    if (kvData) {
      const data = JSON.parse(kvData);
      const now = Math.floor(Date.now() / 1000);
      if (data.expiresAt && data.expiresAt < now) {
        return jsonResponse({ verified: false, expired: true });
      }
      return jsonResponse({ verified: data.verified || false, phone: data.phone || null });
    }

    return jsonResponse({ verified: false });
  } catch (e) {
    return jsonResponse({ error: "Check failed" }, 500);
  }
});

// --------------------------------------------------
// OTP Verification (Send & Check)
// --------------------------------------------------
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('852')) return cleaned;
  if (cleaned.length === 8) return '852' + cleaned;
  return cleaned;
}

app.post("/api/public/verify/send-otp", async (c) => {
  try {
    const body = await c.req.json();
    const rawPhone = body.phone?.trim();
    if (!rawPhone) {
      return jsonResponse({ error: "Missing phone number" }, 400);
    }

    const phone = normalizePhone(rawPhone);
    if (!/^852\d{8}$/.test(phone)) {
      return jsonResponse({ error: "Invalid phone number. Please enter 8 digits HK mobile number." }, 400);
    }

    // Generate 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    // Store in KV with phone as key
    await c.env.CMS_DATA.put(`otp_${phone}`, JSON.stringify({ code, expiresAt }), { expirationTtl: 300 });

    // Send via WhatsApp
    const message = `【好餸社企】您的驗證碼是：${code}，5分鐘內有效。請在網頁上輸入此驗證碼完成身份驗證。`;
    const result = await sendWhatsAppMessage(c.env, phone, message);
    if (!result.success) {
      console.error("[OTP] Failed to send WhatsApp:", result.error);
      return jsonResponse({ error: "Failed to send OTP message", detail: result.error }, 500);
    }

    console.log(`[OTP] Sent to ${phone}: ${code}`);
    return jsonResponse({ success: true });
  } catch (e: any) {
    console.error("[OTP SEND] Error:", e);
    return jsonResponse({ error: "Failed to send OTP", detail: e.message }, 500);
  }
});

app.post("/api/public/verify/check-otp", async (c) => {
  try {
    const body = await c.req.json();
    const rawPhone = body.phone?.trim();
    const code = body.code?.trim();
    if (!rawPhone || !code) {
      return jsonResponse({ error: "Missing phone or code" }, 400);
    }

    const phone = normalizePhone(rawPhone);
    const kvData = await c.env.CMS_DATA.get(`otp_${phone}`);
    if (!kvData) {
      return jsonResponse({ verified: false, error: "驗證碼已過期，請重新發送" });
    }

    const data = JSON.parse(kvData);
    const now = Math.floor(Date.now() / 1000);

    if (data.expiresAt < now) {
      return jsonResponse({ verified: false, error: "驗證碼已過期，請重新發送" });
    }

    if (data.code !== code) {
      return jsonResponse({ verified: false, error: "驗證碼不正確，請重新輸入" });
    }

    // OTP verified - store verification status (7 days)
    await c.env.CMS_DATA.put(`verified_${phone}`, JSON.stringify({ verified: true, phone, verifiedAt: now }), { expirationTtl: 7 * 24 * 60 * 60 });

    return jsonResponse({ verified: true, phone });
  } catch (e: any) {
    console.error("[OTP CHECK] Error:", e);
    return jsonResponse({ error: "Verification failed", detail: e.message }, 500);
  }
});

// --------------------------------------------------
// Order API
// --------------------------------------------------
app.post("/api/public/orders", async (c) => {
  try {
    console.log("[ORDER] Step 1: Parsing body");
    const body = await c.req.json();
    console.log("[ORDER] Step 2: Body parsed", JSON.stringify(body).slice(0, 200));
    const items: OrderItem[] = body.items || [];
    const totalPrice = body.totalPrice || 0;

    // Clean phone
    let fullPhone = String(body.phone || "").replace(/[^0-9]/g, "");
    if (fullPhone.length === 8) fullPhone = "852" + fullPhone;
    if (fullPhone.startsWith("852852")) fullPhone = fullPhone.substring(3);

    const orderNum = generateOrderNum();
    const timestamp = Math.floor(Date.now() / 1000);

    console.log("[ORDER] Step 3: Inserting to DB");
    const result = await c.env.DB.prepare(
      `INSERT INTO order_records
        (items, total_price, region, address, estate, delivery_date, delivery_time, name, phone, email, remarks, referral_code, campaign_name, order_num, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        JSON.stringify(items),
        totalPrice,
        body.region,
        body.address,
        body.estate || null,
        body.deliveryDate,
        body.deliveryTime,
        body.name,
        fullPhone,
        body.email || null,
        body.remarks || null,
        body.referralCode || null,
        body.campaignName || "good-sung-default",
        orderNum,
        timestamp
      )
      .run();

    console.log("[ORDER] Step 4: DB result", JSON.stringify(result));
    const orderId = result.meta?.last_row_id;

    // Send WhatsApp notifications
    const dishSummary = items
      .map(
        (item) =>
          `${item.packageType === "2-dish-1-soup" ? "2餸1湯" : "3餸1湯"} x${item.quantity}`
      )
      .join(", ");

    const proofUrl = `${c.env.SITE_URL}/payment-proof/${orderNum}`;
    const deliveryTimeStr = body.deliveryTime ? ` ${body.deliveryTime}` : '';
    const orderMsg = `【好餸社企 - 訂單確認】\n\n訂單號碼: ${orderNum}\n產品: ${dishSummary}\n總額: HK$${totalPrice}\n姓名: ${body.name}\n電話: ${fullPhone}\n地址: ${body.address}\n日期: ${body.deliveryDate}${deliveryTimeStr}\n\n💳 請付款至：\n${DEFAULT_CMS.bank.account}\n${DEFAULT_CMS.bank.fps}\n名稱: ${DEFAULT_CMS.bank.companyName}\n\n📤 上傳付款憑證：\n${proofUrl}\n\n感謝您的支持！`;

    // Send to customer
    const sendPromise = sendWhatsAppMessage(c.env, fullPhone, orderMsg);
    const sendAdminPromise = sendWhatsAppMessage(c.env, c.env.ADMIN_PHONE, orderMsg);
    
    if (c.executionCtx) {
      c.executionCtx.waitUntil(sendPromise);
      c.executionCtx.waitUntil(sendAdminPromise);
    }

    // Referral handling
    if (body.referralCode && c.executionCtx) {
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const referrer = await c.env.DB.prepare(
              `SELECT * FROM order_records WHERE phone LIKE ? ORDER BY id DESC LIMIT 1`
            )
              .bind(`%${body.referralCode}`)
              .first();

            if (referrer) {
              await c.env.DB.prepare(
                `INSERT INTO referral_records (referrer_phone, referee_order_id, referee_phone) VALUES (?, ?, ?)`
              )
                .bind(referrer.phone, orderId, fullPhone)
                .run();

              const refMsg = `【好餸社企 - 推薦成功】\n\n您推薦的朋友剛剛成功訂購了餸菜包！\n\n感謝您將這份善意傳遞出去，讓更多 SEN 青年獲得工作機會。\n\n您的支持，是我們最大的動力。`;
              await sendWhatsAppMessage(c.env, referrer.phone, refMsg);
            }
          } catch (refErr) {
            console.error("[REFERRAL] Error:", refErr);
          }
        })()
      );
    }

    return jsonResponse({ id: orderId, orderNum, createdAt: timestamp });
  } catch (error: any) {
    console.error("[ORDER] Error:", error);
    return jsonResponse({ error: "Internal server error", detail: error.message }, 500);
  }
});

// --------------------------------------------------
// Payment Proof Upload
// --------------------------------------------------
app.post("/api/public/payment-proof/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const orderNum = formData.get("orderNum") as string;

    if (!file || !orderNum) {
      return jsonResponse({ error: "Missing file or orderNum" }, 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return jsonResponse({ error: "Invalid file type. Only JPG, PNG, PDF allowed" }, 400);
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return jsonResponse({ error: "File too large. Max 5MB" }, 400);
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const key = `proof-${orderNum}-${Date.now()}.${ext}`;

    // Upload to R2
    await c.env.PAYMENT_PROOFS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // Update order record
    const publicUrl = `${c.env.SITE_URL}/api/public/payment-proof/${key}`;
    await c.env.DB.prepare(
      `UPDATE order_records SET payment_proof = ? WHERE order_num = ?`
    )
      .bind(publicUrl, orderNum)
      .run();

    // Notify admin via WhatsApp
    const notifyMsg = `【好餸社企 - 新付款記錄】\n\n訂單編號: ${orderNum}\n已上傳付款憑證，請查閱。`;
    c.executionCtx?.waitUntil(
      sendWhatsAppMessage(c.env, c.env.ADMIN_PHONE, notifyMsg)
    );

    return jsonResponse({ success: true, url: publicUrl });
  } catch (e: any) {
    console.error("[PAYMENT PROOF] Error:", e);
    return jsonResponse({ error: "Upload failed", detail: e.message }, 500);
  }
});

// Serve payment proof images
app.get("/api/public/payment-proof/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const object = await c.env.PAYMENT_PROOFS.get(key);
    if (!object) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch" }, 500);
  }
});

// --------------------------------------------------
// Admin: Orders
// --------------------------------------------------
app.get("/api/public/admin/orders", authMiddleware(), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM order_records ORDER BY created_at DESC`
    ).all();
    return jsonResponse((results || []).map(snakeToCamel));
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch orders" }, 500);
  }
});

app.get("/api/public/admin/orders/:id", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const row = await c.env.DB.prepare(
      `SELECT * FROM order_records WHERE id = ?`
    )
      .bind(id)
      .first();
    if (!row) return jsonResponse({ error: "Order not found" }, 404);
    return jsonResponse(snakeToCamel(row));
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch order" }, 500);
  }
});

app.put("/api/public/admin/orders/:id", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(
      `SELECT * FROM order_records WHERE id = ?`
    )
      .bind(id)
      .first();

    const shouldNotify =
      existing &&
      existing.payment_confirmed === 0 &&
      body.paymentConfirmed === 1;

    const setClause: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(body)) {
      const dbKey = key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      setClause.push(`${dbKey} = ?`);
      values.push(value);
    }
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE order_records SET ${setClause.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    const user = c.get("adminUser") as AdminUser;
    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "UPDATE", "order", String(id), body)
    );

    if (shouldNotify) {
      const msg = `【好餸社企 - 付款確認】\n\n訂單編號: ${existing.order_num}\n\n多謝您的付款！我們已確認收到您的款項。`;
      c.executionCtx.waitUntil(
        sendWhatsAppMessage(c.env, existing.phone, msg)
      );

      // Deduct stock when payment is confirmed
      try {
        const items = JSON.parse(existing.items || '[]');
        const productCounts: Record<string, number> = {};
        for (const item of items) {
          const qty = item.quantity || 1;
          for (const dishName of (item.selectedDishes || [])) {
            productCounts[dishName] = (productCounts[dishName] || 0) + qty;
          }
          if (item.selectedSoup) {
            productCounts[item.selectedSoup] = (productCounts[item.selectedSoup] || 0) + qty;
          }
        }
        for (const [productName, count] of Object.entries(productCounts)) {
          await c.env.DB.prepare(
            `UPDATE cms_products SET stock_quantity = MAX(0, stock_quantity - ?), is_active = CASE WHEN stock_quantity - ? <= 0 THEN 0 ELSE is_active END WHERE name = ?`
          ).bind(count, count, productName).run();
        }
      } catch (stockErr) {
        console.error("[STOCK] Failed to deduct stock:", stockErr);
      }
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to update order" }, 500);
  }
});

app.post("/api/public/admin/orders/:id/complete", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const user = c.get("adminUser") as AdminUser;

    const row = await c.env.DB.prepare(
      `SELECT * FROM order_records WHERE id = ?`
    ).bind(id).first();

    if (!row) {
      return jsonResponse({ error: "Order not found" }, 404);
    }

    if (row.payment_confirmed !== 1) {
      return jsonResponse({ error: "Order must be paid before marking complete" }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE order_records SET order_completed = 1 WHERE id = ?`
    ).bind(id).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "COMPLETE", "order", String(id), { orderNum: row.order_num })
    );

    return jsonResponse({ success: true, orderCompleted: 1 });
  } catch (e) {
    return jsonResponse({ error: "Failed to complete order" }, 500);
  }
});

app.delete("/api/public/admin/orders/:id", authMiddleware(["super_admin", "admin"]), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const user = c.get("adminUser") as AdminUser;
    await c.env.DB.prepare(`DELETE FROM order_records WHERE id = ?`).bind(id).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "DELETE", "order", String(id), {})
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to delete order" }, 500);
  }
});

// --------------------------------------------------
// Admin: Auth
// --------------------------------------------------
app.post("/api/public/admin/login", async (c) => {
  try {
    const { username, password } = await c.req.json();

    // Check database users first
    const user = await c.env.DB.prepare(
      `SELECT id, username, password_hash, role, display_name, is_active FROM admin_users WHERE username = ?`
    ).bind(username).first();

    if (user && user.is_active === 1) {
      const isValid = await verifyPassword(password, user.password_hash as string);
      if (isValid) {
        const token = generateToken();
        await c.env.DB.prepare(
          `UPDATE admin_users SET token = ?, updated_at = ? WHERE id = ?`
        ).bind(token, Math.floor(Date.now() / 1000), user.id).run();

        c.executionCtx?.waitUntil(
          logAudit(c.env.DB, { id: user.id, username: user.username, role: user.role, display_name: user.display_name, is_active: 1 }, "LOGIN", "user", String(user.id), {})
        );

        return jsonResponse({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            display_name: user.display_name,
          }
        });
      }
    }

    // Fallback: check hardcoded admin for backward compatibility
    if (username === c.env.ADMIN_USERNAME) {
      const expectedHash = c.env.ADMIN_PASSWORD_HASH;
      const isValid = await verifyPassword(password, expectedHash);
      if (isValid) {
        return jsonResponse({ success: true, token: c.env.ADMIN_TOKEN_SECRET });
      }
    }

    return jsonResponse({ error: "Invalid credentials" }, 401);
  } catch (e) {
    console.error("[LOGIN] Error:", e);
    return jsonResponse({ error: "Login failed" }, 500);
  }
});

app.get("/api/public/admin/auth/me", authMiddleware(), async (c) => {
  try {
    const user = c.get("adminUser") as AdminUser;
    return jsonResponse({
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
    });
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

// --------------------------------------------------
// Admin: Products (All roles)
// --------------------------------------------------
app.get("/api/public/admin/products", authMiddleware(), async (c) => {
  try {
    const category = c.req.query("category");
    let sql = `SELECT * FROM cms_products`;
    const params: any[] = [];
    if (category) {
      sql += ` WHERE category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY category, sort_order, id`;
    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    return jsonResponse(results || []);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch products" }, 500);
  }
});

app.post("/api/public/admin/products", authMiddleware(), async (c) => {
  try {
    const body = await c.req.json();
    const user = c.get("adminUser") as AdminUser;
    const now = Math.floor(Date.now() / 1000);

    // Auto-generate product code if not provided
    let productCode = body.product_code || null;
    if (!productCode && body.category) {
      const prefix = body.category === 'dish' ? 'D' : body.category === 'soup' ? 'S' : 'P';
      const { results } = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM cms_products WHERE category = ?`
      ).bind(body.category).all();
      const count = ((results?.[0] as any)?.count || 0) + 1;
      productCode = prefix + String(count).padStart(3, '0');
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO cms_products (category, product_code, name, description, price, original_price, is_active, stock_quantity, sort_order, image_url, max_select, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.category,
      productCode,
      body.name,
      body.description || null,
      body.price || null,
      body.original_price || null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      body.stock_quantity !== undefined ? body.stock_quantity : 0,
      body.sort_order || 0,
      body.image_url || null,
      body.max_select || 1,
      user.id,
      now
    ).run();

    const newId = result.meta?.last_row_id;
    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "CREATE", "product", String(newId), { name: body.name, category: body.category })
    );

    return jsonResponse({ success: true, id: newId }, 201);
  } catch (e) {
    return jsonResponse({ error: "Failed to create product" }, 500);
  }
});

app.put("/api/public/admin/products/:id", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const user = c.get("adminUser") as AdminUser;
    const now = Math.floor(Date.now() / 1000);

    const setClause: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) { setClause.push("name = ?"); values.push(body.name); }
    if (body.product_code !== undefined) { setClause.push("product_code = ?"); values.push(body.product_code); }
    if (body.description !== undefined) { setClause.push("description = ?"); values.push(body.description); }
    if (body.price !== undefined) { setClause.push("price = ?"); values.push(body.price); }
    if (body.original_price !== undefined) { setClause.push("original_price = ?"); values.push(body.original_price); }
    if (body.is_active !== undefined) { setClause.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.stock_quantity !== undefined) { setClause.push("stock_quantity = ?"); values.push(body.stock_quantity); }
    if (body.sort_order !== undefined) { setClause.push("sort_order = ?"); values.push(body.sort_order); }
    if (body.image_url !== undefined) { setClause.push("image_url = ?"); values.push(body.image_url); }
    if (body.max_select !== undefined) { setClause.push("max_select = ?"); values.push(body.max_select); }

    setClause.push("updated_by = ?"); values.push(user.id);
    setClause.push("updated_at = ?"); values.push(now);
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE cms_products SET ${setClause.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "UPDATE", "product", String(id), body)
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to update product" }, 500);
  }
});

app.post("/api/public/admin/products/:id/toggle", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const user = c.get("adminUser") as AdminUser;
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      `UPDATE cms_products SET is_active = ?, updated_by = ?, updated_at = ? WHERE id = ?`
    ).bind(body.is_active ? 1 : 0, user.id, now, id).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "UPDATE", "product", String(id), { is_active: body.is_active })
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

app.delete("/api/public/admin/products/:id", authMiddleware(["super_admin", "admin"]), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const user = c.get("adminUser") as AdminUser;
    await c.env.DB.prepare(`DELETE FROM cms_products WHERE id = ?`).bind(id).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "DELETE", "product", String(id), {})
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to delete product" }, 500);
  }
});

// --------------------------------------------------
// Public: Products (for frontend, no auth required)
// --------------------------------------------------
app.get("/api/public/products", async (c) => {
  try {
    const category = c.req.query("category");
    let sql = `SELECT id, category, product_code, name, description, price, original_price, is_active, stock_quantity, sort_order, image_url, max_select FROM cms_products`;
    const params: any[] = [];
    if (category) {
      sql += ` WHERE category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY category, sort_order, id`;
    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    // Add stock status for frontend
    const products = (results || []).map((p: any) => ({
      ...p,
      stockStatus: (p.stock_quantity || 0) <= 0 ? 'out_of_stock' : (p.stock_quantity < 15 ? 'low_stock' : 'in_stock'),
      lowStockWarning: (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) < 15,
    }));
    return jsonResponse(products);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch products" }, 500);
  }
});

// --------------------------------------------------
// Admin: Package Configs
// --------------------------------------------------
app.get("/api/public/admin/package-configs", authMiddleware(), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM package_configs ORDER BY sort_order, id`
    ).all();
    const configs = (results || []).map((r: any) => ({
      id: r.id,
      typeKey: r.config_key,
      name: r.name,
      price: r.price,
      dishCount: r.dish_count,
      soupCount: r.soup_count,
      isActive: r.is_active,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return jsonResponse(configs);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch package configs" }, 500);
  }
});

app.post("/api/public/admin/package-configs", authMiddleware(), async (c) => {
  try {
    const body = await c.req.json();
    const now = Math.floor(Date.now() / 1000);
    // Support both camelCase (frontend) and snake_case field names
    const configKey = body.typeKey || body.config_key;
    const dishCount = body.dishCount !== undefined ? body.dishCount : (body.dish_count || 2);
    const soupCount = body.soupCount !== undefined ? body.soupCount : (body.soup_count || 1);
    const sortOrder = body.sortOrder !== undefined ? body.sortOrder : (body.sort_order || 0);
    const isActive = body.isActive !== undefined ? body.isActive : (body.is_active !== undefined ? body.is_active : 1);
    const result = await c.env.DB.prepare(
      `INSERT INTO package_configs (config_key, name, dish_count, soup_count, price, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      configKey,
      body.name,
      dishCount,
      soupCount,
      body.price || 0,
      isActive ? 1 : 0,
      sortOrder,
      now, now
    ).run();
    return jsonResponse({ success: true, id: result.meta?.last_row_id }, 201);
  } catch (e) {
    return jsonResponse({ error: "Failed to create package config" }, 500);
  }
});

app.put("/api/public/admin/package-configs/:id", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const setClause: string[] = [];
    const values: any[] = [];
    if (body.typeKey !== undefined || body.config_key !== undefined) { setClause.push("config_key = ?"); values.push(body.typeKey !== undefined ? body.typeKey : body.config_key); }
    if (body.name !== undefined) { setClause.push("name = ?"); values.push(body.name); }
    if (body.dishCount !== undefined || body.dish_count !== undefined) { setClause.push("dish_count = ?"); values.push(body.dishCount !== undefined ? body.dishCount : body.dish_count); }
    if (body.soupCount !== undefined || body.soup_count !== undefined) { setClause.push("soup_count = ?"); values.push(body.soupCount !== undefined ? body.soupCount : body.soup_count); }
    if (body.price !== undefined) { setClause.push("price = ?"); values.push(body.price); }
    if (body.isActive !== undefined || body.is_active !== undefined) { setClause.push("is_active = ?"); values.push((body.isActive !== undefined ? body.isActive : body.is_active) ? 1 : 0); }
    if (body.sortOrder !== undefined || body.sort_order !== undefined) { setClause.push("sort_order = ?"); values.push(body.sortOrder !== undefined ? body.sortOrder : body.sort_order); }
    setClause.push("updated_at = ?"); values.push(Math.floor(Date.now() / 1000));
    values.push(id);
    await c.env.DB.prepare(
      `UPDATE package_configs SET ${setClause.join(", ")} WHERE id = ?`
    ).bind(...values).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to update package config" }, 500);
  }
});

app.post("/api/public/admin/package-configs/:id/toggle", authMiddleware(), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : 1;
    await c.env.DB.prepare(
      `UPDATE package_configs SET is_active = ?, updated_at = ? WHERE id = ?`
    ).bind(isActive, Math.floor(Date.now() / 1000), id).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to toggle package config" }, 500);
  }
});

app.delete("/api/public/admin/package-configs/:id", authMiddleware(["super_admin", "admin"]), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    await c.env.DB.prepare(`DELETE FROM package_configs WHERE id = ?`).bind(id).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to delete package config" }, 500);
  }
});

// Public: Package Configs (for frontend)
app.get("/api/public/package-configs", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, config_key, name, dish_count, soup_count, price, is_active, sort_order FROM package_configs WHERE is_active = 1 ORDER BY sort_order, id`
    ).all();
    const configs = (results || []).map((r: any) => ({
      id: r.id,
      typeKey: r.config_key,
      name: r.name,
      price: r.price,
      dishCount: r.dish_count,
      soupCount: r.soup_count,
      isActive: r.is_active,
      sortOrder: r.sort_order,
    }));
    return jsonResponse(configs);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch package configs" }, 500);
  }
});

// --------------------------------------------------
// Admin: Media Library
// --------------------------------------------------
app.post("/api/public/admin/media/upload", authMiddleware(), async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    if (!file) {
      return jsonResponse({ error: "No file uploaded" }, 400);
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return jsonResponse({ error: "Only image files are allowed" }, 400);
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const key = `media/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;

    await c.env.PAYMENT_PROOFS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const publicUrl = `https://good-sung-shop.jimsbond007.workers.dev/media/${key.replace("media/", "")}`;
    return jsonResponse({ success: true, url: publicUrl, key });
  } catch (e) {
    return jsonResponse({ error: "Failed to upload file" }, 500);
  }
});

app.get("/api/public/admin/media", authMiddleware(), async (c) => {
  try {
    const listed = await c.env.PAYMENT_PROOFS.list({ prefix: "media/" });
    const items = (listed.objects || []).map(obj => ({
      key: obj.key,
      name: obj.key.replace("media/", ""),
      size: obj.size,
      uploaded: obj.uploaded,
      url: `https://good-sung-shop.jimsbond007.workers.dev/media/${obj.key.replace("media/", "")}`,
    }));
    return jsonResponse(items);
  } catch (e) {
    return jsonResponse({ error: "Failed to list media" }, 500);
  }
});

app.delete("/api/public/admin/media/:name", authMiddleware(), async (c) => {
  try {
    const name = c.req.param("name");
    await c.env.PAYMENT_PROOFS.delete(`media/${name}`);
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to delete media" }, 500);
  }
});

// Public media access
app.get("/media/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const obj = await c.env.PAYMENT_PROOFS.get(`media/${name}`);
    if (!obj) {
      return new Response("Not found", { status: 404 });
    }
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response("Failed to fetch media", { status: 500 });
  }
});

// --------------------------------------------------
// Admin: Campaigns
// --------------------------------------------------
app.get("/api/public/admin/scenarios", authMiddleware(["super_admin"]), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM campaigns ORDER BY created_at DESC`
    ).all();
    return jsonResponse(results || []);
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

app.post("/api/public/admin/scenarios", authMiddleware(["super_admin"]), async (c) => {
  try {
    const { scenarioKey, name, config } = await c.req.json();
    if (!scenarioKey || !name) {
      return jsonResponse({ error: "Missing fields" }, 400);
    }

    await c.env.DB.prepare(
      `INSERT INTO campaigns (scenario_key, name, config_json) VALUES (?, ?, ?)`
    )
      .bind(scenarioKey, name, JSON.stringify(config || {}))
      .run();

    return jsonResponse({ success: true }, 201);
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

app.get("/api/public/admin/scenarios/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const row = await c.env.DB.prepare(
      `SELECT * FROM campaigns WHERE scenario_key = ?`
    )
      .bind(key)
      .first();
    if (!row) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse(row);
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

app.put("/api/public/admin/scenarios/:key", authMiddleware(["super_admin"]), async (c) => {
  try {
    const key = c.req.param("key");
    const { name, config, isActive } = await c.req.json();
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (config !== undefined) { updates.push("config_json = ?"); values.push(JSON.stringify(config)); }
    if (isActive !== undefined) { updates.push("is_active = ?"); values.push(isActive ? 1 : 0); }
    values.push(key);

    await c.env.DB.prepare(
      `UPDATE campaigns SET ${updates.join(", ")} WHERE scenario_key = ?`
    )
      .bind(...values)
      .run();

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

app.delete("/api/public/admin/scenarios/:key", authMiddleware(["super_admin"]), async (c) => {
  try {
    const key = c.req.param("key");
    await c.env.DB.prepare(`DELETE FROM campaigns WHERE scenario_key = ?`).bind(key).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed" }, 500);
  }
});

// --------------------------------------------------
// Admin: Users (Super Admin only)
// --------------------------------------------------
app.get("/api/admin/users", authMiddleware(["super_admin"]), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, username, role, display_name, phone, is_active, created_at, updated_at FROM admin_users ORDER BY id`
    ).all();
    return jsonResponse(results || []);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch users" }, 500);
  }
});

app.post("/api/admin/users", authMiddleware(["super_admin"]), async (c) => {
  try {
    const body = await c.req.json();
    if (!body.username || !body.password || !body.role) {
      return jsonResponse({ error: "Missing fields" }, 400);
    }
    const hash = await hashPassword(body.password);
    const now = Math.floor(Date.now() / 1000);
    const user = c.get("adminUser") as AdminUser;
    await c.env.DB.prepare(
      `INSERT INTO admin_users (username, password_hash, role, display_name, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(body.username, hash, body.role, body.display_name || body.username, body.phone || null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1, now, now).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "CREATE", "user", body.username, { role: body.role })
    );

    // Send WhatsApp notification to new user if phone provided
    if (body.phone) {
      const roleLabel = body.role === 'super_admin' ? '系統管理員' : body.role === 'admin' ? '管理員' : '產品供應商';
      const msg = `【好餸管理後台】\n\n您的帳號已創建！\n\n用戶名：${body.username}\n密碼：${body.password}\n角色：${roleLabel}\n\n登入網址：\nhttps://goodstore.jkdcoding.com/admin\n\n請妥善保存您的登入資料。`;
      c.executionCtx?.waitUntil(
        sendWhatsAppMessage(c.env, body.phone, msg).then((result: any) => {
          if (!result.success) {
            console.error("[WHATSAPP] Failed to send login info to new user:", result.error);
          }
        })
      );
    }

    return jsonResponse({ success: true }, 201);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE constraint failed")) {
      return jsonResponse({ error: "Username already exists" }, 409);
    }
    return jsonResponse({ error: "Failed to create user" }, 500);
  }
});

app.put("/api/admin/users/:id", authMiddleware(["super_admin"]), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const now = Math.floor(Date.now() / 1000);

    const setClause: string[] = [];
    const values: any[] = [];

    if (body.display_name !== undefined) { setClause.push("display_name = ?"); values.push(body.display_name); }
    if (body.phone !== undefined) { setClause.push("phone = ?"); values.push(body.phone); }
    if (body.role !== undefined) { setClause.push("role = ?"); values.push(body.role); }
    if (body.is_active !== undefined) { setClause.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.password) {
      const hash = await hashPassword(body.password);
      setClause.push("password_hash = ?");
      values.push(hash);
    }

    setClause.push("updated_at = ?");
    values.push(now);
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE admin_users SET ${setClause.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    const user = c.get("adminUser") as AdminUser;
    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "UPDATE", "user", String(id), body)
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to update user" }, 500);
  }
});

app.delete("/api/admin/users/:id", authMiddleware(["super_admin"]), async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const user = c.get("adminUser") as AdminUser;
    if (user.id === id) {
      return jsonResponse({ error: "Cannot delete yourself" }, 400);
    }
    await c.env.DB.prepare(`DELETE FROM admin_users WHERE id = ?`).bind(id).run();

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "DELETE", "user", String(id), {})
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to delete user" }, 500);
  }
});

// --------------------------------------------------
// Admin: System Settings (Super Admin only)
// --------------------------------------------------
app.get("/api/admin/settings", authMiddleware(["super_admin"]), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`SELECT key, value, description, updated_at FROM system_settings`).all();
    const settings: Record<string, any> = {};
    (results || []).forEach((row: any) => {
      settings[row.key] = { value: row.value, description: row.description, updatedAt: row.updated_at };
    });
    return jsonResponse(settings);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch settings" }, 500);
  }
});

app.put("/api/admin/settings", authMiddleware(["super_admin"]), async (c) => {
  try {
    const body = await c.req.json();
    const user = c.get("adminUser") as AdminUser;
    const now = Math.floor(Date.now() / 1000);

    for (const [key, item] of Object.entries(body)) {
      const value = (item as any)?.value ?? item;
      const description = (item as any)?.description ?? null;

      await c.env.DB.prepare(
        `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = COALESCE(excluded.description, system_settings.description), updated_by = excluded.updated_by, updated_at = excluded.updated_at`
      ).bind(key, value, description, user.id, now).run();
    }

    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "UPDATE", "setting", "system", body)
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to update settings" }, 500);
  }
});

// --------------------------------------------------
// Admin: Audit Logs (Super Admin only)
// --------------------------------------------------
app.get("/api/admin/audit-logs", authMiddleware(["super_admin"]), async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
    const offset = parseInt(c.req.query("offset") || "0");
    const action = c.req.query("action");
    const targetType = c.req.query("target_type");
    const adminUsername = c.req.query("admin_username");
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");

    let sql = `SELECT * FROM admin_audit_logs`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (action) { conditions.push("action = ?"); params.push(action); }
    if (targetType) { conditions.push("target_type = ?"); params.push(targetType); }
    if (adminUsername) { conditions.push("admin_username = ?"); params.push(adminUsername); }
    if (startDate) { conditions.push("created_at >= ?"); params.push(Math.floor(new Date(startDate).getTime() / 1000)); }
    if (endDate) { conditions.push("created_at <= ?"); params.push(Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000)); }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    return jsonResponse(results || []);
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch audit logs" }, 500);
  }
});

// --------------------------------------------------
// Webhook: WhatsApp
// --------------------------------------------------
app.post("/api/webhooks/whatsapp", async (c) => {
  try {
    const body = await c.req.json();
    console.log("[WEBHOOK] Raw body:", JSON.stringify(body));

    // Check if this is a SaleSmartly user message (not system/our own reply)
    if (isSaleSmartlyUserMessage(body)) {
      console.log("[WEBHOOK] SaleSmartly user message detected");
    }

    // Try multiple possible field names from different WhatsApp API providers
    const phone = extractPhoneFromWebhook(body);
    const message = extractMessageFromWebhook(body);

    if (!phone || !message) {
      console.log("[WEBHOOK] Could not extract phone/message from:", JSON.stringify(body));
      return jsonResponse({ status: "success", message: "received (no actionable content)" });
    }

    console.log(`[WEBHOOK] From ${phone}: ${message.substring(0, 100)}`);

    // Check if this is a verification message - flexible matching
    // Match pattern: 6 uppercase alphanumeric chars, optionally preceded by 驗證碼 marker
    const verifyMatch = message.match(/(?:驗證碼[：:]\s*)?([A-HJ-NP-Z2-9]{6})/);
    if (verifyMatch) {
      const code = verifyMatch[1];
      console.log(`[WEBHOOK] Verification code detected: ${code}`);
      const now = Math.floor(Date.now() / 1000);

      // Try D1
      try {
        const result = await c.env.DB.prepare(
          `UPDATE verification_sessions SET verified = 1, phone = ?, verified_at = ? WHERE code = ?`
        )
          .bind(phone, now, code)
          .run();
        console.log("[WEBHOOK] D1 update result:", JSON.stringify(result));
      } catch (dbErr) {
        console.error("[WEBHOOK] DB update failed:", dbErr);
      }

      // Also update KV
      try {
        const kvData = await c.env.CMS_DATA.get(`verify_${code}`);
        if (kvData) {
          const data = JSON.parse(kvData);
          data.verified = true;
          data.phone = phone;
          data.verifiedAt = now;
          await c.env.CMS_DATA.put(`verify_${code}`, JSON.stringify(data), { expirationTtl: 300 });
          console.log("[WEBHOOK] KV updated for code:", code);
        } else {
          // Create KV entry if it doesn't exist (D1-only mode)
          await c.env.CMS_DATA.put(`verify_${code}`, JSON.stringify({
            code, verified: true, phone, verifiedAt: now, expiresAt: now + 300
          }), { expirationTtl: 300 });
          console.log("[WEBHOOK] KV created for code:", code);
        }
      } catch (kvErr) {
        console.error("[WEBHOOK] KV update failed:", kvErr);
      }

      // Send WhatsApp confirmation via CloudWAPI
      try {
        const confirmMsg = `【好餸社企】✅ 身份驗證成功！\n\n現在可以返回主頁繼續完成下單。`;
        const waResult = await sendWhatsAppMessage(c.env, phone, confirmMsg);
        console.log("[WEBHOOK] WhatsApp confirmation sent:", waResult.success ? "success" : waResult.error);
      } catch (waErr) {
        console.error("[WEBHOOK] Failed to send WhatsApp confirmation:", waErr);
      }

      return jsonResponse({ status: "success", message: "verified", code });
    }

    // Store non-verification messages in DB for conversation history
    try {
      await c.env.DB.prepare(
        `INSERT INTO whatsapp_messages (phone, message, sender, created_at) VALUES (?, ?, ?, ?)`
      ).bind(phone, message, 'user', Math.floor(Date.now() / 1000)).run();
    } catch (dbErr) {
      console.error("[WEBHOOK] Failed to store message:", dbErr);
    }

    return jsonResponse({ status: "success", message: "received", phone });
  } catch (e) {
    console.error("[WEBHOOK] Internal error:", e);
    return jsonResponse({ error: "Internal error", detail: String(e) }, 500);
  }
});

// --------------------------------------------------
// Admin: WhatsApp Conversations
// --------------------------------------------------
app.get("/api/public/admin/whatsapp/conversations", authMiddleware(), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT phone, MAX(created_at) as last_message_at, COUNT(*) as message_count
       FROM whatsapp_messages
       GROUP BY phone
       ORDER BY last_message_at DESC`
    ).all();
    return jsonResponse({ conversations: (results || []).map(snakeToCamel) });
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch conversations" }, 500);
  }
});

app.get("/api/public/admin/whatsapp/conversations/:phone", authMiddleware(), async (c) => {
  try {
    const phone = c.req.param("phone");
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM whatsapp_messages WHERE phone = ? ORDER BY created_at DESC LIMIT 100`
    ).bind(phone).all();
    return jsonResponse({
      phone,
      messages: (results || []).map(snakeToCamel),
    });
  } catch (e) {
    return jsonResponse({ error: "Failed to fetch conversation" }, 500);
  }
});

app.post("/api/public/admin/whatsapp/send", authMiddleware(), async (c) => {
  try {
    const body = await c.req.json();
    const { phone, message } = body;
    if (!phone || !message) {
      return jsonResponse({ error: "Phone and message are required" }, 400);
    }

    const result = await sendWhatsAppMessage(c.env, phone, message);
    if (!result.success) {
      return jsonResponse({ error: result.error }, 500);
    }

    // Store sent message in DB
    await c.env.DB.prepare(
      `INSERT INTO whatsapp_messages (phone, message, sender, created_at) VALUES (?, ?, ?, ?)`
    ).bind(phone, message, 'bot', Math.floor(Date.now() / 1000)).run();

    const user = c.get("adminUser") as AdminUser;
    c.executionCtx?.waitUntil(
      logAudit(c.env.DB, user, "SEND_WHATSAPP", "message", phone, { message })
    );

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: "Failed to send message" }, 500);
  }
});

// Helper: Extract phone from various webhook formats (CloudWAPI, SaleSmartly, etc.)
function extractPhoneFromWebhook(body: any): string | null {
  if (!body) return null;

  // SaleSmartly format 1: data.channel_uid = "85212345678@c.us"
  if (body.event === "message" && body.data?.channel_uid) {
    const uid = String(body.data.channel_uid);
    return uid.split("@")[0].trim();
  }

  // SaleSmartly format 2: data.from = "85212345678"
  if (body.event === "message" && body.data?.from) {
    return String(body.data.from).trim();
  }

  const candidates = [
    body.phone,
    body.from,
    body.number,
    body.wa_id,
    body.sender,
    body.contact?.wa_id,
    body.payload?.sender?.phone,
    body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      return candidate.trim();
    }
  }
  return null;
}

// Helper: Extract message text from various webhook formats
function extractMessageFromWebhook(body: any): string | null {
  if (!body) return null;

  // SaleSmartly format 1: data.msg = "message text"
  if (body.event === "message" && body.data?.msg && typeof body.data.msg === 'string') {
    return body.data.msg;
  }

  // SaleSmartly format 2: data.text = "message text"
  if (body.event === "message" && body.data?.text && typeof body.data.text === 'string') {
    return body.data.text;
  }

  const candidates = [
    body.message,
    body.text,
    body.body,
    body.msg,
    body.content,
    body.payload?.text,
    body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      return candidate;
    }
  }
  // Try nested text object
  if (body.text && typeof body.text === 'object' && body.text.body) {
    return String(body.text.body);
  }
  return null;
}

// Helper: Check if webhook is from SaleSmartly and sender is user
function isSaleSmartlyUserMessage(body: any): boolean {
  return body?.event === "message" && (body?.data?.sender_type === 1 || body?.data?.from);
}

// --------------------------------------------------
// Default Export
// --------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
