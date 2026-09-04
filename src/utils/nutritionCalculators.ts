import { UserProfile } from '../types.js';

export function calculateBMR(user: Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'gender'>): number {
  // Formula de Mifflin-St Jeor
  if (user.gender === 'femenino') {
    return Math.round(10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age - 161);
  } else {
    // Masculino u otro
    return Math.round(10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age + 5);
  }
}

export function calculateTDEE(
  bmr: number,
  activityLevel: UserProfile['activityLevel']
): number {
  const multipliers: Record<UserProfile['activityLevel'], number> = {
    sedentario: 1.2,
    ligero: 1.375,
    moderado: 1.55,
    muy_activo: 1.725,
    extremo: 1.9,
  };
  return Math.round(bmr * (multipliers[activityLevel] || 1.4));
}

export function calculateRecommendedTargets(
  user: Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'gender' | 'activityLevel' | 'goal'>
): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  const bmr = calculateBMR(user);
  const tdee = calculateTDEE(bmr, user.activityLevel);

  let targetCalories = tdee;
  let proteinPerKg = 1.8;

  if (user.goal === 'deficit') {
    targetCalories = Math.round(tdee * 0.8); // 20% deficit
    proteinPerKg = 2.1; // Mayor proteina para preservar musculo
  } else if (user.goal === 'volumen') {
    targetCalories = Math.round(tdee * 1.12); // 12% superavit
    proteinPerKg = 1.9;
  } else if (user.goal === 'recomposicion') {
    targetCalories = Math.round(tdee * 0.95);
    proteinPerKg = 2.2;
  } else {
    // Mantenimiento
    targetCalories = tdee;
    proteinPerKg = 1.8;
  }

  const proteinG = Math.round(user.weightKg * proteinPerKg);
  const proteinCalories = proteinG * 4;

  // Grasas entre 25% y 30% de calorias totales
  const fatCalories = targetCalories * 0.25;
  const fatG = Math.round(fatCalories / 9);

  // Carbohidratos el resto
  const remainingCalories = Math.max(0, targetCalories - proteinCalories - fatCalories);
  const carbsG = Math.round(remainingCalories / 4);

  return {
    calories: targetCalories,
    proteinG,
    carbsG,
    fatG,
  };
}
