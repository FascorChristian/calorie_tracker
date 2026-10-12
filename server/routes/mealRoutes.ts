import { Router } from 'express';
import {
  getMealsHandler,
  getMealByIdHandler,
  getMealStatusHandler,
  analyzeMealHandler,
  deleteMealHandler,
  purgePastMealsHandler,
} from '../controllers/mealController.js';

export const mealRoutes = Router();

mealRoutes.get('/', getMealsHandler);
mealRoutes.get('/status/:clientRequestId', getMealStatusHandler);
mealRoutes.get('/:id', getMealByIdHandler);
mealRoutes.post('/analyze', analyzeMealHandler);
mealRoutes.delete('/purge/past', purgePastMealsHandler);
mealRoutes.delete('/:id', deleteMealHandler);

