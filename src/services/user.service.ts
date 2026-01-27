import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || "",
);

export const checkUserExists = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("KoomCal_Users")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  if (error || !data) return false;
  return true;
};

// ✅ เพิ่มฟังก์ชันนี้: ดึงข้อมูลผู้ใช้เพื่อเอาไปแสดงในหน้าแก้ไข
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("KoomCal_Users")
    .select("*") // ดึงมาทุกช่อง (weight, height, goal, etc.)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
};

// ... (function registerUser เหมือนเดิม ไม่ต้องแก้) ...
export const registerUser = async (
  userId: string,
  weight: number,
  height: number,
  age: number,
  gender: string,
  activity: string,
  goal: string,
) => {
  // 1. Calculate BMR
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  if (gender === "male") bmr += 5;
  else bmr -= 161;

  // 2. Activity Multiplier
  let multiplier = 1.2;
  switch (activity) {
    case "sedentary":
      multiplier = 1.2;
      break;
    case "light":
      multiplier = 1.375;
      break;
    case "moderate":
      multiplier = 1.55;
      break;
    case "active":
      multiplier = 1.725;
      break;
    case "very_active":
      multiplier = 1.9;
      break;
    default:
      multiplier = 1.2;
  }

  // 3. Goal Adjustment
  let tdee = Math.round(bmr * multiplier);
  if (goal === "lose_weight") {
    tdee -= 500;
    if (tdee < 1200) tdee = 1200;
  } else if (goal === "muscle_gain") {
    tdee += 300;
  }

  // 4. Upsert
  const { error } = await supabase
    .from("KoomCal_Users")
    .upsert([
      {
        user_id: userId,
        tdee: tdee,
        weight: weight,
        height: height,
        age: age,
        gender: gender,
        activity_level: activity,
        goal: goal,
      },
    ]);

  if (error) throw error;
  return tdee;
};
