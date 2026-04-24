import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Client } from "@sdk/server-types";
import { tables, buckets } from "@generated";
import { eq, like, desc, sql, and } from "drizzle-orm";

// ============================================
// Utility: Send WhatsApp Message (Async)
// ============================================
async function sendWhatsAppMessage(phone: string, message: string): Promise<{success: boolean, error?: string}> {
  console.log(`[WHATSAPP] Sending to ${phone}...`);
  try {
    const pushUrl = new URL('https://unofficial.cloudwapi.in/send-message');
    pushUrl.searchParams.append('api_key', 'RQLcKDcn7BtktHSKZFopovpb0HuhvH');
    pushUrl.searchParams.append('sender', '85262322466');
    pushUrl.searchParams.append('number', phone);
    pushUrl.searchParams.append('message', message);

    // Simple fetch with headers to avoid blocking
    const res = await fetch(pushUrl.toString(), {
      headers: { 'User-Agent': 'Youware-Backend/1.0' }
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`[WHATSAPP] Failed to send to ${phone}: ${res.status} ${text}`);
      return { success: false, error: `${res.status} ${text}` };
    } else {
      console.log(`[WHATSAPP] Sent to ${phone}`);
      return { success: true };
    }
  } catch (e) {
    console.error(`[WHATSAPP] Error sending to ${phone}:`, e);
    return { success: false, error: String(e) };
  }
}

async function sendWhatsAppMedia(phone: string, caption: string, mediaUrl: string, mediaType: string = 'image'): Promise<{success: boolean, error?: string}> {
  console.log(`[WHATSAPP] Sending media to ${phone}...`);
  try {
    const pushUrl = 'https://unofficial.cloudwapi.in/send-media';
    const body = {
      api_key: 'RQLcKDcn7BtktHSKZFopovpb0HuhvH',
      sender: '85262322466',
      number: phone,
      media_type: mediaType,
      caption: caption,
      url: mediaUrl
    };

    const res = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Youware-Backend/1.0'
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`[WHATSAPP] Failed to send media to ${phone}: ${res.status} ${text}`);
      return { success: false, error: `${res.status} ${text}` };
    } else {
      console.log(`[WHATSAPP] Sent media to ${phone}`);
      return { success: true };
    }
  } catch (e) {
    console.error(`[WHATSAPP] Error sending media to ${phone}:`, e);
    return { success: false, error: String(e) };
  }
}



// ============================================
// Template Services (Handlebars-like rendering)
// ============================================

class TemplateService {
  private db: any;
  private cache: Map<string, any> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(db: any) {
    this.db = db;
  }

  async getActiveTemplate(scenarioKey: string, messageKey: string, lang: string) {
    const cacheKey = `${scenarioKey}:${messageKey}:${lang}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Try exact match
    const result = await this.db.run(
      sql`SELECT content, variables_json FROM whatsapp_message_templates 
          WHERE scenario_key = ${scenarioKey} AND message_key = ${messageKey} 
          AND lang = ${lang} AND is_active = 1 LIMIT 1`
    );

    if (result && result.length > 0) {
      this.cache.set(cacheKey, { data: result[0], timestamp: Date.now() });
      return result[0];
    }

    // Fallback: try default language
    const defaultLangResult = await this.db.run(
      sql`SELECT default_lang FROM whatsapp_scenarios WHERE scenario_key = ${scenarioKey} LIMIT 1`
    );
    if (defaultLangResult && defaultLangResult.length > 0) {
      const defaultLang = defaultLangResult[0].default_lang;
      if (defaultLang !== lang) {
        const fallbackResult = await this.db.run(
          sql`SELECT content, variables_json FROM whatsapp_message_templates 
              WHERE scenario_key = ${scenarioKey} AND message_key = ${messageKey} 
              AND lang = ${defaultLang} AND is_active = 1 LIMIT 1`
        );
        if (fallbackResult && fallbackResult.length > 0) {
          this.cache.set(cacheKey, { data: fallbackResult[0], timestamp: Date.now() });
          return fallbackResult[0];
        }
      }
    }

    return null;
  }

  async getScenarioConfig(scenarioKey: string) {
    const cacheKey = `scenario:${scenarioKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const result = await this.db.run(
      sql`SELECT * FROM whatsapp_scenarios WHERE scenario_key = ${scenarioKey} LIMIT 1`
    );

    if (result && result.length > 0) {
      const config = result[0];
      config.config_json = JSON.parse(config.config_json || "{}");
      this.cache.set(cacheKey, { data: config, timestamp: Date.now() });
      return config;
    }
    return null;
  }

  clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

class TemplateRenderer {
  render(template: string, variables: Record<string, any>): string {
    let result = template;
    // Simple handlebars-like rendering: {{varName}}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      const safeValue = value !== null && value !== undefined ? String(value) : "-";
      result = result.replace(placeholder, safeValue);
    }
    return result;
  }

  extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return matches.map(m => m.slice(2, -2));
  }
}

// ============================================
// App Creation
// ============================================

