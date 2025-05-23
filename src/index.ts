import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileRoutes } from './routes/fileRoutes';
import { cleanupExpiredFiles } from './utils/fileStorage';
import { config } from './config/env';
import { 
  helmetMiddleware, 
  corsMiddleware, 
  apiLimiter, 
  errorHandler 
} from './middlewares/securityMiddleware';
import { contentSecurityPolicy } from './middlewares/cspMiddleware';
import { uploadErrorHandler, globalErrorHandler } from './middlewares/errorHandlerMiddleware';

const app = express();

// Security middleware - order is important
app.use(helmetMiddleware);       // Secure HTTP headers
app.use(contentSecurityPolicy);  // Content Security Policy
app.use(corsMiddleware);         // CORS protection
app.use(apiLimiter);             // Rate limiting

// Standard middleware
app.use(express.json({ limit: '1mb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Limit URL-encoded body size

// Do NOT expose uploads directory directly - security risk
// Instead, all file access should go through the API

app.use(cors({
  origin: config.cors.allowedOrigins,
}));

// API routes with rate limiting
app.use('/api', fileRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware (order matters)
app.use(uploadErrorHandler);  // Handle file upload errors first
app.use(errorHandler);       // Handle security-related errors
app.use(globalErrorHandler); // Catch-all error handler

// Define cleanup interval
const CLEANUP_INTERVAL = 20 * 1000; // 20 seconds

// Start server
app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port} in ${config.server.nodeEnv} mode`);
  console.log(`CORS allowed origins: ${config.cors.allowedOrigins.join(', ')}`);
  console.log(`Upload directory: ${config.upload.uploadPath}`);
  console.log(`Max file size: ${config.upload.maxFileSize / (1024 * 1024)}MB`);
  console.log(`- Upload endpoint: http://localhost:${config.server.port}/api/upload`);
  console.log(`- Download endpoint: http://localhost:${config.server.port}/api/download/:id`);
  
  // Log cleanup service details'
  console.log(`File cleanup service started (interval: 20 seconds)`);
  
  // Initial cleanup on server start
  try {
    cleanupExpiredFiles();
    console.log('Initial cleanup completed');
  } catch (error) {
    console.error('Error during initial cleanup:', error);
  }
});

// Set up recurring cleanup
setInterval(() => {
  try {
    cleanupExpiredFiles();
  } catch (error) {
    console.error('Error during scheduled cleanup:', error);
  }
}, CLEANUP_INTERVAL);

export default app;
