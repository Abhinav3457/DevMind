import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatController } from '../chat.controller';
import { ApiError } from '../../utils/apiResponse';

// ── Create mock functions using vi.hoisted() to survive hoisting ──

const {
  mockChatCreate, mockChatFind, mockChatFindOne,
  mockChatFindOneAndDelete, mockChatFindOneAndUpdate,
  mockChatFindById, mockChatFindByIdAndUpdate,
  mockMessageFind, mockMessageInsertMany, mockMessageDeleteMany,
  mockGenerateFromAI,
} = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
  mockChatFind: vi.fn(),
  mockChatFindOne: vi.fn(),
  mockChatFindOneAndDelete: vi.fn(),
  mockChatFindOneAndUpdate: vi.fn(),
  mockChatFindById: vi.fn(),
  mockChatFindByIdAndUpdate: vi.fn(),
  mockMessageFind: vi.fn(),
  mockMessageInsertMany: vi.fn(),
  mockMessageDeleteMany: vi.fn(),
  mockGenerateFromAI: vi.fn(),
}));

// ── Mock all dependencies ───────────────────────────────────────

vi.mock('../../models/Chat', () => ({
  default: Object.assign(vi.fn(), {
    create: mockChatCreate,
    find: mockChatFind,
    findOne: mockChatFindOne,
    findOneAndDelete: mockChatFindOneAndDelete,
    findOneAndUpdate: mockChatFindOneAndUpdate,
    findById: mockChatFindById,
    findByIdAndUpdate: mockChatFindByIdAndUpdate,
  }),
}));

vi.mock('../../models/Message', () => ({
  default: Object.assign(vi.fn(), {
    find: mockMessageFind,
    insertMany: mockMessageInsertMany,
    deleteMany: mockMessageDeleteMany,
  }),
}));

vi.mock('../../config/ai', () => ({
  generateFromAI: mockGenerateFromAI,
}));

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Helper: create mock req/res ─────────────────────────────────

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'user-123', email: 'test@example.com', role: 'user' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as never;
}

function createMockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as never;
}

// ── Helper: create chainable Mongoose query mock ────────────────

function createQueryMock(mockResult: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(mockResult),
  };
}

