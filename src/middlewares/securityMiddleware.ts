import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

// Helmet middleware for securing HTTP headers
export const helmetMiddleware = helmet();

// CORS configuration to restrict allowed origins
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // In production, specifically allow the Vercel frontend
    if (config.server.nodeEnv === 'production' && origin === 'https://jogou-baixou.vercel.app') {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    if (config.cors.allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error('CORS policy violation'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Rate limiting to prevent brute force and DoS attacks
export const apiLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
});

// Path traversal prevention middleware
export const preventPathTraversal = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  // Check if the ID contains any path traversal characters
  if (id && /[\/\\.]/.test(id)) {
    return res.status(400).json({ 
      error: 'Invalid file ID format',
      message: 'The file ID contains invalid characters'
    });
  }
  
  next();
};

// Validate file ID format middleware
export const validateFileId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  // Check if ID is in valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && !uuidRegex.test(id)) {
    return res.status(400).json({ 
      error: 'Invalid file ID format',
      message: 'The file ID must be in UUID format'
    });
  }
  
  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  
  // Handle CORS errors
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed by CORS policy'
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.server.isDev ? err.message : 'Something went wrong'
  });
};
