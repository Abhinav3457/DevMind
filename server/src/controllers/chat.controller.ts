import { Request, Response } from 'express';
import { generateFromAI } from '../config/ai';
import { sendSuccess, sendCreated, ApiError } from '../utils/apiResponse';
import Chat from '../models/Chat';
import Message from '../models/Message';
import logger from '../utils/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatController {
  // ── Session Management ───────────────────────────────────

  async createSession(req: Request, res: Response): Promise<void> {
    const chat = await Chat.create({
      title: 'New Chat',
      participants: [req.user!.userId],
      type: 'ai',
    });
    sendCreated(res, { message: 'Chat session created', data: { chat } });
  }

  async listSessions(req: Request, res: Response): Promise<void> {
    const chats = await Chat.find({ participants: req.user!.userId, type: 'ai' })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('title lastMessage lastMessageAt createdAt updatedAt')
      .lean();
    sendSuccess(res, { statusCode: 200, message: 'Chat sessions retrieved', data: { chats } });
  }

  async getSessionMessages(req: Request, res: Response): Promise<void> {
    const { chatId } = req.params;
    const chat = await Chat.findOne({ _id: chatId, participants: req.user!.userId });
    if (!chat) throw new ApiError(404, 'Chat session not found');

    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .limit(200)
      .select('role content createdAt')
      .lean();

    sendSuccess(res, { statusCode: 200, message: 'Messages retrieved', data: { messages, chat } });
  }

  async deleteSession(req: Request, res: Response): Promise<void> {
    const { chatId } = req.params;
    const chat = await Chat.findOneAndDelete({ _id: chatId, participants: req.user!.userId });
    if (!chat) throw new ApiError(404, 'Chat session not found');
    await Message.deleteMany({ chatId });
    sendSuccess(res, { statusCode: 200, message: 'Chat session deleted' });
  }

  async updateSessionTitle(req: Request, res: Response): Promise<void> {
    const { chatId } = req.params;
    const { title } = req.body;
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, participants: req.user!.userId },
      { title },
      { new: true },
    );
    if (!chat) throw new ApiError(404, 'Chat session not found');
    sendSuccess(res, { statusCode: 200, message: 'Title updated', data: { chat } });
  }

  // ── Message Saving Helper ────────────────────────────────

  private async saveMessages(chatId: string, userId: string, userMsg: string, assistantMsg: string, title?: string): Promise<void> {
    await Message.insertMany([
      { chatId, senderId: userId, content: userMsg, role: 'user', type: 'text' },
      { chatId, senderId: userId, content: assistantMsg, role: 'assistant', type: 'ai' },
    ]);

    const update: Record<string, unknown> = {
      lastMessage: assistantMsg.slice(0, 200),
      lastMessageAt: new Date(),
    };
    if (title) update.title = title;

    await Chat.findByIdAndUpdate(chatId, update);
  }

  // ── AI Generation ────────────────────────────────────────

  async generate(req: Request, res: Response): Promise<void> {
    const { message, history, chatId } = req.body as {
      message: string;
      history?: ChatMessage[];
      chatId?: string;
    };
    const userId = req.user!.userId;

    // Build conversation context from history
    let historyContext = '';
    if (history && history.length > 0) {
      historyContext = history
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
    }

    const systemInstruction = [
      'You are DevMind AI, an expert software engineering assistant with deep knowledge of programming.',
      'You help developers with coding questions, debugging, architecture, code reviews, and best practices.',
      '',
      '=== RESPONSE STRUCTURE ===',
      'Structure your answers with clear sections using Markdown headings (##, ###).',
      'Use the following pattern when appropriate:',
      '  ## Overview — Brief summary of the answer',
      '  ## Explanation — Detailed breakdown with bullet points or numbered steps',
      '  ## Code Example — Complete, runnable code snippets with syntax highlighting',
      '  ## Key Points — Bullet list of important takeaways',
      '',
      '=== CODE FORMATTING ===',
      'ALWAYS use proper language-annotated fenced code blocks for ANY code snippet:',
      '  ```typescript',
      '  const x: number = 42;',
      '  ```',
      'Specify the language after the opening triple backticks (e.g., typescript, javascript, python, bash, json, html, css).',
      '',
      '=== GUIDELINES ===',
      '- Provide accurate, well-explained answers with complete code examples where relevant.',
      '- Use markdown tables (| col | col |) for comparing options, API params, or feature lists.',
      '- Be concise but thorough. Break down complex topics into digestible sections.',
      '- If you are unsure about something, say so rather than making up information.',
      '- For debugging questions, guide the user through the investigation process step-by-step.',
      '- Use blockquotes (> Note: ...) for tips, warnings, or important notes.',
      '- Use bold (**text**) for emphasis on key terms.',
      '- Include file paths and line numbers when referencing specific code locations.',
      '- When explaining errors, show the error message, explain the cause, and provide the fix.',
      '- Suggest best practices and potential improvements when relevant.',
    ].join('\n');

    const prompt = historyContext
      ? `Previous conversation:\n${historyContext}\n\nUser: ${message}`
      : message;

    const answer = await generateFromAI({
      systemInstruction,
      prompt,
      temperature: 0.5,
      maxTokens: 4096,
    });

    // Save messages to chat session if chatId is provided
    if (chatId) {
      // Use first user message as chat title if this is the first exchange
      const chat = await Chat.findById(chatId);
      const needsTitle = chat && (!chat.lastMessage || chat.lastMessage === '');
      const title = needsTitle ? message.slice(0, 100) : undefined;
      await this.saveMessages(chatId, userId, message, answer, title);
    }

    sendSuccess(res, {
      statusCode: 200,
      message: 'Response generated successfully',
      data: { answer },
    });
  }
}

export const chatController = new ChatController();
