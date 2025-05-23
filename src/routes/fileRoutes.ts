import express from 'express';
import { uploadFile, downloadFile, getFileInfo } from '../controllers/fileController';
import { upload } from '../middlewares/multerMiddleware';

const router = express.Router();

// Upload file route
router.post('/upload', upload.single('file'), uploadFile);

// Get file info
router.get('/file/:id', getFileInfo);

// Download file route
router.get('/download/:id', downloadFile);

export { router as fileRoutes };
