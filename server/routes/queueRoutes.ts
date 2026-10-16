import { Router, Request, Response } from 'express';
import { geminiQueueManager } from '../services/queueManager.js';

export const queueRoutes = Router();

/**
 * GET /api/queue/status
 * Retorna el estado en tiempo real de la cola de procesamiento de Gemini:
 * - isProcessing: boolean
 * - queueLength: cantidad de solicitudes pendientes
 * - currentJob: tarea en ejecución
 * - waitingJobs: lista de tareas en espera
 * - recentJobs: historial reciente
 * - metrics: RPM actual, límites, modelos activo y de respaldo
 */
queueRoutes.get('/status', (req: Request, res: Response) => {
  try {
    const report = geminiQueueManager.getStatusReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener estado de la cola' });
  }
});

/**
 * GET /api/queue/ping
 * Endpoint liviano para despertar el servidor en Render tras inactividad
 */
queueRoutes.get('/ping', (req: Request, res: Response) => {
  res.json({
    status: 'awake',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

