import multer from 'multer';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import type { Request } from 'express';
import { ApiError } from '../utils/apiResponse';

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/typescript',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Use a temp directory that gets cleaned up after Cloudinary upload
const TEMP_DIR = path.join(os.tmpdir(), 'devmind-uploads');

// Temporary local storage — files are deleted after Cloudinary upload
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type ${file.mimetype} is not allowed. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}`));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

// Single file upload (field name: 'file')
export const uploadSingle = upload.single('file');

// Multiple file upload (field name: 'files', max 5)
export const uploadMultiple = upload.array('files', 5);

// Upload fields
export const uploadFields = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'attachments', maxCount: 5 },
]);

export { TEMP_DIR };
