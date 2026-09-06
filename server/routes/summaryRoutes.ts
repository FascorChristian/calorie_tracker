import { Router } from 'express';
import { getSummaryHandler, evaluateSummaryHandler } from '../controllers/summaryController.js';

export const summaryRoutes = Router();

summaryRoutes.get('/', getSummaryHandler);
summaryRoutes.post('/evaluate', evaluateSummaryHandler);

