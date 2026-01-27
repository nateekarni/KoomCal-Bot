import express, { Application, Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import * as aiService from './services/ai.service';
import * as lineService from './services/line.service';
import dotenv from 'dotenv';

dotenv.config();

// --- ⚙️ CONFIGURATION ---
// แก้ไข: สร้าง Config Object แบบธรรมดา (ไม่ต้องระบุ Type เจาะจง เพื่อให้ใช้ได้กับทั้ง Client และ Middleware)
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

// ... (Supabase config เหมือนเดิม)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

// ... (Allowed Users เหมือนเดิม)
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

const app: Application = express();

// --- 🚀 ROUTE: Webhook ---
app.post('/webhook', line.middleware(config as line.MiddlewareConfig), async (req: Request, res: Response) => {
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
  const userId = event.source.userId;
  if (!userId || (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId))) {
    return Promise.resolve(null);
  }

  // 🛠️ สร้าง Client ตรงนี้ โดยใช้ config ตัวเดิม
  // แก้ไข: cast config เป็น ClientConfig เพื่อบอก TS ว่า "ฉันมี Token นะ"
  const client = new line.Client(config as line.ClientConfig);

  if (event.type === 'message') {
    if (event.message.type === 'image') {
      try {
        const imageBuffer = await lineService.getContent(event.message.id);
        const result = await aiService.analyzeFoodImage(imageBuffer);
        await lineService.replyFoodResult(event.replyToken, result);
      } catch (error) {
        console.error('AI Error:', error);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ',
        });
      }
    }
    else if (event.message.type === 'text') {
      const text = event.message.text;
      if (text.startsWith('บันทึก:')) {
        await handleSaveCommand(client, userId, event.replyToken, text); // ส่ง client เข้าไป
      }
    }
  }
}

// --- 💾 DATABASE LOGIC ---
// แก้ไข: รับ client เข้ามาเป็น Parameter
async function handleSaveCommand(client: line.Client, userId: string, replyToken: string, text: string) {
  const regex = /บันทึก:\s*(.+?)\s*\((\d+)\s*kcal\)\s*-\s*(.+)/;
  const match = text.match(regex);

  if (match) {
    const foodName = match[1];
    const calories = parseInt(match[2]);
    const mealType = match[3];

    try {
      const { error } = await supabase.from('KoomCal_FoodLogs').insert([
        {
          user_id: userId,
          food_name: foodName,
          calories: calories,
          meal_type: mealType,
        },
      ]);

      if (error) throw error;

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
    await client.replyMessage(replyToken, {
      type: 'text',
      text: '⚠️ รูปแบบข้อมูลไม่ถูกต้อง',
    });
  }
}

// --- 🔌 SERVER SETUP ---
const port = process.env.PORT || 3000;

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}