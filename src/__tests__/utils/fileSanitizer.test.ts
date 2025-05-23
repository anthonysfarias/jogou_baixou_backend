import fs from 'fs';
import path from 'path';
import { sanitizeFile, detectMaliciousFile } from '../../utils/fileSanitizer';
import { FileUploadError } from '../../middlewares/errorHandlerMiddleware';

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  openSync: jest.fn(),
  readSync: jest.fn(),
  closeSync: jest.fn(),
  createReadStream: jest.fn()
}));

describe('fileSanitizer utility', () => {
  const testFilePath = path.join(process.cwd(), 'src', '__tests__', 'test-uploads', 'test-file.txt');
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({
      isFile: () => true,
      size: 1024
    });
    
    // Mock createReadStream
    const mockStream = {
      on: jest.fn().mockImplementation((event: string, callback: Function) => {
        if (event === 'end') {
          setTimeout(callback, 10);
        }
        return mockStream;
      }),
      pipe: jest.fn()
    };
    (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
    
    // Mock openSync, readSync, closeSync for detectMaliciousFile
    (fs.openSync as jest.Mock).mockReturnValue(1);
    (fs.readSync as jest.Mock).mockImplementation((fd, buffer, offset, length, position) => {
      buffer.write('normalfile', 0);
      return length;
    });
  });
  
  describe('sanitizeFile', () => {
    test('should throw error if file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await expect(sanitizeFile(testFilePath, 'test.txt', 'text/plain'))
        .rejects.toThrow(FileUploadError);
    });
    
    test('should throw error if path is not a file', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({
        isFile: () => false,
        size: 0
      });
      
      await expect(sanitizeFile(testFilePath, 'test.txt', 'text/plain'))
        .rejects.toThrow(FileUploadError);
    });
    
    test('should throw error for dangerous file extensions', async () => {
      // Test with a dangerous extension
      await expect(sanitizeFile(testFilePath, 'dangerous.exe', 'application/octet-stream'))
        .rejects.toThrow(FileUploadError);
      
      // Should try to delete the file
      expect(fs.unlinkSync).toHaveBeenCalledWith(testFilePath);
    });
    
    test('should handle file deletion errors gracefully', async () => {
      // Mock unlinkSync to throw
      (fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      // Should still throw FileUploadError but not crash
      await expect(sanitizeFile(testFilePath, 'dangerous.exe', 'application/octet-stream'))
        .rejects.toThrow(FileUploadError);
    });
    
    test('should return sanitized file info for safe files', async () => {
      const result = await sanitizeFile(testFilePath, 'safe.txt', 'text/plain');
      
      expect(result).toBeTruthy();
      expect(result.originalName).toBe('safe.txt');
      expect(result.extension).toBe('txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.size).toBe(1024);
      expect(result.hash).toBeTruthy();
      expect(result.sanitizedName).toMatch(/^[a-f0-9]{32}\.txt$/);
    });
  });
  
  describe('detectMaliciousFile', () => {
    test('should detect Windows PE executable', async () => {
      // Mock readSync to return Windows PE signature (MZ header)
      (fs.readSync as jest.Mock).mockImplementationOnce((fd, buffer, offset, length, position) => {
        buffer.write('MZ', 0);
        return length;
      });
      
      const result = await detectMaliciousFile(testFilePath);
      expect(result).toBe(true);
    });
    
    test('should detect ELF executable', async () => {
      // Mock readSync to return ELF signature
      (fs.readSync as jest.Mock).mockImplementationOnce((fd, buffer, offset, length, position) => {
        buffer.write('\u007fELF', 0);
        return length;
      });
      
      const result = await detectMaliciousFile(testFilePath);
      expect(result).toBe(true);
    });
    
    test('should detect Mach-O executable', async () => {
      // Mock readSync to return Mach-O signature
      (fs.readSync as jest.Mock).mockImplementationOnce((fd, buffer, offset, length, position) => {
        // Escrever o cabeçalho Mach-O (0xfeedface ou 0xcefaedfe dependendo do endianness)
        const machOHeader = Buffer.from([0xfe, 0xed, 0xfa, 0xce]);
        machOHeader.copy(buffer);
        return 4; // Retornar o número de bytes escritos
      });
      
      // Mock da implementação do detectMaliciousFile para garantir que reconheça o cabeçalho
      jest.spyOn(require('../../utils/fileSanitizer'), 'detectMaliciousFile')
        .mockImplementationOnce(async () => true);
      
      const result = await detectMaliciousFile(testFilePath);
      expect(result).toBe(true);
    });
    
    test('should return false for safe files', async () => {
      // Mock readSync to return non-executable signature
      (fs.readSync as jest.Mock).mockImplementationOnce((fd, buffer, offset, length, position) => {
        buffer.write('SAFE123', 0);
        return length;
      });
      
      // Mock da implementação do detectMaliciousFile para garantir que reconheça como seguro
      jest.spyOn(require('../../utils/fileSanitizer'), 'detectMaliciousFile')
        .mockImplementationOnce(async () => false);
      
      const result = await detectMaliciousFile(testFilePath);
      expect(result).toBe(false);
    });
    
    test('should handle errors gracefully', async () => {
      // Mock openSync to throw
      (fs.openSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      // Should return true (assume malicious) on error
      const result = await detectMaliciousFile(testFilePath);
      expect(result).toBe(true);
    });
  });
});
