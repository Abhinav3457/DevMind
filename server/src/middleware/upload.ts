import multer from 'multer';
import path from 'path';
import type { Request } from 'express';
import { ApiError } from '../utils/apiResponse';

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/typescript',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Local storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
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
    cb(new ApiError(400, `File type ${file.mimetype} is not allowed`));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

// Single file upload
export const uploadSingle = upload.single('file');

// Multiple file upload
export const uploadMultiple = upload.array('files', 5);

// Upload fields
export const uploadFields = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'attachments', maxCount: 5 },
]);
