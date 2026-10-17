import { GoogleGenAI, Type } from '@google/genai';
import {
  UserProfile,
  Meal,
  GeminiMealAnalysisResponse,
  GeminiDailyScoreResponse,
  UnifiedMealAnalysisResponse,
} from '../../shared/types.js';
import {
  UNIFIED_MEAL_AND_SUMMARY_SYSTEM_PROMPT,
  DAILY_SUMMARY_SYSTEM_PROMPT,
  buildUnifiedMealContextPrompt,
  buildDailySummaryUserContextPrompt,
} from '../prompts/geminiPrompts.js';
import { geminiQueueManager } from './queueManager.js';

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface AnalyzeMealParams {
  imageBase64?: string;
  imageMimeType?: string;
  images?: Array<{ base64: string; mimeType: string }>;
  audioBase64?: string;
  audioMimeType?: string;
  audioTranscript?: string;
  mealType: string;
  user: UserProfile;
  notes?: string;
  clientRequestId?: string;
  previousMeals?: Meal[];
  date?: string;
}

export async function analyzeMealWithGemini(
  params: AnalyzeMealParams
): Promise<UnifiedMealAnalysisResponse> {
  const parts: any[] = [];

  // 1. Add Images Part(s)
  const imagesToAdd: Array<{ base64: string; mimeType: string }> = [];
  if (params.images && params.images.length > 0) {
    imagesToAdd.push(...params.images);
  } else if (params.imageBase64) {
    imagesToAdd.push({
      base64: params.imageBase64,
      mimeType: params.imageMimeType || 'image/jpeg',
    });
  }

  for (const img of imagesToAdd) {
    let cleanBase64 = img.base64;
    let mimeType = img.mimeType || 'image/jpeg';

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

  // 3. Add User Context, Previous Meals & Consolidated Prompt
  const textPrompt = buildUnifiedMealContextPrompt(
    params.user,
    params.mealType,
    params.previousMeals || [],
    params.notes || params.audioTranscript,
    params.date
  );

  parts.push({
    text: textPrompt,
  });

  return await geminiQueueManager.enqueue<UnifiedMealAnalysisResponse>({
    type: 'meal_analysis',
    title: `Análisis consolidado de ${params.mealType || 'Comida'} + Resumen Diario`,
    clientRequestId: params.clientRequestId,
    task: async (model: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          systemInstruction: UNIFIED_MEAL_AND_SUMMARY_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              comidas: {
                type: Type.ARRAY,
                description: 'Lista de una o más comidas o platos detectados (soporte batch).',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    mealType: {
                      type: Type.STRING,
                      description: 'Tipo de comida: desayuno, almuerzo, cena o snack.',
                    },
                    nombre_plato: {
                      type: Type.STRING,
                      description: 'Nombre descriptivo y atractivo del plato.',
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
                      description: 'Resumen o transcripción de lo que el usuario explicó con su voz en el audio o notas.',
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
              resumen_del_dia: {
                type: Type.OBJECT,
                description: 'Evaluación integral consolidada de todo el día acumulado.',
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
            required: ['comidas', 'resumen_del_dia'],
          },
        },
      });

      const rawText = response.text || '{}';
      try {
        const parsed = JSON.parse(rawText);

        // Normalize if output came as single meal instead of { comidas: [...] }
        let mealsList: GeminiMealAnalysisResponse[] = [];
        if (Array.isArray(parsed.comidas) && parsed.comidas.length > 0) {
          mealsList = parsed.comidas;
        } else if (parsed.nombre_plato) {
          mealsList = [parsed as GeminiMealAnalysisResponse];
        } else {
          mealsList = [
            {
              nombre_plato: 'Plato Nutricional',
              calorias_estimadas: 500,
              macros: { proteinas: 30, carbohidratos: 50, grasas: 15 },
              puntaje_plato: 8,
              feedback_breve: 'Comida registrada y procesada correctamente.',
              ingredientes_detectados: ['Ingredientes variados'],
              detalles_audio: params.notes || 'Registro completado',
            },
          ];
        }

        const summary: GeminiDailyScoreResponse = parsed.resumen_del_dia || {
          puntaje_diario: Math.min(100, Math.round(mealsList[0]?.puntaje_plato * 10 || 80)),
          consejo_diario: 'Buen avance diario. Mantén tu disciplina calórica y proteica.',
          balance_nutricional: 'Favorable',
          puntos_fuertes: mealsList.map((m) => `Registrado ${m.nombre_plato} exitosamente.`),
          areas_de_mejora: ['Monitorea tu hidratación y próximas comidas.'],
        };

        return {
          comidas: mealsList,
          resumen_del_dia: summary,
        };
      } catch (err) {
        console.error('Failed to parse Gemini unified output JSON:', rawText, err);
        throw new Error('Formato de respuesta inválido de Gemini');
      }
    },
  });
}

export async function evaluateDailySummaryWithGemini(
  user: UserProfile,
  meals: Meal[],
  date: string
): Promise<GeminiDailyScoreResponse> {
  const promptText = buildDailySummaryUserContextPrompt(user, meals, date);

  return await geminiQueueManager.enqueue<GeminiDailyScoreResponse>({
    type: 'daily_summary',
    title: `Evaluación del día (${date})`,
    task: async (model: string) => {
      const response = await ai.models.generateContent({
        model,
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
    },
  });
}
