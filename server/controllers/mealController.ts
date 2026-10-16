import { Request, Response } from 'express';
import {
  getUser,
  getMeals,
  getMealById,
  addMeal,
  deleteMeal,
  purgePastMeals,
  getDailySummary,
  saveDailySummary,
  getDailyNutritionalTotals,
} from '../services/googleSheetsService.js';
import { analyzeMealWithGemini } from '../services/geminiService.js';
import { geminiQueueManager } from '../services/queueManager.js';
import { uploadMealImageToDrive, deleteImageFromDrive } from '../services/googleDriveService.js';
import { formatToMysqlDateTime, getTodayString, getSantiagoTimeString } from '../utils/dateUtils.js';
import { Meal, DailySummary } from '../../shared/types.js';

export async function getMealsHandler(req: Request, res: Response) {
  try {
    const date = req.query.date as string | undefined;
    const includeAudio = req.query.includeAudio === 'true';
    const meals = await getMeals(date, 'user_default', includeAudio);
    res.json(meals);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener comidas' });
  }
}

export async function getMealByIdHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const meal = await getMealById(id);
    if (!meal) {
      return res.status(404).json({ error: 'Comida no encontrada' });
    }
    res.json(meal);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener detalle de comida' });
  }
}

interface AnalysisResult {
  meal: Meal;
  summary: DailySummary;
}

interface InFlightRequest {
  status: 'processing' | 'completed' | 'error';
  promise?: Promise<AnalysisResult>;
  result?: AnalysisResult;
  error?: string;
  createdAt: number;
}

// Map en memoria para solicitudes de análisis en curso y completadas recientemente (TTL: 15 min)
const activeRequests = new Map<string, InFlightRequest>();

