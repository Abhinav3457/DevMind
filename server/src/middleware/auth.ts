import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiResponse';
import { env } from '../config/environment';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware to verify JWT token and attach user to request.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Fallback to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new ApiError(401, 'Access denied. No authentication token provided.');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(401, 'Invalid or expired authentication token.'));
    }
  }
}

/**
 * Middleware to restrict access based on user roles.
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, 'Forbidden. You do not have permission to access this resource.'));
      return;
    }

    next();
  };
}
