import { Server as SocketServer, Socket } from 'socket.io';
import WorkspaceMember from '../models/WorkspaceMember';
import Project from '../models/Project';
import logger from '../utils/logger';

export function handleSocketEvents(io: SocketServer, socket: Socket): void {
  const userId = (socket.data as Record<string, unknown>).userId as string;

  socket.on('join-project', async (projectId: string) => {
    if (!userId) {
      socket.emit('error', 'Authentication required');
      return;
    }

    // Verify project membership before allowing room join
    try {
      const project = await Project.findById(projectId).select('owner workspace collaborators');
      if (!project) {
        socket.emit('error', 'Project not found');
        return;
      }

      const isOwner = project.owner.toString() === userId;
      const isCollaborator = project.collaborators.some(
        (c) => c.toString() === userId,
      );

      if (!isOwner && !isCollaborator) {
        // Also check if user is a member of the project's workspace
        const member = await WorkspaceMember.findOne({
          workspaceId: project.workspace.toString(),
          userId,
        });
        if (!member) {
          socket.emit('error', 'You do not have access to this project');
          return;
        }
      }

      socket.join(`project:${projectId}`);
      io.to(`project:${projectId}`).emit('user-joined', { userId, socketId: socket.id });
      logger.info('Socket ' + socket.id + ' joined project:' + projectId);
    } catch {
      socket.emit('error', 'Failed to validate project access');
    }
  });

  socket.on('leave-project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
    io.to(`project:${projectId}`).emit('user-left', { userId, socketId: socket.id });
    logger.info('Socket ' + socket.id + ' left project:' + projectId);
  });

  socket.on('join-workspace', async (workspaceId: string) => {
    if (!userId) {
      socket.emit('error', 'Authentication required');
      return;
    }

    // Verify workspace membership before allowing room join
    try {
      const member = await WorkspaceMember.findOne({ workspaceId, userId });
      if (!member) {
        socket.emit('error', 'You are not a member of this workspace');
        return;
      }
      socket.join(`workspace:${workspaceId}`);
      logger.info('Socket ' + socket.id + ' joined workspace:' + workspaceId);
    } catch {
      socket.emit('error', 'Failed to verify workspace membership');
    }
  });

  socket.on('leave-workspace', (workspaceId: string) => {
    socket.leave(`workspace:${workspaceId}`);
    logger.info('Socket ' + socket.id + ' left workspace:' + workspaceId);
  });

  socket.on('code-change', (data: { projectId: string; content: string; filePath: string }) => {
    socket.to(`project:${data.projectId}`).emit('code-update', {
      ...data,
      userId,
    });
  });

  socket.on('cursor-move', (data: { projectId: string; position: unknown }) => {
    socket.to(`project:${data.projectId}`).emit('cursor-update', {
      ...data,
      userId,
    });
  });

  socket.on('send-message', (data: { projectId: string; message: string }) => {
    io.to(`project:${data.projectId}`).emit('new-message', {
      ...data,
      userId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected: ' + socket.id + ' (user: ' + userId + ')');
  });
}
