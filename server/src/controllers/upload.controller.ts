import { Request, Response } from 'express';
import { uploadService } from '../services/upload.service';
import Upload from '../models/Upload';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export class UploadController {
  async uploadSingle(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided' });
      return;
    }

    const result = await uploadService.uploadFile(
      file.path,
      file.originalname,
      file.mimetype,
      { folder: 'devmind-ai/uploads' },
    );

    // Persist upload metadata to MongoDB
    const uploadDoc = await Upload.create({
      userId: req.user!.userId,
      originalName: result.originalName,
      mimeType: result.mimeType,
      size: result.size,
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      width: result.width,
      height: result.height,
      folder: 'devmind-ai/uploads',
    });

    sendCreated(res, {
      message: 'File uploaded successfully',
      data: { file: { ...result, id: uploadDoc._id.toString() } },
    });
  }

  async uploadMultiple(req: Request, res: Response): Promise<void> {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'No files provided' });
      return;
    }

    const results = await uploadService.uploadMultiple(
      files.map((f) => ({
        path: f.path,
        originalname: f.originalname,
        mimetype: f.mimetype,
      })),
      { folder: 'devmind-ai/uploads' },
    );

    // Persist all upload metadata to MongoDB
    const uploadDocs = await Upload.insertMany(
      results.map((r) => ({
        userId: req.user!.userId,
        originalName: r.originalName,
        mimeType: r.mimeType,
        size: r.size,
        url: r.url,
        publicId: r.publicId,
        format: r.format,
        width: r.width,
        height: r.height,
        folder: 'devmind-ai/uploads',
      })),
    );

    const filesWithIds = results.map((r, i) => ({
      ...r,
      id: uploadDocs[i]?._id.toString() || '',
    }));

    sendCreated(res, {
      message: results.length + ' file(s) uploaded successfully',
      data: { files: filesWithIds },
    });
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    const { publicId } = req.body;
    if (!publicId) {
      res.status(400).json({ success: false, message: 'Public ID is required' });
      return;
    }

    await uploadService.deleteFile(publicId);

    // Remove metadata from MongoDB
    await Upload.findOneAndDelete({ publicId, userId: req.user!.userId });

    sendSuccess(res, {
      statusCode: 200,
      message: 'File deleted successfully',
    });
  }
}

export const uploadController = new UploadController();
