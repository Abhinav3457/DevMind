import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('accessToken');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function joinProject(projectId: string): void {
  socket?.emit('join-project', projectId);
}

export function leaveProject(projectId: string): void {
  socket?.emit('leave-project', projectId);
}

export function emitCodeChange(projectId: string, content: string, filePath: string): void {
  socket?.emit('code-change', { projectId, content, filePath });
}

export function onCodeUpdate(callback: (data: { projectId: string; content: string; filePath: string }) => void): void {
  socket?.on('code-update', callback);
}

export function onCursorUpdate(callback: (data: { projectId: string; userId: string; position: unknown }) => void): void {
  socket?.on('cursor-update', callback);
}

export function onNewMessage(callback: (data: { projectId: string; message: string }) => void): void {
  socket?.on('new-message', callback);
}
