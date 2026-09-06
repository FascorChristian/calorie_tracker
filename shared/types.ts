/**
 * Contratos y tipos de datos compartidos entre el Frontend y el Backend
 */

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: 'masculino' | 'femenino' | 'otro';
  weightKg: number;
  heightCm: number;
  activityLevel: 'sedentario' | 'ligero' | 'moderado' | 'muy_activo' | 'extremo';
  goal: 'deficit' | 'mantenimiento' | 'volumen' | 'recomposicion';
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  allergies: string[];
  dietaryPreferences: string[];
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealMacros {
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra?: number;
}

export interface Meal {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  mealType: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
  imageUrl?: string;
  audioDataUrl?: string;
  audioDurationSeconds?: number;
  audioTranscript?: string;
  nombre_plato: string;
  calorias_estimadas: number;
  macros: MealMacros;
  puntaje_plato: number; // 1-10
  feedback_breve: string;
  ingredientes_detectados: string[];
  detalles_audio?: string;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  userId: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  puntaje_diario: number; // 1-100
  consejo_diario: string;
  balance_nutricional: string;
  puntos_fuertes: string[];
  areas_de_mejora: string[];
  mealsCount: number;
  updatedAt: string;
}

export interface MultimodalAnalysisRequest {
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  audioTranscript?: string;
  audioDurationSeconds?: number;
  mealType: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
  date?: string;
  time?: string;
  notes?: string;
}

export interface GeminiMealAnalysisResponse {
  nombre_plato: string;
  calorias_estimadas: number;
  macros: {
    proteinas: number;
    carbohidratos: number;
    grasas: number;
    fibra?: number;
  };
  puntaje_plato: number;
  feedback_breve: string;
  ingredientes_detectados: string[];
  detalles_audio: string;
}

export interface GeminiDailyScoreResponse {
  puntaje_diario: number;
  consejo_diario: string;
  balance_nutricional: string;
  puntos_fuertes: string[];
  areas_de_mejora: string[];
}

