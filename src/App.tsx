import React, { useState, useEffect } from 'react';
import {
  Navbar,
  DailyDashboard,
  UserProfileModal,
  MultimodalMealModal,
  MealDetailModal,
  QueueViewer,
} from './components/index.js';
import { UserProfile, Meal, DailySummary } from '../shared/types.js';
import { api } from './services/api.js';
import { Sparkles, RefreshCw, Server } from 'lucide-react';

function getTodayString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') partMap[p.type] = p.value;
    }
    return `${partMap.year}-${partMap.month}-${partMap.day}`;
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export default function App() {
  const [currentDate, setCurrentDate] = useState<string>(getTodayString());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluatingScore, setIsEvaluatingScore] = useState<boolean>(false);

  // Modals state
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isNewMealOpen, setIsNewMealOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isServerWaking, setIsServerWaking] = useState<boolean>(false);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Reload meals and summary when date changes
  useEffect(() => {
    fetchDayData(currentDate);
  }, [currentDate]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    const wakeTimer = setTimeout(() => {
      setIsServerWaking(true);
    }, 2500);

    try {
      // 1. Fetch User Profile
      const userData = await api.getProfile().catch((err) => {
        console.error('Error fetching user profile:', err);
        return null;
      });
      if (userData) {
        setUser(userData);
      }

      // 2. Fetch Day data
      await fetchDayData(currentDate);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      clearTimeout(wakeTimer);
      setIsServerWaking(false);
      setIsLoading(false);
    }
  };

  const fetchDayData = async (date: string) => {
    try {
      const [mealsData, summaryData] = await Promise.all([
        api.getMeals(date).catch((err) => {
          console.error('Error fetching meals:', err);
          return [];
        }),
        api.getDailySummary(date).catch((err) => {
          console.error('Error fetching summary:', err);
          return null;
        }),
      ]);

      setMeals(mealsData);
      setDailySummary(summaryData);
    } catch (err) {
      console.error('Error fetching day data:', err);
    }
  };

  const handleSaveProfile = async (updated: Partial<UserProfile>) => {
    try {
      const saved = await api.updateProfile(updated);
      setUser(saved);
      showToast('¡Perfil biométrico actualizado exitosamente!');
      // Refresh summary with new goals
      fetchDayData(currentDate);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showToast(err.message || 'Error al guardar el perfil');
    }
  };

  const handleMealsCreated = (newMeals: Meal[], summary?: DailySummary | null) => {
    setMeals((prev) => {
      const existingIds = new Set(newMeals.map((m) => m.id));
      return [...newMeals, ...prev.filter((m) => !existingIds.has(m.id))];
    });
    if (summary) {
      setDailySummary(summary);
    } else {
      fetchDayData(currentDate);
    }
    if (newMeals.length > 1) {
      showToast(`¡${newMeals.length} platos registrados y evaluados juntos con éxito!`);
    } else if (newMeals.length === 1) {
      showToast(`¡${newMeals[0].nombre_plato} registrado y analizado con éxito!`);
    }
  };

  const handleMealCreated = (newMeal: Meal, summary?: DailySummary | null) => {
    handleMealsCreated([newMeal], summary);
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      const success = await api.deleteMeal(mealId);
      if (success) {
        setMeals((prev) => prev.filter((m) => m.id !== mealId));
        fetchDayData(currentDate);
        showToast('Plato eliminado.');
      }
    } catch (err) {
      console.error('Error deleting meal:', err);
      showToast('Error al eliminar comida');
    }
  };

  const handleRecalculateScore = async () => {
    setIsEvaluatingScore(true);
    try {
      const data = await api.evaluateDailySummary(currentDate);
      setDailySummary(data.summary);
      showToast(`¡Puntaje Diario calculado: ${data.summary.puntaje_diario}/100!`);
    } catch (err: any) {
      console.error('Error evaluating daily score:', err);
      showToast(err.message || 'Error al evaluar el día con Gemini');
    } finally {
      setIsEvaluatingScore(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-bounce bg-emerald-500 text-stone-950 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Render cold-start wake-up notification */}
      {isServerWaking && (
        <div className="bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-yellow-600/90 text-stone-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
          <Server className="w-4 h-4 animate-pulse" />
          <span>Despertando servidor en Render (tras período de inactividad, puede tomar unos segundos)...</span>
        </div>
      )}

      {/* Main Navigation */}
      <Navbar
        currentDate={currentDate}
        onDateChange={(newDate) => setCurrentDate(newDate)}
        user={user}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenNewMeal={() => setIsNewMealOpen(true)}
        onOpenQueue={() => setIsQueueOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs font-semibold text-stone-400">
              {isServerWaking
                ? 'Conectando con el servidor en Render...'
                : 'Cargando NutriVoice AI y contexto biométrico...'}
            </p>
          </div>
        ) : (
          <DailyDashboard
            currentDate={currentDate}
            user={user}
            meals={meals}
            dailySummary={dailySummary}
            onOpenNewMeal={() => setIsNewMealOpen(true)}
            onSelectMeal={(meal) => setSelectedMeal(meal)}
            onRecalculateScore={handleRecalculateScore}
            isEvaluatingScore={isEvaluatingScore}
          />
        )}
      </main>

      {/* Footer info */}
      <footer className="border-t border-stone-800/80 bg-stone-950 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-400">NutriVoice AI</span>
            <span>•</span>
            <span>Tracker Calórico Multimodal Inteligente (Gemini 3.1 Flash Lite)</span>
          </div>
          <span className="text-stone-600">Registro por Foto & Voz • Cola con Regulación de RPM</span>
        </div>
      </footer>

      {/* MODALS */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSave={handleSaveProfile}
        onPurgeSuccess={() => {
          fetchDayData(currentDate);
          showToast('Limpieza de almacenamiento completada exitosamente.');
        }}
      />

      <MultimodalMealModal
        isOpen={isNewMealOpen}
        onClose={() => setIsNewMealOpen(false)}
        user={user}
        onMealCreated={handleMealCreated}
        onMealsCreated={handleMealsCreated}
        currentDate={currentDate}
      />

      <MealDetailModal
        meal={selectedMeal}
        onClose={() => setSelectedMeal(null)}
        onDelete={handleDeleteMeal}
      />

      {/* Visor de Cola de Procesamiento de IA */}
      <QueueViewer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        showFloatingBadge={true}
      />
    </div>
  );
}