export async function createApp(
  edgespark: Client<typeof tables>
): Promise<Hono> {
  const app = new Hono();
  const templateService = new TemplateService(edgespark.db);
  const renderer = new TemplateRenderer();

  // Note: Hardcoded fallback messages are generated inline in order submission (Phase 1 safety net)

  // Enable CORS for all origins
  app.use('/*', cors({
    origin: '*',
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }));

  // Admin Login
  app.post('/api/public/admin/login', async (c) => {
    try {
      const { username, password } = await c.req.json();
      const user = await edgespark.db.select().from(tables.adminUsers).where(eq(tables.adminUsers.username, username)).limit(1);
      if (user.length > 0 && user[0].password === password) {
        return c.json({ success: true, token: 'simple-admin-token' });
      }
      return c.json({ error: 'Invalid credentials' }, 401);
    } catch (e) {
      return c.json({ error: 'Login failed' }, 500);
    }
  });

  // Middleware for Admin Auth
  const adminAuth = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    // Support both "Bearer simple-admin-token" format and plain token format
    const bearerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (bearerToken !== 'simple-admin-token') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };

  // Admin: Get Orders
  app.get('/api/public/admin/orders', adminAuth, async (c) => {
    try {
      const orders = await edgespark.db.select().from(tables.orderRecords).orderBy(desc(tables.orderRecords.createdAt));
      return c.json(orders);
    } catch (e) {
      return c.json({ error: 'Failed to fetch orders' }, 500);
    }
  });

  // Admin: Get Order Detail
  app.get('/api/public/admin/orders/:id', adminAuth, async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const order = await edgespark.db.select().from(tables.orderRecords).where(eq(tables.orderRecords.id, id)).limit(1);
      if (order.length === 0) return c.json({ error: 'Order not found' }, 404);
      
      // Fetch uploads
      const uploads = await edgespark.db.select().from(tables.paymentProofUploads).where(eq(tables.paymentProofUploads.orderId, id));
      
      // Generate signed URLs for uploads (since bucket is private)
      const bucket = edgespark.storage.from(buckets.payment_proofs);
      
      const signedUploads = await Promise.all(uploads.map(async (u) => {
        try {
          // Extract path from URL if it matches our storage pattern
          // URL format: .../payment-proofs/{path}
          if (u.fileUrl && u.fileUrl.includes('/payment-proofs/')) {
            const parts = u.fileUrl.split('/payment-proofs/');
            if (parts.length === 2) {
              const path = parts[1];
              // Generate signed URL valid for 1 hour
              const { downloadUrl } = await bucket.createPresignedGetUrl(path, 3600);
              return { ...u, fileUrl: downloadUrl };
            }
          }
          return u;
        } catch (e) {
          console.error('Failed to sign URL for upload:', u.id, e);
          return u;
        }
      }));

      // Handle legacy paymentProof column if it's a storage URL
      let paymentProofUrl = order[0].paymentProof;
      if (paymentProofUrl && paymentProofUrl.includes('/payment-proofs/')) {
         try {
            const parts = paymentProofUrl.split('/payment-proofs/');
            if (parts.length === 2) {
               const path = parts[1];
               const { downloadUrl } = await bucket.createPresignedGetUrl(path, 3600);
               paymentProofUrl = downloadUrl;
            }
         } catch (e) {
            console.error('Failed to sign URL for paymentProof:', e);
         }
      }
      
      return c.json({ ...order[0], paymentProof: paymentProofUrl, uploads: signedUploads });
    } catch (e) {
      console.error('Failed to fetch order:', e);
      return c.json({ error: 'Failed to fetch order' }, 500);
    }
  });

  // Admin: Update Order
  app.put('/api/public/admin/orders/:id', adminAuth, async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const body = await c.req.json();
      
      // Check if paymentConfirmed changed from 0 to 1
      const existing = await edgespark.db.select().from(tables.orderRecords).where(eq(tables.orderRecords.id, id)).limit(1);
      const shouldNotify = existing.length > 0 && existing[0].paymentConfirmed === 0 && body.paymentConfirmed === 1;

      await edgespark.db.update(tables.orderRecords).set(body).where(eq(tables.orderRecords.id, id));
      
      if (shouldNotify) {
         // Send WhatsApp notification
         const order = existing[0];
         const msg = order.language === 'en' 
           ? `【Order #: ${order.orderNum} Payment Confirmed】Thank you! We have confirmed your payment.`
           : `【訂單編號: ${order.orderNum}付款確認】多謝您的付款！我們已確認收到您的款項。`;
           
         await sendWhatsAppMessage(order.phone, msg);
      }

      return c.json({ success: true });
    } catch (e) {
      return c.json({ error: 'Failed to update order' }, 500);
    }
  });

  // Admin: Delete Order
  app.delete('/api/public/admin/orders/:id', adminAuth, async (c) => {
    try {
      const id = Number(c.req.param('id'));
      await edgespark.db.delete(tables.orderRecords).where(eq(tables.orderRecords.id, id));
      return c.json({ success: true });
    } catch (e) {
      return c.json({ error: 'Failed to delete order' }, 500);
    }
  });

  // ============================================
  // Order Submission - Using Template System
  // ============================================

  app.post('/api/public/orders', async (c) => {
    try {
      const body = await c.req.json();

      // Get full phone number (already includes country code from frontend)
      // Clean up phone number: remove duplicate country codes
      let fullPhone = String(body.phone || '').replace(/[^0-9]/g, '');
      
      // If phone is 8 digits, assume HK and add 852
      if (fullPhone.length === 8) {
        fullPhone = '852' + fullPhone;
      }

      // If phone starts with 852852, it means it was duplicated
      // Remove the extra 852 prefix
      if (fullPhone.startsWith('852852')) {
        fullPhone = fullPhone.substring(3); // Remove first 852
      }
      
      // Also handle other duplicate patterns (in case country code appears twice)
      while (fullPhone.match(/^(\d{3})\1/)) {
        // If it starts with repeated 3-digit code, remove one instance
        const match = fullPhone.match(/^(\d{3})\1/);
        if (match) {
          fullPhone = fullPhone.substring(3);
        } else {
          break;
        }
      }

      // Insert order
      const quantity = body.quantity || 1;
      const totalPrice = (body.totalPrice || 0) + (body.shippingFee || 0);

      const timestamp = Math.floor(Date.now() / 1000);
      const orderNum = String(timestamp).slice(-4);
      
      const result = await edgespark.db.insert(tables.orderRecords).values({
        productType: body.productType,
        quantity: quantity,
        region: body.region,
        address: body.address,
        deliveryDate: body.deliveryDate,
        deliveryTime: body.deliveryTime,
        name: body.name,
        phone: fullPhone,
        email: body.email,
        remarks: body.remarks,
        totalPrice: totalPrice,
        language: body.language || 'zh',
        referralCode: body.referralCode || null,
        campaignName: body.campaignName || 'poon-choi-good-sung',
        orderNum: orderNum,
        paymentProof: null,
        paymentConfirmed: 0,
        createdAt: timestamp
      }).returning();

      console.log('[DEBUG] Order created:', JSON.stringify(result));


      // Pre-Check
      try {
         await edgespark.db.update(tables.orderRecords)
           .set({ adminRemarks: 'Pre-Check: Inserted' })
           .where(and(eq(tables.orderRecords.orderNum, orderNum), eq(tables.orderRecords.phone, fullPhone)));
      } catch (e) { console.error('Pre-check failed', e); }
      

      
      const origin = 'https://deliciousexp.youware.app';
      const refCode = fullPhone.slice(-4);
      const shareUrl = `${origin}/?ref=${refCode}`;

      // Context for template rendering
      const context = {
        orderNum,
        productType: body.productType,
        quantity,
        region: body.region,
        address: body.address,
        deliveryDate: body.deliveryDate,
        deliveryTime: body.deliveryTime,
        name: body.name,
        phone: fullPhone,
        email: body.email || '-',
        remarks: body.remarks || '-',
        totalPrice,
        shareUrl,
        bankAccount: 'DBS A/C - 016-000227829',
        fpsId: 'FPS - 108810334',
        companyName: 'DELICIOUS EXPRESS LTD',
        paymentProofUrl: `${origin}/payment-proof/${orderNum}`
      };

      const scenarioKey = body.scenarioKey || 'poonchoi';
      const lang = body.language || 'zh';

      // ============================================
      // Try to render from database templates (Phase 1)
      // ============================================

      let orderConfirmationMsg = null;
      let sharingMsg = null;
      let referralMsg = null;

      try {
        // Get templates
        const orderConfirmationTemplate = await templateService.getActiveTemplate(scenarioKey, 'order_confirmation', lang);
        if (orderConfirmationTemplate) {
          orderConfirmationMsg = renderer.render(orderConfirmationTemplate.content, context);
        }

        const sharingTemplate = await templateService.getActiveTemplate(scenarioKey, 'sharing', lang);
        if (sharingTemplate) {
          sharingMsg = renderer.render(sharingTemplate.content, context);
        }

        const referralTemplate = await templateService.getActiveTemplate(scenarioKey, 'referral_success', lang);
        if (referralTemplate) {
          referralMsg = renderer.render(referralTemplate.content, context);
        }
      } catch (templateErr) {
        console.warn('[TEMPLATE] Failed to load from DB:', templateErr);
        // Fall through to hardcoded fallback
      }

      // ============================================
      // Fallback to hardcoded messages (Phase 1 safety net)
      // ============================================

      if (!orderConfirmationMsg) {
        orderConfirmationMsg = `多謝您的訂購！
訂單號碼: ${orderNum}
產品: ${body.productType}
數量: ${quantity}
地區: ${body.region}
地址: ${body.address}
日期: ${body.deliveryDate}
時間: ${body.deliveryTime}
姓名: ${body.name}
電話: ${fullPhone}
電郵: ${body.email || '-'}
備註: ${body.remarks || '-'}
總額: HK$${totalPrice}

銀行資料：
DBS A/C - 016-000227829
FPS - 108810334
名稱 - DELICIOUS EXPRESS LTD

上傳付款記錄: ${context.paymentProofUrl}

歡迎分享⤵️信息予親朋好友，讓更多人一齊支持 SEN 青年就業！`;
        if (lang === 'en') {
          orderConfirmationMsg = `Thank you for your order!
Order #: ${orderNum}
Product: ${body.productType}
Quantity: ${quantity}
Region: ${body.region}
Address: ${body.address}
Delivery Date: ${body.deliveryDate}
Delivery Time: ${body.deliveryTime}
Name: ${body.name}
Phone: ${fullPhone}
Email: ${body.email || '-'}
Remarks: ${body.remarks || '-'}
Total: HK$${totalPrice}

Bank Details:
DBS A/C - 016-000227829
FPS - 108810334
Name - DELICIOUS EXPRESS LTD

Upload Payment Proof: ${context.paymentProofUrl}

We welcome you to share below⤵️ messsage to friends around supporting SEN youth employment!`;
        }
      }

      if (!sharingMsg) {
        sharingMsg = lang === 'en'
          ? `【Share Kindness • Support Inclusion】
I just ordered *"Delicious Express" Treasure Pot(好餸盤菜)* to support SEN youth employment!

I heartily recommend you join us and make the reunion dinner more meaningful.

Click to learn more⤵️ ${shareUrl}`
          : `【分享善意・支持共融】
我剛剛訂購了 *「好餸」盤菜* ，支持 SEN 青年就業！

誠意推介你也一起支持，讓團年飯更有意義。

點擊了解⤵️ ${shareUrl}`;
      }

      if (!referralMsg) {
        referralMsg = lang === 'en'
          ? `【Kindness Ripple • Thank You】
Your friend just successfully ordered *"Delicious Express"* Treasure Pot!

Thank you for spreading this kindness and creating more job opportunities for SEN youth.

Your support is our greatest motivation.`
          : `【善意漣漪・感謝有你】
您推薦的朋友剛剛成功訂購了 *「好餸」盤菜* ！

感謝您將這份善意傳遞出去，讓更多 SEN 青年獲得工作機會。

您的支持，是我們最大的動力。`;
      }

      // ============================================
      // Send WhatsApp messages (Direct Execution)
      // ============================================

      try {
        // Debug: Log start
        await edgespark.db.update(tables.orderRecords)
          .set({ adminRemarks: 'Step 1: Start ' + new Date().toISOString() })
          .where(and(eq(tables.orderRecords.orderNum, orderNum), eq(tables.orderRecords.phone, fullPhone)));

        let logMsg = '';

          // 1. Order Confirmation (Customer)
          if (orderConfirmationMsg) {
            const r = await sendWhatsAppMessage(fullPhone, orderConfirmationMsg);
            logMsg += `Cust: ${r.success ? 'OK' : r.error}. `;
          }

          // 2. Order Confirmation (Admin)
          if (orderConfirmationMsg) {
            const r = await sendWhatsAppMessage('85298536993', orderConfirmationMsg);
            logMsg += `Admin: ${r.success ? 'OK' : r.error}. `;
          }

          // Update order with log
          if (logMsg) {
             try {
               await edgespark.db.update(tables.orderRecords)
                 .set({ adminRemarks: logMsg.substring(0, 255) })
                 .where(and(eq(tables.orderRecords.orderNum, orderNum), eq(tables.orderRecords.phone, fullPhone)));
             } catch (dbErr) {
               console.error('[NOTIFICATION] Failed to log to DB:', dbErr);
             }
          }

          // 3. Sharing Message (Customer)
          if (sharingMsg) {
            // Use Youware CDN URL for better reliability than Dropbox
            const mediaUrl = 'https://public.youware.com/users-website-assets/prod/8a1805d1-7881-4358-a7eb-4b8f569ebf95/c6cec53e68dc429a839258fdf104fa54.jpg';
            const r = await sendWhatsAppMedia(fullPhone, sharingMsg, mediaUrl);
            logMsg += `Share: ${r.success ? 'OK' : r.error}. `;

             try {
               await edgespark.db.update(tables.orderRecords)
                 .set({ adminRemarks: logMsg.substring(0, 255) })
                 .where(and(eq(tables.orderRecords.orderNum, orderNum), eq(tables.orderRecords.phone, fullPhone)));
             } catch (dbErr) {
               console.error('[NOTIFICATION] Failed to log Share to DB:', dbErr);
             }
          }

          // 4. Sharing Message (Admin) - Skipped
          // if (sharingMsg) {
          //   await sendWhatsAppMessage('85298536993', sharingMsg);
          // }

          // 5. Referral Handling
          if (body.referralCode) {
            try {
                console.log('[REFERRAL] Processing referral code:', body.referralCode);
                const referrers = await edgespark.db.select()
                  .from(tables.orderRecords)
                  .where(like(tables.orderRecords.phone, `%${body.referralCode}`))
                  .limit(1);

                if (referrers.length > 0) {
                  const referrer = referrers[0];

                  // Record referral
                  await edgespark.db.insert(tables.referralRecords).values({
                    referrerPhone: referrer.phone,
                    refereeOrderId: result[0].id,
                    refereePhone: fullPhone
                  }).returning();
                  console.log('[REFERRAL] Record created');

                  // Send referral notification
                  if (referralMsg) {
                    await sendWhatsAppMessage(referrer.phone, referralMsg);
                  }
                }
            } catch (e) {
                console.error('[REFERRAL] Error:', e);
            }
          }
          console.log('[NOTIFICATION] All tasks completed');
        } catch (err) {
           console.error('[NOTIFICATION] Background task error:', err);
           try {
             await edgespark.db.update(tables.orderRecords)
               .set({ adminRemarks: `Crash: ${String(err)} (${orderNum})`.substring(0, 255) })
               .where(and(eq(tables.orderRecords.orderNum, orderNum), eq(tables.orderRecords.phone, fullPhone)));
           } catch (e) { console.error('Failed to log crash', e); }
        }

      // Execute notifications (Removed wrapper)


      return c.json(result[0]);
    } catch (error) {
      console.error('[ORDER] Submission error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ============================================
  // Admin: Campaign/Scenario Management
  // ============================================

  // Get all scenarios
  app.get('/api/public/admin/scenarios', adminAuth, async (c) => {
    try {
      const scenarios = await edgespark.db.select().from(tables.whatsappScenarios).orderBy(desc(tables.whatsappScenarios.createdAt));
      return c.json(scenarios);
    } catch (e) {
      console.error('[ADMIN] Scenarios fetch failed:', e);
      return c.json({ error: 'Failed to fetch scenarios' }, 500);
    }
  });

  // Create new scenario
  app.post('/api/public/admin/scenarios', adminAuth, async (c) => {
    try {
      const { scenarioKey, name, defaultLang, config } = await c.req.json();

      if (!scenarioKey || !name) {
        return c.json({ error: 'Missing required fields: scenarioKey, name' }, 400);
      }

      // Check if scenario already exists
      const existing = await edgespark.db.select()
        .from(tables.whatsappScenarios)
        .where(eq(tables.whatsappScenarios.scenarioKey, scenarioKey))
        .limit(1);

      if (existing.length > 0) {
        return c.json({ error: 'Scenario key already exists' }, 400);
      }

      const result = await edgespark.db.insert(tables.whatsappScenarios).values({
        scenarioKey: scenarioKey,
        name: name,
        defaultLang: defaultLang || 'zh',
        sharePath: '/',
        refCodeStrategy: 'phone_last_n',
        refCodeN: 4,
        configJson: JSON.stringify(config || {}),
        isActive: 1,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000)
      }).returning();

      // Clear template cache
      templateService.clearCache();

      return c.json(result[0], 201);
    } catch (e) {
      console.error('[ADMIN] Scenario creation failed:', e);
      return c.json({ error: 'Failed to create scenario' }, 500);
    }
  });

  // Get scenario detail
  app.get('/api/public/admin/scenarios/:scenarioKey', adminAuth, async (c) => {
    try {
      const scenarioKey = c.req.param('scenarioKey');
      const scenario = await edgespark.db.select()
        .from(tables.whatsappScenarios)
        .where(eq(tables.whatsappScenarios.scenarioKey, scenarioKey))
        .limit(1);

      if (scenario.length === 0) {
        return c.json({ error: 'Scenario not found' }, 404);
      }

      return c.json(scenario[0]);
    } catch (e) {
      console.error('[ADMIN] Scenario fetch failed:', e);
      return c.json({ error: 'Failed to fetch scenario' }, 500);
    }
  });

  // Update scenario
  app.put('/api/public/admin/scenarios/:scenarioKey', adminAuth, async (c) => {
    try {
      const scenarioKey = c.req.param('scenarioKey');
      const { name, defaultLang, config, isActive } = await c.req.json();

      const updates: any = {
        updatedAt: Math.floor(Date.now() / 1000)
      };

      if (name !== undefined) updates.name = name;
      if (defaultLang !== undefined) updates.defaultLang = defaultLang;
      if (config !== undefined) updates.configJson = JSON.stringify(config);
      if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;

      const result = await edgespark.db.update(tables.whatsappScenarios)
        .set(updates)
        .where(eq(tables.whatsappScenarios.scenarioKey, scenarioKey))
        .returning();

      if (result.length === 0) {
        return c.json({ error: 'Scenario not found' }, 404);
      }

      // Clear template cache
      templateService.clearCache();

      return c.json(result[0]);
    } catch (e) {
      console.error('[ADMIN] Scenario update failed:', e);
      return c.json({ error: 'Failed to update scenario' }, 500);
    }
  });

  // Delete scenario
  app.delete('/api/public/admin/scenarios/:scenarioKey', adminAuth, async (c) => {
    try {
      const scenarioKey = c.req.param('scenarioKey');

      // Delete all templates for this scenario first (cascade delete)
      await edgespark.db.delete(tables.whatsappMessageTemplates)
        .where(eq(tables.whatsappMessageTemplates.scenarioKey, scenarioKey));

      const result = await edgespark.db.delete(tables.whatsappScenarios)
        .where(eq(tables.whatsappScenarios.scenarioKey, scenarioKey))
        .returning();

      if (result.length === 0) {
        return c.json({ error: 'Scenario not found' }, 404);
      }

      // Clear template cache
      templateService.clearCache();

      return c.json({ success: true });
    } catch (e) {
      console.error('[ADMIN] Scenario deletion failed:', e);
      return c.json({ error: 'Failed to delete scenario' }, 500);
    }
  });

  // ============================================
  // Admin: Template Management (Phase 2)
  // ============================================

  app.get('/api/public/admin/whatsapp/templates', adminAuth, async (c) => {
    try {
      const scenarioKey = c.req.query('scenarioKey');
      const messageKey = c.req.query('messageKey');
      const lang = c.req.query('lang');

      let query = sql`SELECT * FROM whatsapp_message_templates WHERE 1=1`;
      if (scenarioKey) query = sql`${query} AND scenario_key = ${scenarioKey}`;
      if (messageKey) query = sql`${query} AND message_key = ${messageKey}`;
      if (lang) query = sql`${query} AND lang = ${lang}`;
      query = sql`${query} ORDER BY scenario_key, message_key, lang, version DESC`;

      const templates = await edgespark.db.run(query);
      return c.json(templates || []);
    } catch (e) {
      console.error('[ADMIN] Template fetch failed:', e);
      return c.json({ error: 'Failed to fetch templates' }, 500);
    }
  });

  app.post('/api/public/admin/whatsapp/templates', adminAuth, async (c) => {
    try {
      const { scenarioKey, messageKey, lang, content, description } = await c.req.json();

      if (!scenarioKey || !messageKey || !lang || !content) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Extract variables
      const variables = renderer.extractVariables(content);

      // Get next version
      const lastVersionResult = await edgespark.db.run(
        sql`SELECT MAX(version) as maxVersion FROM whatsapp_message_templates 
            WHERE scenario_key = ${scenarioKey} AND message_key = ${messageKey} AND lang = ${lang}`
      );
      const nextVersion = (lastVersionResult?.[0]?.maxVersion || 0) + 1;

      // Insert new template (not active by default)
      const result = await edgespark.db.insert(tables.whatsappMessageTemplates).values({
        scenarioKey: scenarioKey,
        messageKey: messageKey,
        lang: lang,
        content: content,
        variablesJson: JSON.stringify(variables),
        description: description || null,
        isActive: 0,
        version: nextVersion,
        createdBy: 'admin',
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000)
      }).returning();

      return c.json(result[0], 201);
    } catch (e) {
      console.error('[ADMIN] Template creation failed:', e);
      return c.json({ error: 'Failed to create template' }, 500);
    }
  });

  app.post('/api/public/admin/whatsapp/templates/:id/activate', adminAuth, async (c) => {
    try {
      const templateId = Number(c.req.param('id'));

      // Get template
      const templates = await edgespark.db.run(
        sql`SELECT * FROM whatsapp_message_templates WHERE id = ${templateId}`
      );
      if (!templates || templates.length === 0) {
        return c.json({ error: 'Template not found' }, 404);
      }

      const template = templates[0];

      // Deactivate all others in this group
      await edgespark.db.run(
        sql`UPDATE whatsapp_message_templates SET is_active = 0 
            WHERE scenario_key = ${template.scenario_key} 
            AND message_key = ${template.message_key} 
            AND lang = ${template.lang}
            AND id != ${templateId}`
      );

      // Activate this template
      await edgespark.db.run(
        sql`UPDATE whatsapp_message_templates SET is_active = 1, updated_at = ${Math.floor(Date.now() / 1000)}
            WHERE id = ${templateId}`
      );

      // Clear cache
      templateService.clearCache(`${template.scenario_key}:${template.message_key}:${template.lang}`);

      return c.json({ success: true });
    } catch (e) {
      console.error('[ADMIN] Template activation failed:', e);
      return c.json({ error: 'Failed to activate template' }, 500);
    }
  });

  app.post('/api/public/admin/whatsapp/templates/preview', adminAuth, async (c) => {
    try {
      const { content, variables } = await c.req.json();

      if (!content || !variables) {
        return c.json({ error: 'Missing content or variables' }, 400);
      }

      const rendered = renderer.render(content, variables);
      return c.json({ preview: rendered });
    } catch (e) {
      console.error('[ADMIN] Template preview failed:', e);
      return c.json({ error: 'Failed to preview template' }, 500);
    }
  });

  // ============================================
  // WhatsApp Webhook Integration
  // ============================================

  app.get('/api/public/admin/whatsapp/conversations/:phone', adminAuth, async (c) => {
    try {
      const phone = c.req.param('phone').trim();

      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const result = await edgespark.db.run(sql`SELECT phone, conversation_history, attachments, last_message_at, created_at FROM whatsapp_conversations WHERE phone = ${phone} LIMIT 1`);

      if (!result || result.length === 0) {
        return c.json({ error: 'Conversation not found' }, 404);
      }

      const conversation = result[0];
      return c.json({
        phone: conversation.phone,
        conversationHistory: JSON.parse(conversation.conversation_history || '[]'),
        attachments: JSON.parse(conversation.attachments || '[]'),
        lastMessageAt: conversation.last_message_at,
        createdAt: conversation.created_at
      });
    } catch (e) {
      console.error('[WHATSAPP] Conversation fetch failed:', e);
      return c.json({ error: 'Failed to fetch conversation' }, 500);
    }
  });

  app.get('/api/public/admin/whatsapp/conversations', adminAuth, async (c) => {
    try {
      const result = await edgespark.db.run(sql`SELECT phone, last_message_at, created_at FROM whatsapp_conversations ORDER BY last_message_at DESC`);

      return c.json(result || []);
    } catch (e) {
      console.error('[WHATSAPP] Conversations list failed:', e);
      return c.json({ error: 'Failed to fetch conversations' }, 500);
    }
  });

  app.post('/api/webhooks/whatsapp', async (c) => {
    try {
      const body = await c.req.json();

      if (!body.phone || !body.message) {
        return c.json({ status: 'error', error_code: 'INVALID_DATA', message: 'Missing phone or message' }, 400);
      }

      const timestamp = body.timestamp || new Date().toISOString();
      const messageEntry = {
        message: body.message,
        sender: body.sender || 'user',
        timestamp: timestamp
      };

      // Get existing conversation
      const existing = await edgespark.db.run(
        sql`SELECT id, conversation_history, attachments FROM whatsapp_conversations WHERE phone = ${body.phone}`
      );

      let conversationHistory: any[] = [];
      let attachments: any[] = [];

      if (existing && existing.length > 0) {
        conversationHistory = JSON.parse(existing[0].conversation_history || '[]');
        attachments = JSON.parse(existing[0].attachments || '[]');

        conversationHistory.push(messageEntry);

        if (body.attachments && Array.isArray(body.attachments)) {
          body.attachments.forEach((att: any) => {
            attachments.push({
              ...att,
              timestamp: timestamp
            });
          });
        }

        await edgespark.db.run(
          sql`UPDATE whatsapp_conversations 
              SET conversation_history = ${JSON.stringify(conversationHistory)},
                  attachments = ${JSON.stringify(attachments)},
                  last_message_at = ${timestamp},
                  updated_at = ${Math.floor(Date.now() / 1000)}
              WHERE phone = ${body.phone}`
        );
      } else {
        conversationHistory.push(messageEntry);
        if (body.attachments && Array.isArray(body.attachments)) {
          body.attachments.forEach((att: any) => {
            attachments.push({
              ...att,
              timestamp: timestamp
            });
          });
        }

        await edgespark.db.run(
          sql`INSERT INTO whatsapp_conversations (phone, conversation_history, attachments, last_message_at, created_at, updated_at)
              VALUES (${body.phone}, ${JSON.stringify(conversationHistory)}, ${JSON.stringify(attachments)}, ${timestamp}, ${Math.floor(Date.now() / 1000)}, ${Math.floor(Date.now() / 1000)})`
        );
      }

      return c.json({ status: 'success', message: 'received' });
    } catch (e) {
      console.error('[WEBHOOK] WhatsApp webhook error:', e);
      return c.json({ status: 'error', error_code: 'INTERNAL_ERROR', message: String(e) }, 500);
    }
  });

  // ============================================
  // Debug: Test WhatsApp API
  // ============================================
  app.get('/api/public/test-whatsapp', async (c) => {
    try {
      const phone = c.req.query('phone') || '85298536993';
      const message = c.req.query('message') || 'Debug Test Message ' + Date.now();
      
      const pushUrl = new URL('https://unofficial.cloudwapi.in/send-message');
      pushUrl.searchParams.append('api_key', 'RQLcKDcn7BtktHSKZFopovpb0HuhvH');
      pushUrl.searchParams.append('sender', '85262322466');
      pushUrl.searchParams.append('number', phone);
      pushUrl.searchParams.append('message', message);

      console.log('[DEBUG] Testing WhatsApp to', phone);
      const res = await fetch(pushUrl.toString());
      const text = await res.text();
      
      return c.json({
        status: res.status,
        statusText: res.statusText,
        body: text,
        url: pushUrl.toString().replace(/api_key=[^&]+/, 'api_key=***')
      });
    } catch (e) {
      return c.json({ error: String(e) }, 500);
    }
  });

  // ============================================
  // Payment Proof Upload API
  // ============================================

  app.post('/api/public/payment-proof/upload', async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const orderNum = formData.get('orderNum') as string;

      if (!file || !orderNum) {
        return c.json({ 
          error: 'Missing file or orderNum',
          message: 'File and order number are required'
        }, 400);
      }

      // Find order by orderNum
      const orders = await edgespark.db.select({
          id: tables.orderRecords.id,
          name: tables.orderRecords.name,
          phone: tables.orderRecords.phone,
          language: tables.orderRecords.language
        })
        .from(tables.orderRecords)
        .where(eq(tables.orderRecords.orderNum, orderNum))
        .limit(1);

      if (orders.length === 0) {
        return c.json({ 
          error: 'Order not found',
          message: 'No order found with this order number'
        }, 404);
      }

      const orderId = orders[0].id;
      const customerPhone = orders[0].phone;
      const customerName = orders[0].name;
      const language = orders[0].language || 'zh';

      // Upload file to bucket (using Youbase file storage)
      const fileName = `payment-proof-${orderNum}-${Date.now()}.${file.name.split('.').pop()}`;
      const storagePath = `${orderNum}/${fileName}`;
      
      try {
        // Convert File to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer();
        
        // Upload to Youbase storage bucket using bucket name string
        const bucketDef = buckets.payment_proofs;
        await edgespark.storage
          .from(bucketDef)
          .put(storagePath, arrayBuffer, { contentType: file.type });
        
        // Create public URL for database
        // const fileUri = edgespark.storage.toS3Uri(bucketName, storagePath);
        const projectId = '8a1805d1-7881-4358-a7eb-4b8f569ebf95';
        const bucketName = bucketDef.bucket_name;
        const fileUri = `https://${projectId}.youbase.cloud/storage/v1/object/public/${bucketName}/${storagePath}`;
        
        await edgespark.db.update(tables.orderRecords)
          .set({ 
            paymentProof: fileUri,
            paymentConfirmed: 0  // Keep as unconfirmed until admin approves
          })
          .where(eq(tables.orderRecords.id, orderId));

        // Also add to payment_proof_uploads table
        await edgespark.db.insert(tables.paymentProofUploads).values({
          orderId: orderId,
          fileUrl: fileUri,
          fileName: fileName,
          uploadedAt: Math.floor(Date.now() / 1000)
        });

        // Send WhatsApp notification to customer
        try {
          let notifyMsg = '';
          if (language === 'en') {
            notifyMsg = `Payment proof received (Order: ${orderNum}). We will verify and confirm shortly.`;
          } else {
            notifyMsg = '已收到付款證明（訂單號碼：' + orderNum + '），核實以後會予以確認';
          }
          
          const pushUrl = new URL('https://unofficial.cloudwapi.in/send-message');
          pushUrl.searchParams.append('api_key', 'RQLcKDcn7BtktHSKZFopovpb0HuhvH');
          pushUrl.searchParams.append('sender', '85262322466');
          pushUrl.searchParams.append('number', customerPhone);
          pushUrl.searchParams.append('message', notifyMsg);
          
          // Use Promise.race for timeout
          const fetchPromise = fetch(pushUrl.toString());
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
          await Promise.race([fetchPromise, timeoutPromise]);
          
          console.log('[PAYMENT] WhatsApp notification sent to customer:', customerPhone);

          // Also notify admin
          const adminPushUrl = new URL('https://unofficial.cloudwapi.in/send-message');
          adminPushUrl.searchParams.append('api_key', 'RQLcKDcn7BtktHSKZFopovpb0HuhvH');
          adminPushUrl.searchParams.append('sender', '85262322466');
          adminPushUrl.searchParams.append('number', '85298536993');
          // Use actual newlines which URLSearchParams will encode as %0A
          adminPushUrl.searchParams.append('message', `新付款記錄待審核\n訂單號碼: ${orderNum}\n客戶: ${customerName}\n點擊查閱: https://deliciousexp.youware.app/admin`);
          
          const adminFetchPromise = fetch(adminPushUrl.toString());
          const adminTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
          await Promise.race([adminFetchPromise, adminTimeoutPromise]);
          
        } catch (notifyErr) {
          console.error('[PAYMENT] WhatsApp notification failed:', notifyErr);
        }

        return c.json({ 
          success: true,
          message: 'Payment proof uploaded successfully',
          orderNum,
          fileUri
        });
      } catch (uploadErr) {
        console.error('[PAYMENT] File upload failed:', uploadErr);
        return c.json({ 
          error: 'Upload failed',
          message: 'Failed to upload file'
        }, 500);
      }
    } catch (e) {
      console.error('[PAYMENT] Payment proof upload error:', e);
      return c.json({ 
        error: 'Internal server error',
        message: String(e)
      }, 500);
    }
  });

  // ============================================
  // Short Link Redirect for Payment Proof Upload
  // ============================================
  app.get('/api/public/upload-link/:shortCode', async (c) => {
    try {
      const shortCode = c.req.param('shortCode');

      if (!shortCode) {
        return c.json({ error: 'Short code is required' }, 400);
      }

      // Find upload link by short code
      const uploadLink = await edgespark.db.run(
        sql`SELECT order_id FROM upload_links WHERE short_code = ${shortCode} LIMIT 1`
      );

      if (!uploadLink || uploadLink.length === 0) {
        return c.json({ error: 'Upload link not found' }, 404);
      }

      const orderId = uploadLink[0].order_id;

      // Get order details
      const order = await edgespark.db.select()
        .from(tables.orderRecords)
        .where(eq(tables.orderRecords.id, orderId))
        .limit(1);

      if (order.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      // Return redirect info (front end will handle redirect)
      return c.json({
        success: true,
        orderNum: order[0].orderNum,
        uploadPageUrl: `/payment-proof/${order[0].orderNum}`
      });
    } catch (e) {
      console.error('[SHORT_LINK] Error resolving short code:', e);
      return c.json({ error: 'Failed to resolve link' }, 500);
    }
  });

  return app;
}
