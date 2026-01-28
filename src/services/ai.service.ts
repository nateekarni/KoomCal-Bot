import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
    Return ONLY a valid JSON object:
    {
      "items": [{ "name": "ข้าวกะเพราไก่", "calories": 550 }],
      "total_calories": 550,
      "summary_name": "ข้าวกะเพราไก่" 
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
  text = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(text);
};

export const generateMenuRecommendation = async (
  category: string,
  mealType: string,
  remainingCalories: number,
  recentMeals: string[] = [],
): Promise<any> => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const historyContext =
    recentMeals.length > 0
      ? `Recently eaten (DO NOT suggest): ${recentMeals.join(", ")}.`
      : "";
  const prompt = `
    Role: Creative Chef & Nutritionist.
    Context: User wants "${category}" for "${mealType}".
    Constraint 1: User has ${remainingCalories} kcal remaining.
    Constraint 2: ${historyContext}
    Task: Suggest 3 distinct menu sets.
    Specific Instructions:
    - '7-11': Suggest pairings.
    - 'Street Food': Common Thai street food.
    - 'Home Cooked': Suggest EASY-to-cook Thai menus with simple ingredients.
    Return ONLY a valid JSON object:
    { "recommendations": [{ "menu_name": "Menu Name (Thai)", "calories": 350, "description": "Short reason (Thai)" }] }
  `;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  text = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(text);
};
