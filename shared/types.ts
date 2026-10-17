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
  driveFileId?: string;
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
  clientRequestId?: string;
  imageBase64?: string;
  imageMimeType?: string;
  images?: Array<{ base64: string; mimeType: string }>;
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
  mealType?: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
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

export interface UnifiedMealAnalysisResponse {
  comidas: GeminiMealAnalysisResponse[];
  resumen_del_dia: GeminiDailyScoreResponse;
}

export interface GeminiDailyScoreResponse {
  puntaje_diario: number;
  consejo_diario: string;
  balance_nutricional: string;
  puntos_fuertes: string[];
  areas_de_mejora: string[];
}

export type QueueJobStatus =
  | 'queued'
  | 'processing'
  | 'waiting_quota_backoff'
  | 'retrying_high_demand'
  | 'completed'
  | 'failed';

export interface QueueJobInfo {
  id: string;
  type: 'meal_analysis' | 'daily_summary';
  title: string;
  clientRequestId?: string;
  status: QueueJobStatus;
  statusMessage: string;
  model: string;
  attempt: number;
  elapsedMs: number;
  positionInQueue?: number;
}

export interface QueueRecentJob {
  id: string;
  type: string;
  title: string;
  status: 'completed' | 'failed';
  model: string;
  durationMs: number;
  completedAt: string;
}

export interface QueueStatusReport {
  isProcessing: boolean;
  queueLength: number;
  currentJob: QueueJobInfo | null;
  waitingJobs: QueueJobInfo[];
  recentJobs: QueueRecentJob[];
  metrics: {
    currentRpm: number;
    maxPacedRpm: number;
    activeModel: string;
    fallbackModel: string;
    totalProcessed: number;
    serverUptimeSeconds: number;
    cooldownRemainingSeconds?: number;
  };
}


