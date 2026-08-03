import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './environment';
import { handleSocketEvents } from '../socket';
import logger from '../utils/logger';

let io: SocketServer | null = null;

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Socket.io authentication middleware.
 * Verifies JWT from the handshake auth token and attaches userId to the socket.
 */
function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    logger.warn('Socket auth rejected: No token provided from ' + socket.id);
    return next(new Error('Authentication required. No token provided.'));
  }

  try {
    const decoded = jwt.verify(token as string, env.JWT_SECRET) as JwtPayload;
    (socket as Socket & { userId: string }).data.userId = decoded.userId;
    (socket as Socket & { userId: string }).data.email = decoded.email;
    (socket as Socket & { userId: string }).data.role = decoded.role;
    next();
  } catch {
    logger.warn('Socket auth rejected: Invalid token from ' + socket.id);
    next(new Error('Invalid or expired authentication token.'));
  }
}

export function initializeSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN.replace(/\/+$/, ''),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = (socket.data as Record<string, unknown>).userId as string;
    logger.info('Socket connected: ' + socket.id + ' (user: ' + userId + ')');

    // Join a personal room so the server can push notifications in real time
    socket.join('user:' + userId);

    handleSocketEvents(io!, socket);
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
}
