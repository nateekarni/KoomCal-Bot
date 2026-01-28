import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const analyzeFoodImage = async (imageBuffer: Buffer) => {
  // ✅ ใช้ Flash (ทำงานเร็วและครอบคลุม)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // 🔥 Super Prompt: เน้นภาษาไทย + แยกแยะ Clean Food
  const prompt = `
    Role: Expert Thai Nutritionist & Food Detective.
    Task: Analyze the food image to identify the menu and estimate calories.

    🚨 LANGUAGE REQUIREMENT: **OUTPUT IN THAI (ภาษาไทย) ONLY** for all names.

    --- ANALYSIS STEPS ---

    1. **PACKAGED PRODUCT (Priority):**
       - Identify Brand, Flavor, Net Weight.
       - Output Name in Thai (e.g., "นมเมจิ รสสตรอเบอร์รี่", "อกไก่นุ่ม CP", "เลย์ รสโนริสาหร่าย").
       - Retrieve standard calories from knowledge base.

    2. **VISUAL ANALYSIS (Cooking & Components):**
       - **Identify Components:** List distinct parts in Thai (e.g., "อกไก่ต้ม", "ข้าวไรซ์เบอร์รี่", "ไข่ต้ม").
       - **Detect "Clean Food" Signals:** - Is it Steamed/Boiled/Grilled? (No oil sheen)
         - Is it Brown Rice/Riceberry?
         - Is sauce served separately?
         - Is meat lean/skinless?
       - **Detect "Street Food" Signals:**
         - Oily sheen (Stir-fry), Deep-fried, Coconut Curry.
    
    3. **MENU MATCHING & CALCULATION:**
       - **IF CLEAN FOOD:** Name it specifically in Thai (e.g., "ข้าวกะเพราอกไก่ (คลีน)", "ข้าวไรซ์เบอร์รี่ อกไก่ต้ม"). Estimate based on raw ingredients. DO NOT add hidden oil calories.
       - **IF STREET FOOD:** Name it normally in Thai (e.g., "ข้าวมันไก่", "ข้าวขาหมู", "กะเพราหมูสับไข่ดาว"). **ADD** hidden calories for oil/sugar/chicken skin.
       - **IF UNSURE:** Assume Street Food standard (Safety margin).

    --- OUTPUT FORMAT (JSON Only) ---
    {
      "summary_name": "ชื่อเมนูภาษาไทย (เช่น 'ข้าวกะเพราอกไก่ (คลีน)', 'ข้าวมันไก่ต้ม')",
      "total_calories": Integer (Total Estimate),
      "items": [
        { "name": "ชื่อส่วนประกอบภาษาไทย 1 (เช่น 'ข้าวไรซ์เบอร์รี่ 150g')", "calories": 0 },
        { "name": "ชื่อส่วนประกอบภาษาไทย 2 (เช่น 'อกไก่ต้ม')", "calories": 0 },
        { "name": "หมายเหตุการปรุง (เช่น 'ไม่ใช้น้ำมัน')", "calories": 0 }
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
    
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('AI Error:', error);
    return {
      summary_name: "ประเมินไม่ได้",
      total_calories: 0,
      items: [{ name: "กรุณาลองใหม่ หรือพิมพ์ชื่อเมนู", calories: 0 }]
    };
  }
};

// ... (ส่วน generateMenuRecommendation ปรับให้บังคับไทยด้วย) ...
export const generateMenuRecommendation = async (category: string, mealType: string, budget: number, recentMenus: string[]) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); 
    const prompt = `
      Act as a personal fitness chef. User wants a "${category}" meal for "${mealType}".
      Calorie Budget: ${budget} kcal.
      Recent meals (avoid these): ${recentMenus.join(', ')}.
  
      Recommend 5 distinct **Thai menus (Names in Thai)** suitable for this category and budget.
      
      Response in JSON format:
      {
        "recommendations": [
          { "menu_name": "ชื่อเมนูภาษาไทย", "calories": 0, "description": "Short reasoning in Thai" }
        ]
      }
      Strictly NO Markdown blocks.
    `;
  
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Menu Gen Error:', error);
      return { recommendations: [] };
    }
  };