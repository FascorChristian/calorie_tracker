import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { UserProfile, Meal, DailySummary } from '../src/types.js';

dotenv.config();

// Crear el Pool de conexiones a MySQL
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'calorie_tracker',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // Para recibir las fechas como string 'YYYY-MM-DD' sin conversiones UTC
});

// Helper para parsear campos JSON que puedan venir como string o ya parseados
function safeJsonParse<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

// 1. Obtener perfil de usuario
export async function getUser(userId: string = 'user_default'): Promise<UserProfile> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (!rows || rows.length === 0) {
    throw new Error(`Usuario con id '${userId}' no encontrado en la base de datos.`);
  }

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    age: Number(row.age),
    gender: row.gender,
    weightKg: Number(row.weight_kg),
    heightCm: Number(row.height_cm),
    activityLevel: row.activity_level,
    goal: row.goal,
    targetCalories: Number(row.target_calories),
    targetProteinG: Number(row.target_protein_g),
    targetCarbsG: Number(row.target_carbs_g),
    targetFatG: Number(row.target_fat_g),
    allergies: safeJsonParse<string[]>(row.allergies, []),
    dietaryPreferences: safeJsonParse<string[]>(row.dietary_preferences, []),
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 2. Actualizar perfil de usuario
export async function updateUser(
  updatedUser: Partial<UserProfile>,
  userId: string = 'user_default'
): Promise<UserProfile> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updatedUser.name !== undefined) { fields.push('name = ?'); values.push(updatedUser.name); }
  if (updatedUser.age !== undefined) { fields.push('age = ?'); values.push(updatedUser.age); }
  if (updatedUser.gender !== undefined) { fields.push('gender = ?'); values.push(updatedUser.gender); }
  if (updatedUser.weightKg !== undefined) { fields.push('weight_kg = ?'); values.push(updatedUser.weightKg); }
  if (updatedUser.heightCm !== undefined) { fields.push('height_cm = ?'); values.push(updatedUser.heightCm); }
  if (updatedUser.activityLevel !== undefined) { fields.push('activity_level = ?'); values.push(updatedUser.activityLevel); }
  if (updatedUser.goal !== undefined) { fields.push('goal = ?'); values.push(updatedUser.goal); }
  if (updatedUser.targetCalories !== undefined) { fields.push('target_calories = ?'); values.push(updatedUser.targetCalories); }
  if (updatedUser.targetProteinG !== undefined) { fields.push('target_protein_g = ?'); values.push(updatedUser.targetProteinG); }
  if (updatedUser.targetCarbsG !== undefined) { fields.push('target_carbs_g = ?'); values.push(updatedUser.targetCarbsG); }
  if (updatedUser.targetFatG !== undefined) { fields.push('target_fat_g = ?'); values.push(updatedUser.targetFatG); }
  if (updatedUser.allergies !== undefined) { fields.push('allergies = ?'); values.push(JSON.stringify(updatedUser.allergies)); }
  if (updatedUser.dietaryPreferences !== undefined) { fields.push('dietary_preferences = ?'); values.push(JSON.stringify(updatedUser.dietaryPreferences)); }
  if (updatedUser.notes !== undefined) { fields.push('notes = ?'); values.push(updatedUser.notes); }

  if (fields.length > 0) {
    values.push(userId);
    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  return await getUser(userId);
}

// 3. Obtener comidas (filtradas opcionalmente por fecha)
export async function getMeals(
  date?: string,
  userId: string = 'user_default'
): Promise<Meal[]> {
  let query = 'SELECT * FROM meals WHERE user_id = ?';
  const params: any[] = [userId];

  if (date) {
    query += ' AND meal_date = ?';
    params.push(date);
  }

  query += ' ORDER BY meal_time ASC';

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, params);

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    date: row.meal_date,
    time: row.meal_time,
    mealType: row.meal_type,
    imageUrl: row.image_url || undefined,
    audioDataUrl: row.audio_data_url || undefined,
    audioDurationSeconds: Number(row.audio_duration_seconds) || 0,
    audioTranscript: row.audio_transcript || undefined,
    nombre_plato: row.nombre_plato,
    calorias_estimadas: Number(row.calorias_estimadas),
    macros: {
      proteinas: Number(row.proteinas),
      carbohidratos: Number(row.carbohidratos),
      grasas: Number(row.grasas),
      fibra: row.fibra !== null && row.fibra !== undefined ? Number(row.fibra) : undefined,
    },
    puntaje_plato: Number(row.puntaje_plato),
    feedback_breve: row.feedback_breve || '',
    ingredientes_detectados: safeJsonParse<string[]>(row.ingredientes_detectados, []),
    detalles_audio: row.detalles_audio || undefined,
    createdAt: row.created_at,
  }));
}

