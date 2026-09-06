# Glosario de Archivos e Interacciones de NutriVoice AI

Este glosario documenta cada archivo del proyecto, su responsabilidad dentro de la arquitectura, sus exportaciones clave, los módulos que consume y los módulos que dependen de él.

---

## Índice General de Archivos

| Archivo / Carpeta | Capa | Responsabilidad Principal |
| :--- | :--- | :--- |
| [`shared/types.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/shared/types.ts) | Shared | Contratos e interfaces de TypeScript compartidos entre Frontend y Backend. |
| [`server/index.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/index.ts) | Backend Entry | Inicialización de Express, middlewares de tamaño, integración con Vite y arranque del servidor. |
| [`server/config/db.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/config/db.ts) | Backend Infra | Creación y configuración del pool de conexiones MySQL (`mysql2/promise`). |
| [`server/database/schema.sql`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/database/schema.sql) | Database | Esquema relacional DDL (tablas `users`, `meals`, `daily_summaries`) y datos iniciales. |
| [`server/utils/dateUtils.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/utils/dateUtils.ts) | Backend Utils | Formateo estricto de fechas MySQL (`YYYY-MM-DD HH:MM:SS`) y fecha actual. |
| [`server/prompts/geminiPrompts.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/prompts/geminiPrompts.ts) | Backend AI | Prompts de sistema e inyección de contexto biométrico para Gemini Flash. |
| [`server/services/dbService.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/services/dbService.ts) | Backend Services | Consultas SQL parametrizadas y operaciones CRUD sobre la base de datos. |
| [`server/services/geminiService.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/services/geminiService.ts) | Backend Services | Llamadas a la API de Gemini, gestión multimodal (foto + voz) y cascada de modelos. |
| [`server/controllers/userController.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/controllers/userController.ts) | Backend Controllers | Manejo de solicitudes HTTP para lectura y actualización del perfil de usuario. |
| [`server/controllers/mealController.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/controllers/mealController.ts) | Backend Controllers | Manejo de solicitudes HTTP para consultar, analizar con IA y borrar comidas. |
| [`server/controllers/summaryController.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/controllers/summaryController.ts) | Backend Controllers | Manejo de solicitudes HTTP para obtener o evaluar el resumen nutricional diario. |
| [`server/routes/index.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/routes/index.ts) | Backend Routing | Enrutador raíz `/api` que agrupa las sub-rutas y expone `/health`. |
| [`server/routes/userRoutes.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/routes/userRoutes.ts) | Backend Routing | Endpoints de usuario (`GET /api/profile`, `POST /api/profile`). |
| [`server/routes/mealRoutes.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/routes/mealRoutes.ts) | Backend Routing | Endpoints de comidas (`GET`, `POST /analyze`, `DELETE /:id`). |
| [`server/routes/summaryRoutes.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server/routes/summaryRoutes.ts) | Backend Routing | Endpoints de resumen diario (`GET`, `POST /evaluate`). |
| [`server.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/server.ts) | Backend Root Proxy | Wrapper de una sola línea que delega en `./server/index.js` para retrocompatibilidad. |
| [`src/services/api.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/services/api.ts) | Frontend Services | Cliente HTTP tipado que encapsula todas las llamadas a la API REST. |
| [`src/utils/nutritionCalculators.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/utils/nutritionCalculators.ts) | Frontend Utils | Fórmulas científicas de BMR (Harris-Benedict), TDEE y distribución de macronutrientes. |
| [`src/components/index.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/components/index.ts) | Frontend UI | Barrel export para importar todos los componentes desde una sola ubicación. |
| [`src/components/layout/Navbar.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/components/layout/Navbar.tsx) | Frontend UI | Barra de navegación superior con identidad visual y selector de fecha interactivo. |
| [`src/components/dashboard/DailyDashboard.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/components/dashboard/DailyDashboard.tsx) | Frontend UI | Panel principal: barras de macros, progreso calórico, lista de comidas y feedback IA. |
| [`src/components/meals/MultimodalMealModal.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/components/meals/MultimodalMealModal.tsx) | Frontend UI | Grabador de voz, captura por cámara/subida de foto, notas y envío al backend. |
| [`src/components/meals/MealDetailModal.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/components/meals/MealDetailModal.tsx) | Frontend UI | Modal de vista detallada de una comida, ingredientes detectados y botón de borrado. |
| [`src/components/profile/UserProfileModal.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/components/profile/UserProfileModal.tsx) | Frontend UI | Configuración biométrica, metas, preferencias dietarias y cálculo automático de calorías. |
| [`src/App.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/App.tsx) | Frontend Root | Estado global de la aplicación, control de modales, fechas y notificaciones toast. |
| [`src/main.tsx`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/main.tsx) | Frontend Entry | Renderizado de React en el contenedor `#root` del DOM. |
| [`src/index.css`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/index.css) | Frontend Styles | Estilos globales, configuración de tipografía y directivas Tailwind CSS v4. |
| [`src/types.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/src/types.ts) | Frontend Types | Re-exportación hacia `shared/types.ts` para compatibilidad transparente. |
| [`package.json`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/package.json) | Config | Manifiesto del proyecto, scripts (`dev`, `build`, `lint`) y dependencias. |
| [`tsconfig.json`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/tsconfig.json) | Config | Configuración del compilador TypeScript y resolución de módulos. |
| [`vite.config.ts`](file:///c:/Users/Christian%20Diaz/Desktop/IA/calorie_tracker/vite.config.ts) | Config | Configuración de Vite, plugins de React y Tailwind CSS v4. |

---

## Detalle Módulo por Módulo

### 1. `shared/types.ts`
- **Capa:** Shared / Dominio
- **Propósito:** Define todos los modelos de datos compartidos entre cliente y servidor para evitar duplicidad y discrepancias de tipado.
- **Exporta:**
  - `UserProfile`: Perfil biométrico, nivel de actividad, objetivos y restricciones.
  - `Meal`: Registro de comida con imagen, audio, macros, ingredientes y puntaje.
  - `MealMacros`: Desglose de proteínas, carbohidratos, grasas y fibra.
  - `DailySummary`: Resumen consolidado del día, puntaje global (1-100), fortalezas y mejoras.
  - `MultimodalAnalysisRequest`: Payload de envío para análisis de comida.
  - `GeminiMealAnalysisResponse`: Estructura JSON esperada de Gemini para comidas.
  - `GeminiDailyScoreResponse`: Estructura JSON esperada de Gemini para el resumen del día.
- **Dependencias:** Ninguna (archivo puro de TypeScript).
- **Consumido por:** `server/services/dbService.ts`, `server/services/geminiService.ts`, `server/prompts/geminiPrompts.ts`, `server/controllers/*`, `src/services/api.ts`, `src/components/*`, `src/App.tsx`.

---

### 2. `server/config/db.ts`
- **Capa:** Backend / Infraestructura
- **Propósito:** Configura y exporta el pool de conexiones MySQL gestionado (`mysql2/promise`) a partir de las variables de entorno (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`).
- **Exporta:** `pool` (Instancia de `mysql.Pool`).
- **Dependencias:** `mysql2/promise`, `dotenv`.
- **Consumido por:** `server/services/dbService.ts`.

---

### 3. `server/utils/dateUtils.ts`
- **Capa:** Backend / Utilidades
- **Propósito:** Provee funciones seguras para manejo y formateo de fechas, garantizando compatibilidad absoluta con el tipo `DATETIME` de MySQL (`YYYY-MM-DD HH:MM:SS`) sin errores de conversión ISO/UTC.
- **Exporta:**
  - `getTodayString()`: Retorna la fecha local en formato `YYYY-MM-DD`.
  - `formatToMysqlDateTime(d)`: Desarma cualquier fecha en año, mes, día, hora, minutos y segundos con padding de dos dígitos y la rearma estrictamente en `YYYY-MM-DD HH:MM:SS`.
- **Dependencias:** Ninguna.
- **Consumido por:** `server/services/dbService.ts`, `server/controllers/mealController.ts`, `server/controllers/summaryController.ts`.

---

### 4. `server/prompts/geminiPrompts.ts`
- **Capa:** Backend / Inteligencia Artificial
- **Propósito:** Contiene las instrucciones del sistema y las funciones generadoras de prompts contextualizados para la API de Gemini.
- **Exporta:**
  - `MEAL_ANALYSIS_SYSTEM_PROMPT`: Directivas del sistema como nutricionista clínico de élite multimodal.
  - `DAILY_SUMMARY_SYSTEM_PROMPT`: Directivas del sistema para evaluar el balance nutricional integral del día.
  - `buildMealUserContextPrompt(user, mealType, notes)`: Inyecta el perfil biométrico y metas del usuario en la solicitud de análisis de comida.
  - `buildDailySummaryUserContextPrompt(user, meals, date)`: Construye el reporte completo de todas las comidas del día contra las metas para la evaluación global.
- **Dependencias:** `shared/types.ts`.
- **Consumido por:** `server/services/geminiService.ts`.

---

### 5. `server/services/dbService.ts`
- **Capa:** Backend / Persistencia
- **Propósito:** Encapsula todas las operaciones de lectura y escritura contra la base de datos MySQL mediante consultas SQL parametrizadas.
- **Exporta:**
  - `getUser(userId)`: Obtiene el perfil biométrico del usuario.
  - `updateUser(user, userId)`: Actualiza datos biométricos y metas.
  - `getMeals(date, userId)`: Lista las comidas del usuario (opcionalmente filtradas por fecha).
  - `addMeal(meal)`: Inserta una comida garantizando fecha formateada.
  - `deleteMeal(id)`: Elimina una comida por su ID.
  - `getDailySummary(date, userId)`: Consulta el resumen de un día específico.
  - `saveDailySummary(summary)`: Inserta o actualiza el resumen diario mediante `ON DUPLICATE KEY UPDATE`.
- **Dependencias:** `server/config/db.ts`, `server/utils/dateUtils.ts`, `shared/types.ts`.
- **Consumido por:** `server/controllers/userController.ts`, `server/controllers/mealController.ts`, `server/controllers/summaryController.ts`.

---

### 6. `server/services/geminiService.ts`
- **Capa:** Backend / Inteligencia Artificial
- **Propósito:** Gestiona la comunicación con la API de Google Gemini utilizando `@google/genai`. Implementa el mecanismo de reintentos y cascada de modelos (`gemini-3.7-flash` -> `gemini-3.6-flash` -> `gemini-3.5-flash`) ante picos de demanda 503/429.
- **Exporta:**
  - `analyzeMealWithGemini(params)`: Procesa la foto en Base64, el audio de voz en Base64 y el contexto del usuario, retornando análisis nutricional estructurado.
  - `evaluateDailySummaryWithGemini(user, meals, date)`: Procesa todas las comidas de la jornada y emite un puntaje y consejo integral.
- **Dependencias:** `@google/genai`, `shared/types.ts`, `server/prompts/geminiPrompts.ts`.
- **Consumido por:** `server/controllers/mealController.ts`, `server/controllers/summaryController.ts`.

---

### 7. `server/controllers/userController.ts`
- **Capa:** Backend / Controladores
- **Propósito:** Atiende las peticiones HTTP dirigidas al perfil de usuario.
- **Exporta:**
  - `getProfileHandler(req, res)`: Responde con el perfil biométrico actual.
  - `updateProfileHandler(req, res)`: Valida y guarda las modificaciones de perfil.
- **Dependencias:** `server/services/dbService.ts`.
- **Consumido por:** `server/routes/userRoutes.ts`.

---

### 8. `server/controllers/mealController.ts`
- **Capa:** Backend / Controladores
- **Propósito:** Coordina las operaciones sobre comidas: consulta de lista, procesamiento multimodal con IA, persistencia y recálculo automático de los totales del resumen diario.
- **Exporta:**
  - `getMealsHandler(req, res)`: Retorna la lista de comidas para la fecha solicitada.
  - `analyzeMealHandler(req, res)`: Valida imagen/audio/notas, llama a `geminiService`, persiste en `meals` y actualiza `daily_summaries`.
  - `deleteMealHandler(req, res)`: Elimina un registro de comida.
- **Dependencias:** `server/services/dbService.ts`, `server/services/geminiService.ts`, `server/utils/dateUtils.ts`, `shared/types.ts`.
- **Consumido por:** `server/routes/mealRoutes.ts`.

---

### 9. `server/controllers/summaryController.ts`
- **Capa:** Backend / Controladores
- **Propósito:** Gestiona la obtención del resumen diario y el cálculo del puntaje global mediante Gemini.
- **Exporta:**
  - `getSummaryHandler(req, res)`: Retorna el resumen existente o genera uno por defecto sumando las comidas del día.
  - `evaluateSummaryHandler(req, res)`: Invoca `geminiService` para calificar el balance del día completo y guarda el resultado.
- **Dependencias:** `server/services/dbService.ts`, `server/services/geminiService.ts`, `server/utils/dateUtils.ts`, `shared/types.ts`.
- **Consumido por:** `server/routes/summaryRoutes.ts`.

---

### 10. `server/routes/index.ts` (y sub-rutas `userRoutes`, `mealRoutes`, `summaryRoutes`)
- **Capa:** Backend / Enrutamiento
- **Propósito:** Define los endpoints RESTful estructurados y mapea las rutas HTTP a sus controladores correspondientes.
- **Rutas Principales:**
  - `GET /api/health`: Chequeo de disponibilidad del servidor.
  - `GET /api/profile`, `POST /api/profile`: Gestión del perfil.
  - `GET /api/meals`, `POST /api/meals/analyze`, `DELETE /api/meals/:id`: Gestión de comidas.
  - `GET /api/daily-summary`, `POST /api/daily-summary/evaluate`: Gestión del resumen diario.
- **Dependencias:** Express, controladores respectivos.
- **Consumido por:** `server/index.ts`.

---

### 11. `server/index.ts` & `server.ts`
- **Capa:** Backend / Bootstrap
- **Propósito:** Punto de entrada principal. Configura middlewares de Express (`limit: '50mb'`), monta el router `/api`, configura el middleware de desarrollo de Vite (HMR/SPA) o el servidor estático en producción (`dist/`).
- **Exporta:** `startServer()`.
- **Dependencias:** Express, Vite, `dotenv`, `server/routes/index.ts`.
- **Consumido por:** `npm run dev`, `npm run build`, `npm start`.

---

### 12. `src/services/api.ts`
- **Capa:** Frontend / Servicios de Red
- **Propósito:** Abstrae todas las llamadas HTTP `fetch` hacia el backend en funciones fuertemente tipadas con manejo de errores centralizado.
- **Exporta:** Objeto `api` con métodos:
  - `getProfile()`
  - `updateProfile(profile)`
  - `getMeals(date?)`
  - `analyzeMeal(data)`
  - `deleteMeal(id)`
  - `getDailySummary(date)`
  - `evaluateDailySummary(date)`
- **Dependencias:** `shared/types.ts`.
- **Consumido por:** `src/App.tsx`.

---

### 13. `src/utils/nutritionCalculators.ts`
- **Capa:** Frontend / Lógica Nutricional
- **Propósito:** Implementa fórmulas nutricionales reconocidas para calcular en tiempo real los requerimientos energéticos del usuario.
- **Exporta:**
  - `calculateBMR(weightKg, heightCm, age, gender)`: Ecuación de Harris-Benedict revisada por Roza y Shizgal (1984).
  - `calculateTDEE(bmr, activityLevel)`: Gasto Energético Total Diario según factores de actividad (1.2 a 1.9).
  - `calculateRecommendedTargets(profile)`: Calcula calorías meta y distribución recomendada en gramos de proteína, carbohidratos y grasas según el objetivo (déficit, superávit, etc.).
- **Dependencias:** `shared/types.ts`.
- **Consumido por:** `src/components/profile/UserProfileModal.tsx`.

---

### 14. `src/components/index.ts`
- **Capa:** Frontend / UI
- **Propósito:** Archivo barril que re-exporta los componentes de todas las subcarpetas (`layout`, `dashboard`, `meals`, `profile`) permitiendo importaciones limpias en `App.tsx`.
- **Exporta:** `Navbar`, `DailyDashboard`, `MultimodalMealModal`, `MealDetailModal`, `UserProfileModal`.
- **Consumido por:** `src/App.tsx`.

---

### 15. `src/components/layout/Navbar.tsx`
- **Capa:** Frontend / UI
- **Propósito:** Encabezado persistente de la aplicación. Muestra el selector interactivo de fechas (ayer, hoy, mañana, selector de calendario), el resumen del perfil y el botón de llamada a la acción para registrar comida.
- **Dependencias:** `lucide-react`, `shared/types.ts`.
- **Consumido por:** `src/components/index.ts`.

---

### 16. `src/components/dashboard/DailyDashboard.tsx`
- **Capa:** Frontend / UI
- **Propósito:** Vista principal del día. Despliega:
  - Anillo/barra de calorías consumidas vs. meta.
  - Desglose de macronutrientes (Proteínas, Carbos, Grasas) con porcentaje de cumplimiento.
  - Tarjeta de Puntaje Nutricional Diario con consejos de Gemini y animación de confeti.
  - Tarjetas de comidas registradas en el día con fotos, audio, macros y feedback.
- **Dependencias:** `lucide-react`, `canvas-confetti`, `shared/types.ts`.
- **Consumido por:** `src/components/index.ts`.

---

### 17. `src/components/meals/MultimodalMealModal.tsx`
- **Capa:** Frontend / UI
- **Propósito:** Interfaz de captura y registro multimodal de alimentos:
  - Grabador de audio con Web Audio API: codificación a WAV de 16 bits Mono, visualización de forma de onda en tiempo real, reproducción de vista previa y selector de tiempo.
  - Captura con cámara web en tiempo real o carga de archivo fotográfico.
  - Campo de notas adicionales o detalles de preparación.
  - Envío a `/api/meals/analyze`.
- **Dependencias:** `lucide-react`, `shared/types.ts`.
- **Consumido por:** `src/components/index.ts`.

---

### 18. `src/components/meals/MealDetailModal.tsx`
- **Capa:** Frontend / UI
- **Propósito:** Modal informativo emergente para inspeccionar un plato ya registrado. Muestra la foto ampliada, reproductor del audio grabado, desglose de calorías/macros, puntaje del plato, feedback del nutricionista IA y opción para eliminar el registro.
- **Dependencias:** `lucide-react`, `shared/types.ts`.
- **Consumido por:** `src/components/index.ts`.

---

### 19. `src/components/profile/UserProfileModal.tsx`
- **Capa:** Frontend / UI
- **Propósito:** Configuración del perfil de usuario y metas nutricionales:
  - Formulario biométrico (edad, género, peso, altura).
  - Nivel de actividad física y objetivo corporal (déficit, mantenimiento, volumen).
  - Asistente de cálculo automático (BMR + TDEE + distribución de macros).
  - Alergias, preferencias alimentarias y notas médicas.
- **Dependencias:** `lucide-react`, `shared/types.ts`, `src/utils/nutritionCalculators.ts`.
- **Consumido por:** `src/components/index.ts`.

---

### 20. `src/App.tsx`
- **Capa:** Frontend / Orquestador
- **Propósito:** Componente raíz de React. Mantiene el estado global de la fecha seleccionada (`currentDate`), perfil del usuario (`user`), lista de comidas del día (`meals`), resumen diario (`dailySummary`), control de apertura/cierre de los modales y notificaciones toast.
- **Dependencias:** React, `src/services/api.ts`, `src/components/index.ts`, `shared/types.ts`, `lucide-react`.
- **Consumido por:** `src/main.tsx`.

---

## Matriz de Interacciones del Sistema

```
[Usuario]
   │
   ▼
[src/components/*] (UI)
   │
   ▼
[src/services/api.ts] (Cliente HTTP tipado)
   │
   ▼  (Red: fetch /api/...)
[server/routes/*] (Enrutadores Express)
   │
   ▼
[server/controllers/*] (Controladores HTTP)
   ├───► [server/utils/dateUtils.ts] (Fechas seguras YYYY-MM-DD HH:MM:SS)
   ├───► [server/services/geminiService.ts] (IA Multimodal + Retry + Fallback)
   │        │
   │        ▼
   │     [Google Gemini API] (Modelos 3.7 / 3.6 / 3.5 Flash)
   │
   └───► [server/services/dbService.ts] (Persistencia CRUD)
            │
            ▼
         [server/config/db.ts] (Pool de Conexiones)
            │
            ▼
         [MySQL 8.x Database] (users, meals, daily_summaries)
```

