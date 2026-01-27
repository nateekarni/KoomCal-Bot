import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 1. วิเคราะห์รูปภาพ
export const analyzeFoodImage = async (imageBuffer: Buffer): Promise<any> => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    Analyze this food image (which may contain multiple items).
    Tasks:
    1. Identify ALL distinct food items visible.
    2. Estimate calories for EACH item.
    3. Calculate the grand total calories.
    
    IMPORTANT INSTRUCTION:
    - Return the "name" and "summary_name" in THAI Language (ภาษาไทย) ONLY.
    
    Return ONLY a valid JSON object with this structure:
    {
      "items": [
        { "name": "ข้าวกะเพราไก่ไข่ดาว", "calories": 550 },
        { "name": "นมจืดเมจิ", "calories": 130 }
      ],
      "total_calories": 680,
      "summary_name": "ข้าวกะเพรา + นมจืด" 
    }
  `;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  let text = response.text();
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
};

// 2. แนะนำเมนูอาหาร
export const generateMenuRecommendation = async (
  category: string,
  mealType: string,
  remainingCalories: number,
  recentMeals: string[] = []
): Promise<any> => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const historyContext = recentMeals.length > 0 
    ? `Recently eaten menus (DO NOT suggest these): ${recentMeals.join(', ')}.` 
    : '';

  const prompt = `
    Role: Creative Chef & Nutritionist.
    Context: User wants to eat "${category}" for "${mealType}".
    Constraint 1: User has ${remainingCalories} kcal remaining.
    Constraint 2: ${historyContext}
    
    Task: Suggest 3 distinct menu sets.
    
    Specific Instructions by Category:
    - '7-11': Suggest pairings (e.g., "Chicken Breast + Yogurt").
    - 'Street Food': Common Thai street food.
    - 'Home Cooked': Suggest EASY-to-cook Thai menus. Simple ingredients.
    
    Return ONLY a valid JSON object:
    {
      "recommendations": [
        { 
          "menu_name": "Menu Name (Thai)", 
          "calories": 350, 
          "description": "Short reason why it's good (Thai)"
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
};