import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  Database,
  Layers,
  Sparkles,
  Terminal,
  FileCode,
  Download,
} from 'lucide-react';
import {
  PYTHON_MODELS_CODE,
  PYTHON_BACKEND_CODE,
  REACT_COMPONENT_CODE,
} from '../../server/pythonDeliverables.js';
import {
  MEAL_ANALYSIS_SYSTEM_PROMPT,
  DAILY_SUMMARY_SYSTEM_PROMPT,
} from '../../server/prompts.js';

interface PythonDeliverablesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonDeliverablesModal: React.FC<PythonDeliverablesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'react' | 'backend' | 'prompts'>('backend');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const PROMPTS_TEXT = `=============================================================================
PROMPT 1: EVALUACIÓN DEL PLATO INDIVIDUAL (MULTIMODAL: FOTO + AUDIO NATIVO)
=============================================================================
Modelo recomendado: gemini-3.7-flash (o gemini-1.5-flash / gemini-2.0-flash)
Entrada: [Imagen Parts] + [Audio Parts] + [Texto Contexto Base del Usuario]
Salida: JSON Estricto

--- SYSTEM PROMPT ---
${MEAL_ANALYSIS_SYSTEM_PROMPT}

--- EJEMPLO DE INYECCIÓN DE CONTEXTO DEL USUARIO (TEXT PROMPT) ---
CONTEXTO BASE DEL USUARIO:
- Nombre: Christian Díaz | Edad: 28 años | Género: Masculino
- Peso: 78 kg | Altura: 178 cm | Nivel de Actividad: Moderado (3-5 días/semana)
- Objetivo Principal: DÉFICIT CALÓRICO (Pérdida de grasa preservando músculo)
- Meta Calórica Diaria: 2150 kcal
- Metas de Macros Diarias: Proteína: 160g | Carbohidratos: 200g | Grasas: 65g
- Alergias / Intolerancias: Lactosa moderada
- Preferencias: Alto en proteína, comida real

INFORMACIÓN DEL REGISTRO ACTUAL:
- Tipo de Comida: ALMUERZO
- Notas Adicionales: Prestar máxima atención al audio adjunto para detectar grasas de cocción o aderezos.

=============================================================================
PROMPT 2: EVALUACIÓN DEL RESUMEN DIARIO (TEXT-ONLY: RESUMEN + CONTEXTO BASE)
=============================================================================
Modelo recomendado: gemini-3.7-flash
Entrada: [Texto de todas las comidas del día] + [Contexto Base y Metas]
Salida: JSON Estricto

--- SYSTEM PROMPT ---
${DAILY_SUMMARY_SYSTEM_PROMPT}

--- EJEMPLO DE RESUMEN ENVIADO A GEMINI ---
CONTEXTO DEL USUARIO:
- Objetivo: DÉFICIT CALÓRICO (Meta: 2150 kcal, P: 160g, C: 200g, G: 65g)

RESUMEN CONSUMIDO EN LA FECHA (2026-09-01):
- Calorías totales: 1820 kcal vs Meta 2150 kcal (-330 kcal)
- Proteínas: 156g vs Meta 160g
- Carbohidratos: 168g vs Meta 200g
- Grasas: 58g vs Meta 65g

DETALLE DE TODAS LAS COMIDAS DEL DÍA:
1. [DESAYUNO] Omelette con Espinacas y Tostadas (460 kcal) - P: 32g, C: 36g, G: 20g. Puntaje: 9.2/10.
2. [ALMUERZO] Bowl de Salmón con Quinoa (680 kcal) - P: 46g, C: 52g, G: 28g. Puntaje: 9.4/10.
3. [CENA] Pechuga de Pavo con Ensalada (680 kcal) - P: 78g, C: 80g, G: 10g. Puntaje: 8.8/10.
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2">
                Entregables de Código & Arquitectura
              </h2>
              <p className="text-xs text-stone-400">
                Modelos SQLAlchemy, Componente React Web Audio, FastAPI & System Prompts
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

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-2 bg-stone-950 border-b border-stone-800 flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('backend')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'backend'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-md'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>3. Backend FastAPI & Gemini SDK</span>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'models'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-md'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>1. Modelos SQLAlchemy (Python)</span>
          </button>

          <button
            onClick={() => setActiveTab('react')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'react'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-md'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Componente React (Audio + Foto)</span>
          </button>

          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'prompts'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-md'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4. System Prompts Exactos</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Action Bar for Active Tab */}
          <div className="flex items-center justify-between bg-stone-950 p-3 rounded-2xl border border-stone-800">
            <div>
              <span className="text-xs font-bold text-stone-200 block">
                {activeTab === 'backend' && 'main.py • Endpoints FastAPI con inferencia multimodal (google-genai)'}
                {activeTab === 'models' && 'models.py • SQLAlchemy ORM (User, Meal, DailySummary) + Pydantic'}
                {activeTab === 'react' && 'MultimodalMealCapture.tsx • Web Audio API (Canvas Waveform) + Foto'}
                {activeTab === 'prompts' && 'System Prompts 1 y 2 • Formato JSON Estricto y Contexto Base'}
              </span>
              <span className="text-[11px] text-stone-400">
                Listo para producción, compatible con el SDK moderno @google/genai y google-genai en Python.
              </span>
            </div>

            <button
              onClick={() => {
                const text =
                  activeTab === 'backend'
                    ? PYTHON_BACKEND_CODE
                    : activeTab === 'models'
                    ? PYTHON_MODELS_CODE
                    : activeTab === 'react'
                    ? REACT_COMPONENT_CODE
                    : PROMPTS_TEXT;
                handleCopy(text, activeTab);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors border border-emerald-500/30 shrink-0"
            >
              {copiedTab === activeTab ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer Container */}
          <div className="bg-stone-950 rounded-2xl border border-stone-800 p-4 font-['Fira_Code',monospace] text-xs text-stone-200 overflow-x-auto shadow-inner leading-relaxed max-h-[50vh]">
            <pre className="whitespace-pre">
              {activeTab === 'backend' && PYTHON_BACKEND_CODE}
              {activeTab === 'models' && PYTHON_MODELS_CODE}
              {activeTab === 'react' && REACT_COMPONENT_CODE}
              {activeTab === 'prompts' && PROMPTS_TEXT}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-400">
            Desarrollado para arquitectura limpia Full-Stack React + Python + Gemini.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
