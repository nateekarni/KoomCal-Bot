import express, { Application, Request, Response } from "express";
import * as line from "@line/bot-sdk";
import { createClient } from "@supabase/supabase-js";
import { getUserProfile } from "./services/user.service";
import * as aiService from "./services/ai.service";
import * as lineService from "./services/line.service";
import * as userService from "./services/user.service";
import { MAIN_QUICK_REPLY } from "./services/line.service";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.CHANNEL_SECRET || "",
};

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || "",
);
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
const LIFF_URL = `https://liff.line.me/${process.env.LIFF_ID}`;

const getThaiDate = () => {
  const date = new Date();
  date.setHours(date.getHours() + 7);
  return date;
};

const app: Application = express();
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.send("🤖 KoomCal Bot Ready!");
});
app.post(
  "/webhook",
  line.middleware(config as line.MiddlewareConfig),
  async (req, res) => {
    try {
      const events: line.WebhookEvent[] = req.body.events;
      if (events.length > 0) {
        await Promise.all(events.map(handleEvent));
      }
      res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("Webhook Error:", err);
      res.status(500).end();
    }
  },
);

app.use(express.json());
app.get("/api/liff-id", (req, res) => {
  res.json({ liffId: process.env.LIFF_ID });
});
app.post("/api/register-liff", async (req, res) => {
  const { userId, weight, height, age, gender, activity, goal } = req.body;
  try {
    const tdee = await userService.registerUser(
      userId,
      weight,
      height,
      age,
      gender,
      activity,
      goal,
    );
    const client = new line.Client(config as line.ClientConfig);
    let goalText = "รักษาน้ำหนัก";
    if (goal === "lose_weight") goalText = "ลดน้ำหนัก";
    else if (goal === "muscle_gain") goalText = "สร้างกล้ามเนื้อ";
    await client.pushMessage(userId, {
      type: "text",
      text: `✅ ลงทะเบียนสำเร็จ!\n🎯 เป้าหมาย: ${goalText}\n🔥 TDEE แนะนำ: ${tdee} kcal/วัน\n\nเริ่มใช้งานโดยการถ่ายรูปอาหาร หรือพิมพ์เมนูได้เลยครับ!`,
      quickReply: MAIN_QUICK_REPLY,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.get('/api/user-profile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const profile = await userService.getUserProfile(userId);
    
    if (profile) {
      res.json({ found: true, data: profile });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function handleEvent(event: line.WebhookEvent) {
  const userId = event.source.userId;
  if (
    !userId ||
    (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId))
  )
    return Promise.resolve(null);
  const client = new line.Client(config as line.ClientConfig);

  if (event.type === "follow") {
    const isRegistered = await userService.checkUserExists(userId);
    if (!isRegistered) {
      await client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "กรุณาลงทะเบียนใช้งาน",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "ยินดีต้อนรับสู่ KoomCal",
                weight: "bold",
                size: "xl",
              },
              {
                type: "text",
                text: "กรุณาลงทะเบียนเพื่อเริ่มใช้งาน",
                margin: "md",
                size: "sm",
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#111827",
                action: {
                  type: "uri",
                  label: "📝 ลงทะเบียนใช้งาน",
                  uri: LIFF_URL,
                },
              },
            ],
          },
        },
      });
    } else {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "ยินดีต้อนรับกลับครับ! 🥗",
        quickReply: MAIN_QUICK_REPLY,
      });
    }
  } else if (event.type === "message") {
    const isRegistered = await userService.checkUserExists(userId);
    if (!isRegistered) {
      await client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "กรุณาลงทะเบียน",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "⛔️ กรุณาลงทะเบียนก่อน",
                weight: "bold",
                color: "#EF4444",
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#111827",
                action: {
                  type: "uri",
                  label: "📝 ลงทะเบียนตอนนี้",
                  uri: LIFF_URL,
                },
              },
            ],
          },
        },
      });
      return;
    }

    if (event.message.type === "image") {
      try {
        const imageBuffer = await lineService.getContent(event.message.id);
        const result = await aiService.analyzeFoodImage(imageBuffer);
        await lineService.replyFoodResult(event.replyToken, result);
      } catch (error: any) {
        console.error("Image Analysis Error:", error);
        // ตอบกลับ Error เฉพาะกรณีที่ไม่ใช่ 400 (Token Timeout)
        if (
          error.statusCode !== 400 &&
          (!error.originalError || error.originalError.response?.status !== 400)
        ) {
          try {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ กรุณาลองใหม่ครับ",
              quickReply: MAIN_QUICK_REPLY,
            });
          } catch (e) {}
        }
      }
    } else if (event.message.type === "text") {
      const text = event.message.text.trim();

      // ✅ Handle ปุ่มบันทึก + คำนวณแคลคงเหลือ
      if (text.startsWith("บันทึก:")) {
        await handleSaveCommand(client, userId, event.replyToken, text);
      } else if (text === "สรุปแคล") {
        // (Logic เดิม)
        const today = getThaiDate().toISOString().split("T")[0];
        const startOfDay = new Date(today);
        startOfDay.setHours(startOfDay.getHours() - 7);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        const { data: userData } = await supabase
          .from("KoomCal_Users")
          .select("tdee")
          .eq("user_id", userId)
          .single();
        const tdee = userData?.tdee || 2000;
        const { data: logs } = await supabase
          .from("KoomCal_FoodLogs")
          .select("food_name, calories")
          .eq("user_id", userId)
          .gte("created_at", startOfDay.toISOString())
          .lt("created_at", endOfDay.toISOString());
        const totalCal =
          logs?.reduce((sum, item) => sum + item.calories, 0) || 0;
        await lineService.replyDailySummary(
          event.replyToken,
          logs || [],
          totalCal,
          tdee,
        );
      } else if (text.startsWith("เมนู")) {
        // เมนู 7-11, เมนูตามสั่ง, เมนูทำเอง (Quick Reply ทั้งหมด)
        const isMenuRequest =
          text.startsWith("เมนู 7-11") ||
          text.startsWith("เมนูตามสั่ง") ||
          text.startsWith("เมนูทำเอง");
        if (isMenuRequest) {
          const today = getThaiDate().toISOString().split("T")[0];
          const startOfDay = new Date(today);
          startOfDay.setHours(startOfDay.getHours() - 7);
          const endOfDay = new Date(startOfDay);
          endOfDay.setDate(endOfDay.getDate() + 1);
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - 3);

          const { data: userData } = await supabase
            .from("KoomCal_Users")
            .select("tdee")
            .eq("user_id", userId)
            .single();
          const tdee = userData?.tdee || 2000;
          const { data: todayLogs } = await supabase
            .from("KoomCal_FoodLogs")
            .select("calories")
            .eq("user_id", userId)
            .gte("created_at", startOfDay.toISOString())
            .lt("created_at", endOfDay.toISOString());
          const { data: recentLogs } = await supabase
            .from("KoomCal_FoodLogs")
            .select("food_name")
            .eq("user_id", userId)
            .gte("created_at", pastDate.toISOString());

          const consumed =
            todayLogs?.reduce((sum, item) => sum + item.calories, 0) || 0;
          let budget = tdee - consumed;
          if (budget <= 0) budget = 200;
          const recentMenuNames = [
            ...new Set(recentLogs?.map((log) => log.food_name) || []),
          ];

          // Logic เลือกมื้อ
          let mealType = "Lunch";
          const h = getThaiDate().getHours();
          if (h < 11) mealType = "Breakfast";
          else if (h < 15) mealType = "Lunch";
          else mealType = "Dinner";

          let category = "Street Food";
          if (text.startsWith("เมนู 7-11")) category = "7-11";
          else if (text.startsWith("เมนูทำเอง")) category = "Home Cooked";

          try {
            const recommendations = await aiService.generateMenuRecommendation(
              category,
              mealType,
              budget,
              recentMenuNames,
            );
            await lineService.replyMenuRecommendation(
              event.replyToken,
              recommendations,
              category,
            );
          } catch (e) {
            console.error(e);
            try {
              await client.replyMessage(event.replyToken, {
                type: "text",
                text: "❌ ระบบขัดข้อง",
                quickReply: MAIN_QUICK_REPLY,
              });
            } catch (err) {}
          }
        }
      }
    }
  }
}

