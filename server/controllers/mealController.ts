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
} from '../services/dbService.js';
import { analyzeMealWithGemini } from '../services/geminiService.js';
import { formatToMysqlDateTime, getTodayString } from '../utils/dateUtils.js';
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

export async function analyzeMealHandler(req: Request, res: Response) {
  try {
    const {
      imageBase64,
      imageMimeType,
      audioBase64,
      audioMimeType,
      audioTranscript,
      audioDurationSeconds,
      mealType = 'almuerzo',
      notes,
      date = getTodayString(),
      time,
    } = req.body;

    if (!imageBase64 && !audioBase64 && !notes) {
      return res.status(400).json({
        error: 'Se requiere al menos una imagen, una nota de voz o descripción.',
      });
    }

    const user = await getUser();

    // Call Gemini 3.7 / 3.6 Flash multimodal
    const analysis = await analyzeMealWithGemini({
      imageBase64,
      imageMimeType,
      audioBase64,
      audioMimeType,
      audioTranscript,
      mealType,
      user,
      notes,
    });

    const now = new Date();
    const mealTime =
      time ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMeal: Meal = {
      id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: user.id,
      date: date,
      time: mealTime,
      mealType: mealType,
      imageUrl: imageBase64,
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

    // Auto-update Daily Summary totals delegando la agregación a MySQL (ahorro de RAM)
    const totals = await getDailyNutritionalTotals(date, user.id);

    const existingSummary = await getDailySummary(date);
    const updatedSummary: DailySummary = {
      date,
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

    res.json({
      success: true,
      meal: savedMeal,
      summary: updatedSummary,
    });
  } catch (err: any) {
    console.error('Error in /api/meals/analyze:', err);
    res.status(500).json({
      error: err.message || 'Error al procesar con Gemini',
    });
  }
}

export async function deleteMealHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
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

