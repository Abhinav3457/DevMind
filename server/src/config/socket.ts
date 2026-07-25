import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './environment';
import { handleSocketEvents } from '../socket';
import logger from '../utils/logger';

let io: SocketServer | null = null;

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

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
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
