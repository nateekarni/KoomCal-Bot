import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

// Helper: Check if user exists
export const checkUserExists = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('KoomCal_Users')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;
  return true;
};

// Register / Update User with Activity Level & Goal
export const registerUser = async (
  userId: string, 
  weight: number, 
  height: number, 
  age: number, 
  gender: string,
  activity: string,
  goal: string // ✅ รับ parameter ใหม่
) => {
  
  // 1. Calculate BMR (Mifflin-St Jeor Equation)
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') bmr += 5;
  else bmr -= 161;

  // 2. Determine Multiplier based on Activity
  let multiplier = 1.2;
  switch (activity) {
    case 'sedentary': multiplier = 1.2; break;
    case 'light': multiplier = 1.375; break;
    case 'moderate': multiplier = 1.55; break;
    case 'active': multiplier = 1.725; break;
    case 'very_active': multiplier = 1.9; break;
    default: multiplier = 1.2;
  }

  // 3. Adjust for Goal (Caloric Deficit/Surplus)
  let tdee = Math.round(bmr * multiplier);
  
  // ✅ ปรับ TDEE ตามเป้าหมาย
  if (goal === 'lose_weight') {
    tdee -= 500; // ลดน้ำหนัก (Deficit 500)
    if (tdee < 1200) tdee = 1200; // กันไม่ให้ต่ำเกินไปจนอันตราย
  } else if (goal === 'muscle_gain') {
    tdee += 300; // สร้างกล้ามเนื้อ (Surplus 300)
  }
  // maintain ไม่ต้องทำอะไร

  // 4. Upsert to Supabase
  const { error } = await supabase
    .from('KoomCal_Users')
    .upsert([
      { 
        user_id: userId, 
        tdee: tdee,
        weight: weight,
        height: height,
        age: age,
        gender: gender,
        activity_level: activity,
        goal: goal // ✅ บันทึก goal ลง DB ด้วย
      }
    ]);

  if (error) throw error;
  return tdee;
};