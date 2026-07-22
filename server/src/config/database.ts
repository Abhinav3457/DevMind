import mongoose from 'mongoose';
import logger from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devmind-ai';

  try {
    mongoose.set('strictQuery', true);

    const connection = await mongoose.connect(mongoURI, {
      // Mongoose 8+ no longer needs these options explicitly
      // but we keep serverSelectionTimeoutMS for reliability
      serverSelectionTimeoutMS: 5000,
    });

    logger.info(`✅ MongoDB connected: ${connection.connection.host}`);

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
  }
}
