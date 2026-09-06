import { Router } from 'express';
import { getProfileHandler, updateProfileHandler } from '../controllers/userController.js';

export const userRoutes = Router();

userRoutes.get('/', getProfileHandler);
userRoutes.post('/', updateProfileHandler);

