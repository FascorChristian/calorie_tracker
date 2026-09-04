import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Activity,
  Target,
  Sparkles,
  AlertTriangle,
  HeartPulse,
  Save,
  Calculator,
  Check,
  Flame,
} from 'lucide-react';
import { UserProfile } from '../types.js';
import { calculateRecommendedTargets, calculateBMR, calculateTDEE } from '../utils/nutritionCalculators.js';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSave: (updated: Partial<UserProfile>) => Promise<void>;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: 'Christian Díaz',
    age: 28,
    gender: 'masculino',
    weightKg: 78,
    heightCm: 178,
    activityLevel: 'moderado',
    goal: 'deficit',
    targetCalories: 2150,
    targetProteinG: 160,
    targetCarbsG: 200,
    targetFatG: 65,
    allergies: ['Lactosa moderada'],
    dietaryPreferences: ['Alto en proteína'],
    notes: 'Entrenamiento de fuerza 4x por semana.',
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [prefInput, setPrefInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(user);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleApplyCalculatedTargets = () => {
    if (
      !formData.weightKg ||
      !formData.heightCm ||
      !formData.age ||
      !formData.gender ||
      !formData.activityLevel ||
      !formData.goal
    ) {
      return;
    }

    const calculated = calculateRecommendedTargets({
      weightKg: formData.weightKg,
      heightCm: formData.heightCm,
      age: formData.age,
      gender: formData.gender,
      activityLevel: formData.activityLevel,
      goal: formData.goal,
    });

    setFormData((prev) => ({
      ...prev,
      targetCalories: calculated.calories,
      targetProteinG: calculated.proteinG,
      targetCarbsG: calculated.carbsG,
      targetFatG: calculated.fatG,
    }));
  };

  const handleAddAllergy = () => {
    if (!allergyInput.trim()) return;
    const current = formData.allergies || [];
    if (!current.includes(allergyInput.trim())) {
      setFormData({ ...formData, allergies: [...current, allergyInput.trim()] });
    }
    setAllergyInput('');
  };

  const handleRemoveAllergy = (item: string) => {
    setFormData({
      ...formData,
      allergies: (formData.allergies || []).filter((a) => a !== item),
    });
  };

  const handleAddPref = () => {
    if (!prefInput.trim()) return;
    const current = formData.dietaryPreferences || [];
    if (!current.includes(prefInput.trim())) {
      setFormData({ ...formData, dietaryPreferences: [...current, prefInput.trim()] });
    }
    setPrefInput('');
  };

  const handleRemovePref = (item: string) => {
    setFormData({
      ...formData,
      dietaryPreferences: (formData.dietaryPreferences || []).filter((p) => p !== item),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      setShowSavedToast(true);
      setTimeout(() => {
        setShowSavedToast(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick stats
  const bmr = formData.weightKg && formData.heightCm && formData.age && formData.gender
    ? calculateBMR({
        weightKg: formData.weightKg,
        heightCm: formData.heightCm,
        age: formData.age,
        gender: formData.gender,
      })
    : 0;

  const tdee = bmr && formData.activityLevel ? calculateTDEE(bmr, formData.activityLevel) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100 flex items-center gap-2">
                Perfil Biométrico y Memoria Base
              </h2>
              <p className="text-xs text-stone-400">
                Contexto inyectado en cada evaluación multimodal de Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Base Notice */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Inyección de Contexto Activa</span>
              Gemini utilizará tu peso ({formData.weightKg}kg), tu objetivo ({formData.goal}) y tus restricciones alimentarias para juzgar cada plato y calcular tu puntaje diario del 1 al 100.
            </div>
          </div>

          {/* Section 1: Biometrics */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-400" />
              1. Datos Biométricos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Género Biológico</label>
                <select
                  value={formData.gender || 'masculino'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Edad (años)</label>
                  <input
                    type="number"
                    min="12"
                    max="110"
                    value={formData.age || ''}
                    onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500 text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="250"
                    value={formData.weightKg || ''}
                    onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500 text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Altura (cm)</label>
                  <input
                    type="number"
                    min="100"
                    max="230"
                    value={formData.heightCm || ''}
                    onChange={(e) => setFormData({ ...formData, heightCm: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500 text-center"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Activity & Goals */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              2. Nivel de Actividad y Objetivo Nutricional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nivel de Actividad</label>
                <select
                  value={formData.activityLevel || 'moderado'}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="sedentario">Sedentario (Oficina / Poco ejercicio)</option>
                  <option value="ligero">Ligero (1-3 días ejercicio/semana)</option>
                  <option value="moderado">Moderado (3-5 días ejercicio/semana)</option>
                  <option value="muy_activo">Muy Activo (6-7 días intenso)</option>
                  <option value="extremo">Atleta / Doble sesión diaria</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Objetivo Físico</label>
                <select
                  value={formData.goal || 'deficit'}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="deficit">Déficit Calórico (Pérdida de Grasa)</option>
                  <option value="mantenimiento">Mantenimiento y Salud General</option>
                  <option value="volumen">Volumen / Ganancia Muscular</option>
                  <option value="recomposicion">Recomposición Corporal</option>
                </select>
              </div>
            </div>

            {/* Quick BMR / TDEE estimation badge */}
            <div className="mt-3 flex items-center justify-between p-3 bg-stone-950/70 border border-stone-800/80 rounded-2xl text-xs">
              <div className="flex items-center gap-3">
                <span className="text-stone-400">
                  TMB Base: <strong className="text-stone-200">{bmr} kcal</strong>
                </span>
                <span className="text-stone-600">•</span>
                <span className="text-stone-400">
                  Gasto Total (TDEE): <strong className="text-teal-300">{tdee} kcal</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyCalculatedTargets}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
              >
                <Calculator className="w-3.5 h-3.5" />
                Auto-Calcular Metas
              </button>
            </div>
          </div>

          {/* Section 3: Daily Target Macros */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              3. Metas Diarias de Calorías y Macronutrientes
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Calorías (kcal)</label>
                <input
                  type="number"
                  step="50"
                  value={formData.targetCalories || 2000}
                  onChange={(e) => setFormData({ ...formData, targetCalories: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-500 text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Proteína (g)</label>
                <input
                  type="number"
                  value={formData.targetProteinG || 140}
                  onChange={(e) => setFormData({ ...formData, targetProteinG: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-teal-400 font-bold text-sm focus:outline-none focus:border-emerald-500 text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Carbos (g)</label>
                <input
                  type="number"
                  value={formData.targetCarbsG || 200}
                  onChange={(e) => setFormData({ ...formData, targetCarbsG: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-amber-400 font-bold text-sm focus:outline-none focus:border-emerald-500 text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Grasas (g)</label>
                <input
                  type="number"
                  value={formData.targetFatG || 65}
                  onChange={(e) => setFormData({ ...formData, targetFatG: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-rose-400 font-bold text-sm focus:outline-none focus:border-emerald-500 text-center"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 4: Allergies and Preferences */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              4. Restricciones, Alergias y Preferencias
            </h3>

            {/* Allergies */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Alergias o Intolerancias
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Ej: Lactosa, Gluten, Mariscos..."
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAllergy();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddAllergy}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl"
                >
                  Añadir
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.allergies?.map((allergy) => (
                  <span
                    key={allergy}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(allergy)}
                      className="hover:text-rose-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Preferencias Dietarias / Estilo
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Ej: Keto, Alto en Proteína, Vegano, Ayuno 16/8..."
                  value={prefInput}
                  onChange={(e) => setPrefInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPref();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddPref}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl"
                >
                  Añadir
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.dietaryPreferences?.map((pref) => (
                  <span
                    key={pref}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium"
                  >
                    {pref}
                    <button
                      type="button"
                      onClick={() => handleRemovePref(pref)}
                      className="hover:text-teal-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Notas Médicas / Contexto Personal para Gemini
              </label>
              <textarea
                rows={2}
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Resistencia a la insulina, entreno en ayunas a las 7am..."
                className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-stone-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {showSavedToast ? (
                <>
                  <Check className="w-4 h-4" />
                  ¡Guardado con Éxito!
                </>
              ) : isSaving ? (
                <>Guardando...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Perfil Base
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
