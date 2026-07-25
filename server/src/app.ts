import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { configureCloudinary } from './config/cloudinary';
import { globalErrorHandler } from './middleware/errorHandler';
import { ApiError } from './utils/apiResponse';
import apiRoutes from './routes';

// Initialize Cloudinary
configureCloudinary();

const app: Express = express();

// Normalize CORS origin — remove trailing slash to prevent CORS mismatch
const corsOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint (before rate limiter so monitoring doesn't consume quota)
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'DevMind AI Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/v1', generalLimiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  skipSuccessfulRequests: false,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve static files for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

// API routes
app.use('/api/v1', apiRoutes);

// 404 handler for unknown routes
app.all('*', (_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Route not found'));
});

// Global error handler
app.use(globalErrorHandler);

export default app;
