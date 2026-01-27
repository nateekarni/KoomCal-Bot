const express = require('express');
const line = require('@line/bot-sdk');
const aiService = require('./services/ai.service');
const lineService = require('./services/line.service');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// LINE Middleware
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    if (events.length > 0) {
      await Promise.all(events.map(handleEvent));
    }
    res.status(200).json({});
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type === 'message') {
    // 📸 กรณีส่งรูป (หลายชิ้นก็รับได้)
    if (event.message.type === 'image') {
      // 1. ดึงรูป
      const imageBuffer = await lineService.getContent(event.message.id);
      
      // 2. ส่ง AI (Prompt แบบ Multi-item)
      const result = await aiService.analyzeFoodImage(imageBuffer);
      
      // 3. ตอบกลับเป็น List
      await lineService.replyFoodResult(event.replyToken, result);
    }
    
    // 📝 กรณีส่งข้อความบันทึก (Logic เดิมแต่ต่อ Supabase)
    else if (event.message.type === 'text' && event.message.text.startsWith('บันทึก:')) {
       // ... (เขียน Logic บันทึกลง KoomCal_FoodLogs ที่นี่) ...
    }
  }
}

const port = process.env.PORT || 3000;

// ตรวจสอบว่ารันบน Vercel หรือไม่
if (process.env.VERCEL) {
    module.exports = app; // ส่งไม้ต่อให้ Vercel จัดการ
} else {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}