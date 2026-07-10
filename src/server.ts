import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';

// Load environment variables FIRST before importing other modules
dotenv.config();

import { logger } from '@/utils/logger';
import { slackController } from '@/controllers/slackController';
import { errorHandler } from '@/middleware/errorHandler';
import { HealthCheckResponse } from '@/types';
import '@/utils/database'; // Initialize database connection

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response<HealthCheckResponse>) => {
  const healthCheck: HealthCheckResponse = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  res.status(200).json(healthCheck);
});

// Slack webhook endpoint
app.post('/webhook/slack', slackController.handleSlackWebhook.bind(slackController));

// Slack Events API endpoint (alternative to webhook)
app.post('/events/slack', slackController.handleSlackEvent.bind(slackController));

// Slack Interactivity endpoint (button clicks, etc.)
app.post('/interactive/slack', slackController.handleSlackInteractivity.bind(slackController));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Slack to WordPress server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
