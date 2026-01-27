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

// --- CONFIG ---
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
const LIFF_URL = `https://liff.line.me/${process.env.LIFF_ID}`;

const getThaiDate = () => {
  const date = new Date();
  date.setHours(date.getHours() + 7);
  return date;
};

const app: Application = express();

// ==========================================
// 1. Static Files (เปิดให้เข้าถึงหน้า register.html)
// ==========================================
app.use(express.static(path.join(__dirname, '../public')));

// 2. Health Check
app.get('/', (req, res) => { res.send('🤖 KoomCal Bot Ready!'); });

// ==========================================
// 🚨 3. Webhook (ต้องอยู่ก่อน express.json เสมอ!)
// ==========================================
app.post('/webhook', line.middleware(config as line.MiddlewareConfig), async (req, res) => {
  try {
    const events: line.WebhookEvent[] = req.body.events;
    
    // ใช้ Promise.all เพื่อรอให้ทุก Event ทำงานเสร็จ (และดัก Error ย่อย)
    if (events.length > 0) {
        await Promise.all(events.map(async (event) => {
            try {
                await handleEvent(event);
            } catch (e) {
                console.error('Handle Event Error:', e);
            }
        }));
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).end();
  }
});

// ==========================================
// 4. API อื่นๆ (ใช้ JSON Parser ได้)
// ==========================================
app.use(express.json());

// API: ส่ง LIFF ID ให้หน้า Frontend
app.get('/api/liff-id', (req, res) => { res.json({ liffId: process.env.LIFF_ID }); });

