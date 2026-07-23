import dotenv from 'dotenv';
dotenv.config();

interface Environment {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CLIENT_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SOCKET_CORS_ORIGIN: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] !== undefined ? process.env[key] : defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value!;
}

function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] !== undefined ? process.env[key]! : defaultValue;
}

export const env: Environment = {
  NODE_ENV: getOptionalEnvVar('NODE_ENV', 'development'),
  PORT: parseInt(getOptionalEnvVar('PORT', '5000'), 10),
  MONGODB_URI: getOptionalEnvVar('MONGODB_URI', 'mongodb://localhost:27017/devmind-ai'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: getOptionalEnvVar('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: getOptionalEnvVar('JWT_REFRESH_EXPIRES_IN', '30d'),
  CLIENT_URL: getOptionalEnvVar('CLIENT_URL', 'http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: getOptionalEnvVar('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_API_KEY: getOptionalEnvVar('CLOUDINARY_API_KEY', ''),
  CLOUDINARY_API_SECRET: getOptionalEnvVar('CLOUDINARY_API_SECRET', ''),
  SMTP_HOST: getOptionalEnvVar('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: parseInt(getOptionalEnvVar('SMTP_PORT', '587'), 10),
  SMTP_USER: getOptionalEnvVar('SMTP_USER', ''),
  SMTP_PASS: getOptionalEnvVar('SMTP_PASS', ''),
  SMTP_FROM: getOptionalEnvVar('SMTP_FROM', 'noreply@devmind-ai.com'),
  GEMINI_API_KEY: getOptionalEnvVar('GEMINI_API_KEY', ''),
  GROQ_API_KEY: getOptionalEnvVar('GROQ_API_KEY', ''),
  GITHUB_TOKEN: getOptionalEnvVar('GITHUB_TOKEN', ''),
  GITHUB_CLIENT_ID: getOptionalEnvVar('GITHUB_CLIENT_ID', ''),
  GITHUB_CLIENT_SECRET: getOptionalEnvVar('GITHUB_CLIENT_SECRET', ''),
  SOCKET_CORS_ORIGIN: getOptionalEnvVar('SOCKET_CORS_ORIGIN', 'http://localhost:5173'),
};
