import { Server as SocketServer, Socket } from 'socket.io';
import logger from '../utils/logger';

export function handleSocketEvents(_io: SocketServer, socket: Socket): void {
  const userId = (socket.data as Record<string, unknown>).userId as string;

  socket.on('disconnect', () => {
    logger.info('Socket disconnected: ' + socket.id + ' (user: ' + userId + ')');
  });
}
