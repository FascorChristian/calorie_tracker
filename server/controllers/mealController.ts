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
  meals: Meal[];
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
          meals: cached.result.meals,
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

    // 2. Revisar si ya quedó persistido en Google Sheets (idempotencia batch)
    const todayMeals = await getMeals(getTodayString(), 'user_default').catch(() => []);
    const matchingMeals = todayMeals.filter((m) => m.id.startsWith(`meal_${clientRequestId}`));
    if (matchingMeals.length > 0) {
      const summary = await getDailySummary(matchingMeals[0].date).catch(() => null);
      return res.json({
        status: 'completed',
        meal: matchingMeals[0],
        meals: matchingMeals,
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
      images,
      audioBase64,
      audioMimeType,
      audioTranscript,
      audioDurationSeconds,
      mealType = 'almuerzo',
      notes,
      date,
      time,
    } = req.body;

    const clientRequestId =
      rawRequestId && typeof rawRequestId === 'string' && rawRequestId.trim()
        ? rawRequestId.trim()
        : undefined;

    // Idempotencia: Si ya hay una petición con este clientRequestId en memoria
    if (clientRequestId && activeRequests.has(clientRequestId)) {
      const existing = activeRequests.get(clientRequestId)!;
      if (existing.status === 'completed' && existing.result) {
        return res.json({
          success: true,
          meal: existing.result.meal,
          meals: existing.result.meals,
          summary: existing.result.summary,
        });
      }
      if (existing.status === 'processing' && existing.promise) {
        try {
          const result = await existing.promise;
          return res.json({
            success: true,
            meal: result.meal,
            meals: result.meals,
            summary: result.summary,
          });
        } catch (err: any) {
          return res.status(500).json({
            error: err.message || 'Error al procesar con Gemini',
          });
        }
      }
    }

    // Normalizar imágenes (soporte de 1 o múltiples imágenes)
    const normalizedImages: Array<{ base64: string; mimeType: string }> = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (typeof img === 'string') {
          normalizedImages.push({ base64: img, mimeType: 'image/jpeg' });
        } else if (img && img.base64) {
          normalizedImages.push({ base64: img.base64, mimeType: img.mimeType || 'image/jpeg' });
        }
      }
    } else if (imageBase64) {
      normalizedImages.push({
        base64: imageBase64,
        mimeType: imageMimeType || 'image/jpeg',
      });
    }

    // Idempotencia: Si ya quedó guardada previamente en Google Sheets
    if (clientRequestId) {
      try {
        const checkDate = date || getTodayString();
        const existingMeals = await getMeals(checkDate, 'user_default').catch(() => []);
        const matching = existingMeals.filter((m) => m.id.startsWith(`meal_${clientRequestId}`));
        if (matching.length > 0) {
          const existingSummary = await getDailySummary(matching[0].date).catch(() => null);
          return res.json({
            success: true,
            meal: matching[0],
            meals: matching,
            summary: existingSummary,
          });
        }
      } catch (checkErr) {
        console.warn('Aviso verificando comida existente en Google Sheets:', checkErr);
      }
    }

    if (normalizedImages.length === 0 && !audioBase64 && !notes) {
      return res.status(400).json({
        error: 'Se requiere al menos una imagen, una nota de voz o descripción.',
      });
    }

    const runAnalysis = async (): Promise<AnalysisResult> => {
      const user = await getUser();
      const mealDate = date || getTodayString();
      const mealTime = time || getSantiagoTimeString();

      // Cargar comidas previas registradas hoy para contexto unificado (2-en-1)
      const previousMeals = await getMeals(mealDate, user.id).catch(() => []);

      // Llamada única a Gemini 3.1 Flash Lite (Análisis Batch + Resumen Diario)
      const analysis = await analyzeMealWithGemini({
        images: normalizedImages,
        imageBase64: normalizedImages[0]?.base64,
        imageMimeType: normalizedImages[0]?.mimeType,
        audioBase64,
        audioMimeType,
        audioTranscript,
        mealType,
        user,
        notes,
        clientRequestId,
        previousMeals,
        date: mealDate,
      });

      // Subir fotos a Google Drive
      const uploadedDriveImages: Array<{ directImageUrl: string; fileId?: string }> = [];
      for (let i = 0; i < normalizedImages.length; i++) {
        try {
          const uploadResult = await uploadMealImageToDrive({
            imageBase64: normalizedImages[i].base64,
            fileName: clientRequestId
              ? `comida_${clientRequestId}_${i + 1}.jpg`
              : `comida_${Date.now()}_${i + 1}.jpg`,
            mimeType: normalizedImages[i].mimeType || 'image/jpeg',
          });
          uploadedDriveImages.push(uploadResult);
        } catch (driveErr: any) {
          console.warn('Aviso Drive upload:', driveErr?.message || driveErr);
          uploadedDriveImages.push({ directImageUrl: normalizedImages[i].base64 });
        }
      }

      // Guardar cada comida detectada en Google Sheets
      const savedMeals: Meal[] = [];
      const mealsToSave = analysis.comidas && analysis.comidas.length > 0
        ? analysis.comidas
        : [
            {
              mealType: mealType as 'desayuno' | 'almuerzo' | 'cena' | 'snack',
              nombre_plato: 'Plato Analizado',
              calorias_estimadas: 500,
              macros: { proteinas: 30, carbohidratos: 50, grasas: 15 },
              puntaje_plato: 8,
              feedback_breve: 'Comida registrada con éxito.',
              ingredientes_detectados: ['Ingredientes varios'],
              detalles_audio: notes || 'Sin notas adicionales',
            },
          ];

      for (let idx = 0; idx < mealsToSave.length; idx++) {
        const item = mealsToSave[idx];
        const subId = clientRequestId
          ? mealsToSave.length === 1
            ? `meal_${clientRequestId}`
            : `meal_${clientRequestId}_${idx + 1}`
          : `meal_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;

        const imgData = uploadedDriveImages[idx] || uploadedDriveImages[0];

        const newMeal: Meal = {
          id: subId,
          userId: user.id,
          date: mealDate,
          time: mealTime,
          mealType: (item.mealType as any) || mealType,
          imageUrl: imgData?.directImageUrl,
          driveFileId: imgData?.fileId,
          audioDataUrl: idx === 0 ? audioBase64 : undefined,
          audioDurationSeconds: idx === 0 ? audioDurationSeconds || 0 : 0,
          audioTranscript: item.detalles_audio,
          nombre_plato: item.nombre_plato,
          calorias_estimadas: item.calorias_estimadas,
          macros: item.macros,
          puntaje_plato: item.puntaje_plato,
          feedback_breve: item.feedback_breve,
          ingredientes_detectados: item.ingredientes_detectados,
          detalles_audio: item.detalles_audio,
          createdAt: formatToMysqlDateTime(),
        };

        const saved = await addMeal(newMeal);
        savedMeals.push(saved);
      }

      // Auto-update Daily Summary en Google Sheets con la evaluación directa (sin 2da llamada a IA)
      const totals = await getDailyNutritionalTotals(mealDate, user.id);
      const resDia = analysis.resumen_del_dia || ({} as any);

      const updatedSummary: DailySummary = {
        date: mealDate,
        userId: user.id,
        totalCalories: totals.totalCalories,
        totalProtein: totals.totalProtein,
        totalCarbs: totals.totalCarbs,
        totalFat: totals.totalFat,
        puntaje_diario:
          typeof resDia.puntaje_diario === 'number'
            ? resDia.puntaje_diario
            : Math.min(100, Math.round((savedMeals[0]?.puntaje_plato || 8) * 10)),
        consejo_diario:
          resDia.consejo_diario ||
          'Has completado un nuevo registro. Mantén tu constancia con los macronutrientes.',
        balance_nutricional: resDia.balance_nutricional || 'Favorable',
        puntos_fuertes:
          Array.isArray(resDia.puntos_fuertes) && resDia.puntos_fuertes.length > 0
            ? resDia.puntos_fuertes
            : savedMeals.map((m) => `Registrado ${m.nombre_plato} con éxito.`),
        areas_de_mejora:
          Array.isArray(resDia.areas_de_mejora) && resDia.areas_de_mejora.length > 0
            ? resDia.areas_de_mejora
            : ['Mantén el seguimiento de hidratación y próximas comidas.'],
        mealsCount: totals.mealsCount,
        updatedAt: formatToMysqlDateTime(),
      };

      await saveDailySummary(updatedSummary);

      return {
        meal: savedMeals[0],
        meals: savedMeals,
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
          meals: result.meals,
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
        meals: result.meals,
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
