import express, { Application, Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import * as aiService from './services/ai.service';
import * as lineService from './services/line.service';
import dotenv from 'dotenv';

dotenv.config();

// --- CONFIG ---
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '')
  .split(',').map((id) => id.trim()).filter((id) => id.length > 0);

const getThaiDate = () => {
  const date = new Date();
  date.setHours(date.getHours() + 7);
  return date;
};

const app: Application = express();

// --- ROUTES ---
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('🤖 KoomCal Bot is running! (Ready to accept LINE webhook)');
});

app.post('/webhook', line.middleware(config as line.MiddlewareConfig), async (req: Request, res: Response) => {
  try {
    const events: line.WebhookEvent[] = req.body.events;
    if (events.length > 0) await Promise.all(events.map((event) => handleEvent(event)));
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).end();
  }
});

// --- EVENT HANDLER ---
async function handleEvent(event: line.WebhookEvent) {
  const userId = event.source.userId;
  if (!userId || (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId))) return Promise.resolve(null);

  const client = new line.Client(config as line.ClientConfig);

  if (event.type === 'message') {
    // 📸 1. Handle Image
    if (event.message.type === 'image') {
      try {
        const imageBuffer = await lineService.getContent(event.message.id);
        const result = await aiService.analyzeFoodImage(imageBuffer);
        await lineService.replyFoodResult(event.replyToken, result);
      } catch (error) {
        console.error('AI Error:', error);
        await client.replyMessage(event.replyToken, { type: 'text', text: '❌ วิเคราะห์รูปภาพไม่สำเร็จ กรุณาลองใหม่' });
      }
    }

    // 📝 2. Handle Text
    else if (event.message.type === 'text') {
      const text = event.message.text.trim();
      const isMenuRequest = text.startsWith('เมนู 7-11') || text.startsWith('เมนูตามสั่ง') || text.startsWith('เมนูทำเอง');

      // --- Case A: ขอเมนู ---
      if (isMenuRequest) {
        // Setup Date Range (Today & Past 3 Days)
        const today = getThaiDate().toISOString().split('T')[0];
        const startOfDay = new Date(today); startOfDay.setHours(startOfDay.getHours() - 7);
        const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);

        const pastDate = new Date(); pastDate.setDate(pastDate.getDate() - 3);

        // Fetch Data
        const { data: userData } = await supabase.from('KoomCal_Users').select('tdee').eq('user_id', userId).single();
        const tdee = userData?.tdee || 2000;

        const { data: todayLogs } = await supabase.from('KoomCal_FoodLogs').select('calories').eq('user_id', userId).gte('created_at', startOfDay.toISOString()).lt('created_at', endOfDay.toISOString());
        const { data: recentLogs } = await supabase.from('KoomCal_FoodLogs').select('food_name').eq('user_id', userId).gte('created_at', pastDate.toISOString());

        const consumed = todayLogs?.reduce((sum, item) => sum + item.calories, 0) || 0;
        let budget = tdee - consumed;
        if (budget <= 0) budget = 200;

        const recentMenuNames = [...new Set(recentLogs?.map(log => log.food_name) || [])];

        // Determine Meal Type (Text > Time)
        let mealType = '';
        if (text.includes('เช้า')) mealType = 'Breakfast';
        else if (text.includes('เที่ยง') || text.includes('กลางวัน')) mealType = 'Lunch';
        else if (text.includes('เย็น') || text.includes('ค่ำ')) mealType = 'Dinner';
        else if (text.includes('ว่าง')) mealType = 'Snack';
        else {
          const currentHour = getThaiDate().getHours();
          if (currentHour < 11) mealType = 'Breakfast';
          else if (currentHour < 15) mealType = 'Lunch';
          else mealType = 'Dinner';
        }

        let category = 'Street Food';
        if (text.startsWith('เมนู 7-11')) category = '7-11';
        else if (text.startsWith('เมนูทำเอง')) category = 'Home Cooked';

        try {
            const recommendations = await aiService.generateMenuRecommendation(category, mealType, budget, recentMenuNames);
            await lineService.replyMenuRecommendation(event.replyToken, recommendations, category);
        } catch (e) {
            console.error(e);
            await client.replyMessage(event.replyToken, { type: 'text', text: '❌ ระบบคิดเมนูขัดข้อง' });
        }
      }

      // --- Case B: สรุปแคล ---
      else if (text === 'สรุปแคล') {
        const today = getThaiDate().toISOString().split('T')[0];
        const startOfDay = new Date(today); startOfDay.setHours(startOfDay.getHours() - 7);
        const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);

        const { data: userData } = await supabase.from('KoomCal_Users').select('tdee').eq('user_id', userId).single();
        const tdee = userData?.tdee || 2000;

        const { data: logs } = await supabase.from('KoomCal_FoodLogs').select('food_name, calories').eq('user_id', userId).gte('created_at', startOfDay.toISOString()).lt('created_at', endOfDay.toISOString());

        const totalCal = logs?.reduce((sum, item) => sum + item.calories, 0) || 0;
        await lineService.replyDailySummary(event.replyToken, logs || [], totalCal, tdee);
      }

      // --- Case C: บันทึก ---
      else if (text.startsWith('บันทึก:')) {
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
      const { error } = await supabase.from('KoomCal_FoodLogs').insert([{ user_id: userId, food_name: foodName, calories: calories, meal_type: mealType }]);
      if (error) throw error;
      await client.replyMessage(replyToken, { type: 'text', text: `✅ บันทึกเรียบร้อย!\n🍽️ ${foodName}\n🔥 ${calories} kcal\n📅 มื้อ: ${mealType}` });
    } catch (err: any) {
      console.error('Supabase Error:', err);
      await client.replyMessage(replyToken, { type: 'text', text: '❌ บันทึกไม่สำเร็จ: ' + err.message });
    }
  } else {
    await client.replyMessage(replyToken, { type: 'text', text: '⚠️ รูปแบบข้อมูลไม่ถูกต้อง' });
  }
}

// --- SERVER START ---
const port = process.env.PORT || 3000;
if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}