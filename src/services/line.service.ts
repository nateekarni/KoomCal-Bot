import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();

// สร้าง Client แยกในนี้เพื่อให้ service เรียกใช้ได้สะดวก
const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
});

export const replyFoodResult = async (replyToken: string, data: any) => {
  const itemRows = data.items.map((item: any) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `▪️ ${item.name}`, size: "sm", flex: 4, wrap: true, color: "#555555" },
      { type: "text", text: `${item.calories}`, size: "sm", flex: 1, align: "end", weight: "bold", color: "#111111" }
    ],
    margin: "sm"
  }));

  const createMealButton = (label: string, icon: string, mealType: string, color: string) => ({
    type: "button",
    style: "secondary",
    height: "sm",
    color: color,
    action: {
      type: "message",
      label: `${icon} ${label}`,
      text: `บันทึก: ${data.summary_name} (${data.total_calories} kcal) - ${mealType}`
    },
    flex: 1,
    margin: "xs"
  });

  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: `AI วิเคราะห์: ${data.total_calories} kcal`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🛒 ผลวิเคราะห์สินค้า", weight: "bold", size: "lg", color: "#1DB446" },
          { type: "separator", margin: "md" },
          { 
            type: "box", 
            layout: "vertical", 
            margin: "md", 
            spacing: "xs",
            contents: itemRows 
          },
          { type: "separator", margin: "md" },
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
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "เลือกมื้อที่จะบันทึก 👇", size: "xs", color: "#aaaaaa", align: "center" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("เช้า", "🍳", "Breakfast", "#F59E0B"),
              createMealButton("เที่ยง", "☀️", "Lunch", "#EF4444")
            ]
          },
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

export const getContent = async (messageId: string): Promise<Buffer> => {
    const stream = await client.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
};