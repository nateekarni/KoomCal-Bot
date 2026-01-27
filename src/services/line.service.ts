import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';
dotenv.config();

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
});

// ✅ 1. สร้างปุ่ม Quick Reply กลาง (ชุดคำสั่งขี้เกียจพิมพ์)
export const MAIN_QUICK_REPLY: line.QuickReply = {
  items: [
    // ปุ่ม 1: เปิดกล้องทันที (ไม่ต้องกดเมนู)
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/3687/3687416.png", // ไอคอนกล้อง (Optional)
      action: { type: "camera", label: "📸 ถ่ายรูปอาหาร" }
    },
    // ปุ่ม 2: สรุปแคล
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/2936/2936758.png",
      action: { type: "message", label: "📊 สรุปแคลวันนี้", text: "สรุปแคล" }
    },
    // ปุ่ม 3: เมนู 7-11 (บอทจะรู้อมื้อเอง)
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/3081/3081840.png", // ไอคอนร้านสะดวกซื้อ
      action: { type: "message", label: "🏪 แนะนำ 7-11", text: "เมนู 7-11" }
    },
    // ปุ่ม 4: เมนูตามสั่ง
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/1046/1046751.png", // ไอคอนร้านอาหาร
      action: { type: "message", label: "🍛 แนะนำตามสั่ง", text: "เมนูตามสั่ง" }
    },
    // ปุ่ม 5: เมนูทำเอง
    {
      type: "action",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/1830/1830839.png", // ไอคอนคนทำอาหาร
      action: { type: "message", label: "👩‍🍳 แนะนำทำเอง", text: "เมนูทำเอง" }
    }
  ]
};

export const getContent = async (messageId: string): Promise<Buffer> => {
    const stream = await client.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
};

export const replyFoodResult = async (replyToken: string, data: any) => {
  
  // 1. สร้างรายการสินค้า (Card Content)
  // สไตล์: Clean Row (ชื่อซ้าย, แคลขวา)
  const itemRows: line.FlexComponent[] = data.items.map((item: any) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      // ชื่ออาหาร: สี Zinc-900 (#09090b)
      { 
        type: "text", 
        text: item.name, 
        size: "sm", 
        color: "#09090b", 
        flex: 4, 
        wrap: true 
      } as line.FlexText,
      // แคลอรี่: สี Zinc-500 (#71717a) ดูเป็น Muted Text
      { 
        type: "text", 
        text: `${item.calories}`, 
        size: "sm", 
        color: "#71717a", 
        align: "end", 
        flex: 1 
      } as line.FlexText
    ],
    margin: "md" // เพิ่มระยะห่างให้ดูไม่อึดอัด (Whitespace)
  }));

  // 2. สร้างปุ่มเลือกมื้อ (Card Footer Actions)
  // สไตล์: Shadcn Button Variant="secondary" (พื้นหลังเทาอ่อน, ตัวหนังสือเข้ม)
  const createMealButton = (label: string, icon: string, mealType: string): line.FlexButton => ({
    type: "button",
    style: "secondary", // ใช้ Secondary ของ LINE จะได้พื้นหลังเทาอ่อนๆ ใกล้เคียง Shadcn
    height: "sm",
    color: "#f4f4f5", // Zinc-100 (Background)
    action: {
      type: "message",
      // label ใช้สีเข้มเพื่อให้ตัดกับพื้นหลัง
      label: `${icon} ${label}`,
      text: `บันทึก: ${data.summary_name} (${data.total_calories} kcal) - ${mealType}`
    },
    flex: 1,
    margin: "xs"
  });

  // 3. ประกอบร่าง (Card Container)
  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: `Analysis: ${data.total_calories} kcal`,
    quickReply: MAIN_QUICK_REPLY,
    contents: {
      type: "bubble",
      size: "kilo", // ขนาดกำลังดีเหมือน Card
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl", // Padding รอบด้านให้ดูโปร่ง
        contents: [
          // --- Header ---
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "Food Analysis", weight: "bold", size: "xl", color: "#09090b" } as line.FlexText,
              { type: "text", text: "AI Estimation result", size: "xs", color: "#a1a1aa", margin: "xs" } as line.FlexText // Zinc-400
            ]
          } as line.FlexBox,

          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator, // Zinc-200

          // --- Content (Items List) ---
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: itemRows
          } as line.FlexBox,

          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,

          // --- Total Summary ---
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            contents: [
              { type: "text", text: "Total Calories", size: "sm", color: "#09090b", weight: "bold" } as line.FlexText,
              // ตัวเลขยอดรวม: ใช้สีดำเข้ม (Shadcn จะไม่ค่อยใช้สีฉูดฉาดถ้ายอดไม่น่ากลัว)
              { type: "text", text: `${data.total_calories} kcal`, size: "lg", color: "#09090b", align: "end", weight: "bold" } as line.FlexText
            ]
          } as line.FlexBox
        ]
      },
      // --- Footer (Actions) ---
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        backgroundColor: "#fafafa", // Zinc-50 (พื้นหลัง Footer สีอ่อนกว่า Body นิดนึง)
        contents: [
          { type: "text", text: "Save to log", size: "xs", color: "#a1a1aa", align: "center", margin: "none", weight: "bold" } as line.FlexText,
          { type: "spacer", size: "sm" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("Breakfast", "🍳", "Breakfast"),
              createMealButton("Lunch", "☀️", "Lunch")
            ]
          } as line.FlexBox,
          {
            type: "box",
            layout: "horizontal",
            contents: [
              createMealButton("Dinner", "🌙", "Dinner"),
              createMealButton("Snack", "🍿", "Snack")
            ]
          } as line.FlexBox
        ]
      },
      styles: {
        footer: {
            separator: true // เส้นคั่นระหว่าง Body กับ Footer
        }
      }
    }
  };

  await client.replyMessage(replyToken, flexMsg);
};

