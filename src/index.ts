// ... (Imports เหมือนเดิม) ...
// อย่าลืม import { MAIN_QUICK_REPLY } from './services/line.service';
import express, { Application, Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import * as aiService from './services/ai.service';
import * as lineService from './services/line.service';
import * as userService from './services/user.service';
import { MAIN_QUICK_REPLY } from './services/line.service'; 
import dotenv from 'dotenv';
import path from 'path'; 

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const supabase = createClient( process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '' );
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
const LIFF_URL = `https://liff.line.me/${process.env.LIFF_ID}`;

const getThaiDate = () => { const date = new Date(); date.setHours(date.getHours() + 7); return date; };

const app: Application = express();
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => { res.send('🤖 KoomCal Bot Ready!'); });

app.post('/webhook', line.middleware(config as line.MiddlewareConfig), async (req, res) => {
  try {
    const events: line.WebhookEvent[] = req.body.events;
    if (events.length > 0) { await Promise.all(events.map(handleEvent)); }
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).end();
  }
});

app.use(express.json());
app.get('/api/liff-id', (req, res) => { res.json({ liffId: process.env.LIFF_ID }); });
app.post('/api/register-liff', async (req, res) => {
  const { userId, weight, height, age, gender, activity, goal } = req.body;
  try {
    const tdee = await userService.registerUser(userId, weight, height, age, gender, activity, goal);
    const client = new line.Client(config as line.ClientConfig);
    let goalText = 'รักษาน้ำหนัก';
    if (goal === 'lose_weight') goalText = 'ลดน้ำหนัก';
    else if (goal === 'muscle_gain') goalText = 'สร้างกล้ามเนื้อ';
    await client.pushMessage(userId, {
        type: 'text',
        text: `✅ ลงทะเบียนสำเร็จ!\n🎯 เป้าหมาย: ${goalText}\n🔥 TDEE แนะนำ: ${tdee} kcal/วัน\n\nเริ่มใช้งานโดยการถ่ายรูปอาหาร หรือพิมพ์เมนูได้เลยครับ!`,
        quickReply: MAIN_QUICK_REPLY
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

async function handleEvent(event: line.WebhookEvent) {
  const userId = event.source.userId;
  if (!userId || (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId))) return Promise.resolve(null);
  const client = new line.Client(config as line.ClientConfig);

  if (event.type === 'follow') {
    const isRegistered = await userService.checkUserExists(userId);
    if (!isRegistered) {
      await client.replyMessage(event.replyToken, {
        type: 'flex', altText: 'กรุณาลงทะเบียนใช้งาน',
        contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [ { type: "text", text: "ยินดีต้อนรับสู่ KoomCal", weight: "bold", size: "xl" }, { type: "text", text: "กรุณาลงทะเบียนเพื่อเริ่มใช้งาน", margin: "md", size: "sm" } ] }, footer: { type: "box", layout: "vertical", contents: [{ type: "button", style: "primary", color: "#111827", action: { type: "uri", label: "📝 ลงทะเบียนใช้งาน", uri: LIFF_URL } }] } }
      });
    } else {
      await client.replyMessage(event.replyToken, { type: 'text', text: 'ยินดีต้อนรับกลับครับ! 🥗', quickReply: MAIN_QUICK_REPLY });
    }
  }
  else if (event.type === 'message') {
    const isRegistered = await userService.checkUserExists(userId);
    if (!isRegistered) {
      await client.replyMessage(event.replyToken, { type: 'flex', altText: 'กรุณาลงทะเบียน', contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "⛔️ กรุณาลงทะเบียนก่อน", weight: "bold", color: "#EF4444" }] }, footer: { type: "box", layout: "vertical", contents: [{ type: "button", style: "primary", color: "#111827", action: { type: "uri", label: "📝 ลงทะเบียนตอนนี้", uri: LIFF_URL } }] } } });
      return;
    }

    if (event.message.type === 'image') {
      try {
        const imageBuffer = await lineService.getContent(event.message.id);
        const result = await aiService.analyzeFoodImage(imageBuffer);
        await lineService.replyFoodResult(event.replyToken, result);
      } catch (error: any) {
        console.error('Image Analysis Error:', error);
        
        // 🔥 LOG ERROR DETAIL: เพื่อดูว่า LINE ตอบกลับว่าอะไร (Invalid reply token หรือ Flex ผิด)
        if (error.originalError && error.originalError.response) {
            console.error('LINE API Response:', JSON.stringify(error.originalError.response.data));
        }

        // ถ้า Error 400 (Bad Request) มักจะเป็นเพราะ Token หมดอายุ -> ไม่ต้องส่งซ้ำ
        if (error.statusCode !== 400 && (!error.originalError || error.originalError.response?.status !== 400)) {
             try {
                await client.replyMessage(event.replyToken, { type: 'text', text: '❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ', quickReply: MAIN_QUICK_REPLY });
             } catch (e) { console.error('Failed to send error message'); }
        }
      }
    }
    // (ส่วน Text Message อื่นๆ เหมือนเดิม - ตัดออกเพื่อความกระชับ)
    else if (event.message.type === 'text') {
        const text = event.message.text.trim();
        // ... (Logic เดิม) ...
        // เพื่อให้ไฟล์ไม่ยาวเกินไป ผมขอละส่วน Text Logic ไว้ (ใช้ Logic เดิมได้เลย)
        // เพียงแค่เปลี่ยนการเรียก handleSaveCommand ให้ใช้ quickReply
        if (text === 'สรุปแคล') { /* ... */ } // Logic เดิม
        else if (text.startsWith('บันทึก:')) { await handleSaveCommand(client, userId, event.replyToken, text); }
        else if (text.startsWith('เมนู')) { /* ... Logic แนะนำเมนู ... */ }
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
      await client.replyMessage(replyToken, { type: 'text', text: `✅ บันทึกเรียบร้อย!\n🍽️ ${foodName}\n🔥 ${calories} kcal\n📅 มื้อ: ${mealType}`, quickReply: MAIN_QUICK_REPLY });
    } catch (err: any) {
       // Error here
    }
  }
}

const port = process.env.PORT || 3000;
if (process.env.VERCEL) module.exports = app;
else app.listen(port, () => console.log(`Server running on port ${port}`));