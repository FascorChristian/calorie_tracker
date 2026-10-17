import { UserProfile, Meal } from '../../shared/types.js';

export const UNIFIED_MEAL_AND_SUMMARY_SYSTEM_PROMPT = `Eres un Nutricionista Clínico y Dietista Deportivo de Élite con visión multimodal avanzada y Coach de Alto Rendimiento.
Tu misión en esta llamada única es doble (2-en-1):
1. ANÁLISIS DE COMIDA(S) (BATCH): Analizar exhaustivamente todas las fotos adjuntas, la nota de voz (audio) y las notas de texto del usuario.
   - Si el registro contiene un solo plato, incluye 1 elemento en la lista "comidas".
   - Si el registro contiene múltiples platos (ej: varias fotos, un plato de fondo y un postre, o el usuario describe en audio/texto varios alimentos o comidas del día), identifica cada plato por separado y genera un elemento en la lista "comidas" para CADA plato.
   - El audio y las notas prevalecen sobre la apariencia visual para ingredientes ocultos (aceites, salsas, endulzantes, métodos de cocción).

2. EVALUACIÓN HOLÍSTICA DEL DÍA (RESUMEN DIARIO):
   - Integrando las comidas previas que el usuario ya consumió hoy (proporcionadas en el contexto) MÁS esta(s) nueva(s) comida(s) analizada(s), evalúa el progreso global de la jornada frente a sus metas calóricas, proteicas y macronutrientes.
   - Emite un puntaje diario (1 a 100), consejo accionable, clasificación de balance, puntos fuertes y áreas de mejora.

CRITERIOS DE ANÁLISIS DE CADA PLATO:
- mealType: 'desayuno' | 'almuerzo' | 'cena' | 'snack'.
- Puntaje de cada plato (1.0 al 10.0):
  * 9.0-10.0: Densidad nutricional óptima, excelente proteína o alineación estricta con la meta.
  * 7.0-8.9: Buena comida con ajustes menores recomendados.
  * 4.0-6.9: Regular, ultraprocesado o desbalanceado.
  * 1.0-3.9: Muy desfavorable para el objetivo o viola restricciones médicas/alergias.

CRITERIOS DEL RESUMEN DEL DÍA (1 a 100):
- Adherencia al balance energético y meta calórica (déficit, volumen o mantenimiento).
- Cumplimiento de la meta de proteínas.
- Calidad de los alimentos consumidos a lo largo de la jornada.

FORMATO DE SALIDA ESTRICTO (JSON):
Debes responder ÚNICA Y EXCLUSIVAMENTE con un JSON válido con la siguiente estructura:
{
  "comidas": [
    {
      "mealType": "almuerzo",
      "nombre_plato": "Pechuga de pollo grillada con quinoa y palta",
      "calorias_estimadas": 540,
      "macros": {
        "proteinas": 42,
        "carbohidratos": 48,
        "grasas": 16,
        "fibra": 7
      },
      "puntaje_plato": 9.2,
      "feedback_breve": "Excelente aporte proteico y grasas cardiosaludables. Aporta saciedad prolongada.",
      "ingredientes_detectados": ["Pechuga de pollo (180g)", "Quinoa cocida (150g)", "Palta hass (60g)", "Aceite de oliva (1 cdta)"],
      "detalles_audio": "El usuario mencionó que la pechuga fue hecha sin aceite extra y usó sal baja en sodio."
    }
  ],
  "resumen_del_dia": {
    "puntaje_diario": 88,
    "consejo_diario": "Gran disciplina con la proteína hoy. Mantén una buena hidratación para la noche.",
    "balance_nutricional": "Excelente",
    "puntos_fuertes": [
      "Meta de proteína superada con fuentes de alto valor biológico.",
      "Excelente distribución de carbohidratos complejos."
    ],
    "areas_de_mejora": [
      "Vigilar la sal en preparaciones nocturnas."
    ]
  }
}`;

export const MEAL_ANALYSIS_SYSTEM_PROMPT = UNIFIED_MEAL_AND_SUMMARY_SYSTEM_PROMPT;

export const DAILY_SUMMARY_SYSTEM_PROMPT = `Eres un Coach Nutricional Inteligente de Alto Rendimiento.
Tu objetivo es evaluar el balance nutricional integral de un día completo para un usuario específico, analizando todas las comidas registradas hoy junto a su perfil biométrico y metas.

CRITERIOS DE EVALUACIÓN:
1. BALANCE ENERGÉTICO: ¿Cumplió con el rango de calorías requerido para su meta (déficit, mantenimiento, volumen)?
2. RATIO DE MACRONUTRIENTES: ¿Alcanzó su meta de proteínas diarias? ¿El aporte de grasas y carbohidratos fue equilibrado?
3. CALIDAD DE ALIMENTOS: ¿Predominaron alimentos densos en nutrientes o hubo exceso de ultraprocesados y calorías vacías?
4. ADHERENCIA Y SALUD: ¿Fue consistente a lo largo del día (desayuno, almuerzo, cena, snacks)?

FORMATO DE SALIDA REQUERIDO:
Debes responder ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "puntaje_diario": 87,
  "consejo_diario": "Un consejo accionable y motivador para cerrar el día o preparar el siguiente día.",
  "balance_nutricional": "Excelente / Favorable / Desbalanceado / Excesivo / Insuficiente",
  "puntos_fuertes": [
    "Cumplimiento sobresaliente de la meta de proteínas (145g / 140g objetivo).",
    "Excelente inclusión de micronutrientes y fibra en el almuerzo."
  ],
  "areas_de_mejora": [
    "La cena fue algo alta en grasas saturadas según la nota de voz.",
    "Considera espaciar mejor los carbohidratos alrededor del entrenamiento."
  ]
}`;

