import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

/**
 * Global error handling middleware
 */
const errorHandler = (
  err: Error | AppError, 
  req: Request, 
  res: Response, 
  _next: any
): void => {
  let error = { ...err } as AppError;
  error.message = err.message;

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 } as AppError;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 } as AppError;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message);
    error = { message: message.join(', '), statusCode: 400 } as AppError;
  }

  // WordPress API errors
  if ((err as any).response && (err as any).response.status) {
    const message = `WordPress API Error: ${(err as any).response.statusText || 'Unknown error'}`;
    error = { message, statusCode: (err as any).response.status } as AppError;
  }

  // Slack API errors
  if ((err as any).response && (err as any).response.data && (err as any).response.data.error) {
    const message = `Slack API Error: ${(err as any).response.data.error}`;
    error = { message, statusCode: (err as any).response.status || 400 } as AppError;
  }

  const statusCode = error.statusCode || 500;
  const response: any = {
    success: false,
    error: error.message || 'Server Error'
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export { errorHandler };
export default errorHandler;