// Limpiar solicitudes antiguas cada 10 minutos
setInterval(() => {
  const now = Date.now();
  const maxAge = 15 * 60 * 1000;
  for (const [key, req] of activeRequests.entries()) {
    if (now - req.createdAt > maxAge) {
      activeRequests.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

export async function getMealStatusHandler(req: Request, res: Response) {
  try {
    const clientRequestId = req.params.clientRequestId;
    if (!clientRequestId) {
      return res.status(400).json({ error: 'clientRequestId es requerido' });
    }

    // 1. Revisar caché en memoria
    const cached = activeRequests.get(clientRequestId);
    if (cached) {
      if (cached.status === 'completed' && cached.result) {
        return res.json({
          status: 'completed',
          meal: cached.result.meal,
          summary: cached.result.summary,
        });
      }
      if (cached.status === 'processing') {
        const queueJob = geminiQueueManager.getJobByClientRequestId(clientRequestId);
        return res.json({
          status: 'processing',
          queuePosition: queueJob?.position || 1,
          queueStatus: queueJob?.statusMessage || 'Procesando en cola con Gemini 3.1 Flash Lite...',
          model: queueJob?.model || 'gemini-3.1-flash-lite',
        });
      }
      if (cached.status === 'error') {
        return res.json({
          status: 'error',
          error: cached.error || 'Error al procesar comida',
        });
      }
    }

    // 2. Revisar si ya quedó persistido en Google Sheets
    const mealId = `meal_${clientRequestId}`;
    const meal = await getMealById(mealId);
    if (meal) {
      const summary = await getDailySummary(meal.date).catch(() => null);
      return res.json({
        status: 'completed',
        meal,
        summary,
      });
    }

    return res.json({
      status: 'not_found',
    });
  } catch (err: any) {
    console.error('Error in getMealStatusHandler:', err);
    return res.status(500).json({ error: err.message || 'Error al consultar estado' });
  }
}

export async function analyzeMealHandler(req: Request, res: Response) {
  try {
    const {
      clientRequestId: rawRequestId,
      imageBase64,
      imageMimeType,
      audioBase64,
      audioMimeType,
      audioTranscript,
      audioDurationSeconds,
      mealType = 'almuerzo',
      notes,
      date,
      time,
    } = req.body;

    const clientRequestId = rawRequestId && typeof rawRequestId === 'string' && rawRequestId.trim()
      ? rawRequestId.trim()
      : undefined;

    // Idempotencia: Si ya hay una petición con este clientRequestId en memoria
    if (clientRequestId && activeRequests.has(clientRequestId)) {
      const existing = activeRequests.get(clientRequestId)!;
      if (existing.status === 'completed' && existing.result) {
        return res.json({
          success: true,
          meal: existing.result.meal,
          summary: existing.result.summary,
        });
      }
      if (existing.status === 'processing' && existing.promise) {
        try {
          const result = await existing.promise;
          return res.json({
            success: true,
            meal: result.meal,
            summary: result.summary,
          });
        } catch (err: any) {
          return res.status(500).json({
            error: err.message || 'Error al procesar con Gemini',
          });
        }
      }
    }

    // Idempotencia: Si ya quedó guardada previamente en Google Sheets
    if (clientRequestId) {
      const mealId = `meal_${clientRequestId}`;
      try {
        const existingMeal = await getMealById(mealId);
        if (existingMeal) {
          const existingSummary = await getDailySummary(existingMeal.date).catch(() => null);
          return res.json({
            success: true,
            meal: existingMeal,
            summary: existingSummary,
          });
        }
      } catch (checkErr) {
        console.warn('Aviso verificando comida existente en Google Sheets:', checkErr);
      }
    }

    if (!imageBase64 && !audioBase64 && !notes) {
      return res.status(400).json({
        error: 'Se requiere al menos una imagen, una nota de voz o descripción.',
      });
    }

    const mealId = clientRequestId
      ? `meal_${clientRequestId}`
      : 'meal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const runAnalysis = async (): Promise<AnalysisResult> => {
      const user = await getUser();

      // Call Gemini 3.1 Flash Lite multimodal with queue manager
      const analysis = await analyzeMealWithGemini({
        imageBase64,
        imageMimeType,
        audioBase64,
        audioMimeType,
        audioTranscript,
        mealType,
        user,
        notes,
        clientRequestId,
      });

      // Subir foto a Google Drive si se incluyó una imagen
      let driveImageUrl: string | undefined = undefined;
      let driveFileId: string | undefined = undefined;

      if (imageBase64) {
        try {
          const uploadResult = await uploadMealImageToDrive({
            imageBase64,
            fileName: clientRequestId ? `comida_${clientRequestId}_${mealType}.jpg` : `comida_${Date.now()}_${mealType}.jpg`,
            mimeType: imageMimeType || 'image/jpeg',
          });
          driveImageUrl = uploadResult.directImageUrl;
          driveFileId = uploadResult.fileId;
        } catch (driveErr: any) {
          console.warn('Aviso: No se pudo subir imagen a Google Drive, usando respaldo:', driveErr?.message || driveErr);
          // Respaldo para que la app no falle si Drive no está configurado
          driveImageUrl = imageBase64;
        }
      }

      // Zona horaria de Santiago (Chile) si no se especifica explícitamente
      const mealDate = date || getTodayString();
      const mealTime = time || getSantiagoTimeString();

      const newMeal: Meal = {
        id: mealId,
        userId: user.id,
        date: mealDate,
        time: mealTime,
        mealType: mealType,
        imageUrl: driveImageUrl,
        driveFileId: driveFileId,
        audioDataUrl: audioBase64,
        audioDurationSeconds: audioDurationSeconds || 0,
        audioTranscript: analysis.detalles_audio,
        nombre_plato: analysis.nombre_plato,
        calorias_estimadas: analysis.calorias_estimadas,
        macros: analysis.macros,
        puntaje_plato: analysis.puntaje_plato,
        feedback_breve: analysis.feedback_breve,
        ingredientes_detectados: analysis.ingredientes_detectados,
        detalles_audio: analysis.detalles_audio,
        createdAt: formatToMysqlDateTime(),
      };

      const savedMeal = await addMeal(newMeal);

      // Auto-update Daily Summary totals en Google Sheets
      const totals = await getDailyNutritionalTotals(mealDate, user.id);

      const existingSummary = await getDailySummary(mealDate);
      const updatedSummary: DailySummary = {
        date: mealDate,
        userId: user.id,
        totalCalories: totals.totalCalories,
        totalProtein: totals.totalProtein,
        totalCarbs: totals.totalCarbs,
        totalFat: totals.totalFat,
        puntaje_diario: existingSummary?.puntaje_diario || Math.min(100, Math.round((savedMeal.puntaje_plato * 10))),
        consejo_diario: existingSummary?.consejo_diario || 'Has añadido un nuevo registro multimodal. Puedes recalcular tu puntaje integral del día cuando desees.',
        balance_nutricional: existingSummary?.balance_nutricional || 'En progreso',
        puntos_fuertes: existingSummary?.puntos_fuertes || [
          `Registrado ${savedMeal.nombre_plato} con éxito.`,
        ],
        areas_de_mejora: existingSummary?.areas_de_mejora || [
          `Mantén el seguimiento de hidratación y próximas comidas.`,
        ],
        mealsCount: totals.mealsCount,
        updatedAt: formatToMysqlDateTime(),
      };
      await saveDailySummary(updatedSummary);

      return {
        meal: savedMeal,
        summary: updatedSummary,
      };
    };

    if (clientRequestId) {
      const promise = runAnalysis();
      activeRequests.set(clientRequestId, {
        status: 'processing',
        promise,
        createdAt: Date.now(),
      });

      try {
        const result = await promise;
        activeRequests.set(clientRequestId, {
          status: 'completed',
          result,
          createdAt: Date.now(),
        });
        return res.json({
          success: true,
          meal: result.meal,
          summary: result.summary,
        });
      } catch (err: any) {
        activeRequests.set(clientRequestId, {
          status: 'error',
          error: err.message || 'Error al procesar con Gemini',
          createdAt: Date.now(),
        });
        console.error('Error in /api/meals/analyze:', err);
        return res.status(500).json({
          error: err.message || 'Error al procesar con Gemini',
        });
      }
    } else {
      const result = await runAnalysis();
      return res.json({
        success: true,
        meal: result.meal,
        summary: result.summary,
      });
    }
  } catch (err: any) {
    console.error('Error in /api/meals/analyze:', err);
    return res.status(500).json({
      error: err.message || 'Error al procesar con Gemini',
    });
  }
}

export async function deleteMealHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const meal = await getMealById(id);
    if (meal?.driveFileId) {
      await deleteImageFromDrive(meal.driveFileId).catch(() => {});
    }
    const success = await deleteMeal(id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al eliminar comida' });
  }
}

export async function purgePastMealsHandler(req: Request, res: Response) {
  try {
    const beforeDate =
      (req.query.beforeDate as string) ||
      (req.body?.beforeDate as string) ||
      getTodayString();

    const deletedCount = await purgePastMeals(beforeDate, 'user_default');
    res.json({
      success: true,
      deletedCount,
      beforeDate,
      message: `Se eliminaron ${deletedCount} registros anteriores al día de hoy para liberar espacio en disco.`,
    });
  } catch (err: any) {
    console.error('Error in purgePastMealsHandler:', err);
    res.status(500).json({ error: err.message || 'Error al liberar espacio de días anteriores' });
  }
}

