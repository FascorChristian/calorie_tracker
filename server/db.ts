import fs from 'fs';
import path from 'path';
import { UserProfile, Meal, DailySummary } from '../src/types.js';

interface DatabaseSchema {
  user: UserProfile;
  meals: Meal[];
  dailySummaries: Record<string, DailySummary>; // date -> DailySummary
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_USER: UserProfile = {
  id: 'user_default',
  name: 'Christian Díaz',
  age: 28,
  gender: 'masculino',
  weightKg: 78,
  heightCm: 178,
  activityLevel: 'moderado',
  goal: 'deficit',
  targetCalories: 2150,
  targetProteinG: 160,
  targetCarbsG: 200,
  targetFatG: 65,
  allergies: ['Lactosa moderada'],
  dietaryPreferences: ['Alto en proteína', 'Comida real'],
  notes: 'Entrenamiento de fuerza 4x por semana. Buscando definición muscular preservando masa magra.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SEED_MEALS: Meal[] = [
  {
    id: 'meal_seed_1',
    userId: 'user_default',
    date: getTodayString(),
    time: '08:30',
    mealType: 'desayuno',
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    nombre_plato: 'Omelette de 3 Huevos con Espinacas, Champiñones y Tostadas Integrales',
    calorias_estimadas: 460,
    macros: {
      proteinas: 32,
      carbohidratos: 36,
      grasas: 20,
      fibra: 6,
    },
    puntaje_plato: 9.2,
    feedback_breve: 'Excelente desayuno alto en proteína biodisponible y micronutrientes. Gran inicio para control de saciedad en déficit.',
    ingredientes_detectados: [
      '3 huevos enteros camperos',
      'Espinacas salteadas (50g)',
      'Champiñones (40g)',
      '2 rebanadas pan integral de centeno',
      '1 cucharadita de aceite de oliva virgen extra'
    ],
    detalles_audio: 'Mencionó haber usado 1 cucharadita medida de AOVE y sin quesos añadidos por intolerancia a la lactosa.',
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'meal_seed_2',
    userId: 'user_default',
    date: getTodayString(),
    time: '13:45',
    mealType: 'almuerzo',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    nombre_plato: 'Bowl de Salmón a la Plancha con Quinoa, Aguacate y Ensalada Verde',
    calorias_estimadas: 680,
    macros: {
      proteinas: 46,
      carbohidratos: 52,
      grasas: 28,
      fibra: 9,
    },
    puntaje_plato: 9.4,
    feedback_breve: 'Aporte sobresaliente de ácidos grasos Omega-3 y carbohidratos complejos. Muy alineado con recuperación muscular.',
    ingredientes_detectados: [
      'Salmón a la plancha (200g)',
      'Quinoa cocida (140g)',
      'Medio aguacate Hass (80g)',
      'Mix de hojas verdes con pepino y tomate cherry',
      'Vinagreta de limón y mostaza Dijon'
    ],
    detalles_audio: 'Detalló que el salmón se cocinó sin aceite añadido ya que aprovechó su propia grasa natural.',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  }
];

function initDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content) as DatabaseSchema;
      return data;
    } catch (err) {
      console.error('Error reading db file, regenerating defaults:', err);
    }
  }

  const initialData: DatabaseSchema = {
    user: DEFAULT_USER,
    meals: SEED_MEALS,
    dailySummaries: {
      [getTodayString()]: {
        date: getTodayString(),
        userId: 'user_default',
        totalCalories: 1140,
        totalProtein: 78,
        totalCarbs: 88,
        totalFat: 48,
        puntaje_diario: 91,
        consejo_diario: 'Vas a mitad del día con excelente adhesión al déficit y densidad proteica. Planifica una cena ligera con 35-40g de proteína magra para cerrar en tu meta de 2150 kcal.',
        balance_nutricional: 'Excelente (Progresión Óptima)',
        puntos_fuertes: [
          'Proteína de alto valor biológico en desayuno y almuerzo (78g acumulados).',
          'Grasas saludables mono y poliinsaturadas (Omega-3 de salmón y aguacate).',
          'Control impecable de aceites de cocina reportados con precisión por voz.'
        ],
        areas_de_mejora: [
          'Recuerda hidratación constante (mínimo 2.5L de agua).',
          'Cena recomendada: Pechuga de pavo o pescado blanco con verduras al vapor.'
        ],
        mealsCount: 2,
        updatedAt: new Date().toISOString(),
      }
    }
  };

  saveDb(initialData);
  return initialData;
}

export function loadDb(): DatabaseSchema {
  return initDb();
}

export function saveDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db file:', err);
  }
}

export function getUser(): UserProfile {
  const db = loadDb();
  return db.user;
}

export function updateUser(updatedUser: Partial<UserProfile>): UserProfile {
  const db = loadDb();
  db.user = {
    ...db.user,
    ...updatedUser,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
  return db.user;
}

export function getMeals(date?: string): Meal[] {
  const db = loadDb();
  if (date) {
    return db.meals.filter((m) => m.date === date);
  }
  return db.meals;
}

export function addMeal(meal: Meal): Meal {
  const db = loadDb();
  db.meals.unshift(meal);
  saveDb(db);
  return meal;
}

export function deleteMeal(id: string): boolean {
  const db = loadDb();
  const initialLen = db.meals.length;
  db.meals = db.meals.filter((m) => m.id !== id);
  const changed = db.meals.length !== initialLen;
  if (changed) {
    saveDb(db);
  }
  return changed;
}

export function getDailySummary(date: string): DailySummary | null {
  const db = loadDb();
  return db.dailySummaries[date] || null;
}

export function saveDailySummary(summary: DailySummary): DailySummary {
  const db = loadDb();
  db.dailySummaries[summary.date] = summary;
  saveDb(db);
  return summary;
}
