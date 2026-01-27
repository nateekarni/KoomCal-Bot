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

// Register / Update User with Activity Level
export const registerUser = async (
  userId: string, 
  weight: number, 
  height: number, 
  age: number, 
  gender: string,
  activity: string
) => {
  
  // 1. Calculate BMR (Mifflin-St Jeor Equation)
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') bmr += 5;
  else bmr -= 161;

  // 2. Determine Multiplier based on Activity
  let multiplier = 1.2; // Default Sedentary
  switch (activity) {
    case 'sedentary': multiplier = 1.2; break;
    case 'light': multiplier = 1.375; break;
    case 'moderate': multiplier = 1.55; break;
    case 'active': multiplier = 1.725; break;
    case 'very_active': multiplier = 1.9; break;
    default: multiplier = 1.2;
  }

  const tdee = Math.round(bmr * multiplier);

  // 3. Upsert to Supabase
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
        activity_level: activity
      }
    ]);

  if (error) throw error;
  return tdee;
};