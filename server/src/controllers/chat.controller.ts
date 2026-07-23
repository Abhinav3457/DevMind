import { Request, Response } from 'express';
import { generateFromAI } from '../config/ai';
import { sendSuccess } from '../utils/apiResponse';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatController {
  async generate(req: Request, res: Response): Promise<void> {
    const { message, history } = req.body as {
      message: string;
      history?: ChatMessage[];
    };

    // Build conversation context from history
    let historyContext = '';
    if (history && history.length > 0) {
      historyContext = history
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
    }

    const systemInstruction = [
      'You are DevMind AI, an expert software engineering assistant.',
      'You help developers with coding questions, debugging, architecture, and best practices.',
      '',
      'Guidelines:',
      '- Provide accurate, well-explained answers with code examples where relevant.',
      '- Use markdown formatting with proper syntax highlighting for code blocks.',
      '- Be concise but thorough. Break down complex topics.',
      '- If you are unsure about something, say so rather than making up information.',
      '- For debugging questions, guide the user through the investigation process.',
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

    sendSuccess(res, {
      statusCode: 200,
      message: 'Response generated successfully',
      data: { answer },
    });
  }
}

export const chatController = new ChatController();
