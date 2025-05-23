import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { FileInfo } from '../types/interfaces';
import { saveFileInfo, getFileInfoById, isFileExpired, incrementDownloadCount, deleteFileInfo } from '../utils/fileStorage';
import { config } from '../config/env';

// Handle file upload with security measures
export const uploadFile = (req: Request, res: Response) => {
  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Generate a secure UUID for the file ID
    const fileId = uuidv4();
    
    // Create file info with security features
    const fileInfo: FileInfo = {
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadDate: new Date(),
      expiryDate: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      downloadCount: 0
    };

    // Save file info - this will generate an access token internally
    saveFileInfo(fileInfo);
    
    // Get the file info with the generated access token
    const savedFileInfo = getFileInfoById(fileId);
    
    if (!savedFileInfo) {
      throw new Error('Failed to save file information');
    }

    // Return limited information to the client (no internal paths or tokens)
    res.status(201).json({
      id: savedFileInfo.id,
      fileId: savedFileInfo.id, // Include fileId for backward compatibility
      originalName: savedFileInfo.originalName,
      size: savedFileInfo.size,
      expiryDate: savedFileInfo.expiryDate,
      downloadUrl: `/api/download/${savedFileInfo.id}`,
      message: 'File will expire in 5 minutes'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

// Get file info with security measures
export const getFileInfo = (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Validate ID format to prevent injection attacks
  const validIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!validIdRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid file ID format' });
  }
  
  try {
    const fileInfo = getFileInfoById(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found or expired' });
    }
    
    // Return only necessary information, not internal file paths
    res.json({
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      size: fileInfo.size,
      mimetype: fileInfo.mimetype,
      uploadDate: fileInfo.uploadDate,
      expiryDate: fileInfo.expiryDate,
      downloadCount: fileInfo.downloadCount || 0
    });
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
};

// Download file with security measures
export const downloadFile = (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Validate ID format to prevent injection attacks
  const validIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!validIdRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid file ID format' });
  }
  
  try {
    const fileInfo = getFileInfoById(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found or expired' });
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(fileInfo.path)) {
      // Clean up inconsistent state
      deleteFileInfo(id);
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Increment download count for analytics
    incrementDownloadCount(id);
    
    // Set secure headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`);
    res.setHeader('Content-Type', fileInfo.mimetype);
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    res.setHeader('Cache-Control', 'no-store'); // Prevent caching
    
    // Send file
    const fileStream = fs.createReadStream(fileInfo.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
};
