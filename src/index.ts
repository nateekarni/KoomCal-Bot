import express, { Application, Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import * as aiService from './services/ai.service';
import * as lineService from './services/line.service';
import dotenv from 'dotenv';

dotenv.config();

// --- ⚙️ CONFIGURATION ---
const config: line.MiddlewareConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

// 🛡️ SECURITY: โหลด Whitelist จาก Env (แยกด้วย comma)
// ตัวอย่าง Env: "U12345,U67890" -> แปลงเป็น ["U12345", "U67890"]
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '')
  .split(',')
  .map((id) => id.trim()) // ตัดช่องว่างหน้าหลังออกกันพลาด
  .filter((id) => id.length > 0); // ตัดค่าว่างทิ้ง

const app: Application = express();

// --- 🚀 ROUTE: Webhook ---
app.post('/webhook', line.middleware(config), async (req: Request, res: Response) => {
  try {
    const events: line.WebhookEvent[] = req.body.events;
    if (events.length > 0) {
      await Promise.all(events.map((event) => handleEvent(event)));
    }
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).end();
  }
});

// --- 🧠 EVENT HANDLER ---
async function handleEvent(event: line.WebhookEvent) {
  // 1. 🛡️ Security Check: ตรวจสอบสิทธิ์ผู้ใช้
  const userId = event.source.userId;
  if (!userId || (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId))) {
    console.warn(`Blocked unauthorized access from: ${userId}`);
    // (Optional) อาจจะตอบกลับไปว่า "คุณไม่มีสิทธิ์ใช้งาน" ก็ได้ แต่แนะนำให้เงียบไว้ดีกว่า
    return Promise.resolve(null);
  }

  // 2. จัดการข้อความ
  if (event.type === 'message') {
    // 📸 กรณีส่งรูปภาพ (วิเคราะห์แคลอรี่)
    if (event.message.type === 'image') {
      try {
        // แจ้งเตือน Loading (ถ้าทำได้) หรือปล่อยให้ User รอสักครู่
        const imageBuffer = await lineService.getContent(event.message.id);
        const result = await aiService.analyzeFoodImage(imageBuffer);
        await lineService.replyFoodResult(event.replyToken, result);
      } catch (error) {
        console.error('AI Error:', error);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ กรุณาลองใหม่อีกครั้ง',
        });
      }
    }

    // 📝 กรณีส่งข้อความ (คำสั่งบันทึก)
    // รูปแบบ: "บันทึก: ชื่อเมนู (xxx kcal) - MealType"
    else if (event.message.type === 'text') {
      const text = event.message.text;

      if (text.startsWith('บันทึก:')) {
        await handleSaveCommand(userId, event.replyToken, text);
      }
    }
  }
}

// --- 💾 DATABASE LOGIC (Supabase) ---
async function handleSaveCommand(userId: string, replyToken: string, text: string) {
  // Regex แกะข้อความ: "บันทึก: ข้าวมันไก่ (600 kcal) - Lunch"
  const regex = /บันทึก:\s*(.+?)\s*\((\d+)\s*kcal\)\s*-\s*(.+)/;
  const match = text.match(regex);

  const client = new line.Client(config);

  if (match) {
    const foodName = match[1];
    const calories = parseInt(match[2]);
    const mealType = match[3]; // Breakfast, Lunch, etc.

    try {
      // Insert ลง Supabase
      const { error } = await supabase.from('KoomCal_FoodLogs').insert([
        {
          user_id: userId,
          food_name: foodName,
          calories: calories,
          meal_type: mealType,
          // created_at จะ auto generate เอง
        },
      ]);

      if (error) throw error;

      // ตอบกลับความสำเร็จ
      await client.replyMessage(replyToken, {
        type: 'text',
        text: `✅ บันทึกเรียบร้อย!\n🍽️ ${foodName}\n🔥 ${calories} kcal\n📅 มื้อ: ${mealType}`,
      });

    } catch (err: any) {
      console.error('Supabase Error:', err);
      await client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ บันทึกข้อมูลไม่สำเร็จ: ' + err.message,
      });
    }
  } else {
    // กรณี Format ผิด (เช่น User พิมพ์เองแล้วผิดรูปแบบ)
    await client.replyMessage(replyToken, {
      type: 'text',
      text: '⚠️ รูปแบบข้อมูลไม่ถูกต้อง',
    });
  }
}

// --- 🔌 SERVER SETUP (For Vercel & Local) ---
const client = new line.Client(config);
const port = process.env.PORT || 3000;

// ถ้ามี Env VERCEL แปลว่ารันบน Cloud ให้ Export app
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // ถ้ารัน Local ให้ listen port เอง
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Allowed Users: ${ALLOWED_USER_IDS.length > 0 ? ALLOWED_USER_IDS.join(', ') : 'ALL (No whitelist)'}`);
  });
}