// 4. Agregar nueva comida
export async function addMeal(meal: Meal): Promise<Meal> {
  const query = `
    INSERT INTO meals (
      id, user_id, meal_date, meal_time, meal_type,
      image_url, audio_data_url, audio_duration_seconds, audio_transcript,
      nombre_plato, calorias_estimadas, proteinas, carbohidratos, grasas, fibra,
      puntaje_plato, feedback_breve, ingredientes_detectados, detalles_audio, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await pool.execute(query, [
    meal.id,
    meal.userId,
    meal.date,
    meal.time,
    meal.mealType,
    meal.imageUrl || null,
    meal.audioDataUrl || null,
    meal.audioDurationSeconds || 0,
    meal.audioTranscript || null,
    meal.nombre_plato,
    meal.calorias_estimadas,
    meal.macros.proteinas,
    meal.macros.carbohidratos,
    meal.macros.grasas,
    meal.macros.fibra ?? null,
    meal.puntaje_plato,
    meal.feedback_breve,
    JSON.stringify(meal.ingredientes_detectados || []),
    meal.detalles_audio || null,
    meal.createdAt || new Date().toISOString(),
  ]);

  return meal;
}

// 5. Eliminar comida por ID
export async function deleteMeal(id: string): Promise<boolean> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'DELETE FROM meals WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

// 6. Obtener resumen diario por fecha
export async function getDailySummary(
  date: string,
  userId: string = 'user_default'
): Promise<DailySummary | null> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date = ? LIMIT 1',
    [userId, date]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    date: row.summary_date,
    userId: row.user_id,
    totalCalories: Number(row.total_calories),
    totalProtein: Number(row.total_protein),
    totalCarbs: Number(row.total_carbs),
    totalFat: Number(row.total_fat),
    puntaje_diario: Number(row.puntaje_diario),
    consejo_diario: row.consejo_diario,
    balance_nutricional: row.balance_nutricional,
    puntos_fuertes: safeJsonParse<string[]>(row.puntos_fuertes, []),
    areas_de_mejora: safeJsonParse<string[]>(row.areas_de_mejora, []),
    mealsCount: Number(row.meals_count),
    updatedAt: row.updated_at,
  };
}

// 7. Guardar o actualizar resumen diario (UPSERT)
export async function saveDailySummary(
  summary: DailySummary
): Promise<DailySummary> {
  const id = `${summary.userId}_${summary.date}`;
  const query = `
    INSERT INTO daily_summaries (
      id, user_id, summary_date, total_calories, total_protein, total_carbs, total_fat,
      puntaje_diario, consejo_diario, balance_nutricional, puntos_fuertes, areas_de_mejora,
      meals_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      total_calories = VALUES(total_calories),
      total_protein = VALUES(total_protein),
      total_carbs = VALUES(total_carbs),
      total_fat = VALUES(total_fat),
      puntaje_diario = VALUES(puntaje_diario),
      consejo_diario = VALUES(consejo_diario),
      balance_nutricional = VALUES(balance_nutricional),
      puntos_fuertes = VALUES(puntos_fuertes),
      areas_de_mejora = VALUES(areas_de_mejora),
      meals_count = VALUES(meals_count),
      updated_at = NOW()
  `;

  await pool.execute(query, [
    id,
    summary.userId,
    summary.date,
    summary.totalCalories,
    summary.totalProtein,
    summary.totalCarbs,
    summary.totalFat,
    summary.puntaje_diario,
    summary.consejo_diario,
    summary.balance_nutricional,
    JSON.stringify(summary.puntos_fuertes || []),
    JSON.stringify(summary.areas_de_mejora || []),
    summary.mealsCount,
  ]);

  return summary;
}
