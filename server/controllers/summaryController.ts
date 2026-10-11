import { Request, Response } from 'express';
import {
  getUser,
  getDailySummary,
  saveDailySummary,
  getDailyNutritionalTotals,
  getMealsForSummary,
} from '../services/googleSheetsService.js';
import { evaluateDailySummaryWithGemini } from '../services/geminiService.js';
import { formatToMysqlDateTime, getTodayString } from '../utils/dateUtils.js';
import { DailySummary } from '../../shared/types.js';

export async function getSummaryHandler(req: Request, res: Response) {
  try {
    const date = (req.query.date as string) || getTodayString();
    const [summary, totals] = await Promise.all([
      getDailySummary(date),
      getDailyNutritionalTotals(date),
    ]);

    if (!summary) {
      const defaultSummary: DailySummary = {
        date,
        userId: 'user_default',
        totalCalories: totals.totalCalories,
        totalProtein: totals.totalProtein,
        totalCarbs: totals.totalCarbs,
        totalFat: totals.totalFat,
        puntaje_diario: 0,
        consejo_diario: 'Aún no has calculado el puntaje para este día. Registra tus comidas y presiona "Evaluar Día con Gemini".',
        balance_nutricional: 'Pendiente de cálculo',
        puntos_fuertes: [],
        areas_de_mejora: [],
        mealsCount: totals.mealsCount,
        updatedAt: formatToMysqlDateTime(),
      };
      return res.json(defaultSummary);
    }

    // Update totals delegando al motor MySQL (ahorro masivo de RAM)
    summary.totalCalories = totals.totalCalories;
    summary.totalProtein = totals.totalProtein;
    summary.totalCarbs = totals.totalCarbs;
    summary.totalFat = totals.totalFat;
    summary.mealsCount = totals.mealsCount;

    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener resumen' });
  }
}

export async function evaluateSummaryHandler(req: Request, res: Response) {
  try {
    const { date = getTodayString() } = req.body;
    const user = await getUser();
    
    // Obtenemos solo la metadata necesaria para el prompt y los totales agregados por SQL
    const [meals, totals] = await Promise.all([
      getMealsForSummary(date, user.id),
      getDailyNutritionalTotals(date, user.id),
    ]);

    const evaluation = await evaluateDailySummaryWithGemini(user, meals, date);

    const updatedSummary: DailySummary = {
      date,
      userId: user.id,
      totalCalories: totals.totalCalories,
      totalProtein: totals.totalProtein,
      totalCarbs: totals.totalCarbs,
      totalFat: totals.totalFat,
      puntaje_diario: evaluation.puntaje_diario,
      consejo_diario: evaluation.consejo_diario,
      balance_nutricional: evaluation.balance_nutricional,
      puntos_fuertes: evaluation.puntos_fuertes,
      areas_de_mejora: evaluation.areas_de_mejora,
      mealsCount: totals.mealsCount,
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