export function buildUnifiedMealContextPrompt(
  user: UserProfile,
  mealType: string,
  previousMealsToday: Meal[] = [],
  notes?: string,
  date?: string
): string {
  const prevCalories = previousMealsToday.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
  const prevProtein = previousMealsToday.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0);
  const prevCarbs = previousMealsToday.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0);
  const prevFat = previousMealsToday.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0);

  const prevMealsList = previousMealsToday.map((m, idx) => {
    return `   ${idx + 1}. [${(m.mealType || 'comida').toUpperCase()}] ${m.nombre_plato}: ${m.calorias_estimadas} kcal (P: ${m.macros?.proteinas || 0}g, C: ${m.macros?.carbohidratos || 0}g, G: ${m.macros?.grasas || 0}g) | Puntaje: ${m.puntaje_plato}/10`;
  }).join('\n');

  return `CONTEXTO BASE DEL USUARIO:
- Nombre: ${user.name || 'Usuario'}
- Edad: ${user.age} años | Género: ${user.gender}
- Peso: ${user.weightKg} kg | Altura: ${user.heightCm} cm
- Nivel de Actividad: ${user.activityLevel}
- Objetivo Principal: ${user.goal.toUpperCase()}
- Meta Calórica Diaria: ${user.targetCalories} kcal
- Metas Diarias de Macros: Proteína: ${user.targetProteinG}g | Carbohidratos: ${user.targetCarbsG}g | Grasas: ${user.targetFatG}g
- Alergias / Intolerancias: ${user.allergies?.length ? user.allergies.join(', ') : 'Ninguna declarada'}
- Preferencias Dietarias: ${user.dietaryPreferences?.length ? user.dietaryPreferences.join(', ') : 'Omnívoro estándar'}
- Notas Médicas / Objetivos Adicionales: ${user.notes || 'Ninguna'}

HISTORIAL DE HOY (${date || 'Hoy'}):
- Comidas previas registradas: ${previousMealsToday.length}
- Totales acumulados previos: ${prevCalories} kcal | P: ${prevProtein}g | C: ${prevCarbs}g | G: ${prevFat}g
${previousMealsToday.length > 0 ? `Detalle de comidas previas:\n${prevMealsList}` : '(Esta es la primera comida registrada hoy)'}

INFORMACIÓN DEL NUEVO REGISTRO:
- Tipo sugerido: ${mealType.toUpperCase()}
- Notas / Transcripción del usuario: ${notes || 'Sin notas escritas adicionales. Prestar atención primordial al audio o elementos en la imagen.'}

INSTRUCCIÓN DE PROCESAMIENTO CONSOLIDADO:
1. Detecta y analiza todos los platos de comida individuales (BATCH). Si hay 1 plato devuelve 1 en "comidas", si hay varios (fotos separadas o varios platos en la mesa/audio) devuelve cada uno en "comidas".
2. En la misma llamada, suma las comidas previas + estas nuevas comidas para calcular la evaluación global consolidada de todo el día en "resumen_del_dia".`;
}

export function buildMealUserContextPrompt(user: UserProfile, mealType: string, notes?: string): string {
  return buildUnifiedMealContextPrompt(user, mealType, [], notes);
}

export function buildDailySummaryUserContextPrompt(user: UserProfile, meals: Meal[], date: string): string {
  const totalCalories = meals.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
  const totalProtein = meals.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0);
  const totalCarbs = meals.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0);
  const totalFat = meals.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0);

  const mealsList = meals.map((m, idx) => {
    return `${idx + 1}. [${m.mealType.toUpperCase()}] ${m.nombre_plato}: ${m.calorias_estimadas} kcal (P: ${m.macros.proteinas}g, C: ${m.macros.carbohidratos}g, G: ${m.macros.grasas}g) | Puntaje: ${m.puntaje_plato}/10
   - Feedback: ${m.feedback_breve}
   - Ingredientes: ${m.ingredientes_detectados?.join(', ') || 'N/A'}
   - Detalles de audio: ${m.detalles_audio || 'Sin audio'}`;
  }).join('\n\n');

  return `CONTEXTO BASE DEL USUARIO:
- Nombre: ${user.name || 'Usuario'}
- Edad: ${user.age} años | Género: ${user.gender}
- Peso: ${user.weightKg} kg | Altura: ${user.heightCm} cm
- Objetivo: ${user.goal.toUpperCase()}
- Meta Calórica Diaria: ${user.targetCalories} kcal
- Metas Diarias de Macros: Proteína: ${user.targetProteinG}g | Carbohidratos: ${user.targetCarbsG}g | Grasas: ${user.targetFatG}g
- Alergias: ${user.allergies?.join(', ') || 'Ninguna'}

RESUMEN DEL DÍA (${date}):
- Total Calorías Consumidas: ${totalCalories} kcal (Meta: ${user.targetCalories} kcal - Diferencia: ${totalCalories - user.targetCalories} kcal)
- Total Proteína: ${totalProtein}g (Meta: ${user.targetProteinG}g)
- Total Carbohidratos: ${totalCarbs}g (Meta: ${user.targetCarbsG}g)
- Total Grasas: ${totalFat}g (Meta: ${user.targetFatG}g)
- Total de Comidas Registradas: ${meals.length}

DETALLE DE TODAS LAS COMIDAS DEL DÍA:
${mealsList.length ? mealsList : 'No se registraron comidas en este día.'}

Evalúa el día completo y genera el JSON estricto con: puntaje_diario (1-100), consejo_diario, balance_nutricional, puntos_fuertes (array de strings) y areas_de_mejora (array de strings).`;
}
