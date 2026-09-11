import {
  UserProfile,
  Meal,
  DailySummary,
  MultimodalAnalysisRequest,
} from '../../shared/types.js';

/**
 * Cliente HTTP tipado centralizado para la API de NutriVoice AI.
 */
export const api = {
  /**
   * Obtiene el perfil biométrico y metas del usuario.
   */
  async getProfile(): Promise<UserProfile> {
    const res = await fetch('/api/profile');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener perfil');
    }
    return res.json();
  },

  /**
   * Actualiza el perfil biométrico y metas del usuario.
   */
  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar perfil');
    }
    return res.json();
  },

  /**
   * Obtiene la lista de comidas registradas, opcionalmente filtradas por fecha (YYYY-MM-DD).
   */
  async getMeals(date?: string): Promise<Meal[]> {
    const url = date ? `/api/meals?date=${encodeURIComponent(date)}` : '/api/meals';
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener comidas');
    }
    return res.json();
  },

  /**
   * Obtiene el detalle completo de una comida por ID (incluyendo audio_data_url bajo demanda).
   */
  async getMeal(id: string): Promise<Meal> {
    const res = await fetch(`/api/meals/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener detalle de la comida');
    }
    return res.json();
  },

  /**
   * Envía foto y/o nota de voz para análisis multimodal con Gemini.
   */
  async analyzeMeal(
    data: MultimodalAnalysisRequest
  ): Promise<{ success: boolean; meal: Meal; summary: DailySummary }> {
    const res = await fetch('/api/meals/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error en análisis multimodal');
    }
    return res.json();
  },

  /**
   * Elimina un registro de comida por su ID.
   */
  async deleteMeal(id: string): Promise<boolean> {
    const res = await fetch(`/api/meals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar comida');
    }
    const data = await res.json();
    return data.success;
  },

  /**
   * Elimina registros de comidas de días anteriores al actual para liberar espacio en disco.
   * Conserva los resúmenes diarios y las comidas del día de hoy.
   */
  async purgePastMeals(
    beforeDate?: string
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    const url = beforeDate
      ? `/api/meals/purge/past?beforeDate=${encodeURIComponent(beforeDate)}`
      : '/api/meals/purge/past';
    const res = await fetch(url, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al liberar espacio en disco');
    }
    return res.json();
  },

  /**
   * Obtiene el resumen nutricional diario para una fecha específica (YYYY-MM-DD).
   */
  async getDailySummary(date: string): Promise<DailySummary> {
    const res = await fetch(`/api/daily-summary?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener resumen diario');
    }
    return res.json();
  },

  /**
   * Evalúa el balance integral del día y calcula el puntaje global con Gemini.
   */
  async evaluateDailySummary(
    date: string
  ): Promise<{ success: boolean; summary: DailySummary }> {
    const res = await fetch('/api/daily-summary/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al evaluar el día con Gemini');
    }
    return res.json();
  },
};

