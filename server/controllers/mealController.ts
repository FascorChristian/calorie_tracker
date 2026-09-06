import { Request, Response } from 'express';
import { getUser, getMeals, addMeal, deleteMeal, getDailySummary, saveDailySummary } from '../services/dbService.js';
import { analyzeMealWithGemini } from '../services/geminiService.js';
import { formatToMysqlDateTime, getTodayString } from '../utils/dateUtils.js';
import { Meal, DailySummary } from '../../shared/types.js';

export async function getMealsHandler(req: Request, res: Response) {
  try {
    const date = req.query.date as string | undefined;
    const meals = await getMeals(date);
    res.json(meals);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener comidas' });
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

    // Auto-update Daily Summary totals
    const dayMeals = await getMeals(date);
    const totalCal = dayMeals.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
    const totalP = dayMeals.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0);
    const totalC = dayMeals.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0);
    const totalF = dayMeals.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0);

    const existingSummary = await getDailySummary(date);
    const updatedSummary: DailySummary = {
      date,
      userId: user.id,
      totalCalories: totalCal,
      totalProtein: Math.round(totalP * 10) / 10,
      totalCarbs: Math.round(totalC * 10) / 10,
      totalFat: Math.round(totalF * 10) / 10,
      puntaje_diario: existingSummary?.puntaje_diario || Math.min(100, Math.round((savedMeal.puntaje_plato * 10))),
      consejo_diario: existingSummary?.consejo_diario || 'Has añadido un nuevo registro multimodal. Puedes recalcular tu puntaje integral del día cuando desees.',
      balance_nutricional: existingSummary?.balance_nutricional || 'En progreso',
      puntos_fuertes: existingSummary?.puntos_fuertes || [
        `Registrado ${savedMeal.nombre_plato} con éxito.`,
      ],
      areas_de_mejora: existingSummary?.areas_de_mejora || [
        `Mantén el seguimiento de hidratación y próximas comidas.`,
      ],
      mealsCount: dayMeals.length,
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

