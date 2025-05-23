import { 
  uploadErrorHandler, 
  globalErrorHandler,
  FileUploadError 
} from '../../middlewares/errorHandlerMiddleware';
import { config } from '../../config/env';

// Mock config
jest.mock('../../config/env', () => ({
  config: {
    upload: {
      maxFileSize: 10 * 1024 * 1024 // 10MB
    },
    server: {
      isDev: true
    }
  }
}));

// Mock console.error to prevent test output pollution
console.error = jest.fn();

describe('errorHandlerMiddleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock request, response, and next function
    req = {
      path: '/api/upload',
      method: 'POST'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });
  
  describe('FileUploadError', () => {
    test('should create error with default status code', () => {
      const error = new FileUploadError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('FileUploadError');
      expect(error.statusCode).toBe(400);
    });
    
    test('should create error with custom status code', () => {
      const error = new FileUploadError('Not found', 404);
      
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
    });
  });
  
  describe('uploadErrorHandler', () => {
    test('should handle MulterError LIMIT_FILE_SIZE', () => {
      // Create multer error
      const multerError = {
        name: 'MulterError',
        code: 'LIMIT_FILE_SIZE',
        message: 'File too large'
      };
      
      // Call middleware
      uploadErrorHandler(multerError, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Upload Error',
        message: expect.stringContaining('File size exceeds the limit'),
        code: 'LIMIT_FILE_SIZE'
      }));
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should handle MulterError LIMIT_UNEXPECTED_FILE', () => {
      // Create multer error
      const multerError = {
        name: 'MulterError',
        code: 'LIMIT_UNEXPECTED_FILE',
        message: 'Unexpected field'
      };
      
      // Call middleware
      uploadErrorHandler(multerError, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Upload Error',
        message: 'Unexpected field name in upload',
        code: 'LIMIT_UNEXPECTED_FILE'
      }));
    });
    
    test('should handle MulterError LIMIT_FILE_COUNT', () => {
      // Create multer error
      const multerError = {
        name: 'MulterError',
        code: 'LIMIT_FILE_COUNT',
        message: 'Too many files'
      };
      
      // Call middleware
      uploadErrorHandler(multerError, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Upload Error',
        message: 'Too many files uploaded',
        code: 'LIMIT_FILE_COUNT'
      }));
    });
    
    test('should handle unknown MulterError', () => {
      // Create multer error
      const multerError = {
        name: 'MulterError',
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error'
      };
      
      // Call middleware
      uploadErrorHandler(multerError, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Upload Error',
        message: 'Unknown error',
        code: 'UNKNOWN_ERROR'
      }));
    });
    
    test('should handle FileUploadError', () => {
      // Create custom error
      const fileError = new FileUploadError('Invalid file format', 415);
      
      // Call middleware
      uploadErrorHandler(fileError, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Upload Error',
        message: 'Invalid file format'
      }));
    });
    
    test('should pass other errors to next middleware', () => {
      // Create generic error
      const genericError = new Error('Generic error');
      
      // Call middleware
      uploadErrorHandler(genericError, req, res, next);
      
      // Verify it passed to next
      expect(next).toHaveBeenCalledWith(genericError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
  
  describe('globalErrorHandler', () => {
    test('should handle errors with status code', () => {
      // Create error with status code
      const error = {
        statusCode: 403,
        message: 'Forbidden'
      };
      
      // Call middleware
      globalErrorHandler(error, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Request Error',
        message: 'Forbidden'
      }));
      expect(console.error).toHaveBeenCalled();
    });
    
    test('should handle generic errors with default 500 status', () => {
      // Create generic error
      const error = new Error('Something broke');
      
      // Call middleware
      globalErrorHandler(error, req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Internal Server Error',
        message: 'Something broke' // Shows actual message in dev mode
      }));
    });
    
    test('should include stack trace in logs when in dev mode', () => {
      // Create error with stack
      const error = new Error('Stack trace test');
      error.stack = 'Error: Stack trace test\n    at Test.test';
      
      // Call middleware
      globalErrorHandler(error, req, res, next);
      
      // Verify console output includes stack
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Error:/),
        expect.objectContaining({
          stack: error.stack
        })
      );
    });
  });
});
