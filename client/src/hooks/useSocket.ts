import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket, joinProject, leaveProject } from '../services/socket';

export function useSocket(projectId?: string) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    connectSocket();

    return () => {
      disconnectSocket();
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId]);

  const joinRoom = useCallback((roomId: string) => joinProject(roomId), []);
  const leaveRoom = useCallback((roomId: string) => leaveProject(roomId), []);

  return { joinRoom, leaveRoom };
}
