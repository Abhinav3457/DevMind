import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    success: true,
    message: 'DevMind AI Server is healthy',
    data: {
      server: 'running',
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memoryUsage: process.memoryUsage(),
    },
  });
});

router.get('/ping', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'pong' });
});

export default router;
