import {
  QueueJobStatus,
  QueueJobInfo,
  QueueRecentJob,
  QueueStatusReport,
} from '../../shared/types.js';

interface InternalQueueJob<T = any> {
  id: string;
  type: 'meal_analysis' | 'daily_summary';
  title: string;
  clientRequestId?: string;
  status: QueueJobStatus;
  statusMessage: string;
  model: string;
  attempt: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  cooldownEndsAt?: number;
  task: (model: string) => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
}

class GeminiQueueManager {
  private queue: InternalQueueJob[] = [];
  private currentJob: InternalQueueJob | null = null;
  private isProcessing = false;
  private recentJobs: QueueRecentJob[] = [];
  private apiCallTimestamps: number[] = [];
  private totalProcessed = 0;
  private readonly serverStartTime = Date.now();
  private lastCallFinishedAt = 0;

  // Modelos según límites de frecuencia (Gemini 3.1 Flash Lite: 15 RPM / 500 RPD)
  public readonly primaryModel = 'gemini-3.1-flash-lite';
  public readonly fallbackModel = 'gemini-3.5-flash-lite';

  // Espaciado mínimo entre peticiones para mantener el RPM bajo y evitar límites de AI Studio
  // 4500ms = 13.3 RPM máx. En uso normal será 1-2 RPM
  public readonly minIntervalMs = 4500;

