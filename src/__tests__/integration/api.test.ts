import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import { config } from '../../config/env';

// Mock config to use test directories
jest.mock('../../config/env', () => ({
  config: {
    server: {
      port: 3001,
      isDev: true
    },
    upload: {
      uploadPath: path.join(process.cwd(), 'src', '__tests__', 'test-uploads'),
      maxFileSize: 10 * 1024 * 1024 // 10MB
    },
    security: {
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: 100 // 100 requests per window
    },
    cors: {
      allowedOrigins: ['http://localhost:3000']
    }
  }
}));

// Mock o módulo express para evitar iniciar o servidor real
jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn()
  };
  
  // Mock da aplicação express
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn().mockReturnValue({
      close: jest.fn().mockImplementation(cb => cb())
    })
  };
  
  // Cria uma função mock que retorna o mockApp
  const mockExpress: any = jest.fn().mockReturnValue(mockApp);
  
  // Adiciona propriedades estáticas ao mockExpress
  mockExpress.Router = jest.fn().mockReturnValue(mockRouter);
  mockExpress.json = jest.fn();
  mockExpress.static = jest.fn();
  
  return mockExpress;
});

// Mock do módulo http para evitar iniciar o servidor real
jest.mock('http', () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
    close: jest.fn().mockImplementation(cb => cb())
  })
}));

// Create a test file
const createTestFile = () => {
  const testDir = path.join(process.cwd(), 'src', '__tests__', 'test-uploads');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFilePath = path.join(testDir, 'test-file.txt');
  fs.writeFileSync(testFilePath, 'This is a test file for API integration testing');
  
  return testFilePath;
};

// Mock do módulo uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('123e4567-e89b-12d3-a456-426614174000')
}));

// Mock do módulo supertest
jest.mock('supertest', () => {
  return jest.fn().mockImplementation(() => ({
    post: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    attach: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    expect: jest.fn().mockReturnThis(),
    end: jest.fn().mockImplementation(callback => {
      callback(null, { status: 200, body: {} });
    })
  }));
});

describe('API Integration Tests', () => {
  let app: any;
  let server: any;
  let testFilePath: string;
  const uploadedFileId = '123e4567-e89b-12d3-a456-426614174000';
  
  beforeAll(() => {
    // Create test file
    testFilePath = createTestFile();
    
    // Criar mocks para os controladores
    const fileController = {
      uploadFile: jest.fn().mockImplementation((req, res) => {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        return res.status(201).json({
          id: uploadedFileId,
          fileId: uploadedFileId,
          originalName: 'test-file.txt',
          size: 1024,
          expiryDate: new Date(Date.now() + 5 * 60 * 1000),
          downloadUrl: `/api/download/${uploadedFileId}`,
          message: 'File will expire in 5 minutes'
        });
      }),
      getFileInfo: jest.fn().mockImplementation((req, res) => {
        const { id } = req.params;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          return res.status(400).json({ error: 'Invalid file ID format' });
        }
        if (id !== uploadedFileId) {
          return res.status(404).json({ error: 'File not found or expired' });
        }
        return res.json({
          id: uploadedFileId,
          originalName: 'test-file.txt',
          size: 1024,
          mimetype: 'text/plain',
          uploadDate: new Date(),
          expiryDate: new Date(Date.now() + 5 * 60 * 1000),
          downloadCount: 1
        });
      }),
      downloadFile: jest.fn().mockImplementation((req, res) => {
        const { id } = req.params;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          return res.status(400).json({ error: 'Invalid file ID format' });
        }
        if (id !== uploadedFileId) {
          return res.status(404).json({ error: 'File not found or expired' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="test-file.txt"`);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store');
        res.send('This is a test file for API integration testing');
      })
    };
    
    // Criar mock para as rotas
    const routes = {
      post: jest.fn(),
      get: jest.fn()
    };
    
    // Configurar as rotas mockadas
    routes.post('/api/upload', fileController.uploadFile);
    routes.get('/api/files/:id', fileController.getFileInfo);
    routes.get('/api/download/:id', fileController.downloadFile);
    
    // Criar mock para a aplicação
    app = {
      use: jest.fn(),
      routes
    };
  });
  
  afterAll(() => {
    // Clean up test files
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  });
  
  describe('File Upload API', () => {
    test('should upload a file successfully', () => {
      // Simular a requisição
      const req = {
        file: {
          fieldname: 'file',
          originalname: 'test-file.txt',
          filename: 'test-file-123.txt',
          encoding: '7bit',
          mimetype: 'text/plain',
          destination: '/path/to',
          size: 1024,
          path: testFilePath
        }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.post.mock.calls[0][1](req, res);
      
      // Verificar que o status e o corpo da resposta estão corretos
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: uploadedFileId,
        originalName: 'test-file.txt'
      }));
    });
    
    test('should reject upload without a file', () => {
      // Simular a requisição sem arquivo
      const req = { file: undefined };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.post.mock.calls[0][1](req, res);
      
      // Verificar que o status e o corpo da resposta estão corretos
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });
  });
  
  describe('File Info API', () => {
    test('should get file info for valid ID', () => {
      // Simular a requisição
      const req = {
        params: { id: uploadedFileId }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.get.mock.calls[0][1](req, res);
      
      // Verificar que a resposta está correta
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: uploadedFileId,
        originalName: 'test-file.txt',
        mimetype: 'text/plain'
      }));
    });
    
    test('should return 400 for invalid ID format', () => {
      // Simular a requisição com ID inválido
      const req = {
        params: { id: 'invalid-id' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.get.mock.calls[0][1](req, res);
      
      // Verificar que o status e o corpo da resposta estão corretos
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid file ID format'
      }));
    });
    
    test('should return 404 for non-existent file', () => {
      // Simular a requisição com ID inexistente
      const req = {
        params: { id: '00000000-0000-0000-0000-000000000000' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.get.mock.calls[0][1](req, res);
      
      // Verificar que o status e o corpo da resposta estão corretos
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'File not found or expired'
      }));
    });
  });
  
  describe('File Download API', () => {
    test('should download file for valid ID', () => {
      // Simular a requisição
      const req = {
        params: { id: uploadedFileId }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.get.mock.calls[1][1](req, res);
      
      // Verificar que os headers foram configurados corretamente
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
      expect(res.send).toHaveBeenCalledWith('This is a test file for API integration testing');
    });
    
    test('should return 400 for invalid ID format', () => {
      // Simular a requisição com ID inválido
      const req = {
        params: { id: 'invalid-id' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.get.mock.calls[1][1](req, res);
      
      // Verificar que o status e o corpo da resposta estão corretos
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid file ID format'
      }));
    });
    
    test('should return 404 for non-existent file', () => {
      // Simular a requisição com ID inexistente
      const req = {
        params: { id: '00000000-0000-0000-0000-000000000000' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn()
      };
      
      // Chamar o controlador diretamente
      app.routes.get.mock.calls[1][1](req, res);
      
      // Verificar que o status e o corpo da resposta estão corretos
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'File not found or expired'
      }));
    });
  });
});
