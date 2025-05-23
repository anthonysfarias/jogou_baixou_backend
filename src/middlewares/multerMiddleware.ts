import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/env';

// Get upload directory from configuration
const uploadsDir = config.upload.uploadPath;

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage with security measures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with randomized name for security
    // This prevents path traversal and predictable file access
    const uniqueId = uuidv4();
    
    // Add randomness with crypto for additional security
    const randomString = crypto.randomBytes(8).toString('hex');
    
    // Keep original extension but sanitize it
    const fileExt = path.extname(file.originalname).toLowerCase();
    const sanitizedExt = fileExt.replace(/[^a-z0-9.]/gi, '');
    
    // Final filename: uuid + random string + sanitized extension
    cb(null, `${uniqueId}-${randomString}${sanitizedExt}`);
  }
});

// Allowed MIME types for security
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp',
  
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  
  // Audio/Video
  'audio/mpeg', 'audio/wav', 'video/mp4', 'video/mpeg', 'video/webm'
];

// File filter function with enhanced security checks
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Check if the MIME type is allowed
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type '${file.mimetype}' not allowed`), false);
  }
  
  // Validate filename for security
  const filename = file.originalname;
  
  // Prevent files with suspicious names
  if (/[\\/:*?"<>|]/.test(filename)) {
    return cb(new Error('Filename contains invalid characters'), false);
  }
  
  // Check file extension
  const fileExt = path.extname(filename).toLowerCase().replace('.', '');
  const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'pl', 'py', 'js', 'jsp', 'dll'];
  
  if (dangerousExtensions.includes(fileExt)) {
    return cb(new Error(`File extension '${fileExt}' not allowed for security reasons`), false);
  }
  
  // Accept the file
  cb(null, true);
};

// Create multer instance with security limits
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize, // Limit file size (default 10MB)
    files: 1 // Allow only one file per request
  }
});
