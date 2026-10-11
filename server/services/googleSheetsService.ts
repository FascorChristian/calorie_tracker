import {
  getSheetsClient,
  GOOGLE_SPREADSHEET_ID,
  isUsingAppsScript,
  callAppsScript,
} from '../config/google.js';
import { UserProfile, Meal, DailySummary } from '../../shared/types.js';
import { formatToMysqlDateTime } from '../utils/dateUtils.js';

// Nombres de las hojas de trabajo en el Google Spreadsheet
export const SHEETS_NAMES = {
  MEALS: 'Comidas',
  USERS: 'Usuarios',
  SUMMARIES: 'Resumenes_Diarios',
} as const;

// Encabezados estándar para cada hoja
const MEALS_HEADERS = [
  'id',
  'user_id',
  'meal_date',
  'meal_time',
  'meal_type',
  'image_url',
  'drive_file_id',
  'audio_duration_seconds',
  'audio_transcript',
  'nombre_plato',
  'calorias_estimadas',
  'proteinas',
  'carbohidratos',
  'grasas',
  'fibra',
  'puntaje_plato',
  'feedback_breve',
  'ingredientes_detectados',
  'detalles_audio',
  'created_at',
];

const USERS_HEADERS = [
  'id',
  'name',
  'age',
  'gender',
  'weight_kg',
  'height_cm',
  'activity_level',
  'goal',
  'target_calories',
  'target_protein_g',
  'target_carbs_g',
  'target_fat_g',
  'allergies',
  'dietary_preferences',
  'notes',
  'created_at',
  'updated_at',
];

const SUMMARIES_HEADERS = [
  'id',
  'user_id',
  'summary_date',
  'total_calories',
  'total_protein',
  'total_carbs',
  'total_fat',
  'puntaje_diario',
  'consejo_diario',
  'balance_nutricional',
  'puntos_fuertes',
  'areas_de_mejora',
  'meals_count',
  'updated_at',
];

// Cache para almacenar los sheetId numéricos
const sheetIdCache: Record<string, number> = {};
let isInitialized = false;

function safeJsonParse<T>(val: any, fallback: T): T {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

/**
 * Asegura que las hojas (Comidas, Usuarios, Resumenes_Diarios) y sus encabezados
 * existan en el Google Spreadsheet. Si no existen, las crea automáticamente.
 */
export async function initializeGoogleSheets(): Promise<void> {
  if (isUsingAppsScript()) {
    await callAppsScript('initialize');
    isInitialized = true;
    return;
  }

  if (!GOOGLE_SPREADSHEET_ID) {
    throw new Error('Falta configurar GOOGLE_SPREADSHEET_ID (o GOOGLE_APPS_SCRIPT_URL) en el archivo .env');
  }

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
  });

  const existingSheets = meta.data.sheets || [];
  const existingTitles = new Set(
    existingSheets.map((s) => s.properties?.title).filter(Boolean)
  );

  // Guardar en cache los sheetId numéricos
  for (const s of existingSheets) {
    if (s.properties?.title && s.properties?.sheetId !== undefined && s.properties?.sheetId !== null) {
      sheetIdCache[s.properties.title] = s.properties.sheetId;
    }
  }

  // 1. Crear hojas que falten
  const requests: any[] = [];
  for (const sheetName of Object.values(SHEETS_NAMES)) {
    if (!existingTitles.has(sheetName)) {
      requests.push({
        addSheet: {
          properties: {
            title: sheetName,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      });
    }
  }

  if (requests.length > 0) {
    const updateRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      requestBody: { requests },
    });

    // Actualizar cache con los nuevos sheetIds
    const replies = updateRes.data.replies || [];
    for (const reply of replies) {
      if (reply.addSheet?.properties?.title && reply.addSheet.properties.sheetId !== undefined) {
        sheetIdCache[reply.addSheet.properties.title] = reply.addSheet.properties.sheetId;
      }
    }
  }

  // 2. Asegurar fila de encabezados en cada hoja
  await Promise.all([
    ensureHeader(SHEETS_NAMES.MEALS, MEALS_HEADERS),
    ensureHeader(SHEETS_NAMES.USERS, USERS_HEADERS),
    ensureHeader(SHEETS_NAMES.SUMMARIES, SUMMARIES_HEADERS),
  ]);

  // 3. Crear usuario por defecto si no existe ninguno en Usuarios
  await seedDefaultUserIfEmpty();

  isInitialized = true;
}

