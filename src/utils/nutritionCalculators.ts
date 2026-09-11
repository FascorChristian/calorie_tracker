import { UserProfile } from '../../shared/types.js';

/**
 * Calcula la Tasa Metabólica Basal (BMR) mediante la ecuación de Mifflin-St Jeor.
 * Considerada el estándar de oro clínico para adultos sanos y con sobrepeso.
 *
 * Hombres/Otros: BMR = (10 * peso_kg) + (6.25 * altura_cm) - (5 * edad) + 5
 * Mujeres:       BMR = (10 * peso_kg) + (6.25 * altura_cm) - (5 * edad) - 161
 */
export function calculateBMR(
  user: Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'gender'>
): number {
  if (user.gender === 'femenino') {
    return Math.round(10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age - 161);
  } else {
    // Masculino u otro
    return Math.round(10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age + 5);
  }
}

/**
 * Calcula el Gasto Energético Total Diario (TDEE) multiplicando el BMR
 * por el factor de actividad física correspondiente.
 * 
 * En caso de valor no reconocido, se usa el valor base sedentario (1.2) con coalescencia nula.
 */
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
  return Math.round(bmr * (multipliers[activityLevel] ?? 1.2));
}

/**
 * Obtiene el multiplicador proteico óptimo (g/kg de peso corporal)
 * según el nivel de actividad física y el objetivo nutricional,
 * fundamentado en evidencia científica (Morton et al., 2018; Guías ISSN 2017).
 *
 * - Sedentario: 1.2 g/kg (sin sobrecarga innecesaria sin estímulo de fuerza).
 * - Actividad Ligera/Moderada: 1.5 a 1.8 g/kg (1.7 en déficit para retención de masa magra).
 * - Alta Actividad/Extremo: 1.6 a 1.9 g/kg (máxima demanda metabólica y de recuperación).
 */
export function getProteinMultiplier(
  activityLevel: UserProfile['activityLevel'],
  goal: UserProfile['goal']
): number {
  if (activityLevel === 'sedentario') {
    return 1.2;
  }

  if (activityLevel === 'ligero' || activityLevel === 'moderado') {
    switch (goal) {
      case 'deficit':
        return 1.7;
      case 'volumen':
        return 1.6;
      case 'recomposicion':
        return 1.8;
      case 'mantenimiento':
      default:
        return 1.5;
    }
  }

  // muy_activo | extremo
  switch (goal) {
    case 'deficit':
      return 1.9;
    case 'volumen':
      return 1.7;
    case 'recomposicion':
      return 1.9;
    case 'mantenimiento':
    default:
      return 1.6;
  }
}

/**
 * Calcula los objetivos de calorías y macronutrientes recomendados
 * garantizando coherencia calórica estricta mediante cuadratura final:
 * calories = (proteinG * 4) + (carbsG * 4) + (fatG * 9)
 *
 * Reglas de optimización:
 * 1. Ajuste calórico: Déficit (20%), Volumen (10%), Recomposición (5%), Mantenimiento (0%).
 * 2. Proteína dinámica según actividad y meta para evitar sobreprescripción.
 * 3. Protección lipídica: mínimo 0.8 g/kg o 25% de calorías (tope 35%).
 * 4. Carbohidratos como remanente energético disponible.
 */
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

  // 1. Ajuste calórico inicial según objetivo
  let targetCalories = tdee;
  if (user.goal === 'deficit') {
    targetCalories = Math.round(tdee * 0.8); // 20% déficit
  } else if (user.goal === 'volumen') {
    targetCalories = Math.round(tdee * 1.1); // 10% superávit
  } else if (user.goal === 'recomposicion') {
    targetCalories = Math.round(tdee * 0.95); // 5% déficit ligero
  } else {
    targetCalories = tdee; // Mantenimiento
  }

  // 2. Proteína dinámica según nivel de actividad y meta
  const proteinMultiplier = getProteinMultiplier(user.activityLevel, user.goal);
  const proteinG = Math.round(user.weightKg * proteinMultiplier);
  const proteinCalories = proteinG * 4;

  // 3. Protección de Lípidos: al menos 0.8 g/kg o 25% de calorías totales (tope 35%)
  const fatCaloriesMin = user.weightKg * 0.8 * 9;
  const fatCaloriesRatio = targetCalories * 0.25;
  const fatCalories = Math.min(
    Math.max(fatCaloriesRatio, fatCaloriesMin),
    targetCalories * 0.35
  );
  const fatG = Math.round(fatCalories / 9);

  // 4. Asignación de Carbohidratos a partir del remanente calórico real
  const remainingCalories = Math.max(0, targetCalories - proteinCalories - (fatG * 9));
  const carbsG = Math.round(remainingCalories / 4);

  // 5. Cuadratura final estricta de calorías
  const calories = (proteinG * 4) + (carbsG * 4) + (fatG * 9);

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
  };
}
