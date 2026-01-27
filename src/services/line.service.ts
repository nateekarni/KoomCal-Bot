const line = require('@line/bot-sdk');
require('dotenv').config();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

exports.replyFoodResult = async (replyToken, data) => {
  // 1. สร้างรายการสินค้า (เหมือนเดิม)
  const itemRows = data.items.map(item => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `▪️ ${item.name}`, size: "sm", flex: 4, wrap: true, color: "#555555" },
      { type: "text", text: `${item.calories}`, size: "sm", flex: 1, align: "end", weight: "bold", color: "#111111" }
    ],
    margin: "sm"
  }));

  // 2. 🌟 ส่วนที่เพิ่ม: สร้างปุ่มเลือกมื้ออาหาร (Helper Function)
  // ปุ่มนี้จะส่งข้อความว่า "บันทึก: [ชื่อเมนู] ([แคล] kcal) - [มื้อ]" กลับมา
  const createMealButton = (label, icon, mealType, color) => ({
    type: "button",
    style: "secondary", // ใช้แบบ secondary จะได้ดูไม่รก
    height: "sm",
    color: color,
    action: {
      type: "message",
      label: `${icon} ${label}`,
      // Text ที่ส่งกลับมาต้องตรงกับ Regex ที่ Controller รอรับ
      text: `บันทึก: ${data.summary_name} (${data.total_calories} kcal) - ${mealType}`
    },
    flex: 1,
    margin: "xs"
  });

  // 3. ประกอบ Flex Message
  const flexMsg = {
    type: "flex",
    altText: `AI วิเคราะห์: ${data.total_calories} kcal`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          // Header
          { type: "text", text: "🛒 ผลวิเคราะห์สินค้า", weight: "bold", size: "lg", color: "#1DB446" },
          { type: "separator", margin: "md" },
          
          // List รายการ
          { 
            type: "box", 
            layout: "vertical", 
            margin: "md", 
            spacing: "xs",
            contents: itemRows 
          },
          
          { type: "separator", margin: "md" },
          
          // Total Summary
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              { type: "text", text: "รวมทั้งหมด", weight: "bold", size: "md", color: "#888888" },
              { type: "text", text: `${data.total_calories} kcal`, weight: "bold", size: "xl", color: "#FF6B6E", align: "end" }
            ]
          }
        ]
      },
      // 🌟 Footer ใหม่: ปุ่มเลือกมื้อ
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "เลือกมื้อที่จะบันทึก 👇", size: "xs", color: "#aaaaaa", align: "center" },
          // แถวที่ 1: เช้า - เที่ยง
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("เช้า", "🍳", "Breakfast", "#F59E0B"),
              createMealButton("เที่ยง", "☀️", "Lunch", "#EF4444")
            ]
          },
          // แถวที่ 2: เย็น - ของว่าง
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("เย็น", "🌙", "Dinner", "#3B82F6"),
              createMealButton("ของว่าง", "🍿", "Snack", "#8B5CF6")
            ]
          }
        ]
      }
    }
  };

  await client.replyMessage(replyToken, flexMsg);
};

exports.getContent = async (messageId) => {
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};