import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const analyzeFoodImage = async (imageBuffer: Buffer) => {
  // ✅ เลือกใช้ 'gemini-2.0-flash' จากในลิสต์ของคุณ (ตัวเสถียร)
  // รุ่นนี้เก่งเรื่อง OCR (อ่านฉลาก) และดูรูปภาพมาก
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    // 🛡️ ปลดล็อค Safety Settings (จำเป็นมากสำหรับรูปอาหารไทยสีจัดๆ)
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
  });

  const prompt = `
    Role: Expert Thai Nutritionist.
    Task: Analyze the food image. Identify the menu (in THAI) and estimate calories.

    --- ANALYSIS LOGIC (Priority Order) ---
    
    1. **PACKAGED PRODUCT (OCR & Recognition):** - If it looks like a 7-11 item, identify Brand/Flavor (e.g., "นมเมจิ", "แซนวิชเลอแปง"). 
       - Use standard calorie info for that product.
    
    2. **COOKING ANALYSIS (Visual):**
       - **Clean Food:** (Steamed, Boiled, Riceberry, Separate Sauce) -> Name with "(คลีน)". Low Oil.
       - **Street Food:** (Stir-fry, Curry, Deep-fry) -> **ADD** oil/sugar calories. Name normally.
    
    3. **OUTPUT REQUIREMENT:**
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
      data: imageBuffer.toString('base64'),
      mimeType: 'image/jpeg',
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // 🧹 Clean Text: ล้าง Markdown ออกให้หมดก่อนแปลงเป็น JSON
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);

  } catch (error: any) {
    console.error('AI Error (2.0 Flash):', error); 
    
    return {
      summary_name: "ระบบขัดข้องชั่วคราว",
      total_calories: 0,
      items: [{ name: "กรุณาลองถ่ายรูปใหม่อีกครั้งครับ", calories: 0 }]
    };
  }
};

// ... (ส่วนแนะนำเมนู ใช้ 2.0 Flash เหมือนกัน)
export const generateMenuRecommendation = async (category: string, mealType: string, budget: number, recentMenus: string[]) => {
    // ใช้ 2.0 Flash แนะนำเมนู ฉลาดกว่าเดิม
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); 
    const prompt = `
      Recommend 5 Thai menus for "${category}" (${mealType}). Budget: ${budget} kcal.
      Exclude: ${recentMenus.join(', ')}.
      Output JSON: { "recommendations": [{ "menu_name": "Thai Name", "calories": 0, "description": "Thai Desc" }] }
      NO Markdown.
    `;
  
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Menu Gen Error:', error);
      return { recommendations: [] };
    }
};