import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

export const isS3Configured = Boolean(
  AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_S3_BUCKET
);

let s3Client = null;
if (isS3Configured) {
  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('[S3] AWS S3 Client configured for bucket:', AWS_S3_BUCKET);
} else {
  console.log('[S3] AWS S3 credentials not provided. Using local disk upload storage for development.');
}

/**
 * Generate randomized safe S3 key adhering to Section 20 security rules:
 * uploads/YYYY/MM/<random-uuid>.<ext>
 */
export const generateStorageKey = (originalName) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = path.extname(originalName).toLowerCase();
  const randomId = uuidv4();
  return `uploads/${year}/${month}/${randomId}${ext}`;
};

/**
 * Determine message type from mime type
 */
export const getMessageTypeFromMime = (mimeType) => {
  if (!mimeType) return 'FILE';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
};

/**
 * Allowed MIME types and max size validation (Section 20)
 */
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const validateFileMetadata = (fileName, mimeType, fileSize) => {
  if (fileSize && fileSize > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 25MB maximum limit.');
  }

  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.mp4', '.mov', '.webm',
    '.mp3', '.wav', '.ogg', '.m4a',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.txt'
  ];

  const ext = path.extname(fileName).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`File extension '${ext}' is not permitted.`);
  }

  return true;
};

/**
 * Generate Presigned S3 PUT URL for direct React -> S3 upload (Section 13)
 */
export const generatePresignedUploadUrl = async (fileName, mimeType, fileSize) => {
  validateFileMetadata(fileName, mimeType, fileSize);
  const key = generateStorageKey(fileName);

  if (!isS3Configured || !s3Client) {
    if (process.env.VERCEL) {
      const error = new Error(
        'File uploads are not configured for production. Configure AWS S3 storage to enable attachments.'
      );
      error.statusCode = 503;
      throw error;
    }

    return {
      isS3: false,
      key,
      uploadUrl: `/api/files/upload-local`,
      message: 'S3 not configured. Use local upload route.',
    };
  }

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 mins
  const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

  return {
    isS3: true,
    key,
    uploadUrl,
    fileUrl: publicUrl,
  };
};
