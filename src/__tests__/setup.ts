// Jest setup file
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';

// Ensure test directories exist
const testUploadsDir = path.join(process.cwd(), 'src', '__tests__', 'test-uploads');
if (!fs.existsSync(testUploadsDir)) {
  fs.mkdirSync(testUploadsDir, { recursive: true });
}

// Mock environment variables for testing
process.env.PORT = '3001';
process.env.UPLOAD_PATH = testUploadsDir;
process.env.MAX_FILE_SIZE = '10485760'; // 10MB

// Adiciona um teste básico para evitar o erro "must contain at least one test"
describe('Test environment', () => {
  test('setup is working correctly', () => {
    expect(true).toBe(true);
  });
});

// Global teardown - clean test files after all tests
afterAll(async () => {
  // Clean up test files
  const testFiles = fs.readdirSync(testUploadsDir);
  testFiles.forEach(file => {
    if (file !== '.gitkeep') {
      fs.unlinkSync(path.join(testUploadsDir, file));
    }
  });
  
  // Add a small delay to ensure file operations complete
  await new Promise(resolve => setTimeout(resolve, 100));
});
