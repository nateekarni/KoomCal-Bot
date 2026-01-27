import * as line from "@line/bot-sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
});

export const getContent = async (messageId: string): Promise<Buffer> => {
  const stream = await client.getMessageContent(messageId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

// ✅ Quick Reply (ภาษาไทย + ครบทุกฟังก์ชัน)
export const MAIN_QUICK_REPLY: line.QuickReply = {
  items: [
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/10473/10473491.png",
      action: { type: "camera", label: "ถ่ายรูปอาหาร" },
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/10473/10473357.png",
      action: { type: "message", label: "สรุปแคลวันนี้", text: "สรุปแคล" },
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/15106/15106158.png",
      action: { type: "message", label: "เมนู 7-11", text: "เมนู 7-11" },
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/8209/8209353.png",
      action: { type: "message", label: "เมนูตามสั่ง", text: "เมนูตามสั่ง" },
    },
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/128/9273/9273847.png",
      action: { type: "message", label: "เมนูทำเอง", text: "เมนูทำเอง" },
    },
    { 
      type: "action", 
      imageUrl: "https://cdn-icons-png.flaticon.com/128/10147/10147504.png", // ไอคอน Setting
      action: { type: "uri", label: "แก้ไขข้อมูล", uri: LIFF_REGISTER_URL } 
    }
  ],
};

// ==========================================================
// 🍽️ 1. ผลวิเคราะห์อาหาร (ภาษาไทย + ไม่มีไอคอนที่ปุ่ม)
// ==========================================================
export const replyFoodResult = async (replyToken: string, data: any) => {
  const itemRows: line.FlexComponent[] = data.items.map((item: any) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: `▪️ ${item.name}`,
        size: "sm",
        flex: 4,
        wrap: true,
        color: "#09090b",
      } as line.FlexText,
      {
        type: "text",
        text: `${item.calories}`,
        size: "sm",
        flex: 1,
        align: "end",
        weight: "bold",
        color: "#71717a",
      } as line.FlexText,
    ],
    margin: "md",
  }));

  // 🚫 แก้ไขปุ่ม: เอา Icon ออก, ใช้ภาษาไทย
  const createMealButton = (
    label: string,
    mealType: string,
  ): line.FlexButton => ({
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "message",
      label: label,
      text: `บันทึก: ${data.summary_name} (${data.total_calories} kcal) - ${mealType}`,
    },
    flex: 1,
    margin: "xs",
  });

  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: `AI วิเคราะห์: ${data.total_calories} kcal`,
    quickReply: MAIN_QUICK_REPLY,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        contents: [
          // Header ไทย
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "ผลวิเคราะห์อาหาร",
                weight: "bold",
                size: "xl",
                color: "#09090b",
              } as line.FlexText,
              {
                type: "text",
                text: "ประเมินโดย AI (โดยประมาณ)",
                size: "xs",
                color: "#a1a1aa",
                margin: "xs",
              } as line.FlexText,
            ],
          } as line.FlexBox,
          {
            type: "separator",
            margin: "lg",
            color: "#e4e4e7",
          } as line.FlexSeparator,
          // List รายการ
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: itemRows,
          } as line.FlexBox,
          {
            type: "separator",
            margin: "lg",
            color: "#e4e4e7",
          } as line.FlexSeparator,
          // Total ไทย
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            contents: [
              {
                type: "text",
                text: "พลังงานรวม",
                size: "sm",
                color: "#09090b",
                weight: "bold",
              } as line.FlexText,
              {
                type: "text",
                text: `${data.total_calories} kcal`,
                size: "lg",
                color: "#09090b",
                align: "end",
                weight: "bold",
              } as line.FlexText,
            ],
          } as line.FlexBox,
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        backgroundColor: "#fafafa",
        contents: [
          {
            type: "text",
            text: "เลือกมื้อที่จะบันทึก",
            size: "xs",
            color: "#a1a1aa",
            align: "center",
            margin: "none",
            weight: "bold",
          } as line.FlexText,
          // ปุ่มไม่มีไอคอน
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              createMealButton("มื้อเช้า", "Breakfast"),
              createMealButton("มื้อกลางวัน", "Lunch"),
            ],
          } as line.FlexBox,
          {
            type: "box",
            layout: "horizontal",
            margin: "sm",
            contents: [
              createMealButton("มื้อเย็น", "Dinner"),
              createMealButton("ของว่าง", "Snack"),
            ],
          } as line.FlexBox,
        ],
      },
      styles: { footer: { separator: true } },
    },
  };

  await client.replyMessage(replyToken, flexMsg);
};

