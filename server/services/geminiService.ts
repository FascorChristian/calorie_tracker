import { GoogleGenAI, Type } from '@google/genai';
import {
  UserProfile,
  Meal,
  GeminiMealAnalysisResponse,
  GeminiDailyScoreResponse,
} from '../../shared/types.js';
import {
  MEAL_ANALYSIS_SYSTEM_PROMPT,
  DAILY_SUMMARY_SYSTEM_PROMPT,
  buildMealUserContextPrompt,
  buildDailySummaryUserContextPrompt,
} from '../prompts/geminiPrompts.js';

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Resilient model cascade: if gemini-3.7-flash has 503 high demand spikes, automatically retry and fall back to 3.6 / 3.5
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];

async function generateContentWithRetryAndFallback(params: {
  contents: any;
  config: any;
}): Promise<any> {
  let lastError: any = null;

  for (let mIdx = 0; mIdx < FALLBACK_MODELS.length; mIdx++) {
    const model = FALLBACK_MODELS[mIdx];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code || (err?.error && err.error.code);
        const isTransient = status === 503 || status === 429 || status === 500;

        console.warn(
          `[Gemini AI] Modelo '${model}' falló (intento ${attempt + 1}/2). Error ${status}: ${err.message || 'Alta demanda/Servicio no disponible'}`
        );

        if (isTransient && attempt < 1) {
          // Breve pausa exponencial antes de reintentar el mismo modelo
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        // Si se agotaron los intentos o no es transitorio, saltar al siguiente modelo del cascade
        if (mIdx < FALLBACK_MODELS.length - 1) {
          console.log(`[Gemini AI] Redirigiendo automáticamente a modelo de respaldo: '${FALLBACK_MODELS[mIdx + 1]}'`);
        }
        break;
      }
    }
  }

  throw lastError || new Error('No se pudo obtener respuesta de ningún modelo de Gemini');
}

export async function analyzeMealWithGemini(params: {
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  audioTranscript?: string;
  mealType: string;
  user: UserProfile;
  notes?: string;
}): Promise<GeminiMealAnalysisResponse> {
  const parts: any[] = [];

  // 1. Add Image Part if present
  if (params.imageBase64) {
    let cleanBase64 = params.imageBase64;
    let mimeType = params.imageMimeType || 'image/jpeg';

    if (cleanBase64.includes(';base64,')) {
      const split = cleanBase64.split(';base64,');
      const header = split[0];
      cleanBase64 = split[1];
      const match = header.match(/data:([^;]+)/);
      if (match && match[1]) {
        mimeType = match[1];
      }
    }

    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType,
      },
    });
  }

  // 2. Add Audio Part if present
  if (params.audioBase64) {
    let cleanAudioBase64 = params.audioBase64;
    let audioMime = params.audioMimeType || 'audio/webm';

    if (cleanAudioBase64.includes(';base64,')) {
      const split = cleanAudioBase64.split(';base64,');
      const header = split[0];
      cleanAudioBase64 = split[1];
      const match = header.match(/data:([^;]+)/);
      if (match && match[1]) {
        audioMime = match[1];
      }
    }

    parts.push({
      inlineData: {
        data: cleanAudioBase64,
        mimeType: audioMime,
      },
    });
  }

  // 3. Add User Context and Text prompt
  const textPrompt = buildMealUserContextPrompt(
    params.user,
    params.mealType,
    params.notes || params.audioTranscript
  );

  parts.push({
    text: textPrompt,
  });

  const response = await generateContentWithRetryAndFallback({
    contents: { parts },
    config: {
      systemInstruction: MEAL_ANALYSIS_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nombre_plato: {
            type: Type.STRING,
            description: 'Nombre descriptivo y atractivo del plato analizado.',
          },
          calorias_estimadas: {
            type: Type.INTEGER,
            description: 'Total de calorías estimadas para la porción entera.',
          },
          macros: {
            type: Type.OBJECT,
            properties: {
              proteinas: {
                type: Type.NUMBER,
                description: 'Gramos de proteína estimados.',
              },
              carbohidratos: {
                type: Type.NUMBER,
                description: 'Gramos de carbohidratos estimados.',
              },
              grasas: {
                type: Type.NUMBER,
                description: 'Gramos de grasas estimadas.',
              },
              fibra: {
                type: Type.NUMBER,
                description: 'Gramos de fibra dietaria estimados (opcional).',
              },
            },
            required: ['proteinas', 'carbohidratos', 'grasas'],
          },
          puntaje_plato: {
            type: Type.NUMBER,
            description: 'Puntaje nutricional del 1 al 10 según el perfil del usuario.',
          },
          feedback_breve: {
            type: Type.STRING,
            description: 'Breve explicación concisa (2-3 oraciones) con consejos.',
          },
          ingredientes_detectados: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista detallada de ingredientes y porciones aproximadas observadas o habladas.',
          },
          detalles_audio: {
            type: Type.STRING,
            description: 'Resumen o transcripción de lo que el usuario explicó con su voz en el audio.',
          },
        },
        required: [
          'nombre_plato',
          'calorias_estimadas',
          'macros',
          'puntaje_plato',
          'feedback_breve',
          'ingredientes_detectados',
          'detalles_audio',
        ],
      },
    },
  });

  const rawText = response.text || '{}';
  try {
    const parsed = JSON.parse(rawText) as GeminiMealAnalysisResponse;
    return parsed;
  } catch (err) {
    console.error('Failed to parse Gemini meal output JSON:', rawText, err);
    throw new Error('Formato de respuesta inválido de Gemini');
  }
}

export async function evaluateDailySummaryWithGemini(
  user: UserProfile,
  meals: Meal[],
  date: string
): Promise<GeminiDailyScoreResponse> {
  const promptText = buildDailySummaryUserContextPrompt(user, meals, date);

  const response = await generateContentWithRetryAndFallback({
    contents: promptText,
    config: {
      systemInstruction: DAILY_SUMMARY_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          puntaje_diario: {
            type: Type.INTEGER,
            description: 'Puntaje de adherencia y calidad nutricional del día entre 1 y 100.',
          },
          consejo_diario: {
            type: Type.STRING,
            description: 'Consejo integral de cierre del día o preparación del día siguiente.',
          },
          balance_nutricional: {
            type: Type.STRING,
            description: 'Clasificación del balance (ej: Excelente, Favorable, Desbalanceado, etc.).',
          },
          puntos_fuertes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de aciertos y fortalezas del día.',
          },
          areas_de_mejora: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de áreas o ajustes recomendados.',
          },
        },
        required: [
          'puntaje_diario',
          'consejo_diario',
          'balance_nutricional',
          'puntos_fuertes',
          'areas_de_mejora',
        ],
      },
    },
  });

  const rawText = response.text || '{}';
  try {
    const parsed = JSON.parse(rawText) as GeminiDailyScoreResponse;
    return parsed;
  } catch (err) {
    console.error('Failed to parse Gemini daily score JSON:', rawText, err);
    throw new Error('Formato de respuesta de resumen diario inválido');
  }
}

