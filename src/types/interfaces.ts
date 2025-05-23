/**
 * File-related interfaces for the Jogou Baixou application
 */

/**
 * Interface for sanitized file information
 */
export interface SanitizedFileInfo {
  originalName: string;
  sanitizedName: string;
  extension: string;
  mimeType: string;
  size: number;
  hash: string;
}

/**
 * Interface for file information stored in the system
 */
export interface FileInfo {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  uploadDate: Date;
  expiryDate: Date;
  downloadCount: number;
  accessToken?: string;
}

/**
 * Interface for file upload response
 */
export interface FileUploadResponse {
  id: string;
  fileId: string;
  originalName: string;
  size: number;
  expiryDate: Date;
  downloadUrl: string;
  message: string;
}

/**
 * Interface for file download response
 */
export interface FileDownloadResponse {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadDate: Date;
  expiryDate: Date;
  downloadCount: number;
}
