import { Router } from 'express';
import { getMealsHandler, analyzeMealHandler, deleteMealHandler } from '../controllers/mealController.js';

export const mealRoutes = Router();

mealRoutes.get('/', getMealsHandler);
mealRoutes.post('/analyze', analyzeMealHandler);
mealRoutes.delete('/:id', deleteMealHandler);

