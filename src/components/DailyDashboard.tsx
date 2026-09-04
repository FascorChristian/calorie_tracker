import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Target,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Volume2,
  ChevronRight,
  Utensils,
  Award,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Meal, DailySummary, UserProfile } from '../types.js';

interface DailyDashboardProps {
  currentDate: string;
  user: UserProfile | null;
  meals: Meal[];
  dailySummary: DailySummary | null;
  onOpenNewMeal: () => void;
  onSelectMeal: (meal: Meal) => void;
  onRecalculateScore: () => Promise<void>;
  isEvaluatingScore: boolean;
}

export const DailyDashboard: React.FC<DailyDashboardProps> = ({
  currentDate,
  user,
  meals,
  dailySummary,
  onOpenNewMeal,
  onSelectMeal,
  onRecalculateScore,
  isEvaluatingScore,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const targetCalories = user?.targetCalories || 2000;
  const targetProtein = user?.targetProteinG || 140;
  const targetCarbs = user?.targetCarbsG || 200;
  const targetFat = user?.targetFatG || 65;

  const totalCalories = meals.reduce((acc, m) => acc + (m.calorias_estimadas || 0), 0);
  const totalProtein = Math.round(meals.reduce((acc, m) => acc + (m.macros?.proteinas || 0), 0));
  const totalCarbs = Math.round(meals.reduce((acc, m) => acc + (m.macros?.carbohidratos || 0), 0));
  const totalFat = Math.round(meals.reduce((acc, m) => acc + (m.macros?.grasas || 0), 0));

  const remainingCalories = targetCalories - totalCalories;
  const calPercent = Math.min(100, Math.round((totalCalories / targetCalories) * 100));
  const protPercent = Math.min(100, Math.round((totalProtein / targetProtein) * 100));
  const carbPercent = Math.min(100, Math.round((totalCarbs / targetCarbs) * 100));
  const fatPercent = Math.min(100, Math.round((totalFat / targetFat) * 100));

  const filteredMeals = filterType === 'all' ? meals : meals.filter((m) => m.mealType === filterType);

  const handleTriggerRecalculate = async () => {
    await onRecalculateScore();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-emerald-500 to-teal-400 text-emerald-400 border-emerald-500/30';
    if (score >= 70) return 'from-teal-500 to-amber-400 text-teal-400 border-teal-500/30';
    if (score >= 50) return 'from-amber-500 to-orange-400 text-amber-400 border-amber-500/30';
    return 'from-rose-500 to-orange-500 text-rose-400 border-rose-500/30';
  };

  const dailyScore = dailySummary?.puntaje_diario || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. TOP CARDS: CALORIES & MACROS PROGRESS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Calorie Progress Card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 p-6 rounded-3xl border border-stone-800 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Calorías del Día
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-stone-300">
              Meta: {targetCalories} kcal
            </span>
          </div>

          {/* Numbers */}
          <div className="my-5 flex items-baseline justify-between">
            <div>
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-100">
                {totalCalories}
              </span>
              <span className="text-stone-400 text-sm ml-1 font-medium">kcal consumidas</span>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold block ${remainingCalories >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {remainingCalories >= 0 ? `${remainingCalories} restantes` : `${Math.abs(remainingCalories)} excedidas`}
              </span>
              <span className="text-[11px] text-stone-500">
                {calPercent}% de tu meta diaria
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-stone-800 rounded-full overflow-hidden p-0.5">
              <div
                style={{ width: `${calPercent}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  calPercent > 105
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-stone-500 font-mono">
              <span>0 kcal</span>
              <span>{Math.round(targetCalories / 2)} kcal</span>
              <span>{targetCalories} kcal</span>
            </div>
          </div>
        </div>

        {/* 3 Macro Cards */}
        <div className="lg:col-span-7 grid grid-cols-3 gap-3">
          {/* Protein */}
          <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                  Proteína
                </span>
                <span className="text-[10px] text-stone-400 font-mono">{protPercent}%</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-stone-100">
                {totalProtein}
                <span className="text-xs font-normal text-stone-400">/{targetProtein}g</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${protPercent}%` }}
                  className="h-full bg-teal-400 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          {/* Carbs */}
          <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Carbos
                </span>
                <span className="text-[10px] text-stone-400 font-mono">{carbPercent}%</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-stone-100">
                {totalCarbs}
                <span className="text-xs font-normal text-stone-400">/{targetCarbs}g</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${carbPercent}%` }}
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          {/* Fats */}
          <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                  Grasas
                </span>
                <span className="text-[10px] text-stone-400 font-mono">{fatPercent}%</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-stone-100">
                {totalFat}
                <span className="text-xs font-normal text-stone-400">/{targetFat}g</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${fatPercent}%` }}
                  className="h-full bg-rose-400 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. GEMINI DAILY SCORE & COACH ADVICE (Puntaje Diario 1-100) */}
      <section className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left: Score Badge */}
          <div className="flex items-center gap-5">
            <div className={`w-24 h-24 rounded-3xl bg-stone-950 border-2 flex flex-col items-center justify-center shadow-2xl shrink-0 ${getScoreColor(dailyScore)}`}>
              <span className="text-3xl font-black tracking-tight leading-none">
                {dailyScore > 0 ? dailyScore : '--'}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 mt-1">
                Puntaje IA
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Evaluación Holística Diaria (Gemini 3.7)
                </span>
                {dailySummary?.balance_nutricional && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                    {dailySummary.balance_nutricional}
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-stone-100">
                {dailyScore >= 85
                  ? '¡Excelente calidad y balance nutricional hoy!'
                  : dailyScore >= 70
                  ? 'Buen progreso con detalles a afinar'
                  : dailyScore > 0
                  ? 'Día con oportunidad de optimización'
                  : 'Listo para evaluar tu día completo'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-300 mt-1 leading-relaxed max-w-2xl">
                {dailySummary?.consejo_diario ||
                  'Registra tus comidas y presiona "Evaluar Día con Gemini" para obtener tu puntaje de 1 a 100 y consejos personalizados.'}
              </p>
            </div>
          </div>

          {/* Right: Recalculate Button */}
          <button
            onClick={handleTriggerRecalculate}
            disabled={isEvaluatingScore || meals.length === 0}
            className="w-full md:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isEvaluatingScore ? 'animate-spin' : ''}`} />
            <span>
              {isEvaluatingScore
                ? 'Analizando día completo...'
                : dailyScore > 0
                ? 'Recalcular con Gemini'
                : 'Evaluar Día con Gemini'}
            </span>
          </button>
        </div>

        {/* Strong points and improvement areas */}
        {dailySummary && (dailySummary.puntos_fuertes?.length > 0 || dailySummary.areas_de_mejora?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-stone-800/80">
            {/* Puntos Fuertes */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Aciertos del Día
              </span>
              <ul className="space-y-1.5">
                {dailySummary.puntos_fuertes?.map((item, idx) => (
                  <li key={idx} className="text-xs text-stone-300 flex items-start gap-2 bg-stone-950/40 p-2.5 rounded-xl border border-stone-800/50">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Áreas de Mejora */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" />
                Consejos de Ajuste
              </span>
              <ul className="space-y-1.5">
                {dailySummary.areas_de_mejora?.map((item, idx) => (
                  <li key={idx} className="text-xs text-stone-300 flex items-start gap-2 bg-stone-950/40 p-2.5 rounded-xl border border-stone-800/50">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* 3. TODAY'S MEALS TIMELINE & CARDS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-100 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-emerald-400" />
              Platos Registrados ({meals.length})
            </h2>
            <p className="text-xs text-stone-400">
              Análisis visual + notas de voz procesadas por la IA
            </p>
          </div>

          {/* Meal Filters & New Meal CTA */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center bg-stone-900 p-1 rounded-xl border border-stone-800 text-xs">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'desayuno', label: 'Desayuno' },
                { id: 'almuerzo', label: 'Almuerzo' },
                { id: 'cena', label: 'Cena' },
                { id: 'snack', label: 'Snacks' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filterType === f.id
                      ? 'bg-emerald-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={onOpenNewMeal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Añadir Plato</span>
            </button>
          </div>
        </div>

        {/* Meals Grid */}
        {filteredMeals.length === 0 ? (
          <div className="p-12 text-center bg-stone-900/50 rounded-3xl border border-dashed border-stone-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
              <Utensils className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-stone-200">
              No hay comidas registradas para esta selección
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Toma una foto de tu plato y graba una breve nota de voz con los ingredientes o usa los platos de prueba.
            </p>
            <button
              onClick={onOpenNewMeal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Registrar Primera Comida
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMeals.map((meal) => (
              <div
                key={meal.id}
                onClick={() => onSelectMeal(meal)}
                className="bg-stone-900 border border-stone-800 hover:border-emerald-500/50 rounded-3xl p-5 shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between group"
              >
                {/* Header info */}
                <div className="flex items-start gap-4">
                  {meal.imageUrl ? (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 shrink-0">
                      <img
                        src={meal.imageUrl}
                        alt={meal.nombre_plato}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-center text-emerald-400 shrink-0">
                      <Utensils className="w-7 h-7" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-800 text-emerald-400 border border-stone-700">
                        {meal.mealType} • {meal.time}
                      </span>
                      <span className="text-xs font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                        {meal.puntaje_plato}/10
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-stone-100 mt-1.5 leading-snug line-clamp-1">
                      {meal.nombre_plato}
                    </h4>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-extrabold text-emerald-400">
                        {meal.calorias_estimadas} kcal
                      </span>
                      <span className="text-stone-600">•</span>
                      <span className="text-xs text-stone-400">
                        P: <strong className="text-stone-200">{meal.macros.proteinas}g</strong> | C: <strong className="text-stone-200">{meal.macros.carbohidratos}g</strong> | G: <strong className="text-stone-200">{meal.macros.grasas}g</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Brief Feedback / Voice Snippet */}
                <div className="mt-4 pt-3 border-t border-stone-800/80 space-y-1.5">
                  <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                    {meal.feedback_breve}
                  </p>

                  {meal.detalles_audio && (
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400 italic">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">"{meal.detalles_audio}"</span>
                    </div>
                  )}
                </div>

                {/* Footer Link */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-400 font-semibold group-hover:text-emerald-300">
                  <span>Ver análisis completo de ingredientes</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
