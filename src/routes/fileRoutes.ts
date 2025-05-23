import express from 'express';
import { uploadFile, downloadFile, getFileInfo } from '../controllers/fileController';
import { upload } from '../middlewares/multerMiddleware';
import { preventPathTraversal, validateFileId, apiLimiter } from '../middlewares/securityMiddleware';

const router = express.Router();

// Upload file route with rate limiting
router.post('/upload', apiLimiter, upload.single('file') as any, uploadFile);

// Get file info with security validation
router.get('/file/:id', apiLimiter, validateFileId, preventPathTraversal, getFileInfo);

// Download file route with security validation
router.get('/download/:id', validateFileId, preventPathTraversal, downloadFile);

export { router as fileRoutes };
