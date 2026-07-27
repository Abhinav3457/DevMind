import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSocketEvents } from '../socket';
import WorkspaceMember from '../models/WorkspaceMember';
import Project from '../models/Project';

vi.mock('../models/WorkspaceMember', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../models/Project', () => ({ default: { findById: vi.fn() } }));
vi.mock('../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('Socket Events', () => {
  let eventHandlers: Record<string, (...args: never[]) => void>;

  function createSocket(userId: string) {
    eventHandlers = {};
    const to = vi.fn().mockReturnValue({ emit: vi.fn() });
    return {
      on: vi.fn((event: string, handler: (...args: never[]) => void) => {
        eventHandlers[event] = handler;
        return this;
      }),
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      to,
      data: { userId },
      id: 'socket-123',
    };
  }

  function createIo() {
    const to = vi.fn().mockReturnValue({ emit: vi.fn() });
    return { to, emit: vi.fn() };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject events if userId is not set', () => {
    const mockIo = createIo();
    const mockSocket = createSocket('') as never;
    handleSocketEvents(mockIo, mockSocket);

    const joinHandler = eventHandlers['join-workspace'];
    joinHandler('ws-123');

    // Should emit error but NOT join the room
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it('should allow workspace join if user is a member', async () => {
    const mockIo = createIo();
    const mockSocket = createSocket('user-123') as never;
    handleSocketEvents(mockIo, mockSocket);

    vi.mocked(WorkspaceMember.findOne).mockResolvedValue({ role: 'member' } as never);

    const handler = eventHandlers['join-workspace'];
    await handler('ws-123');

    expect(WorkspaceMember.findOne).toHaveBeenCalledWith({ workspaceId: 'ws-123', userId: 'user-123' });
    expect((mockSocket as unknown as { join: ReturnType<typeof vi.fn> }).join).toHaveBeenCalledWith('workspace:ws-123');
  });

  it('should reject workspace join if user is not a member', async () => {
    const mockIo = createIo();
    const mockSocket = createSocket('user-123') as never;
    handleSocketEvents(mockIo, mockSocket);

    vi.mocked(WorkspaceMember.findOne).mockResolvedValue(null);

    const handler = eventHandlers['join-workspace'];
    await handler('ws-123');

    expect((mockSocket as unknown as { join: ReturnType<typeof vi.fn> }).join).not.toHaveBeenCalled();
  });

  it('should allow project join if user is project owner', async () => {
    const mockIo = createIo();
    const mockSocket = createSocket('user-123') as never;
    handleSocketEvents(mockIo, mockSocket);

    // Project.findById returns a query chain — need .select() on it
    vi.mocked(Project.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        owner: { toString: () => 'user-123' },
        collaborators: [],
        workspace: { toString: () => 'ws-123' },
      }),
    } as never);

    const handler = eventHandlers['join-project'];
    await handler('proj-123');

    expect((mockSocket as unknown as { join: ReturnType<typeof vi.fn> }).join).toHaveBeenCalledWith('project:proj-123');
  });

  it('should reject project join if user has no access', async () => {
    const mockIo = createIo();
    const mockSocket = createSocket('unauthorized') as never;
    handleSocketEvents(mockIo, mockSocket);

    vi.mocked(Project.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        owner: { toString: () => 'owner-123' },
        collaborators: [],
        workspace: { toString: () => 'ws-123' },
      }),
    } as never);
    vi.mocked(WorkspaceMember.findOne).mockResolvedValue(null);

    const handler = eventHandlers['join-project'];
    await handler('proj-123');

    expect((mockSocket as unknown as { join: ReturnType<typeof vi.fn> }).join).not.toHaveBeenCalled();
  });

  it('should broadcast code updates excluding sender', () => {
    const mockIo = createIo();
    const mockSocket = createSocket('user-123') as never;
    handleSocketEvents(mockIo, mockSocket);

    const handler = eventHandlers['code-change'];
    handler({ projectId: 'proj-123', content: 'new code', filePath: 'src/index.ts' });

    const socketWithTo = mockSocket as unknown as { to: ReturnType<typeof vi.fn> };
    expect(socketWithTo.to).toHaveBeenCalledWith('project:proj-123');
  });

  it('should broadcast message to all room members', () => {
    const mockIo = createIo();
    const mockSocket = createSocket('user-123') as never;
    handleSocketEvents(mockIo, mockSocket);

    const handler = eventHandlers['send-message'];
    handler({ projectId: 'proj-123', message: 'Hello!' });

    expect(mockIo.to).toHaveBeenCalledWith('project:proj-123');
  });
});
