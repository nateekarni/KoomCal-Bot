import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';
dotenv.config();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
});

export const getContent = async (messageId: string): Promise<Buffer> => {
    const stream = await client.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
};

// ✅ 1. Quick Reply (Clean Version) - ลบเว้นวรรคข้างหน้าออกทั้งหมด
export const MAIN_QUICK_REPLY: line.QuickReply = {
  items: [
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/10473/10473491.png",
      action: { type: "camera", label: "ถ่ายรูปอาหาร" }
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/10473/10473357.png",
      action: { type: "message", label: "สรุปแคลวันนี้", text: "สรุปแคล" }
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/15106/15106158.png",
      action: { type: "message", label: "เมนู 7-11", text: "เมนู 7-11" }
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/8209/8209353.png",
      action: { type: "message", label: "เมนูตามสั่ง", text: "เมนูตามสั่ง" }
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/9273/9273847.png",
      action: { type: "message", label: "เมนูทำเอง", text: "เมนูทำเอง" }
    }
  ]
};

// ==========================================================
// 🍽️ 2. Reply Food Analysis Result (Bulletproof Version)
// แก้ไขปุ่มให้ปลอดภัยต่อ API 100%
// ==========================================================
export const replyFoodResult = async (replyToken: string, data: any) => {
  const itemRows: line.FlexComponent[] = data.items.map((item: any) => ({
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: `▪️ ${item.name}`, size: "sm", flex: 4, wrap: true, color: "#09090b" } as line.FlexText,
      { type: "text", text: `${item.calories}`, size: "sm", flex: 1, align: "end", weight: "bold", color: "#71717a" } as line.FlexText
    ], margin: "md"
  }));

  // ✅ แก้ไขปุ่ม: ใช้ style="secondary" โดยไม่กำหนด color (ใช้ Default)
  const createMealButton = (label: string, icon: string, mealType: string): line.FlexButton => ({
    type: "button", 
    style: "secondary", 
    height: "sm", 
    // color: "#f4f4f5", // <-- ลบบรรทัดนี้ออกเพื่อความชัวร์ (บางที LINE API มองว่า Secondary ห้ามใส่สี)
    action: { type: "message", label: `${icon} ${label}`, text: `บันทึก: ${data.summary_name} (${data.total_calories} kcal) - ${mealType}` },
    flex: 1, margin: "xs"
  });

  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: `Analysis: ${data.total_calories} kcal`,
    quickReply: MAIN_QUICK_REPLY, 
    contents: {
      type: "bubble", size: "kilo",
      body: {
        type: "box", layout: "vertical", paddingAll: "xl",
        contents: [
          { type: "box", layout: "vertical", contents: [{ type: "text", text: "Food Analysis", weight: "bold", size: "xl", color: "#09090b" } as line.FlexText, { type: "text", text: "AI Estimation result", size: "xs", color: "#a1a1aa", margin: "xs" } as line.FlexText] } as line.FlexBox,
          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,
          { type: "box", layout: "vertical", margin: "lg", contents: itemRows } as line.FlexBox,
          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,
          { type: "box", layout: "horizontal", margin: "lg", contents: [{ type: "text", text: "Total Calories", size: "sm", color: "#09090b", weight: "bold" } as line.FlexText, { type: "text", text: `${data.total_calories} kcal`, size: "lg", color: "#09090b", align: "end", weight: "bold" } as line.FlexText] } as line.FlexBox
        ]
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "xl", backgroundColor: "#fafafa",
        contents: [
          { type: "text", text: "Save to log", size: "xs", color: "#a1a1aa", align: "center", margin: "none", weight: "bold" } as line.FlexText,
          { type: "spacer", size: "sm" },
          { type: "box", layout: "horizontal", contents: [ createMealButton("Breakfast", "🍳", "Breakfast"), createMealButton("Lunch", "☀️", "Lunch") ] } as line.FlexBox,
          { type: "box", layout: "horizontal", contents: [ createMealButton("Dinner", "🌙", "Dinner"), createMealButton("Snack", "🍿", "Snack") ] } as line.FlexBox
        ]
      },
      styles: { footer: { separator: true } }
    }
  };
  
  await client.replyMessage(replyToken, flexMsg);
};

