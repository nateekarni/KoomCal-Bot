import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const analyzeFoodImage = async (imageBuffer: Buffer) => {
  // ✅ ใช้รุ่น 2.0 Flash (ตัวเสถียร ตัด -exp ออก)
  // ถ้ายัง Error ให้เปลี่ยนกลับเป็น 'gemini-1.5-flash'
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    // 🛡️ ปลดล็อค Safety Settings (สำคัญมากสำหรับรูปอาหาร)
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    // ⚙️ บังคับให้ตอบเป็น JSON เท่านั้น (ลดโอกาส Error 99%)
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `
    Role: Expert Thai Nutritionist.
    Task: Analyze food image. Identify menu and estimate calories.
    
    REQUIREMENT: Output JSON in THAI (ภาษาไทย).

    LOGIC:
    1. **Product Recognition:** If packaged, identify Brand/Flavor (e.g. "นมเมจิ สตรอเบอร์รี่").
    2. **Cooking Analysis:**
       - Clean Food? (Steamed, Boiled, No Oil) -> Low Cal. Name: "... (คลีน)".
       - Street Food? (Stir-fry, Curry, Deep-fry) -> Add Oil/Sugar. Name: Normal Thai name.
    
    OUTPUT JSON SCHEMA:
    {
      "summary_name": "Thai Menu Name",
      "total_calories": Integer,
      "items": [
        { "name": "Thai Component Name", "calories": 0 }
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
    
    // ✅ พอใช้ responseMimeType: "application/json" ไม่ต้อง replace text แล้ว
    const text = response.text();
    return JSON.parse(text);

  } catch (error: any) {
    console.error('AI Error Details:', error); // ดู Logs ถ้ายังพัง
    
    // ถ้ายัง Error ให้ตอบค่า Default กลับไป (User จะได้ไม่ต้องถ่ายใหม่)
    return {
      summary_name: "วิเคราะห์ขัดข้อง (AI Busy)",
      total_calories: 0,
      items: [{ name: "ระบบกำลังปรับปรุง กรุณาลองใหม่", calories: 0 }]
    };
  }
};

// ... (ส่วน generateMenuRecommendation เหมือนเดิม แต่เพิ่ม safetySettings ด้วยก็ดีครับ)
export const generateMenuRecommendation = async (category: string, mealType: string, budget: number, recentMenus: string[]) => {
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json" }
    }); 
    
    const prompt = `
      Recommend 5 Thai menus for "${category}" (${mealType}). Budget: ${budget} kcal.
      Exclude: ${recentMenus.join(', ')}.
      Output JSON: { "recommendations": [{ "menu_name": "Thai Name", "calories": 0, "description": "Thai Desc" }] }
    `;
  
    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (error) {
      console.error('Menu Gen Error:', error);
      return { recommendations: [] };
    }
};