  /**
   * Encola una tarea multimodal o de resumen para ser procesada con control estricto de RPM
   */
  public enqueue<T>(options: {
    type: 'meal_analysis' | 'daily_summary';
    title: string;
    clientRequestId?: string;
    task: (model: string) => Promise<T>;
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const job: InternalQueueJob<T> = {
        id: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        type: options.type,
        title: options.title,
        clientRequestId: options.clientRequestId,
        status: 'queued',
        statusMessage: 'En cola esperando turno de procesamiento de IA...',
        model: this.primaryModel,
        attempt: 0,
        createdAt: Date.now(),
        task: options.task,
        resolve,
        reject,
      };

      this.queue.push(job);
      this.updateQueuePositions();

      console.log(
        `[Gemini Queue] Nueva tarea encolada: "${job.title}" (ID: ${job.id}, Cola: ${this.queue.length})`
      );

      // Disparar procesador si está inactivo
      this.processNext();
    });
  }

  private updateQueuePositions() {
    this.queue.forEach((job, index) => {
      if (job.status === 'queued') {
        job.statusMessage = `En cola (Posición #${index + 1}). Esperando procesamiento...`;
      }
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift()!;
    this.currentJob = job;
    this.updateQueuePositions();

    try {
      await this.executeJobWithRateLimit(job);
    } catch (fatalErr: any) {
      console.error(`[Gemini Queue] Error fatal no recuperable en tarea ${job.id}:`, fatalErr);
      job.status = 'failed';
      job.statusMessage = fatalErr.message || 'Error desconocido';
      this.recordRecentJob(job, 'failed');
      job.reject(fatalErr);
    } finally {
      this.currentJob = null;
      this.isProcessing = false;
      this.lastCallFinishedAt = Date.now();

      // Procesar siguiente elemento si existe
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), 100);
      }
    }
  }

  private async executeJobWithRateLimit(job: InternalQueueJob) {
    const maxAttempts = 4;
    let selectedModel = this.primaryModel;

    while (job.attempt < maxAttempts) {
      job.attempt++;
      job.startedAt = Date.now();

      // 1. Control de espaciado anti-límite de RPM (Pacing)
      const now = Date.now();
      const elapsedSinceLast = now - this.lastCallFinishedAt;
      if (this.lastCallFinishedAt > 0 && elapsedSinceLast < this.minIntervalMs) {
        const waitTime = this.minIntervalMs - elapsedSinceLast;
        job.status = 'waiting_quota_backoff';
        job.cooldownEndsAt = Date.now() + waitTime;
        job.statusMessage = `Pausa anti-límite RPM (${Math.ceil(waitTime / 1000)}s)...`;
        console.log(`[Gemini Queue] Espaciando petición (${waitTime}ms) para mantener RPM bajo.`);
        await new Promise((res) => setTimeout(res, waitTime));
        job.cooldownEndsAt = undefined;
      }

      // 2. Registrar timestamp de consumo para métricas de RPM
      this.recordApiCall();

      // 3. Ejecutar la llamada a Gemini
      job.status = 'processing';
      job.model = selectedModel;
      job.statusMessage = `Procesando con ${selectedModel} (Intento ${job.attempt}/${maxAttempts})...`;

      try {
        console.log(`[Gemini Queue] Ejecutando "${job.title}" con ${selectedModel}...`);
        const result = await job.task(selectedModel);

        // Éxito
        job.status = 'completed';
        job.statusMessage = 'Completado exitosamente';
        job.completedAt = Date.now();
        this.totalProcessed++;
        this.recordRecentJob(job, 'completed');
        job.resolve(result);
        return;
      } catch (err: any) {
        const status = err?.status || err?.code || (err?.error && err.error.code);
        const isQuotaExceeded = status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
        const isHighDemand = status === 503 || status === 500 || err?.message?.includes('overloaded');

        console.warn(
          `[Gemini Queue] Fallo en intento ${job.attempt}/${maxAttempts} para "${job.title}": Status ${status} - ${err.message}`
        );

        if (job.attempt >= maxAttempts) {
          throw err;
        }

        if (isQuotaExceeded) {
          // Límite de frecuencia alcanzado (429): Backoff exponencial
          const backoffTimes = [8000, 15000, 25000];
          const backoff = backoffTimes[job.attempt - 1] || 30000;
          job.status = 'waiting_quota_backoff';
          job.cooldownEndsAt = Date.now() + backoff;
          job.statusMessage = `Límite RPM alcanzado temporalmente. Enfriando cuota (${Math.ceil(backoff / 1000)}s)...`;
          console.log(`[Gemini Queue] Pausando por 429 (Cuota excedida). Espera: ${backoff}ms.`);
          await new Promise((res) => setTimeout(res, backoff));
          job.cooldownEndsAt = undefined;

          // Si tras reintentar con el primario sigue en 429, probar el de respaldo
          if (job.attempt >= 2) {
            selectedModel = this.fallbackModel;
          }
        } else if (isHighDemand) {
          // Alta demanda / Servidor ocupado (503): Cambiar inmediatamente a modelo de respaldo
          selectedModel = this.fallbackModel;
          const backoffTimes = [3000, 6000, 12000];
          const backoff = backoffTimes[job.attempt - 1] || 15000;
          job.status = 'retrying_high_demand';
          job.cooldownEndsAt = Date.now() + backoff;
          job.statusMessage = `Alta demanda en Gemini. Reintentando con ${selectedModel} en ${Math.ceil(backoff / 1000)}s...`;
          console.log(`[Gemini Queue] Pausando por 503 (Alta demanda). Cambiando a ${selectedModel}. Espera: ${backoff}ms.`);
          await new Promise((res) => setTimeout(res, backoff));
          job.cooldownEndsAt = undefined;
        } else {
          // Otro error transitorio
          const backoff = 2500 * job.attempt;
          job.statusMessage = `Reintentando tras error temporal (${Math.ceil(backoff / 1000)}s)...`;
          await new Promise((res) => setTimeout(res, backoff));
        }
      }
    }
  }

  private recordApiCall() {
    const now = Date.now();
    this.apiCallTimestamps.push(now);
    // Limpiar marcas mayores a 60 segundos
    const oneMinAgo = now - 60000;
    this.apiCallTimestamps = this.apiCallTimestamps.filter((t) => t > oneMinAgo);
  }

  private recordRecentJob(job: InternalQueueJob, status: 'completed' | 'failed') {
    const durationMs = (job.completedAt || Date.now()) - (job.startedAt || job.createdAt);
    this.recentJobs.unshift({
      id: job.id,
      type: job.type,
      title: job.title,
      status,
      model: job.model,
      durationMs,
      completedAt: new Date().toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });

    if (this.recentJobs.length > 8) {
      this.recentJobs.pop();
    }
  }

  /**
   * Calcula el RPM en los últimos 60 segundos
   */
  public getCurrentRpm(): number {
    const now = Date.now();
    const oneMinAgo = now - 60000;
    this.apiCallTimestamps = this.apiCallTimestamps.filter((t) => t > oneMinAgo);
    return this.apiCallTimestamps.length;
  }

  /**
   * Busca un trabajo por su clientRequestId (para informar posición al modal de comida)
   */
  public getJobByClientRequestId(clientRequestId: string): {
    status: QueueJobStatus;
    statusMessage: string;
    position: number;
    model: string;
  } | null {
    if (this.currentJob && this.currentJob.clientRequestId === clientRequestId) {
      return {
        status: this.currentJob.status,
        statusMessage: this.currentJob.statusMessage,
        position: 1,
        model: this.currentJob.model,
      };
    }

    const index = this.queue.findIndex((j) => j.clientRequestId === clientRequestId);
    if (index !== -1) {
      const job = this.queue[index];
      return {
        status: job.status,
        statusMessage: job.statusMessage,
        position: index + (this.currentJob ? 2 : 1),
        model: job.model,
      };
    }

    return null;
  }

  /**
   * Genera el reporte completo del estado de la cola para el visor en la web
   */
  public getStatusReport(): QueueStatusReport {
    const now = Date.now();
    const currentRpm = this.getCurrentRpm();
    const maxPacedRpm = Math.floor(60000 / this.minIntervalMs); // ~13 RPM

    let currentJobInfo: QueueJobInfo | null = null;
    let cooldownRemainingSeconds: number | undefined = undefined;

    if (this.currentJob) {
      const elapsedMs = now - (this.currentJob.startedAt || this.currentJob.createdAt);
      if (this.currentJob.cooldownEndsAt && this.currentJob.cooldownEndsAt > now) {
        cooldownRemainingSeconds = Math.ceil((this.currentJob.cooldownEndsAt - now) / 1000);
      }

      currentJobInfo = {
        id: this.currentJob.id,
        type: this.currentJob.type,
        title: this.currentJob.title,
        clientRequestId: this.currentJob.clientRequestId,
        status: this.currentJob.status,
        statusMessage: this.currentJob.statusMessage,
        model: this.currentJob.model,
        attempt: this.currentJob.attempt,
        elapsedMs,
        positionInQueue: 1,
      };
    }

    const waitingJobs: QueueJobInfo[] = this.queue.map((j, idx) => ({
      id: j.id,
      type: j.type,
      title: j.title,
      clientRequestId: j.clientRequestId,
      status: j.status,
      statusMessage: j.statusMessage,
      model: j.model,
      attempt: j.attempt,
      elapsedMs: now - j.createdAt,
      positionInQueue: idx + (this.currentJob ? 2 : 1),
    }));

    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length + (this.currentJob ? 1 : 0),
      currentJob: currentJobInfo,
      waitingJobs,
      recentJobs: this.recentJobs,
      metrics: {
        currentRpm,
        maxPacedRpm,
        activeModel: this.primaryModel,
        fallbackModel: this.fallbackModel,
        totalProcessed: this.totalProcessed,
        serverUptimeSeconds: Math.floor((now - this.serverStartTime) / 1000),
        cooldownRemainingSeconds,
      },
    };
  }
}

export const geminiQueueManager = new GeminiQueueManager();