export const replyDailySummary = async (replyToken: string, logs: any[], totalCal: number, tdee: number) => {
  
  // สร้างรายการอาหาร (Rows)
  const rows: line.FlexComponent[] = logs.map((log) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      // ชื่อเมนู: สีเข้ม (#09090b)
      { 
        type: "text", 
        text: log.food_name, 
        size: "sm", 
        color: "#09090b", 
        flex: 4, 
        wrap: true 
      } as line.FlexText,
      // แคลอรี่: สีเทา (#71717a)
      { 
        type: "text", 
        text: `${log.calories}`, 
        size: "sm", 
        color: "#71717a", 
        align: "end", 
        flex: 1 
      } as line.FlexText
    ],
    margin: "md"
  }));

  const remaining = tdee - totalCal;
  // สีสถานะ: ถ้าเกินใช้แดง Shadcn (#ef4444), ถ้าเหลือใช้เขียว (#22c55e)
  const statusColor = remaining < 0 ? "#ef4444" : "#22c55e"; 

  const flexMsg: line.FlexMessage = {
    type: "flex",
    altText: "Daily Summary",
    quickReply: MAIN_QUICK_REPLY,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        contents: [
          // --- Header ---
          {
            type: "box", layout: "vertical",
            contents: [
              { type: "text", text: "Daily Log", weight: "bold", size: "xl", color: "#09090b" } as line.FlexText,
              { type: "text", text: new Date().toLocaleDateString('th-TH', { dateStyle: 'long' }), size: "xs", color: "#a1a1aa", margin: "xs" } as line.FlexText
            ]
          } as line.FlexBox,

          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,

          // --- List Items ---
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            // ถ้าไม่มีรายการ ให้แสดงข้อความว่างๆ
            contents: rows.length > 0 ? rows : [
              { type: "text", text: "No records found today.", size: "sm", color: "#a1a1aa", align: "center", margin: "md" } as line.FlexText
            ]
          } as line.FlexBox,

          { type: "separator", margin: "lg", color: "#e4e4e7" } as line.FlexSeparator,

          // --- Summary Stats (Box พื้นหลังเทาอ่อน) ---
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            paddingAll: "lg",
            backgroundColor: "#f4f4f5", // Zinc-100
            cornerRadius: "md",
            contents: [
              // Row 1: Target
              {
                type: "box", layout: "horizontal",
                contents: [
                  { type: "text", text: "Target (TDEE)", size: "xs", color: "#71717a" } as line.FlexText,
                  { type: "text", text: `${tdee}`, size: "xs", color: "#09090b", align: "end", weight: "bold" } as line.FlexText
                ]
              } as line.FlexBox,
              // Row 2: Consumed
              {
                type: "box", layout: "horizontal", margin: "sm",
                contents: [
                  { type: "text", text: "Consumed", size: "xs", color: "#71717a" } as line.FlexText,
                  { type: "text", text: `${totalCal}`, size: "xs", color: "#09090b", align: "end", weight: "bold" } as line.FlexText
                ]
              } as line.FlexBox,
              
              { type: "separator", margin: "sm", color: "#e4e4e7" } as line.FlexSeparator,
              
              // Row 3: Remaining (Highlight)
              {
                type: "box", layout: "horizontal", margin: "sm",
                contents: [
                  { type: "text", text: remaining < 0 ? "Over Limit" : "Remaining", size: "sm", color: statusColor, weight: "bold" } as line.FlexText,
                  { type: "text", text: `${Math.abs(remaining)}`, size: "lg", color: statusColor, align: "end", weight: "bold" } as line.FlexText
                ]
              } as line.FlexBox
            ]
          } as line.FlexBox
        ]
      }
    }
  };
  await client.replyMessage(replyToken, flexMsg);
};