async function ensureHeader(sheetTitle: string, headers: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${sheetTitle}!A1:Z1`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${sheetTitle}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers],
      },
    });
  }
}

async function seedDefaultUserIfEmpty(): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.USERS}!A2:A2`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    const now = formatToMysqlDateTime();
    const defaultUserRow = [
      'user_default',
      'Usuario Demo',
      28,
      'masculino',
      78,
      178,
      'moderado',
      'deficit',
      2150,
      160,
      200,
      65,
      JSON.stringify(['Lactosa moderada']),
      JSON.stringify(['Alto en proteína', 'Comida real']),
      'Entrenamiento de fuerza 4x por semana. Buscando definición muscular preservando masa magra.',
      now,
      now,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${SHEETS_NAMES.USERS}!A:Q`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [defaultUserRow],
      },
    });
  }
}

async function getNumericSheetId(sheetTitle: string): Promise<number> {
  if (sheetIdCache[sheetTitle] !== undefined) {
    return sheetIdCache[sheetTitle];
  }
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`No se encontró la hoja '${sheetTitle}' en Google Sheets.`);
  }
  sheetIdCache[sheetTitle] = sheet.properties.sheetId;
  return sheet.properties.sheetId;
}

// ============================================================================
// 1. USUARIOS (UserProfile)
// ============================================================================

export async function getUser(userId: string = 'user_default'): Promise<UserProfile> {
  if (isUsingAppsScript()) {
    return await callAppsScript<UserProfile>('getUser', { userId });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.USERS}!A2:Q`,
  });

  const rows = res.data.values || [];
  const row = rows.find((r) => r[0] === userId);

  if (!row) {
    // Si no existe, devuelve usuario por defecto
    return {
      id: userId,
      name: 'Usuario Demo',
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
      dietaryPreferences: ['Alto en proteína'],
      notes: '',
    };
  }

  return {
    id: row[0],
    name: row[1] || 'Usuario',
    age: Number(row[2]) || 28,
    gender: (row[3] as any) || 'masculino',
    weightKg: Number(row[4]) || 70,
    heightCm: Number(row[5]) || 170,
    activityLevel: (row[6] as any) || 'moderado',
    goal: (row[7] as any) || 'deficit',
    targetCalories: Number(row[8]) || 2000,
    targetProteinG: Number(row[9]) || 140,
    targetCarbsG: Number(row[10]) || 200,
    targetFatG: Number(row[11]) || 65,
    allergies: safeJsonParse<string[]>(row[12], []),
    dietaryPreferences: safeJsonParse<string[]>(row[13], []),
    notes: row[14] || '',
    createdAt: row[15],
    updatedAt: row[16],
  };
}

export async function updateUser(
  user: Partial<UserProfile>,
  userId: string = 'user_default'
): Promise<UserProfile> {
  if (isUsingAppsScript()) {
    return await callAppsScript<UserProfile>('updateUser', { user, userId });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const current = await getUser(userId);
  const updated: UserProfile = { ...current, ...user };

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.USERS}!A2:Q`,
  });

  const rows = res.data.values || [];
  const index = rows.findIndex((r) => r[0] === userId);
  const now = formatToMysqlDateTime();

  const userRow = [
    userId,
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
    updated.notes || '',
    current.createdAt || now,
    now,
  ];

  if (index !== -1) {
    const sheetRowNumber = index + 2; // +2 porque el índice es 0-based y la fila 1 es encabezado
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${SHEETS_NAMES.USERS}!A${sheetRowNumber}:Q${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [userRow] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${SHEETS_NAMES.USERS}!A:Q`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [userRow] },
    });
  }

  return updated;
}

