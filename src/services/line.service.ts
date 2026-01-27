import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
});

export const replyFoodResult = async (replyToken: string, data: any) => {
  // ✅ 1. ระบุ Type ให้ชัดเจนว่าเป็น FlexBox
  const itemRows: line.FlexComponent[] = data.items.map((item: any) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `▪️ ${item.name}`, size: "sm", flex: 4, wrap: true, color: "#555555" } as line.FlexText,
      { type: "text", text: `${item.calories}`, size: "sm", flex: 1, align: "end", weight: "bold", color: "#111111" } as line.FlexText
    ],
    margin: "sm"
  }));

  // ✅ 2. ระบุ Return Type ว่าฟังก์ชันนี้คืนค่าเป็น FlexButton
  const createMealButton = (label: string, icon: string, mealType: string, color: string): line.FlexButton => ({
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
          { type: "text", text: "🛒 ผลวิเคราะห์สินค้า", weight: "bold", size: "lg", color: "#1DB446" } as line.FlexText,
          { type: "separator", margin: "md" } as line.FlexSeparator,
          { 
            type: "box", 
            layout: "vertical", 
            margin: "md", 
            spacing: "xs",
            contents: itemRows 
          } as line.FlexBox,
          { type: "separator", margin: "md" } as line.FlexSeparator,
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              { type: "text", text: "รวมทั้งหมด", weight: "bold", size: "md", color: "#888888" } as line.FlexText,
              { type: "text", text: `${data.total_calories} kcal`, weight: "bold", size: "xl", color: "#FF6B6E", align: "end" } as line.FlexText
            ]
          } as line.FlexBox
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "เลือกมื้อที่จะบันทึก 👇", size: "xs", color: "#aaaaaa", align: "center" } as line.FlexText,
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("เช้า", "🍳", "Breakfast", "#F59E0B"),
              createMealButton("เที่ยง", "☀️", "Lunch", "#EF4444")
            ]
          } as line.FlexBox,
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("เย็น", "🌙", "Dinner", "#3B82F6"),
              createMealButton("ของว่าง", "🍿", "Snack", "#8B5CF6")
            ]
          } as line.FlexBox
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