describe('ChatController', () => {
  let chatController: ChatController;

  beforeEach(() => {
    chatController = new ChatController();
    vi.resetAllMocks();
  });

  // ─── Create Session ───────────────────────────────────────────

  describe('createSession', () => {
    it('should create a new chat session and return 201', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const mockChat = { _id: 'chat-123', title: 'New Chat', participants: ['user-123'], type: 'ai' };
      mockChatCreate.mockResolvedValue(mockChat);

      await chatController.createSession(req, res);

      expect(mockChatCreate).toHaveBeenCalledWith({
        title: 'New Chat',
        participants: ['user-123'],
        type: 'ai',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Chat session created',
          data: { chat: mockChat },
        }),
      );
    });
  });

  // ─── List Sessions ────────────────────────────────────────────

  describe('listSessions', () => {
    it('should list chat sessions for the authenticated user', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const mockChats = [
        { _id: 'chat-1', title: 'Chat 1', lastMessage: 'Hello', updatedAt: new Date() },
        { _id: 'chat-2', title: 'Chat 2', lastMessage: 'Hi', updatedAt: new Date() },
      ];
      mockChatFind.mockReturnValue(createQueryMock(mockChats));

      await chatController.listSessions(req, res);

      expect(mockChatFind).toHaveBeenCalledWith({
        participants: 'user-123',
        type: 'ai',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Chat sessions retrieved',
          data: { chats: mockChats },
        }),
      );
    });
  });

  // ─── Get Session Messages ─────────────────────────────────────

  describe('getSessionMessages', () => {
    it('should return messages for a valid chat session', async () => {
      const req = createMockReq({ params: { chatId: 'chat-123' } });
      const res = createMockRes();
      const mockChat = { _id: 'chat-123', title: 'Test Chat', participants: ['user-123'] };
      const mockMessages = [
        { role: 'user', content: 'Hello', createdAt: new Date() },
        { role: 'assistant', content: 'Hi there!', createdAt: new Date() },
      ];
      mockChatFindOne.mockResolvedValue(mockChat);
      mockMessageFind.mockReturnValue(createQueryMock(mockMessages));

      await chatController.getSessionMessages(req, res);

      expect(mockChatFindOne).toHaveBeenCalledWith({
        _id: 'chat-123',
        participants: 'user-123',
      });
      expect(mockMessageFind).toHaveBeenCalledWith({ chatId: 'chat-123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Messages retrieved',
          data: { messages: mockMessages, chat: mockChat },
        }),
      );
    });

    it('should throw 404 if chat session not found', async () => {
      const req = createMockReq({ params: { chatId: 'nonexistent' } });
      const res = createMockRes();
      mockChatFindOne.mockResolvedValue(null);

      await expect(chatController.getSessionMessages(req, res)).rejects.toThrow(ApiError);
      await expect(chatController.getSessionMessages(req, res)).rejects.toThrow(
        'Chat session not found',
      );
    });
  });

  // ─── Delete Session ───────────────────────────────────────────

  describe('deleteSession', () => {
    it('should delete a chat session and its messages', async () => {
      const req = createMockReq({ params: { chatId: 'chat-123' } });
      const res = createMockRes();
      const mockChat = { _id: 'chat-123' };
      mockChatFindOneAndDelete.mockResolvedValue(mockChat);
      mockMessageDeleteMany.mockResolvedValue({ deletedCount: 5 });

      await chatController.deleteSession(req, res);

      expect(mockChatFindOneAndDelete).toHaveBeenCalledWith({
        _id: 'chat-123',
        participants: 'user-123',
      });
      expect(mockMessageDeleteMany).toHaveBeenCalledWith({ chatId: 'chat-123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Chat session deleted',
        }),
      );
    });

    it('should throw 404 if chat session not found', async () => {
      const req = createMockReq({ params: { chatId: 'nonexistent' } });
      const res = createMockRes();
      mockChatFindOneAndDelete.mockResolvedValue(null);

      await expect(chatController.deleteSession(req, res)).rejects.toThrow(ApiError);
      await expect(chatController.deleteSession(req, res)).rejects.toThrow(
        'Chat session not found',
      );
    });
  });

  // ─── Update Session Title ─────────────────────────────────────

  describe('updateSessionTitle', () => {
    it('should update the chat session title', async () => {
      const req = createMockReq({
        params: { chatId: 'chat-123' },
        body: { title: 'New Title' },
      });
      const res = createMockRes();
      const updatedChat = { _id: 'chat-123', title: 'New Title' };
      mockChatFindOneAndUpdate.mockResolvedValue(updatedChat);

      await chatController.updateSessionTitle(req, res);

      expect(mockChatFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'chat-123', participants: 'user-123' },
        { title: 'New Title' },
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Title updated',
          data: { chat: updatedChat },
        }),
      );
    });

    it('should throw 404 if chat session not found', async () => {
      const req = createMockReq({
        params: { chatId: 'nonexistent' },
        body: { title: 'New Title' },
      });
      const res = createMockRes();
      mockChatFindOneAndUpdate.mockResolvedValue(null);

      await expect(chatController.updateSessionTitle(req, res)).rejects.toThrow(ApiError);
      await expect(chatController.updateSessionTitle(req, res)).rejects.toThrow(
        'Chat session not found',
      );
    });
  });

  // ─── Generate ─────────────────────────────────────────────────

  describe('generate', () => {
    it('should generate AI response with chatId and save messages', async () => {
      const req = createMockReq({
        body: {
          message: 'How do I center a div?',
          history: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
          chatId: 'chat-123',
        },
      });
      const res = createMockRes();
      const mockAnswer = 'Use CSS Flexbox: `display: flex; justify-content: center; align-items: center;`';
      mockGenerateFromAI.mockResolvedValue(mockAnswer);
      mockChatFindById.mockResolvedValue({ _id: 'chat-123', lastMessage: '' });
      mockMessageInsertMany.mockResolvedValue([{}, {}]);

      await chatController.generate(req, res);

      expect(mockGenerateFromAI).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('How do I center a div?'),
          temperature: 0.5,
          maxTokens: 4096,
        }),
      );
      expect(mockMessageInsertMany).toHaveBeenCalled();
      expect(mockChatFindByIdAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { answer: mockAnswer },
        }),
      );
    });

    it('should generate response without saving if no chatId', async () => {
      const req = createMockReq({
        body: { message: 'What is TypeScript?' },
      });
      const res = createMockRes();
      const mockAnswer = 'TypeScript is a typed superset of JavaScript.';
      mockGenerateFromAI.mockResolvedValue(mockAnswer);

      await chatController.generate(req, res);

      expect(mockGenerateFromAI).toHaveBeenCalled();
      expect(mockMessageInsertMany).not.toHaveBeenCalled();
      expect(mockChatFindByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should include history context when provided', async () => {
      const req = createMockReq({
        body: {
          message: 'Continue',
          history: [
            { role: 'user', content: 'Tell me about React' },
            { role: 'assistant', content: 'React is a UI library.' },
          ],
        },
      });
      const res = createMockRes();
      mockGenerateFromAI.mockResolvedValue('Sure, continuing...');

      await chatController.generate(req, res);

      expect(mockGenerateFromAI).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Previous conversation'),
        }),
      );
    });

    it('should set title from first message when chat has no prior messages', async () => {
      const req = createMockReq({
        body: { message: 'How do I use async/await?', chatId: 'chat-123' },
      });
      const res = createMockRes();
      mockGenerateFromAI.mockResolvedValue('Async/await is syntactic sugar over promises.');
      mockChatFindById.mockResolvedValue({ _id: 'chat-123', lastMessage: '' });
      mockMessageInsertMany.mockResolvedValue([{}, {}]);

      await chatController.generate(req, res);

      expect(mockChatFindByIdAndUpdate).toHaveBeenCalledWith(
        'chat-123',
        expect.objectContaining({ title: 'How do I use async/await?' }),
      );
    });

    it('should NOT overwrite title if chat already has messages', async () => {
      const req = createMockReq({
        body: { message: 'Another question?', chatId: 'chat-123' },
      });
      const res = createMockRes();
      mockGenerateFromAI.mockResolvedValue('Here is the answer.');
      mockChatFindById.mockResolvedValue({
        _id: 'chat-123',
        lastMessage: 'Previous conversation',
        title: 'Existing Title',
      });
      mockMessageInsertMany.mockResolvedValue([{}, {}]);

      await chatController.generate(req, res);

      // The update should NOT contain a title field since needsTitle is false
      const updateCall = mockChatFindByIdAndUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(updateCall).toBeDefined();
      expect(updateCall.title).toBeUndefined();
    });
  });
});