// ... (ส่วนอื่นๆ replyDailySummary, replyMenuRecommendation เหมือนเดิม) ...
export const replyDailySummary = async (replyToken: string, logs: any[], totalCal: number, tdee: number) => {
  const rows: line.FlexComponent[] = logs.map((log) => ({
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: log.food_name, size: "sm", color: "#09090b", flex: 4, wrap: true } as line.FlexText,
      { type: "text", text: `${log.calories}`, size: "sm", color: "#71717a", align: "end", flex: 1 } as line.FlexText
    ], margin: "md"
  }));
  const remaining = tdee - totalCal;
  const statusColor = remaining < 0 ? "#ef4444" : "#22c55e";
  const flexMsg: line.FlexMessage = {
    type: "flex", altText: "Daily Summary", quickReply: MAIN_QUICK_REPLY,
    contents: {
      type: "bubble", size: "kilo",
      body: {
        type: "box", layout: "vertical", paddingAll: "xl",
        contents: [
          { type: "box", layout: "vertical", contents: [{ type: "text", text: "Daily Log", weight: "bold", size: "xl", color: "#09090b" } as line.FlexText, { type: "text", text: new Date().toLocaleDateString('th-TH', { dateStyle: 'long' }), size: "xs", color: "#a1a1aa", margin: "xs" } as line.FlexText] } as line.FlexBox,
          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,
          { type: "box", layout: "vertical", margin: "lg", contents: rows.length > 0 ? rows : [{ type: "text", text: "No records found today.", size: "sm", color: "#a1a1aa", align: "center", margin: "md" } as line.FlexText] } as line.FlexBox,
          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,
          { type: "box", layout: "vertical", margin: "lg", paddingAll: "lg", backgroundColor: "#f4f4f5", cornerRadius: "md", contents: [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "Target (TDEE)", size: "xs", color: "#71717a" } as line.FlexText, { type: "text", text: `${tdee}`, size: "xs", color: "#09090b", align: "end", weight: "bold" } as line.FlexText] } as line.FlexBox, { type: "box", layout: "horizontal", margin: "sm", contents: [{ type: "text", text: "Consumed", size: "xs", color: "#71717a" } as line.FlexText, { type: "text", text: `${totalCal}`, size: "xs", color: "#09090b", align: "end", weight: "bold" } as line.FlexText] } as line.FlexBox, { type: "separator", margin: "sm", color: "#e4e4e7" } as line.FlexSeparator, { type: "box", layout: "horizontal", margin: "sm", contents: [{ type: "text", text: remaining < 0 ? "Over Limit" : "Remaining", size: "sm", color: statusColor, weight: "bold" } as line.FlexText, { type: "text", text: `${Math.abs(remaining)}`, size: "lg", color: statusColor, align: "end", weight: "bold" } as line.FlexText] } as line.FlexBox] } as line.FlexBox
        ]
      }
    }
  };
  await client.replyMessage(replyToken, flexMsg);
};

export const replyMenuRecommendation = async (replyToken: string, data: any, category: string) => {
  const bubbles: line.FlexBubble[] = data.recommendations.map((item: any) => {
    const buttons: line.FlexComponent[] = [];
    buttons.push({
      type: "button", style: "primary", color: "#09090b", height: "sm",
      action: { type: "message", label: "Select This", text: `บันทึก: ${item.menu_name} (${item.calories} kcal) - ${category}` }
    });
    if (category === 'Home Cooked') {
      const searchUrl = `https://www.google.com/search?q=วิธีทำ+${encodeURIComponent(item.menu_name)}`;
      buttons.push({
        type: "button", style: "secondary", height: "sm", margin: "sm", // color removed
        action: { type: "uri", label: "View Recipe", uri: searchUrl }
      });
    }
    return {
      type: "bubble", size: "kilo",
      body: {
        type: "box", layout: "vertical", paddingAll: "xl",
        contents: [
          { type: "box", layout: "horizontal", contents: [{ type: "text", text: category.toUpperCase(), size: "xxs", color: "#71717a", weight: "bold", align: "start" } as line.FlexText] } as line.FlexBox,
          { type: "text", text: item.menu_name, weight: "bold", size: "lg", color: "#09090b", wrap: true, margin: "sm" } as line.FlexText,
          { type: "text", text: `${item.calories} kcal`, color: "#71717a", size: "sm", margin: "xs" } as line.FlexText,
          { type: "separator", margin: "md", color: "#e4e4e7" } as line.FlexSeparator,
          { type: "text", text: item.description, size: "xs", color: "#a1a1aa", wrap: true, margin: "md", maxLines: 3 } as line.FlexText
        ]
      },
      footer: { type: "box", layout: "vertical", paddingAll: "lg", contents: buttons },
      styles: { footer: { separator: true } }
    };
  });
  await client.replyMessage(replyToken, {
    type: "flex", altText: `Recommended: ${category}`, quickReply: MAIN_QUICK_REPLY,
    contents: { type: "carousel", contents: bubbles }
  });
};