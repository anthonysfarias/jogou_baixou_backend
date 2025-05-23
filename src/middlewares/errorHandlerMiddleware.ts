import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Custom error class for file upload errors
 */
export class FileUploadError extends Error {
  public statusCode: number;
  
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FileUploadError';
    this.statusCode = statusCode;
  }
}

/**
 * Middleware to handle file upload errors
 */
export const uploadErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Handle multer errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File size exceeds the limit of ${config.upload.maxFileSize / (1024 * 1024)}MB`;
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name in upload';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      default:
        message = err.message || 'Unknown file upload error';
    }
    
    return res.status(statusCode).json({
      error: 'Upload Error',
      message,
      code: err.code
    });
  }
  
  // Handle custom file upload errors
  if (err instanceof FileUploadError) {
    return res.status(err.statusCode).json({
      error: 'Upload Error',
      message: err.message
    });
  }
  
  // Pass to next error handler if not a file upload error
  next(err);
};

/**
 * Global error handler for all other errors
 */
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Log the error for debugging
  console.error(`[${new Date().toISOString()}] Error:`, {
    path: req.path,
    method: req.method,
    statusCode,
    message,
    stack: config.server.isDev ? err.stack : undefined
  });
  
  // Send error response
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Request Error',
    message: config.server.isDev ? message : (statusCode === 500 ? 'Something went wrong' : message)
  });
};
