import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { FileInfo, saveFileInfo, getFileInfoById } from '../utils/fileStorage';

// Handle file upload
export const uploadFile = (req: Request, res: Response) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate a unique ID for the file
    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    
    // Create file info object
    const fileInfo: FileInfo = {
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadDate: new Date(),
      expiryDate: new Date(Date.now() + 60 * 1000), // 1 minute from now
    };

    // Save file info
    saveFileInfo(fileInfo);

    // Return success response with file ID
    return res.status(201).json({
      success: true,
      fileId,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Server error during upload' });
  }
};

// Get file info
export const getFileInfo = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get file info from storage
    const fileInfo = getFileInfoById(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file has expired
    if (new Date() > fileInfo.expiryDate) {
      return res.status(410).json({ error: 'File link has expired' });
    }

    // Return file info (excluding the actual file path for security)
    return res.status(200).json({
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      size: fileInfo.size,
      mimetype: fileInfo.mimetype,
      uploadDate: fileInfo.uploadDate,
      expiryDate: fileInfo.expiryDate,
    });
  } catch (error) {
    console.error('Get file info error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Handle file download
export const downloadFile = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get file info from storage
    const fileInfo = getFileInfoById(id);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file has expired
    if (new Date() > fileInfo.expiryDate) {
      return res.status(410).json({ error: 'File link has expired' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(fileInfo.path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`);
    res.setHeader('Content-Type', fileInfo.mimetype);

    // Stream the file
    const fileStream = fs.createReadStream(fileInfo.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Server error during download' });
  }
};
