import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getUser,
  updateUser,
  getMeals,
  addMeal,
  deleteMeal,
  getDailySummary,
  saveDailySummary,
} from './server/db.js';
import {
  analyzeMealWithGemini,
  evaluateDailySummaryWithGemini,
} from './server/geminiService.js';
import {
  PYTHON_MODELS_CODE,
  PYTHON_BACKEND_CODE,
  REACT_COMPONENT_CODE,
} from './server/pythonDeliverables.js';
import {
  MEAL_ANALYSIS_SYSTEM_PROMPT,
  DAILY_SUMMARY_SYSTEM_PROMPT,
} from './server/prompts.js';
import { Meal, DailySummary } from './src/types.js';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for large base64 uploads (image + audio)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. User Profile (Base Context)
  app.get('/api/profile', (req, res) => {
    try {
      const user = getUser();
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al obtener perfil' });
    }
  });

  app.post('/api/profile', (req, res) => {
    try {
      const updated = updateUser(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al actualizar perfil' });
    }
  });

  // 3. Meals List
  app.get('/api/meals', (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const meals = getMeals(date);
      res.json(meals);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al obtener comidas' });
    }
  });

  // 4. Core Multimodal Meal Analysis (Image + Audio + Base User Context)
  app.post('/api/meals/analyze', async (req, res) => {
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

      const user = getUser();

      // Call Gemini 3.7 Flash multimodal
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
      const mealTime = time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
        createdAt: new Date().toISOString(),
      };

      const savedMeal = addMeal(newMeal);

      // Auto-update Daily Summary totals
      const dayMeals = getMeals(date);
      const totalCal = dayMeals.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
      const totalP = dayMeals.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0);
      const totalC = dayMeals.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0);
      const totalF = dayMeals.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0);

      const existingSummary = getDailySummary(date);
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
        updatedAt: new Date().toISOString(),
      };
      saveDailySummary(updatedSummary);

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
  });

  // 5. Delete Meal
  app.delete('/api/meals/:id', (req, res) => {
    try {
      const id = req.params.id;
      const success = deleteMeal(id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al eliminar comida' });
    }
  });

  // 6. Get Daily Summary
  app.get('/api/daily-summary', (req, res) => {
    try {
      const date = (req.query.date as string) || getTodayString();
      const summary = getDailySummary(date);
      const dayMeals = getMeals(date);

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
          updatedAt: new Date().toISOString(),
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
  });

  // 7. Evaluate Daily Summary with Gemini (Prompt 2)
  app.post('/api/daily-summary/evaluate', async (req, res) => {
    try {
      const { date = getTodayString() } = req.body;
      const user = getUser();
      const meals = getMeals(date);

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
        updatedAt: new Date().toISOString(),
      };

      saveDailySummary(updatedSummary);

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
  });

  // 8. Python Code Deliverables & Exact Prompts for Reference & Export
  app.get('/api/python-deliverables', (req, res) => {
    res.json({
      models_code: PYTHON_MODELS_CODE,
      backend_code: PYTHON_BACKEND_CODE,
      react_component_code: REACT_COMPONENT_CODE,
      system_prompts: {
        prompt_1_meal: MEAL_ANALYSIS_SYSTEM_PROMPT,
        prompt_2_daily: DAILY_SUMMARY_SYSTEM_PROMPT,
      },
    });
  });

  // ==========================================
  // VITE / STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriVoice AI Fullstack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
