import mongoose, { Connection } from 'mongoose';
import { logger } from './logger';

class Database {
  private connection: Connection | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/slack-to-wordpress';
      const dbName = process.env.DB_NAME || 'slack-to-wordpress';

      await mongoose.connect(mongoUri, {
        dbName,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.connection = mongoose.connection;
      this.isConnected = true;

      logger.info(`Connected to MongoDB: ${mongoUri}/${dbName}`);

      // Handle connection events
      this.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      this.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      this.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      logger.warn('Failed to connect to MongoDB, running without database:', (error as Error).message);
      logger.warn('Application will continue but database features will be disabled');
      // Don't throw error - allow app to run without database
      this.isConnected = false;
    }
  }

  /**
   * Get database connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected && this.connection?.readyState === 1;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB connection closed');
    }
  }

  /**
   * Get mongoose connection instance
   */
  getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Health check for database
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection || !this.connection.db) return false;

      // Simple ping to check connection
      await this.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', (error as Error).message);
      return false;
    }
  }
}

// Export singleton instance
export const database = new Database();
export default database;