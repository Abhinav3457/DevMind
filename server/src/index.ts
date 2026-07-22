import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDatabase } from './config/database';
import { initializeSocket } from './config/socket';
import { createServer } from 'http';
import logger from './utils/logger';

const PORT = process.env.PORT || 5000;

async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.io
    initializeSocket(httpServer);

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`DevMind AI Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
