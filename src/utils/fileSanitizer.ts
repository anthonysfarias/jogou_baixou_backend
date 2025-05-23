import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FileUploadError } from '../middlewares/errorHandlerMiddleware';
import { SanitizedFileInfo } from '../types/interfaces';

/**
 * List of potentially dangerous file extensions
 */
const DANGEROUS_EXTENSIONS = [
  // Executable files
  'exe', 'dll', 'com', 'bat', 'cmd', 'vbs', 'js', 'jse', 'ws', 'wsf', 'wsc', 'wsh',
  'msc', 'scr', 'ps1', 'msi', 'msp', 'hta', 'cpl', 'jar', 'vb', 'vbe',
  // Script files
  'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'pht', 'phar', 'asp',
  'aspx', 'cer', 'csr', 'jsp', 'jspx', 'cfm', 'cfml', 'py', 'pl', 'cgi',
  // Other potentially dangerous files
  'sh', 'bash', 'zsh', 'ksh', 'ade', 'adp', 'app', 'application', 'gadget',
  'inf', 'ins', 'isp', 'lnk', 'msh', 'msh1', 'msh2', 'mshxml', 'msh1xml',
  'msh2xml', 'prf', 'prg', 'reg', 'scf', 'sct', 'shb', 'shs', 'url', 'xbap'
];

/**
 * Validates and sanitizes a file
 * @param filePath Path to the uploaded file
 * @param originalName Original name of the file
 * @param mimeType MIME type of the file
 * @returns Sanitized file information
 * @throws FileUploadError if file is invalid or dangerous
 */
export const sanitizeFile = async (
  filePath: string,
  originalName: string,
  mimeType: string
): Promise<SanitizedFileInfo> => {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new FileUploadError('File not found', 404);
  }
  
  // Get file stats
  const stats = fs.statSync(filePath);
  
  // Check if it's actually a file
  if (!stats.isFile()) {
    throw new FileUploadError('Not a valid file', 400);
  }
  
  // Get file extension and check if it's dangerous
  const extension = path.extname(originalName).toLowerCase().replace('.', '');
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    // Delete the file
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Error deleting dangerous file:', error);
    }
    
    throw new FileUploadError('File type not allowed for security reasons', 400);
  }
  
  // Calculate file hash for integrity verification
  const hash = await calculateFileHash(filePath);
  
  // Generate a sanitized filename
  const sanitizedName = `${crypto.randomBytes(16).toString('hex')}${extension ? '.' + extension : ''}`;
  
  return {
    originalName,
    sanitizedName,
    extension,
    mimeType,
    size: stats.size,
    hash
  };
};

/**
 * Calculates SHA-256 hash of a file
 * @param filePath Path to the file
 * @returns SHA-256 hash as hex string
 */
const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

/**
 * Checks if a file is potentially malicious based on its magic bytes
 * This is a basic implementation - for production, consider using a library like file-type
 * @param filePath Path to the file
 * @returns True if file appears malicious
 */
export const detectMaliciousFile = async (filePath: string): Promise<boolean> => {
  try {
    // Read first 8 bytes of the file to check magic numbers
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    
    // Check for executable file signatures
    // Windows PE (EXE, DLL)
    if (buffer.toString('hex', 0, 2) === '4d5a') {
      return true;
    }
    
    // ELF (Linux executables)
    if (buffer.toString('hex', 0, 4) === '7f454c46') {
      return true;
    }
    
    // Mach-O (macOS executables)
    if (['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe'].includes(buffer.toString('hex', 0, 4))) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error detecting malicious file:', error);
    return true; // Fail safe - if we can't check, assume it's malicious
  }
};
