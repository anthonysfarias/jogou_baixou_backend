import fs from 'fs';
import path from 'path';

// File info interface
export interface FileInfo {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  uploadDate: Date;
  expiryDate: Date;
}

// In-memory storage for file info (in a real app, this would be a database)
const fileInfoStorage: Record<string, FileInfo> = {};

// Path to a JSON file for persistent storage
const storageFilePath = path.join(__dirname, '..', 'uploads', 'file-info.json');

// Initialize storage from file if it exists
try {
  if (fs.existsSync(storageFilePath)) {
    const data = fs.readFileSync(storageFilePath, 'utf8');
    const parsedData = JSON.parse(data);
    
    // Convert string dates back to Date objects
    Object.keys(parsedData).forEach(key => {
      if (parsedData[key].uploadDate) {
        parsedData[key].uploadDate = new Date(parsedData[key].uploadDate);
      }
      if (parsedData[key].expiryDate) {
        parsedData[key].expiryDate = new Date(parsedData[key].expiryDate);
      }
    });
    
    Object.assign(fileInfoStorage, parsedData);
    console.log(`Loaded ${Object.keys(parsedData).length} file records from storage`);
  }
} catch (error) {
  console.error('Error loading file info storage:', error);
}

// Save file info to storage
export const saveFileInfo = (fileInfo: FileInfo): void => {
  fileInfoStorage[fileInfo.id] = fileInfo;
  
  // Save to file for persistence
  try {
    fs.writeFileSync(
      storageFilePath,
      JSON.stringify(fileInfoStorage, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Error saving file info to storage:', error);
  }
};

// Get file info by ID
export const getFileInfoById = (id: string): FileInfo | null => {
  return fileInfoStorage[id] || null;
};

// Delete file info by ID
export const deleteFileInfoById = (id: string): boolean => {
  if (fileInfoStorage[id]) {
    // Delete the actual file
    try {
      fs.unlinkSync(fileInfoStorage[id].path);
    } catch (error) {
      console.error(`Error deleting file ${id}:`, error);
    }
    
    // Remove from storage
    delete fileInfoStorage[id];
    
    // Update storage file
    try {
      fs.writeFileSync(
        storageFilePath,
        JSON.stringify(fileInfoStorage, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error updating file info storage:', error);
    }
    
    return true;
  }
  return false;
};

// Clean up expired files (could be called by a scheduled job)
export const cleanupExpiredFiles = (): number => {
  const now = new Date();
  let count = 0;
  
  Object.keys(fileInfoStorage).forEach(id => {
    if (now > fileInfoStorage[id].expiryDate) {
      if (deleteFileInfoById(id)) {
        count++;
      }
    }
  });
  
  return count;
};
