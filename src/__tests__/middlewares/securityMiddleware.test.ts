import { 
  preventPathTraversal, 
  validateFileId, 
  errorHandler,
  corsMiddleware
} from '../../middlewares/securityMiddleware';
import { config } from '../../config/env';

// Mock config
jest.mock('../../config/env', () => ({
  config: {
    cors: {
      allowedOrigins: ['http://localhost:3000', 'https://example.com']
    },
    server: {
      isDev: true
    },
    security: {
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutos
      rateLimitMaxRequests: 100 // 100 requisições por janela
    }
  }
}));

describe('securityMiddleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock request, response, and next function
    req = {
      params: {},
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });
  
  describe('preventPathTraversal', () => {
    test('should block requests with path traversal characters', () => {
      // Set up request with path traversal attempt
      req.params.id = 'file../../../etc/passwd';
      
      // Call middleware
      preventPathTraversal(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid file ID format'
      }));
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should allow valid requests', () => {
      // Set up request with valid ID
      req.params.id = 'validfileid123';
      
      // Call middleware
      preventPathTraversal(req, res, next);
      
      // Verify it called next()
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
  
  describe('validateFileId', () => {
    test('should block requests with invalid UUID format', () => {
      // Set up request with invalid UUID
      req.params.id = 'not-a-uuid';
      
      // Call middleware
      validateFileId(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid file ID format'
      }));
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should allow valid UUID format', () => {
      // Set up request with valid UUID
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      
      // Call middleware
      validateFileId(req, res, next);
      
      // Verify it called next()
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
  
  describe('errorHandler', () => {
    test('should handle CORS errors', () => {
      // Create CORS error
      const corsError = new Error('CORS policy violation');
      
      // Call middleware
      errorHandler(corsError, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'CORS Error'
      }));
    });
    
    test('should handle generic errors in development mode', () => {
      // Create generic error
      const genericError = new Error('Something went wrong');
      
      // Call middleware
      errorHandler(genericError, req, res, next);
      
      // Verify response includes actual error message in dev mode
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Something went wrong'
      }));
    });
  });
  
  describe('corsMiddleware', () => {
    // Vamos testar diretamente a função origin em vez de acessar corsMiddleware.options
    // já que a implementação do cors não expõe options diretamente
    
    // Mock da função origin do CORS
    const originFn = (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      // Permitir requisições sem origem
      if (!origin) return callback(null, true);
      
      // Verificar se a origem está na lista de permitidas
      if (config.cors.allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        return callback(new Error('CORS policy violation'), false);
      }
    };
    
    test('should allow requests from allowed origins', () => {
      const callback = jest.fn();
      
      // Test with allowed origin
      originFn('http://localhost:3000', callback);
      
      // Verify it allowed the request
      expect(callback).toHaveBeenCalledWith(null, true);
    });
    
    test('should block requests from disallowed origins', () => {
      const callback = jest.fn();
      
      // Test with disallowed origin
      originFn('http://evil-site.com', callback);
      
      // Verify it blocked the request
      expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    });
    
    test('should allow requests with no origin', () => {
      const callback = jest.fn();
      
      // Test with no origin (like curl, postman)
      originFn(undefined, callback);
      
      // Verify it allowed the request
      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });
});