// ✅ ฟังก์ชันบันทึก พร้อมคำนวณแคลคงเหลือทันที
async function handleSaveCommand(
  client: line.Client,
  userId: string,
  replyToken: string,
  text: string,
) {
  const regex = /บันทึก:\s*(.+?)\s*\((\d+)\s*kcal\)\s*-\s*(.+)/;
  const match = text.match(regex);
  if (match) {
    const foodName = match[1];
    const calories = parseInt(match[2]);
    const mealType = match[3];
    try {
      // 1. บันทึกลง DB
      const { error } = await supabase
        .from("KoomCal_FoodLogs")
        .insert([
          {
            user_id: userId,
            food_name: foodName,
            calories: calories,
            meal_type: mealType,
          },
        ]);
      if (error) throw error;

      // 2. คำนวณแคลคงเหลือทันที
      const today = getThaiDate().toISOString().split("T")[0];
      const startOfDay = new Date(today);
      startOfDay.setHours(startOfDay.getHours() - 7);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      // ดึง TDEE และ ประวัติการกินวันนี้ (รวมที่เพิ่งบันทึก)
      const { data: userData } = await supabase
        .from("KoomCal_Users")
        .select("tdee")
        .eq("user_id", userId)
        .single();
      const tdee = userData?.tdee || 2000;
      const { data: logs } = await supabase
        .from("KoomCal_FoodLogs")
        .select("calories")
        .eq("user_id", userId)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString());

      const totalConsumed =
        logs?.reduce((sum, item) => sum + item.calories, 0) || 0;
      const remaining = tdee - totalConsumed;

      // 3. ตอบกลับพร้อมข้อมูลคงเหลือ
      await client.replyMessage(replyToken, {
        type: "text",
        text: `✅ บันทึกเรียบร้อย!\n🍽️ เมนู: ${foodName}\n🔥 พลังงาน: ${calories} kcal\n📅 มื้อ: ${mealType}\n\n📉 คงเหลือวันนี้: ${remaining} kcal`,
        quickReply: MAIN_QUICK_REPLY,
      });
    } catch (err: any) {
      await client.replyMessage(replyToken, {
        type: "text",
        text: "❌ บันทึกไม่สำเร็จ: " + err.message,
      });
    }
  } else {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "⚠️ รูปแบบข้อมูลไม่ถูกต้อง",
    });
  }
}

const port = process.env.PORT || 3000;
if (process.env.VERCEL) module.exports = app;
else app.listen(port, () => console.log(`Server running on port ${port}`));
