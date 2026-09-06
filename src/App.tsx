import React, { useState, useEffect } from 'react';
import {
  Navbar,
  DailyDashboard,
  UserProfileModal,
  MultimodalMealModal,
  MealDetailModal,
} from './components/index.js';
import { UserProfile, Meal, DailySummary } from '../shared/types.js';
import { api } from './services/api.js';
import { Sparkles, RefreshCw } from 'lucide-react';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

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

  const handleMealCreated = (newMeal: Meal) => {
    setMeals((prev) => [newMeal, ...prev]);
    fetchDayData(currentDate);
    showToast(`¡${newMeal.nombre_plato} registrado y analizado con éxito!`);
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

      {/* Main Navigation */}
      <Navbar
        currentDate={currentDate}
        onDateChange={(newDate) => setCurrentDate(newDate)}
        user={user}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenNewMeal={() => setIsNewMealOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs font-semibold text-stone-400">
              Cargando NutriVoice AI y contexto biométrico...
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
            <span>Tracker Calórico Multimodal Inteligente (Gemini 3.7 Flash)</span>
          </div>
          <span className="text-stone-600">Registro por Foto & Voz • IA Nutricional</span>
        </div>
      </footer>

      {/* MODALS */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSave={handleSaveProfile}
      />

      <MultimodalMealModal
        isOpen={isNewMealOpen}
        onClose={() => setIsNewMealOpen(false)}
        user={user}
        onMealCreated={handleMealCreated}
      />

      <MealDetailModal
        meal={selectedMeal}
        onClose={() => setSelectedMeal(null)}
        onDelete={handleDeleteMeal}
      />
    </div>
  );
}
