import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile, getFileInfo, downloadFile } from '../../controllers/fileController';
import * as fileStorage from '../../utils/fileStorage';

// Mock do módulo uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('123e4567-e89b-12d3-a456-426614174000')
}));

// Mock the file storage module
jest.mock('../../utils/fileStorage', () => ({
  saveFileInfo: jest.fn(),
  getFileInfoById: jest.fn(),
  isFileExpired: jest.fn(),
  incrementDownloadCount: jest.fn(),
  deleteFileInfo: jest.fn()
}));

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  createReadStream: jest.fn()
}));

describe('fileController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock request and response
    req = {
      params: {},
      file: {
        fieldname: 'file',
        originalname: 'test-file.txt',
        filename: 'test-file-123.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        destination: '/path/to',
        size: 1024,
        path: '/path/to/test-file.txt',
        buffer: Buffer.from('test'),
        stream: {} as any
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });
  
  describe('uploadFile', () => {
    test('should return 400 if no file was uploaded', () => {
      // Set up request with no file
      req.file = undefined;
      
      // Call controller
      uploadFile(req as Request, res as Response);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'No file uploaded'
      }));
    });
    
    test('should save file info and return success response', () => {
      // UUID já está mockado no início do arquivo
      const mockUuid = '123e4567-e89b-12d3-a456-426614174000';
      
      // Mock getFileInfoById to return file info
      const mockFileInfo = {
        id: mockUuid,
        originalName: 'test-file.txt',
        filename: 'test-file-123.txt',
        mimetype: 'text/plain',
        size: 1024,
        path: '/path/to/test-file.txt',
        uploadDate: new Date(),
        expiryDate: new Date(Date.now() + 5 * 60 * 1000),
        downloadCount: 0,
        accessToken: 'test-token'
      };
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(mockFileInfo);
      
      // Call controller
      uploadFile(req as Request, res as Response);
      
      // Verify saveFileInfo was called with correct data
      expect(fileStorage.saveFileInfo).toHaveBeenCalledWith(expect.objectContaining({
        id: mockUuid,
        originalName: 'test-file.txt',
        filename: 'test-file-123.txt',
        mimetype: 'text/plain',
        size: 1024,
        path: '/path/to/test-file.txt'
      }));
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: mockUuid,
        fileId: mockUuid,
        originalName: 'test-file.txt',
        size: 1024,
        downloadUrl: `/api/download/${mockUuid}`
      }));
    });
    
    test('should handle errors during file upload', () => {
      // Mock saveFileInfo to throw error
      (fileStorage.saveFileInfo as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Call controller
      uploadFile(req as Request, res as Response);
      
      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to upload file'
      }));
    });
    
    test('should handle case where file info cannot be retrieved', () => {
      // Mock getFileInfoById to return null
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(null);
      
      // Call controller
      uploadFile(req as Request, res as Response);
      
      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to upload file'
      }));
    });
  });
  
  describe('getFileInfo', () => {
    test('should return 400 for invalid ID format', () => {
      // Set up request with invalid ID
      req.params = { id: 'invalid-id' };
      
      // Call controller
      getFileInfo(req as Request, res as Response);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid file ID format'
      }));
    });
    
    test('should return 404 if file not found', () => {
      // Set up request with valid ID
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      
      // Mock getFileInfoById to return null
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(null);
      
      // Call controller
      getFileInfo(req as Request, res as Response);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'File not found or expired'
      }));
    });
    
    test('should return file info for valid ID', () => {
      // Set up request with valid ID
      const fileId = '123e4567-e89b-12d3-a456-426614174000';
      req.params = { id: fileId };
      
      // Mock getFileInfoById to return file info
      const mockFileInfo = {
        id: fileId,
        originalName: 'test-file.txt',
        filename: 'test-file-123.txt',
        mimetype: 'text/plain',
        size: 1024,
        path: '/path/to/test-file.txt',
        uploadDate: new Date(),
        expiryDate: new Date(Date.now() + 5 * 60 * 1000),
        downloadCount: 2,
        accessToken: 'test-token'
      };
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(mockFileInfo);
      
      // Call controller
      getFileInfo(req as Request, res as Response);
      
      // Verify response
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: fileId,
        originalName: 'test-file.txt',
        size: 1024,
        mimetype: 'text/plain',
        downloadCount: 2
      }));
      
      // Verify it doesn't expose sensitive data
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response).not.toHaveProperty('path');
      expect(response).not.toHaveProperty('accessToken');
    });
    
    test('should handle errors during file info retrieval', () => {
      // Set up request with valid ID
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      
      // Mock getFileInfoById to throw error
      (fileStorage.getFileInfoById as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Call controller
      getFileInfo(req as Request, res as Response);
      
      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to get file info'
      }));
    });
  });
  
  describe('downloadFile', () => {
    test('should return 400 for invalid ID format', () => {
      // Set up request with invalid ID
      req.params = { id: 'invalid-id' };
      
      // Call controller
      downloadFile(req as Request, res as Response);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid file ID format'
      }));
    });
    
    test('should return 404 if file not found', () => {
      // Set up request with valid ID
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      
      // Mock getFileInfoById to return null
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(null);
      
      // Call controller
      downloadFile(req as Request, res as Response);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'File not found or expired'
      }));
    });
    
    test('should return 404 if file not found on disk', () => {
      // Set up request with valid ID
      const fileId = '123e4567-e89b-12d3-a456-426614174000';
      req.params = { id: fileId };
      
      // Mock getFileInfoById to return file info
      const mockFileInfo = {
        id: fileId,
        originalName: 'test-file.txt',
        filename: 'test-file-123.txt',
        mimetype: 'text/plain',
        size: 1024,
        path: '/path/to/test-file.txt',
        uploadDate: new Date(),
        expiryDate: new Date(Date.now() + 5 * 60 * 1000),
        downloadCount: 0,
        accessToken: 'test-token'
      };
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(mockFileInfo);
      
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      // Call controller
      downloadFile(req as Request, res as Response);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'File not found on server'
      }));
      
      // Verify deleteFileInfo was called
      expect(fileStorage.deleteFileInfo).toHaveBeenCalledWith(fileId);
    });
    
    test('should stream file for download', () => {
      // Set up request with valid ID
      const fileId = '123e4567-e89b-12d3-a456-426614174000';
      req.params = { id: fileId };
      
      // Mock getFileInfoById to return file info
      const mockFileInfo = {
        id: fileId,
        originalName: 'test-file.txt',
        filename: 'test-file-123.txt',
        mimetype: 'text/plain',
        size: 1024,
        path: '/path/to/test-file.txt',
        uploadDate: new Date(),
        expiryDate: new Date(Date.now() + 5 * 60 * 1000),
        downloadCount: 0,
        accessToken: 'test-token'
      };
      (fileStorage.getFileInfoById as jest.Mock).mockReturnValue(mockFileInfo);
      
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      // Mock createReadStream
      const mockStream = {
        pipe: jest.fn()
      };
      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
      
      // Call controller
      downloadFile(req as Request, res as Response);
      
      // Verify incrementDownloadCount was called
      expect(fileStorage.incrementDownloadCount).toHaveBeenCalledWith(fileId);
      
      // Verify headers were set
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('test-file.txt'));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      
      // Verify file was streamed
      expect(fs.createReadStream).toHaveBeenCalledWith('/path/to/test-file.txt');
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });
    
    test('should handle errors during file download', () => {
      // Set up request with valid ID
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      
      // Mock getFileInfoById to throw error
      (fileStorage.getFileInfoById as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Call controller
      downloadFile(req as Request, res as Response);
      
      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to download file'
      }));
    });
  });
});
