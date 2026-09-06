import { Router } from 'express';
import { userRoutes } from './userRoutes.js';
import { mealRoutes } from './mealRoutes.js';
import { summaryRoutes } from './summaryRoutes.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Modular sub-routers
apiRouter.use('/profile', userRoutes);
apiRouter.use('/meals', mealRoutes);
apiRouter.use('/daily-summary', summaryRoutes);