// ============================================================================
// 2. COMIDAS (Meal)
// ============================================================================

function mapRowToMeal(row: any[]): Meal {
  return {
    id: row[0],
    userId: row[1],
    date: row[2],
    time: row[3],
    mealType: row[4] as any,
    imageUrl: row[5] || undefined,
    driveFileId: row[6] || undefined,
    audioDurationSeconds: Number(row[7]) || 0,
    audioTranscript: row[8] || undefined,
    nombre_plato: row[9] || 'Comida',
    calorias_estimadas: Number(row[10]) || 0,
    macros: {
      proteinas: Number(row[11]) || 0,
      carbohidratos: Number(row[12]) || 0,
      grasas: Number(row[13]) || 0,
      fibra: row[14] !== undefined && row[14] !== '' ? Number(row[14]) : undefined,
    },
    puntaje_plato: Number(row[15]) || 0,
    feedback_breve: row[16] || '',
    ingredientes_detectados: safeJsonParse<string[]>(row[17], []),
    detalles_audio: row[18] || undefined,
    createdAt: row[19] || '',
  };
}

export async function getMeals(
  date?: string,
  userId: string = 'user_default',
  _includeAudio: boolean = false
): Promise<Meal[]> {
  if (isUsingAppsScript()) {
    return await callAppsScript<Meal[]>('getMeals', { date, userId });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.MEALS}!A2:T`,
  });

  const rows = res.data.values || [];
  let meals = rows.map(mapRowToMeal).filter((m) => m.userId === userId);

  if (date) {
    meals = meals.filter((m) => m.date === date);
  }

  // Ordenar por hora ascendente
  meals.sort((a, b) => a.time.localeCompare(b.time));
  return meals;
}

export async function getMealById(id: string): Promise<Meal | null> {
  if (isUsingAppsScript()) {
    return await callAppsScript<Meal | null>('getMealById', { id });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.MEALS}!A2:T`,
  });

  const rows = res.data.values || [];
  const found = rows.find((r) => r[0] === id);
  if (!found) return null;

  return mapRowToMeal(found);
}

export async function getMealsForSummary(
  date: string,
  userId: string = 'user_default'
): Promise<Meal[]> {
  const meals = await getMeals(date, userId);
  // Excluye referencias pesadas para construir el prompt
  return meals.map((m) => ({
    ...m,
    imageUrl: undefined,
    audioDataUrl: undefined,
  }));
}

export async function addMeal(meal: Meal): Promise<Meal> {
  if (isUsingAppsScript()) {
    return await callAppsScript<Meal>('addMeal', { meal });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const formattedCreatedAt = formatToMysqlDateTime(meal.createdAt);

  const row = [
    meal.id,
    meal.userId,
    meal.date,
    meal.time,
    meal.mealType,
    meal.imageUrl || '',
    meal.driveFileId || '',
    meal.audioDurationSeconds || 0,
    meal.audioTranscript || '',
    meal.nombre_plato,
    meal.calorias_estimadas,
    meal.macros.proteinas,
    meal.macros.carbohidratos,
    meal.macros.grasas,
    meal.macros.fibra ?? '',
    meal.puntaje_plato,
    meal.feedback_breve,
    JSON.stringify(meal.ingredientes_detectados || []),
    meal.detalles_audio || '',
    formattedCreatedAt,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.MEALS}!A:T`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return {
    ...meal,
    createdAt: formattedCreatedAt,
  };
}

export async function deleteMeal(id: string): Promise<boolean> {
  if (isUsingAppsScript()) {
    return await callAppsScript<boolean>('deleteMeal', { id });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.MEALS}!A2:A`,
  });

  const rows = res.data.values || [];
  const index = rows.findIndex((r) => r[0] === id);
  if (index === -1) return false;

  const sheetId = await getNumericSheetId(SHEETS_NAMES.MEALS);
  const rowIndex = index + 1; // 0-based relativo a la fila A2, por ende fila 1 de datos es index 1 (fila 2 de la hoja)

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

