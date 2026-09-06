import React from 'react';
import {
  Sparkles,
  Camera,
  Mic,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { UserProfile } from '../../../shared/types.js';

interface NavbarProps {
  currentDate: string;
  onDateChange: (newDate: string) => void;
  user: UserProfile | null;
  onOpenProfile: () => void;
  onOpenNewMeal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentDate,
  onDateChange,
  user,
  onOpenProfile,
  onOpenNewMeal,
}) => {
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = currentDate === getTodayString();

  const handlePrevDay = () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${day}`);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${day}`);
  };

  const formatDateLabel = (dateStr: string) => {
    const today = getTodayString();
    if (dateStr === today) return 'Hoy';
    
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-950/85 backdrop-blur-md border-b border-stone-800/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/30">
              <Sparkles className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
                  NutriVoice AI
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Multimodal
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Foto + Voz nativa con Gemini 3.7
              </p>
            </div>
          </div>

          {/* Quick Action on Mobile */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <button
              onClick={onOpenProfile}
              className="p-2 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 hover:text-emerald-400 text-xs"
              title="Perfil"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Date Selector */}
        <div className="flex items-center bg-stone-900/90 border border-stone-800 rounded-xl px-2 py-1 gap-1 shadow-inner">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Día anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-stone-200">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formatDateLabel(currentDate)}</span>
            <span className="text-stone-500 font-normal">({currentDate})</span>
          </div>

          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Día siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && (
            <button
              onClick={() => onDateChange(getTodayString())}
              className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
            >
              Ir a Hoy
            </button>
          )}
        </div>

        {/* Right: Actions (Desktop) */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* User Profile */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 text-xs font-medium text-stone-300 hover:text-stone-100 transition-all"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="text-left">
              <span className="block font-semibold leading-tight">{user?.name || 'Mi Perfil'}</span>
              <span className="block text-[10px] text-stone-400">
                {user?.targetCalories || 2000} kcal • {user?.goal || 'Deficit'}
              </span>
            </div>
          </button>

          {/* New Multimodal Meal Action */}
          <button
            onClick={onOpenNewMeal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 shadow-md shadow-emerald-500/25 transition-all transform active:scale-95"
          >
            <div className="flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              <Mic className="w-3.5 h-3.5" />
            </div>
            <span>Registrar Comida</span>
          </button>
        </div>
      </div>
    </header>
  );
};

