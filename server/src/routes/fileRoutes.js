import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getPresignedUrl, uploadLocalFile } from '../controllers/fileController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Vercel function filesystems are read-only (apart from ephemeral /tmp).
// Keep the local disk fallback for development; production file uploads use S3.
const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = path.resolve('uploads');
if (!isVercel && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

router.use(authenticate);

router.post('/presigned-url', getPresignedUrl);
router.post(
  '/upload-local',
  (req, res, next) => {
    if (isVercel) {
      return res.status(503).json({
        error: 'Local file uploads are unavailable in production. Configure S3 storage to enable attachments.',
      });
    }
    return next();
  },
  upload.single('file'),
  uploadLocalFile
);

export default router;
