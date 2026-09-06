import { Request, Response } from 'express';
import { getUser, updateUser } from '../services/dbService.js';

export async function getProfileHandler(req: Request, res: Response) {
  try {
    const user = await getUser();
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener perfil' });
  }
}

export async function updateProfileHandler(req: Request, res: Response) {
  try {
    const updated = await updateUser(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar perfil' });
  }
}

