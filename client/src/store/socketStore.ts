import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import toast from 'react-hot-toast';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  activeProjectId: string | null;
  connect: (token: string) => void;
  disconnect: () => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  emitCodeChange: (data: { projectId: string; content: string; filePath: string }) => void;
  emitCursorMove: (data: { projectId: string; position: unknown }) => void;
  emitMessage: (data: { projectId: string; message: string }) => void;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocketStore = create<SocketState>()(
  devtools(
    (set, get) => ({
      socket: null,
      isConnected: false,
      activeProjectId: null,

      connect: (token: string) => {
        const existingSocket = get().socket;
        if (existingSocket?.connected) return;

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
          set({ isConnected: true });
        });

        socket.on('disconnect', () => {
          set({ isConnected: false });
        });

        socket.on('connect_error', () => {
          toast.error('Socket connection failed. Retrying...');
        });

        set({ socket });
      },

      disconnect: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null, isConnected: false, activeProjectId: null });
        }
      },

      joinProject: (projectId: string) => {
        const { socket } = get();
        if (socket) {
          socket.emit('join-project', projectId);
          set({ activeProjectId: projectId });
        }
      },

      leaveProject: (projectId: string) => {
        const { socket } = get();
        if (socket) {
          socket.emit('leave-project', projectId);
          set({ activeProjectId: null });
        }
      },

      emitCodeChange: (data) => {
        get().socket?.emit('code-change', data);
      },

      emitCursorMove: (data) => {
        get().socket?.emit('cursor-move', data);
      },

      emitMessage: (data) => {
        get().socket?.emit('send-message', data);
      },
    }),
    { name: 'socket-store' },
  ),
);
