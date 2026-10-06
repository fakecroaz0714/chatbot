import path from 'path';
import fs from 'fs';
import {
  generatePresignedUploadUrl,
  generateStorageKey,
  getMessageTypeFromMime,
  validateFileMetadata,
} from '../services/s3Service.js';

export const getPresignedUrl = async (req, res, next) => {
  try {
    const { fileName, mimeType, fileSize } = req.body;

    if (!fileName || !mimeType) {
      return res.status(400).json({ error: 'fileName and mimeType are required.' });
    }

    const presignedData = await generatePresignedUploadUrl(fileName, mimeType, fileSize);
    const messageType = getMessageTypeFromMime(mimeType);

    return res.json({
      ...presignedData,
      messageType,
      fileName,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

export const uploadLocalFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { originalname, mimetype, size, filename } = req.file;

    // Validate
    validateFileMetadata(originalname, mimetype, size);

    const relativePath = `/uploads/${filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${relativePath}`;
    const messageType = getMessageTypeFromMime(mimetype);

    return res.json({
      fileUrl: fullUrl,
      fileName: originalname,
      fileSize: size,
      messageType,
      mimeType: mimetype,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
