import mysql from 'mysql2/promise';
import { pool } from '../config/db.js';
import { formatToMysqlDateTime } from '../utils/dateUtils.js';
import { UserProfile, Meal, DailySummary } from '../../shared/types.js';

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
  user: Partial<UserProfile>,
  userId: string = 'user_default'
): Promise<UserProfile> {
  const current = await getUser(userId);
  const updated: UserProfile = { ...current, ...user };

  const query = `
    UPDATE users SET
      name = ?,
      age = ?,
      gender = ?,
      weight_kg = ?,
      height_cm = ?,
      activity_level = ?,
      goal = ?,
      target_calories = ?,
      target_protein_g = ?,
      target_carbs_g = ?,
      target_fat_g = ?,
      allergies = ?,
      dietary_preferences = ?,
      notes = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await pool.execute(query, [
    updated.name,
    updated.age,
    updated.gender,
    updated.weightKg,
    updated.heightCm,
    updated.activityLevel,
    updated.goal,
    updated.targetCalories,
    updated.targetProteinG,
    updated.targetCarbsG,
    updated.targetFatG,
    JSON.stringify(updated.allergies || []),
    JSON.stringify(updated.dietaryPreferences || []),
    updated.notes || null,
    userId,
  ]);

  return getUser(userId);
}

function mapRowToMeal(row: any): Meal {
  return {
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
  };
}

export interface DailyNutritionalTotals {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealsCount: number;
}

// 3. Totales nutricionales agregados directamente en MySQL (ahorro masivo de RAM)
export async function getDailyNutritionalTotals(
  date: string,
  userId: string = 'user_default'
): Promise<DailyNutritionalTotals> {
  const query = `
    SELECT 
      COALESCE(SUM(calorias_estimadas), 0) AS totalCalories,
      COALESCE(SUM(proteinas), 0) AS totalProtein,
      COALESCE(SUM(carbohidratos), 0) AS totalCarbs,
      COALESCE(SUM(grasas), 0) AS totalFat,
      COUNT(*) AS mealsCount
    FROM meals
    WHERE user_id = ? AND meal_date = ?
  `;

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, [userId, date]);
  const row = rows[0];

  return {
    totalCalories: Number(row?.totalCalories) || 0,
    totalProtein: Math.round((Number(row?.totalProtein) || 0) * 10) / 10,
    totalCarbs: Math.round((Number(row?.totalCarbs) || 0) * 10) / 10,
    totalFat: Math.round((Number(row?.totalFat) || 0) * 10) / 10,
    mealsCount: Number(row?.mealsCount) || 0,
  };
}

// 4. Obtener lista de comidas (proyección selectiva: excluye audio_data_url por defecto para optimizar RAM)
export async function getMeals(
  date?: string,
  userId: string = 'user_default',
  includeAudio: boolean = false
): Promise<Meal[]> {
  const audioColumn = includeAudio ? 'audio_data_url' : 'NULL AS audio_data_url';
  let query = `
    SELECT 
      id, user_id, meal_date, meal_time, meal_type,
      image_url, ${audioColumn}, audio_duration_seconds, audio_transcript,
      nombre_plato, calorias_estimadas, proteinas, carbohidratos, grasas, fibra,
      puntaje_plato, feedback_breve, ingredientes_detectados, detalles_audio, created_at
    FROM meals 
    WHERE user_id = ?
  `;
  const params: any[] = [userId];

  if (date) {
    query += ' AND meal_date = ?';
    params.push(date);
  }

  query += ' ORDER BY meal_time ASC';

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, params);
  return rows.map(mapRowToMeal);
}

// 5. Obtener una comida individual por ID con todo su contenido multimedia (audio e imagen)
export async function getMealById(
  id: string,
  userId: string = 'user_default'
): Promise<Meal | null> {
  const query = 'SELECT * FROM meals WHERE id = ? AND user_id = ? LIMIT 1';
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, [id, userId]);

  if (!rows || rows.length === 0) {
    return null;
  }

  return mapRowToMeal(rows[0]);
}

// 6. Obtener comidas para el prompt de resumen diario (excluye tanto image_url como audio_data_url)
export async function getMealsForSummary(
  date: string,
  userId: string = 'user_default'
): Promise<Meal[]> {
  const query = `
    SELECT 
      id, user_id, meal_date, meal_time, meal_type,
      NULL AS image_url, NULL AS audio_data_url, audio_duration_seconds, audio_transcript,
      nombre_plato, calorias_estimadas, proteinas, carbohidratos, grasas, fibra,
      puntaje_plato, feedback_breve, ingredientes_detectados, detalles_audio, created_at
    FROM meals 
    WHERE user_id = ? AND meal_date = ?
    ORDER BY meal_time ASC
  `;

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, [userId, date]);
  return rows.map(mapRowToMeal);
}

// 4. Agregar nueva comida
export async function addMeal(meal: Meal): Promise<Meal> {
  const formattedCreatedAt = formatToMysqlDateTime(meal.createdAt);

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
    formattedCreatedAt,
  ]);

  return {
    ...meal,
    createdAt: formattedCreatedAt,
  };
}

// 5. Eliminar comida por ID
export async function deleteMeal(id: string): Promise<boolean> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'DELETE FROM meals WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

// 5b. Eliminar comidas de días anteriores para liberar espacio en disco (fotos y audios)
export async function purgePastMeals(
  beforeDate: string,
  userId: string = 'user_default'
): Promise<number> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'DELETE FROM meals WHERE user_id = ? AND meal_date < ?',
    [userId, beforeDate]
  );

  // Opción A: Reconstruir físicamente el archivo .ibd (InnoDB) para devolver el espacio libre al disco del SO
  try {
    await pool.query('OPTIMIZE TABLE meals');
  } catch (optErr) {
    console.warn('Advertencia al ejecutar OPTIMIZE TABLE meals:', optErr);
  }

  return result.affectedRows;
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

