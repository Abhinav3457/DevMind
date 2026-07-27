import { Response } from 'express';

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

interface ApiResponseOptions {
  statusCode: number;
  message: string;
  data?: unknown;
  meta?: Record<string, unknown>;
}

export function sendSuccess(res: Response, options: ApiResponseOptions): void {
  const { statusCode, message, data, meta } = options;
  const response: Record<string, unknown> = {
    success: true,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
}

export function sendCreated(res: Response, options: { message: string; data?: unknown }): void {
  sendSuccess(res, { statusCode: 201, message: options.message, data: options.data });
}

export function sendError(res: Response, statusCode: number, message: string): void {
  res.status(statusCode).json({
    success: false,
    message,
  });
}

export function sendPaginated(
  res: Response,
  message: string,
  data: unknown,
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
): void {
  sendSuccess(res, {
    statusCode: 200,
    message,
    data,
    meta: { pagination },
  });
}