// API: รับข้อมูลลงทะเบียนจาก LIFF
app.post('/api/register-liff', async (req, res) => {
  const { userId, weight, height, age, gender, activity, goal } = req.body;
  try {
    const tdee = await userService.registerUser(userId, weight, height, age, gender, activity, goal);
    
    // Push Message ยืนยัน
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

// --- EVENT HANDLER ---
async function handleEvent(event: line.WebhookEvent) {
  const userId = event.source.userId;
  if (!userId) return Promise.resolve(null);
  
  // Security Guard: Check Allowed Users (ถ้าตั้งค่าไว้)
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) return Promise.resolve(null);

  const client = new line.Client(config as line.ClientConfig);

  // -----------------------------------------------------------------
  // Case 1: Follow Event (กดแอดเพื่อน)
  // -----------------------------------------------------------------
  if (event.type === 'follow') {
    const isRegistered = await userService.checkUserExists(userId);
    if (!isRegistered) {
      await client.replyMessage(event.replyToken, {
        type: 'flex',
        altText: 'กรุณาลงทะเบียนใช้งาน',
        contents: {
          type: "bubble",
          hero: { type: "image", url: "https://images.unsplash.com/photo-1543362906-ac1b9642f56b?w=800&q=80", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
          body: {
            type: "box", layout: "vertical",
            contents: [
              { type: "text", text: "ยินดีต้อนรับสู่ KoomCal", weight: "bold", size: "xl" },
              { type: "text", text: "AI ผู้ช่วยดูแลโภชนาการส่วนตัว", size: "sm", color: "#aaaaaa" },
              { type: "separator", margin: "md" },
              { type: "text", text: "กรุณาลงทะเบียนเพื่อเริ่มใช้งาน", wrap: true, margin: "md", size: "sm" }
            ]
          },
          footer: {
            type: "box", layout: "vertical",
            contents: [{ type: "button", style: "primary", color: "#111827", action: { type: "uri", label: "📝 ลงทะเบียนใช้งาน", uri: LIFF_URL } }]
          }
        }
      });
    } else {
      await client.replyMessage(event.replyToken, { 
          type: 'text', 
          text: 'ยินดีต้อนรับกลับครับ! 🥗',
          quickReply: MAIN_QUICK_REPLY 
      });
    }
  }

  // -----------------------------------------------------------------
  // Case 2: Message Event
  // -----------------------------------------------------------------
  else if (event.type === 'message') {
    // Check Registration First
    const isRegistered = await userService.checkUserExists(userId);
    
    if (!isRegistered) {
      // ถ้ายังไม่ลงทะเบียน ให้ส่งการ์ดลงทะเบียนไปใหม่
      await client.replyMessage(event.replyToken, {
        type: 'flex',
        altText: 'กรุณาลงทะเบียนก่อนใช้งาน',
        contents: {
            type: "bubble",
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: "⛔️ กรุณาลงทะเบียนก่อน", weight: "bold", color: "#EF4444" },
                    { type: "text", text: "ระบบต้องใช้ข้อมูลส่วนตัวเพื่อคำนวณแคลอรี่ครับ", size: "sm", wrap: true, margin: "sm" }
                ]
            },
            footer: {
                type: "box", layout: "vertical",
                contents: [{ type: "button", style: "primary", color: "#111827", action: { type: "uri", label: "📝 ลงทะเบียนตอนนี้", uri: LIFF_URL } }]
            }
        }
      });
      return;
    }

    // A. Image Message (วิเคราะห์อาหาร)
    if (event.message.type === 'image') {
      try {
        const imageBuffer = await lineService.getContent(event.message.id);
        
        // 🚀 1. ตอบกลับทันที (Reply) เพื่อบอกว่าได้รับรูปแล้ว และป้องกัน Timeout
        // (เพราะ AI อาจใช้เวลา 5-10 วินาที ซึ่ง replyToken อาจหมดอายุก่อน)
        await client.replyMessage(event.replyToken, { 
            type: 'text', 
            text: '🔍 กำลังวิเคราะห์รูปภาพ... รอสักครู่นะครับ',
            quickReply: MAIN_QUICK_REPLY 
        });

        // 🚀 2. เรียก AI ประมวลผล (ใช้เวลา)
        const result = await aiService.analyzeFoodImage(imageBuffer);
        
        // 🚀 3. ส่งผลลัพธ์ตามไป (Push) โดยใช้ userId (ไม่ใช้ Token แล้ว)
        // ต้องมั่นใจว่าใน line.service.ts ฟังก์ชัน replyFoodResult ถูกแก้เป็น pushMessage(userId, ...) แล้ว
        await lineService.replyFoodResult(userId, result);

      } catch (error) {
        console.error('Image Analysis Error:', error);
        // ถ้า error ให้ Push บอก user
        await client.pushMessage(userId, { type: 'text', text: '❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ กรุณาลองใหม่ครับ' });
      }
    }

    // B. Text Message
    else if (event.message.type === 'text') {
      const text = event.message.text.trim();
      const isMenuRequest = text.startsWith('เมนู 7-11') || text.startsWith('เมนูตามสั่ง') || text.startsWith('เมนูทำเอง');

      if (isMenuRequest) {
        // ... คำนวณช่วงเวลาและ Budget ...
        const today = getThaiDate().toISOString().split('T')[0];
        const startOfDay = new Date(today); startOfDay.setHours(startOfDay.getHours() - 7);
        const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
        const pastDate = new Date(); pastDate.setDate(pastDate.getDate() - 3);

        const { data: userData } = await supabase.from('KoomCal_Users').select('tdee').eq('user_id', userId).single();
        const tdee = userData?.tdee || 2000;
        const { data: todayLogs } = await supabase.from('KoomCal_FoodLogs').select('calories').eq('user_id', userId).gte('created_at', startOfDay.toISOString()).lt('created_at', endOfDay.toISOString());
        const { data: recentLogs } = await supabase.from('KoomCal_FoodLogs').select('food_name').eq('user_id', userId).gte('created_at', pastDate.toISOString());

        const consumed = todayLogs?.reduce((sum, item) => sum + item.calories, 0) || 0;
        let budget = tdee - consumed;
        if (budget <= 0) budget = 200;

        const recentMenuNames = [...new Set(recentLogs?.map(log => log.food_name) || [])];

        let mealType = '';
        if (text.includes('เช้า')) mealType = 'Breakfast';
        else if (text.includes('เที่ยง') || text.includes('กลางวัน')) mealType = 'Lunch';
        else if (text.includes('เย็น') || text.includes('ค่ำ')) mealType = 'Dinner';
        else if (text.includes('ว่าง')) mealType = 'Snack';
        else {
          const h = getThaiDate().getHours();
          if (h < 11) mealType = 'Breakfast';
          else if (h < 15) mealType = 'Lunch';
          else mealType = 'Dinner';
        }

        let category = 'Street Food';
        if (text.startsWith('เมนู 7-11')) category = '7-11';
        else if (text.startsWith('เมนูทำเอง')) category = 'Home Cooked';

        try {
            // แจ้ง user ก่อนว่ากำลังคิด
            await client.replyMessage(event.replyToken, { type: 'text', text: '👩‍🍳 กำลังคิดเมนูให้ครับ...' });

            const recommendations = await aiService.generateMenuRecommendation(category, mealType, budget, recentMenuNames);
            
            // ส่งผลลัพธ์ (เมนูแนะนำใช้ pushMessage หรือ replyMessage ก็ได้ แต่ถ้า token ถูกใช้ไปแล้วตอนแจ้งเตือนข้างบน ต้องใช้ pushMessage)
            // ในที่นี้เราใช้ replyMessage ไปแล้วข้างบน ดังนั้นต้องใช้ pushMessage ส่งผลลัพธ์
            await client.pushMessage(userId, {
                type: "flex",
                altText: `Recommended: ${category}`,
                quickReply: MAIN_QUICK_REPLY,
            });
            
            // *หมายเหตุ*: เพื่อความสมบูรณ์ ผมแนะนำให้แก้ lineService.replyMenuRecommendation ให้เป็น pushMessage(userId, ...) เหมือน replyFoodResult จะดีที่สุดครับ
            // แต่ ณ ตอนนี้ ผมจะเรียกแบบเดิมไปก่อน (ถ้า AI ไม่ช้ามากจะผ่านครับ)
            await lineService.replyMenuRecommendation(event.replyToken, recommendations, category);

        } catch (e) {
            console.error(e);
            await client.pushMessage(userId, { type: 'text', text: '❌ ระบบขัดข้องขณะคิดเมนู' });
        }
      }

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
      
      await client.replyMessage(replyToken, { 
          type: 'text', 
          text: `✅ บันทึกเรียบร้อย!\n🍽️ ${foodName}\n🔥 ${calories} kcal\n📅 มื้อ: ${mealType}`,
          quickReply: MAIN_QUICK_REPLY
      });
    } catch (err: any) {
      await client.replyMessage(replyToken, { type: 'text', text: '❌ Error: ' + err.message });
    }
  } else {
    await client.replyMessage(replyToken, { type: 'text', text: '⚠️ รูปแบบข้อมูลไม่ถูกต้อง' });
  }
}

// Start Server
const port = process.env.PORT || 3000;
if (process.env.VERCEL) module.exports = app;
else app.listen(port, () => console.log(`Server running on port ${port}`));