export const replyMenuRecommendation = async (replyToken: string, data: any, category: string) => {
  
  const bubbles: line.FlexBubble[] = data.recommendations.map((item: any) => {
    
    // Buttons
    const buttons: line.FlexComponent[] = [];
    
    // ปุ่ม Select: สไตล์ Primary (สีดำล้วน แบบ Shadcn)
    buttons.push({
      type: "button",
      style: "primary",
      color: "#09090b", // Zinc-950 (Black)
      height: "sm",
      action: { 
        type: "message", 
        label: "Select This", 
        text: `บันทึก: ${item.menu_name} (${item.calories} kcal) - ${category}` 
      }
    });

    // ปุ่ม Recipe: สไตล์ Secondary/Link (สีเทาอ่อน)
    if (category === 'Home Cooked') {
      const searchUrl = `https://www.google.com/search?q=วิธีทำ+${encodeURIComponent(item.menu_name)}`;
      buttons.push({
        type: "button",
        style: "secondary",
        color: "#f4f4f5", // Zinc-100
        height: "sm",
        margin: "sm",
        action: { 
          type: "uri", 
          label: "View Recipe", 
          uri: searchUrl 
        }
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
          // Badge: Category
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
                align: "start"
              } as line.FlexText
            ]
          } as line.FlexBox,

          // Menu Name
          { 
            type: "text", 
            text: item.menu_name, 
            weight: "bold", 
            size: "lg", 
            color: "#09090b", 
            wrap: true, 
            margin: "sm" 
          } as line.FlexText,
          
          // Calories (Subtext)
          { 
            type: "text", 
            text: `${item.calories} kcal`, 
            color: "#71717a", 
            size: "sm", 
            margin: "xs" 
          } as line.FlexText,

          { type: "separator", margin: "md", color: "#e4e4e7" } as line.FlexSeparator,

          // Description
          { 
            type: "text", 
            text: item.description, 
            size: "xs", 
            color: "#a1a1aa", // Zinc-400
            wrap: true, 
            margin: "md",
            maxLines: 3
          } as line.FlexText
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg", // ลด Padding Footer นิดนึงให้กระชับ
        contents: buttons
      },
      styles: {
        footer: { separator: true }
      }
    };
  });

  await client.replyMessage(replyToken, {
    type: "flex",
    altText: `Recommended: ${category}`,
    quickReply: MAIN_QUICK_REPLY,
    contents: { type: "carousel", contents: bubbles }
  });
};