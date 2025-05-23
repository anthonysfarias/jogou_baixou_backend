import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env';

// Define file info type with enhanced security fields
export interface FileInfo {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  uploadDate: Date;
  expiryDate: Date;
  accessToken?: string; // Optional security token for downloads
  downloadCount?: number; // Track number of downloads
}

// In-memory storage for file info
const fileInfoStorage: Record<string, FileInfo> = {};

// Path to the storage file - using config for better security
const storageFilePath = path.join(config.upload.uploadPath, 'file-info.json');

// Initialize storage from file if it exists
try {
  if (fs.existsSync(storageFilePath)) {
    const data = fs.readFileSync(storageFilePath, 'utf8');
    const parsedData = JSON.parse(data);
    
    // Convert string dates back to Date objects
    Object.keys(parsedData).forEach(key => {
      fileInfoStorage[key] = {
        ...parsedData[key],
        uploadDate: new Date(parsedData[key].uploadDate),
        expiryDate: new Date(parsedData[key].expiryDate)
      };
    });
  }
} catch (error) {
  console.error('Error loading file info storage:', error);
  // Create storage directory if it doesn't exist
  const storageDir = path.dirname(storageFilePath);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

// Generate a secure access token for file downloads
const generateAccessToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Check if a file has expired
export const isFileExpired = (fileInfo: FileInfo): boolean => {
  return new Date() > new Date(fileInfo.expiryDate);
};

// Save file info to storage with enhanced security
export const saveFileInfo = (fileInfo: FileInfo): void => {
  // Add security token if not present
  if (!fileInfo.accessToken) {
    fileInfo.accessToken = generateAccessToken();
  }
  
  // Initialize download count
  if (fileInfo.downloadCount === undefined) {
    fileInfo.downloadCount = 0;
  }
  
  fileInfoStorage[fileInfo.id] = fileInfo;
  
  // Use try-catch for better error handling
  try {
    fs.writeFileSync(storageFilePath, JSON.stringify(fileInfoStorage, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving file info:', error);
    // Create directory if it doesn't exist
    const storageDir = path.dirname(storageFilePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      // Try writing again
      fs.writeFileSync(storageFilePath, JSON.stringify(fileInfoStorage, null, 2), 'utf8');
    }
  }
};

// Get file info by ID with security checks
export const getFileInfoById = (id: string): FileInfo | null => {
  // Validate ID format to prevent injection attacks
  const validIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!validIdRegex.test(id)) {
    return null;
  }
  
  const fileInfo = fileInfoStorage[id];
  
  if (!fileInfo) {
    return null;
  }
  
  // Check if the file has expired
  if (isFileExpired(fileInfo)) {
    return null;
  }
  
  // Verify file exists on disk
  if (!fs.existsSync(fileInfo.path)) {
    // File missing but metadata exists - clean up the inconsistency
    delete fileInfoStorage[id];
    try {
      fs.writeFileSync(storageFilePath, JSON.stringify(fileInfoStorage, null, 2), 'utf8');
    } catch (error) {
      console.error('Error updating file info after finding missing file:', error);
    }
    return null;
  }
  
  return fileInfo;
};

// Verify access token for a file (adds another security layer)
export const verifyFileAccessToken = (id: string, token: string): boolean => {
  const fileInfo = fileInfoStorage[id];
  if (!fileInfo || !fileInfo.accessToken) return false;
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(fileInfo.accessToken)
  );
};

// Delete file info from storage with enhanced security
export const deleteFileInfo = (id: string): void => {
  if (fileInfoStorage[id]) {
    // Delete the actual file
    try {
      // Check if file exists before attempting to delete
      if (fs.existsSync(fileInfoStorage[id].path)) {
        fs.unlinkSync(fileInfoStorage[id].path);
      }
    } catch (error) {
      console.error(`Error deleting file ${id}:`, error);
    }
    
    // Remove from storage
    delete fileInfoStorage[id];
    
    try {
      fs.writeFileSync(storageFilePath, JSON.stringify(fileInfoStorage, null, 2), 'utf8');
    } catch (error) {
      console.error('Error updating storage after file deletion:', error);
    }
  }
};

// Increment download count for analytics and security monitoring
export const incrementDownloadCount = (id: string): void => {
  if (fileInfoStorage[id]) {
    fileInfoStorage[id].downloadCount = (fileInfoStorage[id].downloadCount || 0) + 1;
    
    try {
      fs.writeFileSync(storageFilePath, JSON.stringify(fileInfoStorage, null, 2), 'utf8');
    } catch (error) {
      console.error('Error updating download count:', error);
    }
  }
};

// Clean up expired files
export const cleanupExpiredFiles = (): void => {
  const now = new Date();
  let cleanupPerformed = false;
  
  Object.keys(fileInfoStorage).forEach(id => {
    const fileInfo = fileInfoStorage[id];
    if (now > new Date(fileInfo.expiryDate)) {
      deleteFileInfo(id);
      cleanupPerformed = true;
    }
  });
  
  if (cleanupPerformed) {
    console.log(`[${new Date().toISOString()}] Cleaned up expired files`);
  }
};
