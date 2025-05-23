import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Define environment variables schema with validation
const envSchema = z.object({
  // Server configuration
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  
  // File upload configuration
  MAX_FILE_SIZE: z.string().default('10485760'), // 10MB in bytes
  UPLOAD_DIR: z.string().default('uploads'),
  
  // Security
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'), // Maximum requests per window
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Create configuration object with proper types
export const config = {
  server: {
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
  },
  cors: {
    allowedOrigins: env.ALLOWED_ORIGINS.split(','),
  },
  upload: {
    maxFileSize: parseInt(env.MAX_FILE_SIZE, 10),
    uploadDir: env.UPLOAD_DIR,
    uploadPath: path.join(__dirname, '..', env.UPLOAD_DIR),
  },
  security: {
    rateLimitWindowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    rateLimitMaxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },
};

// Ensure upload directory exists
if (!fs.existsSync(config.upload.uploadPath)) {
  fs.mkdirSync(config.upload.uploadPath, { recursive: true });
}
