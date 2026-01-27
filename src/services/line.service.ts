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
    for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
};

// 1. ตอบกลับผลวิเคราะห์รูป (มีปุ่มเลือกมื้อ)
export const replyFoodResult = async (replyToken: string, data: any) => {
  const itemRows: line.FlexComponent[] = data.items.map((item: any) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `▪️ ${item.name}`, size: "sm", flex: 4, wrap: true, color: "#555555" } as line.FlexText,
      { type: "text", text: `${item.calories}`, size: "sm", flex: 1, align: "end", weight: "bold", color: "#111111" } as line.FlexText
    ],
    margin: "sm"
  }));

  const createMealButton = (label: string, icon: string, mealType: string, color: string): line.FlexButton => ({
    type: "button", style: "secondary", height: "sm", color: color,
    action: {
      type: "message",
      label: `${icon} ${label}`,
      text: `บันทึก: ${data.summary_name} (${data.total_calories} kcal) - ${mealType}`
    },
    flex: 1, margin: "xs"
  });

  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: `AI วิเคราะห์: ${data.total_calories} kcal`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical",
        contents: [
          { type: "text", text: "🛒 ผลวิเคราะห์สินค้า", weight: "bold", size: "lg", color: "#1DB446" } as line.FlexText,
          { type: "separator", margin: "md" } as line.FlexSeparator,
          { type: "box", layout: "vertical", margin: "md", spacing: "xs", contents: itemRows } as line.FlexBox,
          { type: "separator", margin: "md" } as line.FlexSeparator,
          {
            type: "box", layout: "horizontal", margin: "md",
            contents: [
              { type: "text", text: "รวมทั้งหมด", weight: "bold", size: "md", color: "#888888" } as line.FlexText,
              { type: "text", text: `${data.total_calories} kcal`, weight: "bold", size: "xl", color: "#FF6B6E", align: "end" } as line.FlexText
            ]
          } as line.FlexBox
        ]
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: "เลือกมื้อที่จะบันทึก 👇", size: "xs", color: "#aaaaaa", align: "center" } as line.FlexText,
          {
            type: "box", layout: "horizontal",
            contents: [ createMealButton("เช้า", "🍳", "Breakfast", "#F59E0B"), createMealButton("เที่ยง", "☀️", "Lunch", "#EF4444") ]
          } as line.FlexBox,
          {
            type: "box", layout: "horizontal",
            contents: [ createMealButton("เย็น", "🌙", "Dinner", "#3B82F6"), createMealButton("ของว่าง", "🍿", "Snack", "#8B5CF6") ]
          } as line.FlexBox
        ]
      }
    }
  };
  await client.replyMessage(replyToken, flexMsg);
};

// 2. ตอบกลับสรุปรายวัน (ใบเสร็จ)
export const replyDailySummary = async (replyToken: string, logs: any[], totalCal: number, tdee: number) => {
  const rows: line.FlexComponent[] = logs.map((log) => ({
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: log.food_name, size: "sm", color: "#555555", flex: 4 } as line.FlexText,
      { type: "text", text: `${log.calories}`, size: "sm", color: "#111111", align: "end", flex: 1 } as line.FlexText
    ],
    margin: "xs"
  }));

  const remaining = tdee - totalCal;
  const statusColor = remaining < 0 ? "#EF4444" : "#1DB446";

  const flexMsg: line.FlexMessage = {
    type: "flex", altText: "สรุปแคลอรี่วันนี้",
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical",
        contents: [
          { type: "text", text: "📊 สรุปแคลอรี่วันนี้", weight: "bold", size: "lg" } as line.FlexText,
          { type: "text", text: new Date().toLocaleDateString('th-TH'), size: "xs", color: "#aaaaaa" } as line.FlexText,
          { type: "separator", margin: "md" } as line.FlexSeparator,
          { type: "box", layout: "vertical", margin: "md", contents: rows.length > 0 ? rows : [{ type: "text", text: "ยังไม่มีรายการวันนี้", size: "sm", color: "#cccccc", align: "center" } as line.FlexText] } as line.FlexBox,
          { type: "separator", margin: "md" } as line.FlexSeparator,
          {
            type: "box", layout: "vertical", margin: "md", spacing: "sm",
            contents: [
              { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เป้าหมาย (TDEE)", size: "sm", color: "#aaaaaa" } as line.FlexText, { type: "text", text: `${tdee}`, size: "sm", align: "end" } as line.FlexText] } as line.FlexBox,
              { type: "box", layout: "horizontal", contents: [{ type: "text", text: "กินไปแล้ว", size: "sm", color: "#aaaaaa" } as line.FlexText, { type: "text", text: `${totalCal}`, size: "sm", align: "end", weight: "bold" } as line.FlexText] } as line.FlexBox,
              { type: "separator", margin: "sm" } as line.FlexSeparator,
              { type: "box", layout: "horizontal", contents: [{ type: "text", text: remaining < 0 ? "เกินโควต้า" : "คงเหลือ", weight: "bold", color: statusColor } as line.FlexText, { type: "text", text: `${Math.abs(remaining)}`, weight: "bold", size: "xl", color: statusColor, align: "end" } as line.FlexText] } as line.FlexBox
            ]
          } as line.FlexBox
        ]
      }
    }
  };
  await client.replyMessage(replyToken, flexMsg);
};

// 3. ตอบกลับเมนูแนะนำ (Carousel + Link วิธีทำ)
export const replyMenuRecommendation = async (replyToken: string, data: any, category: string) => {
  const bubbles: line.FlexBubble[] = data.recommendations.map((item: any) => {
    const buttons: line.FlexComponent[] = [];
    buttons.push({
      type: "button", style: "primary", height: "sm", color: "#1DB446",
      action: { type: "message", label: "✅ เลือกเมนูนี้", text: `บันทึก: ${item.menu_name} (${item.calories} kcal) - ${category}` }
    });

    if (category === 'Home Cooked') {
      const searchUrl = `https://www.google.com/search?q=วิธีทำ+${encodeURIComponent(item.menu_name)}`;
      buttons.push({
        type: "button", style: "link", height: "sm", margin: "sm",
        action: { type: "uri", label: "📖 ดูวัตถุดิบ/วิธีทำ", uri: searchUrl }
      });
    }

    return {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical",
        backgroundColor: category === '7-11' ? "#007C36" : (category === 'Street Food' ? "#F97316" : "#0EA5E9"),
        contents: [{ type: "text", text: category === 'Home Cooked' ? '👩‍🍳 เมนูทำเองง่ายๆ' : category, color: "#ffffff", weight: "bold", size: "xs" } as line.FlexText]
      },
      body: {
        type: "box", layout: "vertical",
        contents: [
          { type: "text", text: item.menu_name, weight: "bold", size: "md", wrap: true } as line.FlexText,
          { type: "text", text: `🔥 ~${item.calories} kcal`, color: "#ff6b6e", size: "sm", margin: "xs" } as line.FlexText,
          { type: "text", text: item.description, size: "xs", color: "#aaaaaa", wrap: true, margin: "md" } as line.FlexText
        ]
      },
      footer: { type: "box", layout: "vertical", contents: buttons }
    };
  });

  await client.replyMessage(replyToken, {
    type: "flex", altText: `แนะนำเมนู ${category}`,
    contents: { type: "carousel", contents: bubbles }
  });
};