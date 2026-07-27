import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from '../upload.service';
import { ApiError } from '../../utils/apiResponse';

const { mockCloudinaryUpload, mockCloudinaryDestroy, mockCloudinaryDeleteResources, mockUnlink } = vi.hoisted(() => ({
  mockCloudinaryUpload: vi.fn(),
  mockCloudinaryDestroy: vi.fn(),
  mockCloudinaryDeleteResources: vi.fn(),
  mockUnlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/cloudinary', () => ({
  default: {
    uploader: { upload: mockCloudinaryUpload, destroy: mockCloudinaryDestroy },
    api: { delete_resources: mockCloudinaryDeleteResources },
  },
}));

vi.mock('fs/promises', () => ({ default: { unlink: mockUnlink } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(() => {
    service = new UploadService();
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file to Cloudinary and return result', async () => {
      mockCloudinaryUpload.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/image.jpg',
        public_id: 'devmind-ai/test-abc',
        bytes: 1024, width: 800, height: 600, format: 'jpg',
      });

      const result = await service.uploadFile('/tmp/test.jpg', 'test.jpg', 'image/jpeg');

      expect(result.url).toBe('https://res.cloudinary.com/test/image.jpg');
      expect(result.publicId).toBe('devmind-ai/test-abc');
      expect(result.size).toBe(1024);
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/test.jpg');
    });

    it('should handle Cloudinary failure gracefully', async () => {
      mockCloudinaryUpload.mockRejectedValue(new Error('Upload failed'));
      await expect(service.uploadFile('/tmp/test.jpg', 'test.jpg', 'image/jpeg')).rejects.toThrow(ApiError);
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files', async () => {
      mockCloudinaryUpload.mockResolvedValue({ secure_url: 'https://example.com/file.jpg', public_id: 'id-abc', bytes: 512 });
      const files = [
        { path: '/tmp/a.jpg', originalname: 'a.jpg', mimetype: 'image/jpeg' },
        { path: '/tmp/b.png', originalname: 'b.png', mimetype: 'image/png' },
      ];
      const results = await service.uploadMultiple(files);
      expect(results).toHaveLength(2);
      expect(mockCloudinaryUpload).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile', () => {
    it('should delete file from Cloudinary', async () => {
      mockCloudinaryDestroy.mockResolvedValue({ result: 'ok' });
      await service.deleteFile('public-id-123');
      expect(mockCloudinaryDestroy).toHaveBeenCalledWith('public-id-123');
    });

    it('should handle deletion failure', async () => {
      mockCloudinaryDestroy.mockRejectedValue(new Error('Delete failed'));
      await expect(service.deleteFile('public-id-123')).rejects.toThrow(ApiError);
    });
  });

  describe('deleteMultiple', () => {
    it('should delete multiple files', async () => {
      mockCloudinaryDeleteResources.mockResolvedValue({ deleted: { a: 'deleted' } });
      await service.deleteMultiple(['id-1', 'id-2']);
      expect(mockCloudinaryDeleteResources).toHaveBeenCalledWith(['id-1', 'id-2']);
    });

    it('should skip empty array', async () => {
      await service.deleteMultiple([]);
      expect(mockCloudinaryDeleteResources).not.toHaveBeenCalled();
    });
  });
});
