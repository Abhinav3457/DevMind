import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './environment';

let genAI: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

export function getGeminiModel(modelName: string = 'gemini-2.5-flash') {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: modelName });
}