export async function purgePastMeals(
  beforeDate: string,
  userId: string = 'user_default'
): Promise<number> {
  if (isUsingAppsScript()) {
    return await callAppsScript<number>('purgePastMeals', { beforeDate, userId });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.MEALS}!A2:C`,
  });

  const rows = res.data.values || [];
  // Recopilar índices de filas a eliminar (de mayor a menor para no alterar los índices subsiguientes)
  const indicesToDelete: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowUserId = rows[i][1];
    const rowDate = rows[i][2];
    if (rowUserId === userId && rowDate && rowDate < beforeDate) {
      indicesToDelete.push(i + 1); // +1 porque el encabezado está en la fila 0 (A1)
    }
  }

  if (indicesToDelete.length === 0) return 0;

  // Ordenar en orden descendente
  indicesToDelete.sort((a, b) => b - a);
  const sheetId = await getNumericSheetId(SHEETS_NAMES.MEALS);

  const requests = indicesToDelete.map((rowIdx) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowIdx,
        endIndex: rowIdx + 1,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    requestBody: { requests },
  });

  return indicesToDelete.length;
}

// ============================================================================
// 3. RESÚMENES DIARIOS (DailySummary)
// ============================================================================

export async function getDailySummary(
  date: string,
  userId: string = 'user_default'
): Promise<DailySummary | null> {
  if (isUsingAppsScript()) {
    return await callAppsScript<DailySummary | null>('getDailySummary', { date, userId });
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.SUMMARIES}!A2:N`,
  });

  const rows = res.data.values || [];
  const row = rows.find((r) => r[1] === userId && r[2] === date);
  if (!row) return null;

  return {
    date: row[2],
    userId: row[1],
    totalCalories: Number(row[3]) || 0,
    totalProtein: Number(row[4]) || 0,
    totalCarbs: Number(row[5]) || 0,
    totalFat: Number(row[6]) || 0,
    puntaje_diario: Number(row[7]) || 0,
    consejo_diario: row[8] || '',
    balance_nutricional: row[9] || '',
    puntos_fuertes: safeJsonParse<string[]>(row[10], []),
    areas_de_mejora: safeJsonParse<string[]>(row[11], []),
    mealsCount: Number(row[12]) || 0,
    updatedAt: row[13] || '',
  };
}

export async function saveDailySummary(summary: DailySummary): Promise<void> {
  if (isUsingAppsScript()) {
    await callAppsScript<void>('saveDailySummary', { summary });
    return;
  }

  if (!isInitialized) await initializeGoogleSheets();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${SHEETS_NAMES.SUMMARIES}!A2:N`,
  });

  const rows = res.data.values || [];
  const index = rows.findIndex((r) => r[1] === summary.userId && r[2] === summary.date);
  const now = formatToMysqlDateTime();
  const id = `${summary.userId}_${summary.date}`;

  const summaryRow = [
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
    summary.updatedAt || now,
  ];

  if (index !== -1) {
    const sheetRowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${SHEETS_NAMES.SUMMARIES}!A${sheetRowNumber}:N${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [summaryRow] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${SHEETS_NAMES.SUMMARIES}!A:N`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [summaryRow] },
    });
  }
}

// ============================================================================
// 4. TOTALES NUTRICIONALES DIARIOS
// ============================================================================

export async function getDailyNutritionalTotals(
  date: string,
  userId: string = 'user_default'
): Promise<{
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealsCount: number;
}> {
  const meals = await getMeals(date, userId);

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const m of meals) {
    totalCalories += Number(m.calorias_estimadas) || 0;
    totalProtein += Number(m.macros.proteinas) || 0;
    totalCarbs += Number(m.macros.carbohidratos) || 0;
    totalFat += Number(m.macros.grasas) || 0;
  }

  return {
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    mealsCount: meals.length,
  };
}

