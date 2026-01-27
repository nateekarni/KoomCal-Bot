const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.analyzeFoodImage = async (imageBuffer) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // 🎯 Prompt ขั้นสูง: สั่งให้แยกรายการสินค้าและรวมยอด
  const prompt = `
    Analyze this food image (which may contain multiple items, e.g., 7-11 products).
    
    Tasks:
    1. Identify ALL distinct food items visible.
    2. Estimate calories for EACH item (read the label if visible, otherwise estimate).
    3. Calculate the grand total calories.
    
    Return ONLY a valid JSON object with this structure:
    {
      "items": [
        { "name": "Sandwich Ham Cheese", "calories": 290 },
        { "name": "Meiji Milk", "calories": 130 }
      ],
      "total_calories": 420,
      "summary_name": "Sandwich + Milk" 
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
  
  // Clean JSON
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
};