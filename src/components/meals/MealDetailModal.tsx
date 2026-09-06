import React from 'react';
import {
  X,
  Sparkles,
  Flame,
  Volume2,
  CheckCircle2,
  Trash2,
  Utensils,
  Clock,
  Calendar,
} from 'lucide-react';
import { Meal } from '../../../shared/types.js';

interface MealDetailModalProps {
  meal: Meal | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const MealDetailModal: React.FC<MealDetailModalProps> = ({
  meal,
  onClose,
  onDelete,
}) => {
  if (!meal) return null;

  const totalMacros = (meal.macros.proteinas || 0) + (meal.macros.carbohidratos || 0) + (meal.macros.grasas || 0);
  const pPct = totalMacros ? Math.round((meal.macros.proteinas / totalMacros) * 100) : 33;
  const cPct = totalMacros ? Math.round((meal.macros.carbohidratos / totalMacros) * 100) : 33;
  const fPct = totalMacros ? Math.round((meal.macros.grasas / totalMacros) * 100) : 34;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Image Header or Gradient */}
        {meal.imageUrl ? (
          <div className="relative aspect-video w-full bg-stone-950 overflow-hidden">
            <img
              src={meal.imageUrl}
              alt={meal.nombre_plato}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-black/40" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-stone-950 font-bold text-xs capitalize shadow-md">
                {meal.mealType}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-900/90 text-stone-200 text-xs font-mono border border-stone-700">
                {meal.time}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 bg-stone-850 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-stone-950 font-bold text-xs capitalize">
                {meal.mealType}
              </span>
              <span className="text-xs text-stone-400">{meal.time}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-stone-100 leading-snug">
              {meal.nombre_plato}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-extrabold text-emerald-400 flex items-center gap-1">
                <Flame className="w-5 h-5" />
                {meal.calorias_estimadas} <span className="text-xs font-normal text-stone-400">kcal</span>
              </span>

              <div className="px-2.5 py-1 rounded-xl bg-stone-800 border border-stone-700 text-xs font-bold text-teal-300">
                Puntaje Nutricional: {meal.puntaje_plato}/10
              </div>
            </div>
          </div>

          {/* Macro Breakdown Bar */}
          <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
              Distribución de Macronutrientes
            </span>
            <div className="h-3 w-full bg-stone-900 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${pPct}%` }}
                className="bg-teal-500 h-full"
                title={`Proteína: ${pPct}%`}
              />
              <div
                style={{ width: `${cPct}%` }}
                className="bg-amber-500 h-full"
                title={`Carbohidratos: ${cPct}%`}
              />
              <div
                style={{ width: `${fPct}%` }}
                className="bg-rose-500 h-full"
                title={`Grasas: ${fPct}%`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-stone-900/80 p-2 rounded-xl border border-stone-800">
                <span className="text-[10px] text-teal-400 font-bold block">Proteína</span>
                <span className="text-sm font-extrabold text-stone-100">{meal.macros.proteinas}g</span>
              </div>
              <div className="bg-stone-900/80 p-2 rounded-xl border border-stone-800">
                <span className="text-[10px] text-amber-400 font-bold block">Carbos</span>
                <span className="text-sm font-extrabold text-stone-100">{meal.macros.carbohidratos}g</span>
              </div>
              <div className="bg-stone-900/80 p-2 rounded-xl border border-stone-800">
                <span className="text-[10px] text-rose-400 font-bold block">Grasas</span>
                <span className="text-sm font-extrabold text-stone-100">{meal.macros.grasas}g</span>
              </div>
            </div>
          </div>

          {/* AI Feedback */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>Feedback Nutricional Personalizado</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              {meal.feedback_breve}
            </p>
          </div>

          {/* Voice note audio player and/or transcript */}
          {(meal.audioDataUrl || meal.detalles_audio) && (
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-stone-300">
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  Nota de Voz Grabada
                </span>
                {meal.audioDurationSeconds ? (
                  <span className="text-[11px] text-stone-500 font-mono">
                    {meal.audioDurationSeconds}s
                  </span>
                ) : null}
              </div>

              {meal.audioDataUrl && (
                <audio
                  src={meal.audioDataUrl}
                  controls
                  className="w-full h-8 accent-emerald-500"
                />
              )}

              {meal.detalles_audio && (
                <p className="text-xs text-stone-400 italic">
                  "{meal.detalles_audio}"
                </p>
              )}
            </div>
          )}

          {/* Ingredients list */}
          {meal.ingredientes_detectados?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-teal-400" />
                Ingredientes & Porciones Detectadas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {meal.ingredientes_detectados.map((ing, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-3 py-1 rounded-xl bg-stone-950 border border-stone-800 text-stone-300"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm('¿Eliminar este registro de comida?')) {
                onDelete(meal.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar Plato
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
