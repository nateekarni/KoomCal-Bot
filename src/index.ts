import express, { Application, Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import * as aiService from './services/ai.service';
import * as lineService from './services/line.service';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

const app: Application = express();

// ✅ 1. เพิ่ม Health Check Route (หน้าแรก)
// ถ้าเข้าเว็บผ่าน Browser ต้องเจอหน้านี้
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('🤖 KoomCal Bot is running! (Ready to accept LINE webhook)');
});

// ✅ 2. Webhook Route (สำหรับ LINE)
// สังเกตว่าเราใช้ config as ... เพื่อแก้ Error TS
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

async function handleEvent(event: line.WebhookEvent) {
  const userId = event.source.userId;
  if (!userId || (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId))) {
    return Promise.resolve(null);
  }

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
        await handleSaveCommand(client, userId, event.replyToken, text);
      }
    }
  }
}

async function handleSaveCommand(client: line.Client, userId: string, replyToken: string, text: string) {
  const regex = /บันทึก:\s*(.+?)\s*\((\d+)\s*kcal\)\s*-\s*(.+)/;
  const match = text.match(regex);

  if (match) {
    const foodName = match[1];
    const calories = parseInt(match[2]);
    const mealType = match[3];

    try {
      const { error } = await supabase.from('KoomCal_FoodLogs').insert([
        { user_id: userId, food_name: foodName, calories: calories, meal_type: mealType },
      ]);
      if (error) throw error;
      await client.replyMessage(replyToken, {
        type: 'text',
        text: `✅ บันทึกเรียบร้อย!\n🍽️ ${foodName}\n🔥 ${calories} kcal\n📅 มื้อ: ${mealType}`,
      });
    } catch (err: any) {
      console.error('Supabase Error:', err);
      await client.replyMessage(replyToken, { type: 'text', text: '❌ บันทึกไม่สำเร็จ: ' + err.message });
    }
  } else {
    await client.replyMessage(replyToken, { type: 'text', text: '⚠️ รูปแบบข้อมูลไม่ถูกต้อง' });
  }
}

// ✅ 3. Export App ให้ Vercel เข้าใจ
const port = process.env.PORT || 3000;
// ถ้าเป็น Vercel ไม่ต้องสั่ง app.listen เอง ให้ export ไปเลย
if (process.env.VERCEL) {
    // สำคัญ: ต้องใช้ module.exports สำหรับ Vercel Node.js runtime
    module.exports = app;
} else {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}