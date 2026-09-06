import { Request, Response } from 'express';
import { getUser, getMeals, getDailySummary, saveDailySummary } from '../services/dbService.js';
import { evaluateDailySummaryWithGemini } from '../services/geminiService.js';
import { formatToMysqlDateTime, getTodayString } from '../utils/dateUtils.js';
import { DailySummary } from '../../shared/types.js';

export async function getSummaryHandler(req: Request, res: Response) {
  try {
    const date = (req.query.date as string) || getTodayString();
    const summary = await getDailySummary(date);
    const dayMeals = await getMeals(date);

    const totalCal = dayMeals.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
    const totalP = dayMeals.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0);
    const totalC = dayMeals.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0);
    const totalF = dayMeals.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0);

    if (!summary) {
      const defaultSummary: DailySummary = {
        date,
        userId: 'user_default',
        totalCalories: totalCal,
        totalProtein: Math.round(totalP * 10) / 10,
        totalCarbs: Math.round(totalC * 10) / 10,
        totalFat: Math.round(totalF * 10) / 10,
        puntaje_diario: 0,
        consejo_diario: 'Aún no has calculado el puntaje para este día. Registra tus comidas y presiona "Evaluar Día con Gemini".',
        balance_nutricional: 'Pendiente de cálculo',
        puntos_fuertes: [],
        areas_de_mejora: [],
        mealsCount: dayMeals.length,
        updatedAt: formatToMysqlDateTime(),
      };
      return res.json(defaultSummary);
    }

    // Update totals in case meals changed
    summary.totalCalories = totalCal;
    summary.totalProtein = Math.round(totalP * 10) / 10;
    summary.totalCarbs = Math.round(totalC * 10) / 10;
    summary.totalFat = Math.round(totalF * 10) / 10;
    summary.mealsCount = dayMeals.length;

    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener resumen' });
  }
}

export async function evaluateSummaryHandler(req: Request, res: Response) {
  try {
    const { date = getTodayString() } = req.body;
    const user = await getUser();
    const meals = await getMeals(date);

    const evaluation = await evaluateDailySummaryWithGemini(user, meals, date);

    const totalCal = meals.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
    const totalP = meals.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0);
    const totalC = meals.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0);
    const totalF = meals.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0);

    const updatedSummary: DailySummary = {
      date,
      userId: user.id,
      totalCalories: totalCal,
      totalProtein: Math.round(totalP * 10) / 10,
      totalCarbs: Math.round(totalC * 10) / 10,
      totalFat: Math.round(totalF * 10) / 10,
      puntaje_diario: evaluation.puntaje_diario,
      consejo_diario: evaluation.consejo_diario,
      balance_nutricional: evaluation.balance_nutricional,
      puntos_fuertes: evaluation.puntos_fuertes,
      areas_de_mejora: evaluation.areas_de_mejora,
      mealsCount: meals.length,
      updatedAt: formatToMysqlDateTime(),
    };

    await saveDailySummary(updatedSummary);

    res.json({
      success: true,
      summary: updatedSummary,
    });
  } catch (err: any) {
    console.error('Error in /api/daily-summary/evaluate:', err);
    res.status(500).json({
      error: err.message || 'Error al evaluar resumen diario con Gemini',
    });
  }
}

