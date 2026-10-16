import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Layers,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  Server,
  Sparkles,
} from 'lucide-react';
import { QueueStatusReport } from '../../../shared/types.js';
import { api } from '../../services/api.js';

interface QueueViewerProps {
  // If provided, controls visibility from parent; otherwise manages its own modal
  isOpen?: boolean;
  onClose?: () => void;
  // If true, shows a floating badge on mobile/desktop
  showFloatingBadge?: boolean;
}

export const QueueViewer: React.FC<QueueViewerProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showFloatingBadge = true,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [report, setReport] = useState<QueueStatusReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRenderWaking, setIsRenderWaking] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isModalOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const closeModal = controlledOnClose || (() => setInternalIsOpen(false));
  const openModal = () => setInternalIsOpen(true);

  const fetchStatus = async () => {
    try {
      const startTime = Date.now();
      const data = await api.getQueueStatus();
      setReport(data);
      setIsRenderWaking(false);
      return data;
    } catch (err) {
      console.warn('Error fetching queue status:', err);
      // Podría estar despertando el servidor en Render
      setIsRenderWaking(true);
      return null;
    }
  };

  useEffect(() => {
    fetchStatus();

    // Polling dinámico: más frecuente si hay trabajo activo o si el modal está abierto
    const pollInterval = isModalOpen || report?.isProcessing || (report?.queueLength || 0) > 0 ? 3000 : 10000;

    timerRef.current = setInterval(() => {
      fetchStatus();
    }, pollInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isModalOpen, report?.isProcessing, report?.queueLength]);

  const handleManualRefresh = async () => {
    setIsLoading(true);
    await fetchStatus();
    setIsLoading(false);
  };

  const getStatusColor = () => {
    if (isRenderWaking) return 'bg-amber-500';
    if (!report) return 'bg-stone-500';
    if (report.currentJob?.status === 'waiting_quota_backoff') return 'bg-amber-400 animate-pulse';
    if (report.currentJob?.status === 'retrying_high_demand') return 'bg-orange-500 animate-pulse';
    if (report.isProcessing) return 'bg-teal-400 animate-ping';
    return 'bg-emerald-400';
  };

  const getStatusBadgeText = () => {
    if (isRenderWaking) return 'Despertando Render...';
    if (!report) return 'Conectando cola...';
    if (report.currentJob?.status === 'waiting_quota_backoff') return 'Enfriamiento anti-RPM';
    if (report.currentJob?.status === 'retrying_high_demand') return 'Reintentando (Alta demanda)';
    if (report.isProcessing) return `Procesando IA (${report.queueLength} en cola)`;
    return 'IA Lista • 3.1 Flash Lite';
  };

  return (
    <>
      {/* Floating Trigger Badge (esquina inferior derecha) */}
      {showFloatingBadge && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={openModal}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-stone-900/90 hover:bg-stone-850 border border-stone-750 shadow-xl backdrop-blur-md text-stone-200 text-xs font-medium transition-all hover:scale-105 hover:border-emerald-500/50 cursor-pointer"
            title="Ver estado de la cola de IA y consumo de RPM"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusColor()}`}
              />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${getStatusColor()}`} />
            </span>
            <span className="font-semibold">{getStatusBadgeText()}</span>
            {report && report.queueLength > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                {report.queueLength}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Modal / Panel Detallado de la Cola */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-6">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-stone-950 font-bold shadow-md shadow-emerald-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2">
                    Cola de Procesamiento de IA
                  </h2>
                  <p className="text-xs text-stone-400">
                    Regulación de RPM y tolerancia a alta demanda (Gemini 3.1)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isLoading}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
                  title="Actualizar estado ahora"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Alerta si el servidor en Render está recién despertando */}
              {isRenderWaking && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
                  <Server className="w-4 h-4 shrink-0 text-amber-400 mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-bold text-amber-300">Despertando servidor en Render</p>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed mt-0.5">
                      En el plan gratuito de Render, el servidor se suspende tras 15 minutos sin peticiones.
                      La primera llamada toma unos 30-40s mientras inicia; una vez activo responderá de inmediato.
                    </p>
                  </div>
                </div>
              )}

              {/* Métricas Principales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800/80 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-400 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Modelo
                  </span>
                  <div className="mt-2">
                    <p className="font-bold text-stone-100 truncate" title={report?.metrics.activeModel}>
                      3.1 Flash Lite
                    </p>
                    <p className="text-[10px] text-emerald-400 font-semibold">500 RPD / 15 RPM</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800/80 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-400 flex items-center gap-1 font-medium">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" /> RPM Actual
                  </span>
                  <div className="mt-2">
                    <p className="font-bold text-stone-100 text-sm">
                      {report?.metrics.currentRpm ?? 0}{' '}
                      <span className="text-[10px] text-stone-500 font-normal">/ 15 máx</span>
                    </p>
                    <p className="text-[10px] text-stone-400">Pacing: 1 req/4.5s</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800/80 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-400 flex items-center gap-1 font-medium">
                    <Layers className="w-3.5 h-3.5 text-amber-400" /> En Cola
                  </span>
                  <div className="mt-2">
                    <p className="font-bold text-stone-100 text-sm">{report?.queueLength ?? 0}</p>
                    <p className="text-[10px] text-stone-400">
                      {report?.isProcessing ? '1 procesando' : 'Sin espera'}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800/80 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-400 flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Tolerancia
                  </span>
                  <div className="mt-2">
                    <p className="font-bold text-emerald-400 truncate">Anti-503 Activo</p>
                    <p className="text-[10px] text-stone-400">Fallback a 3.5</p>
                  </div>
                </div>
              </div>

              {/* Tarea en Curso (Active Job) */}
              <div className="space-y-2">
                <h3 className="font-bold text-stone-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" /> Tarea en Proceso
                </h3>

                {report?.currentJob ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-100 text-sm">
                        {report.currentJob.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                        Intento {report.currentJob.attempt}
                      </span>
                    </div>

                    <p className="text-stone-300 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
                      <span>{report.currentJob.statusMessage}</span>
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800/60">
                      <span>Modelo: <strong className="text-stone-200">{report.currentJob.model}</strong></span>
                      <span>Tiempo activo: {Math.round(report.currentJob.elapsedMs / 1000)}s</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-stone-950/50 border border-stone-800/60 text-center text-stone-400">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500/70 mx-auto mb-1.5" />
                    <p className="font-medium text-stone-300">Cola libre y lista</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      No hay tareas pendientes. Tus registros de fotos y voz se procesarán inmediatamente respetando el límite de RPM.
                    </p>
                  </div>
                )}
              </div>

              {/* Tareas en Espera en la Cola */}
              {report && report.waitingJobs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-stone-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> En Espera ({report.waitingJobs.length})
                  </h3>
                  <div className="space-y-1.5">
                    {report.waitingJobs.map((job, i) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-stone-200">{job.title}</p>
                          <p className="text-[10px] text-stone-400">{job.statusMessage}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-stone-850 text-stone-300 text-[10px] font-bold">
                          Posición #{job.positionInQueue || i + 2}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial Reciente */}
              {report && report.recentJobs.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h3 className="font-bold text-stone-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-stone-500" /> Solicitudes Recientes
                  </h3>
                  <div className="divide-y divide-stone-800/60 rounded-2xl bg-stone-950/40 border border-stone-800/60 overflow-hidden">
                    {report.recentJobs.slice(0, 5).map((job) => (
                      <div
                        key={job.id}
                        className="px-3.5 py-2.5 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          {job.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span className="font-medium text-stone-200 truncate max-w-[180px] sm:max-w-xs">
                            {job.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-stone-400">
                          <span className="text-[10px] text-stone-400">{job.model}</span>
                          <span>{(job.durationMs / 1000).toFixed(1)}s</span>
                          <span className="text-stone-400">{job.completedAt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explicación Técnica y Ayuda */}
              <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 text-[11px] text-stone-400 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-stone-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ¿Por qué se encolan las solicitudes?
                </p>
                <p>
                  El modelo <strong>Gemini 3.1 Flash Lite</strong> ofrece <strong>500 solicitudes diarias</strong> y un límite de 15 RPM.
                  Para que nunca recibas errores de cuota excedida, el servidor espacia cada petición al menos 4.5 segundos y reintenta automáticamente si Google tiene alta demanda transitoria.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
              <span>
                Servidor:{' '}
                <strong className="text-stone-300">
                  {report?.metrics.serverUptimeSeconds
                    ? `Activo (${Math.floor(report.metrics.serverUptimeSeconds / 60)} min)`
                    : 'En línea'}
                </strong>
              </span>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

