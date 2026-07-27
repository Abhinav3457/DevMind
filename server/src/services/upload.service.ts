import fs from 'fs/promises';
import cloudinary from '../config/cloudinary';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

interface UploadResult {
  url: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
}

interface UploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: Record<string, unknown>;
}

export class UploadService {
  async uploadFile(
    filePath: string,
    originalName: string,
    _mimeType: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const folder = options.folder || 'devmind-ai';

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder,
        public_id: options.publicId,
        resource_type: 'auto',
        ...options.transformation,
      });

      fs.unlink(filePath).catch((err) =>
        logger.warn('UploadService: Failed to delete temp file', err),
      );

      logger.info('UploadService: Uploaded ' + originalName + ' to Cloudinary');

      return {
        url: result.secure_url,
        publicId: result.public_id,
        originalName,
        mimeType: _mimeType,
        size: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    } catch (error) {
      fs.unlink(filePath).catch((err) =>
        logger.warn('UploadService: Failed to delete temp file', err),
      );

      const message = error instanceof Error ? error.message : String(error);
      logger.error('UploadService: Upload failed for ' + originalName, error);

      if (message.includes('Invalid file type')) {
        throw new ApiError(400, 'Invalid file type.');
      }
      if (message.includes('File size too large')) {
        throw new ApiError(400, 'File size exceeds 10MB limit.');
      }
      throw new ApiError(502, 'File upload failed. Please try again.');
    }
  }

  async uploadMultiple(
    files: { path: string; originalname: string; mimetype: string }[],
    options: UploadOptions = {},
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      const result = await this.uploadFile(file.path, file.originalname, file.mimetype, options);
      results.push(result);
    }
    return results;
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('UploadService: Deleted ' + publicId + ' from Cloudinary');
    } catch (error) {
      logger.error('UploadService: Failed to delete ' + publicId, error);
      throw new ApiError(502, 'Failed to delete file from Cloudinary.');
    }
  }

  async deleteMultiple(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;
    try {
      await cloudinary.api.delete_resources(publicIds);
      logger.info('UploadService: Deleted ' + publicIds.length + ' files from Cloudinary');
    } catch (error) {
      logger.error('UploadService: Failed to delete multiple files', error);
    }
  }
}

export const uploadService = new UploadService();
