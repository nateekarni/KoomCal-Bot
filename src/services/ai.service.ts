import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const analyzeFoodImage = async (imageBuffer: Buffer) => {
  // ✅ ใช้ 1.5 Flash เพื่อความเสถียรสูงสุด (รุ่น 2.0 อาจจะมีปัญหาเรื่อง JSON Format ในบางครั้ง)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  const prompt = `
    Role: Expert Thai Nutritionist.
    Task: Analyze the food image. Identify the menu (in THAI) and estimate calories.

    --- LOGIC ---
    1. **Product Recognition (7-11):** - If packaged, identify Brand/Flavor (e.g., "นมเมจิ", "เลย์"). 
       - Use standard calorie info.
    
    2. **Cooking Analysis:**
       - **Clean Food:** (Steamed, Boiled, Riceberry) -> Name with "(คลีน)". Low Oil.
       - **Street Food:** (Stir-fry, Curry, Deep-fry) -> **ADD** oil/sugar calories. Name normally.
    
    3. **Output Requirement:**
       - STRICTLY JSON FORMAT.
       - STRICTLY THAI LANGUAGE for names.

    JSON SCHEMA:
    {
      "summary_name": "ชื่อเมนู (ภาษาไทย)",
      "total_calories": Integer,
      "items": [
        { "name": "ส่วนประกอบ 1", "calories": 0 },
        { "name": "ส่วนประกอบ 2", "calories": 0 }
      ]
    }
  `;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log("AI Raw Response:", text); // 🛠️ Debug ดูว่า AI ตอบอะไรมา

    // ✅ ฟังก์ชันแกะ JSON ขั้นเทพ (กันเหนียว)
    // จะพยายามหาปีกกาเปิด { ตัวแรก และปีกกาปิด } ตัวสุดท้าย
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const jsonString = jsonMatch[0]; // เอาเฉพาะส่วนที่เป็น JSON จริงๆ
    return JSON.parse(jsonString);
  } catch (error: any) {
    console.error("AI Error:", error);

    // แจ้ง User ว่าเกิดอะไรขึ้น (แทนที่จะตอบ 0 เฉยๆ)
    return {
      summary_name: "เกิดข้อผิดพลาด",
      total_calories: 0,
      items: [{ name: "ระบบอ่านข้อมูลไม่ได้ กรุณาลองใหม่", calories: 0 }],
    };
  }
};

// ... (ส่วน generateMenuRecommendation เหมือนเดิม) ...
export const generateMenuRecommendation = async (
  category: string,
  mealType: string,
  budget: number,
  recentMenus: string[],
) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
      Recommend 5 Thai menus for "${category}" (${mealType}). Budget: ${budget} kcal.
      Exclude: ${recentMenus.join(", ")}.
      Output JSON: { "recommendations": [{ "menu_name": "Thai Name", "calories": 0, "description": "Thai Desc" }] }
      NO Markdown.
    `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Menu Gen Error:", error);
    return { recommendations: [] };
  }
};
