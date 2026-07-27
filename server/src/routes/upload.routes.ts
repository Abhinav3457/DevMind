import { Router } from 'express';
import fs from 'fs';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { uploadSingle, uploadMultiple, TEMP_DIR } from '../middleware/upload';
import { uploadController } from '../controllers/upload.controller';

const router = Router();

// Ensure temp directory exists on first use
fs.mkdir(TEMP_DIR, { recursive: true }, () => {
  // Directory created or already exists
});

router.use(authenticate);

// Single file upload
router.post('/single', uploadSingle, asyncHandler(uploadController.uploadSingle));

// Multiple file upload (up to 5)
router.post('/multiple', uploadMultiple, asyncHandler(uploadController.uploadMultiple));

// Avatar upload
router.post('/avatar', uploadSingle, asyncHandler(uploadController.uploadAvatar));

// Delete a file from Cloudinary
router.delete('/delete', asyncHandler(uploadController.deleteFile));

export default router;
