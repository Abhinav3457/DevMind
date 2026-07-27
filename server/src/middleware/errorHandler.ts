import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

export function globalErrorHandler(
  error: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: unknown = null;

  // Handle known ApiError
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
  } else {
    // Use the actual error message for unknown errors instead of generic 'Internal Server Error'
    message = error.message || 'Internal Server Error';
  }

  // Handle Mongoose validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = error.message;
  }

  // Handle Mongoose duplicate key error
  const mongoError = error as { code?: unknown; keyValue?: Record<string, unknown> };
  if (mongoError.code === 11000) {
    statusCode = 409;
    message = 'Duplicate key error. Resource already exists.';
    const keyValue = mongoError.keyValue as Record<string, unknown>;
    const field = Object.keys(keyValue || {})[0];
    if (field) {
      message = `Duplicate value for ${field}. This ${field} is already in use.`;
    }
  }

  // Handle Mongoose cast error (invalid ObjectId, etc.)
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier';
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Log client errors (4xx) as warnings, server errors (5xx) as errors
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } else {
    logger.warn('Client Error:', {
      statusCode,
      message: error.message,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
}
