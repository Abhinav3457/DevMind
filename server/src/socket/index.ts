import { Server as SocketServer, Socket } from 'socket.io';
import logger from '../utils/logger';

export function handleSocketEvents(io: SocketServer, socket: Socket): void {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-project', (projectId: string) => {
    socket.join(`project:${projectId}`);
    logger.info(`Socket ${socket.id} joined project:${projectId}`);
  });

  socket.on('leave-project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
    logger.info(`Socket ${socket.id} left project:${projectId}`);
  });

  socket.on('code-change', (data: { projectId: string; content: string; filePath: string }) => {
    socket.to(`project:${data.projectId}`).emit('code-update', data);
  });

  socket.on('cursor-move', (data: { projectId: string; userId: string; position: unknown }) => {
    socket.to(`project:${data.projectId}`).emit('cursor-update', data);
  });

  socket.on('send-message', (data: { projectId: string; message: string }) => {
    io.to(`project:${data.projectId}`).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
}