// ==========================================================
// 📊 2. สรุปแคลอรี่รายวัน (ภาษาไทย)
// ==========================================================
export const replyDailySummary = async (
  replyToken: string,
  logs: any[],
  totalCal: number,
  tdee: number,
) => {
  const rows: line.FlexComponent[] = logs.map((log) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: log.food_name,
        size: "sm",
        color: "#09090b",
        flex: 4,
        wrap: true,
      } as line.FlexText,
      {
        type: "text",
        text: `${log.calories}`,
        size: "sm",
        color: "#71717a",
        align: "end",
        flex: 1,
      } as line.FlexText,
    ],
    margin: "md",
  }));
  const remaining = tdee - totalCal;
  const statusColor = remaining < 0 ? "#ef4444" : "#22c55e";

  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: "สรุปแคลอรี่รายวัน",
    quickReply: MAIN_QUICK_REPLY,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "สรุปแคลอรี่รายวัน",
                weight: "bold",
                size: "xl",
                color: "#09090b",
              } as line.FlexText,
              {
                type: "text",
                text: new Date().toLocaleDateString("th-TH", {
                  dateStyle: "long",
                }),
                size: "xs",
                color: "#a1a1aa",
                margin: "xs",
              } as line.FlexText,
            ],
          } as line.FlexBox,
          {
            type: "separator",
            margin: "lg",
            color: "#e4e4e7",
          } as line.FlexSeparator,
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents:
              rows.length > 0
                ? rows
                : [
                    {
                      type: "text",
                      text: "ยังไม่มีรายการวันนี้",
                      size: "sm",
                      color: "#a1a1aa",
                      align: "center",
                      margin: "md",
                    } as line.FlexText,
                  ],
          } as line.FlexBox,
          {
            type: "separator",
            margin: "lg",
            color: "#e4e4e7",
          } as line.FlexSeparator,
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            paddingAll: "lg",
            backgroundColor: "#f4f4f5",
            cornerRadius: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "เป้าหมาย (TDEE)",
                    size: "xs",
                    color: "#71717a",
                  } as line.FlexText,
                  {
                    type: "text",
                    text: `${tdee}`,
                    size: "xs",
                    color: "#09090b",
                    align: "end",
                    weight: "bold",
                  } as line.FlexText,
                ],
              } as line.FlexBox,
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: "กินไปแล้ว",
                    size: "xs",
                    color: "#71717a",
                  } as line.FlexText,
                  {
                    type: "text",
                    text: `${totalCal}`,
                    size: "xs",
                    color: "#09090b",
                    align: "end",
                    weight: "bold",
                  } as line.FlexText,
                ],
              } as line.FlexBox,
              {
                type: "separator",
                margin: "sm",
                color: "#e4e4e7",
              } as line.FlexSeparator,
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: remaining < 0 ? "เกินกำหนด" : "คงเหลือ",
                    size: "sm",
                    color: statusColor,
                    weight: "bold",
                  } as line.FlexText,
                  {
                    type: "text",
                    text: `${Math.abs(remaining)}`,
                    size: "lg",
                    color: statusColor,
                    align: "end",
                    weight: "bold",
                  } as line.FlexText,
                ],
              } as line.FlexBox,
            ],
          } as line.FlexBox,
        ],
      },
    },
  };
  await client.replyMessage(replyToken, flexMsg);
};

// ==========================================================
// 💡 3. แนะนำเมนู (ภาษาไทย)
// ==========================================================
export const replyMenuRecommendation = async (
  replyToken: string,
  data: any,
  category: string,
) => {
  const bubbles: line.FlexBubble[] = data.recommendations.map((item: any) => {
    const buttons: line.FlexComponent[] = [];
    buttons.push({
      type: "button",
      style: "primary",
      color: "#09090b",
      height: "sm",
      action: {
        type: "message",
        label: "เลือกเมนูนี้",
        text: `บันทึก: ${item.menu_name} (${item.calories} kcal) - ${category}`,
      },
    });
    if (category === "Home Cooked") {
      const searchUrl = `https://www.google.com/search?q=วิธีทำ+${encodeURIComponent(item.menu_name)}`;
      buttons.push({
        type: "button",
        style: "secondary",
        height: "sm",
        margin: "sm",
        action: { type: "uri", label: "ดูวิธีทำ", uri: searchUrl },
      });
    }
    return {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: category.toUpperCase(),
                size: "xxs",
                color: "#71717a",
                weight: "bold",
                align: "start",
              } as line.FlexText,
            ],
          } as line.FlexBox,
          {
            type: "text",
            text: item.menu_name,
            weight: "bold",
            size: "lg",
            color: "#09090b",
            wrap: true,
            margin: "sm",
          } as line.FlexText,
          {
            type: "text",
            text: `${item.calories} kcal`,
            color: "#71717a",
            size: "sm",
            margin: "xs",
          } as line.FlexText,
          {
            type: "separator",
            margin: "md",
            color: "#e4e4e7",
          } as line.FlexSeparator,
          {
            type: "text",
            text: item.description,
            size: "xs",
            color: "#a1a1aa",
            wrap: true,
            margin: "md",
            maxLines: 3,
          } as line.FlexText,
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg",
        contents: buttons,
      },
      styles: { footer: { separator: true } },
    };
  });
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: `เมนูแนะนำ: ${category}`,
    quickReply: MAIN_QUICK_REPLY,
    contents: { type: "carousel", contents: bubbles },
  });
};
