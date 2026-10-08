import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadController } from '../upload.controller';
import { ApiError } from '../../utils/apiResponse';

const { mockUploadFindOne, mockUploadDeleteOne, mockDeleteFile } = vi.hoisted(() => ({
  mockUploadFindOne: vi.fn(),
  mockUploadDeleteOne: vi.fn(),
  mockDeleteFile: vi.fn(),
}));

vi.mock('../../models/Upload', () => ({
  default: {
    findOne: mockUploadFindOne,
    deleteOne: mockUploadDeleteOne,
    create: vi.fn(),
    insertMany: vi.fn(),
  },
}));

vi.mock('../../services/upload.service', () => ({
  uploadService: {
    uploadFile: vi.fn(),
    uploadMultiple: vi.fn(),
    deleteFile: mockDeleteFile,
  },
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'user-123' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as never;
}

function createMockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as never;
}

describe('UploadController.deleteFile', () => {
  let controller: UploadController;

  beforeEach(() => {
    controller = new UploadController();
    vi.clearAllMocks();
  });

  it('deletes the Cloudinary asset and metadata row when the user owns the file', async () => {
    const req = createMockReq({ body: { publicId: 'devmind-ai/owned-123' } });
    const res = createMockRes();
    mockUploadFindOne.mockResolvedValue({ _id: 'upload-1', publicId: 'devmind-ai/owned-123' });
    mockDeleteFile.mockResolvedValue(undefined);
    mockUploadDeleteOne.mockResolvedValue({});

    await controller.deleteFile(req, res);

    // Ownership is checked first, scoped to the authenticated user
    expect(mockUploadFindOne).toHaveBeenCalledWith({
      publicId: 'devmind-ai/owned-123',
      userId: 'user-123',
    });
    expect(mockDeleteFile).toHaveBeenCalledWith('devmind-ai/owned-123');
    expect(mockUploadDeleteOne).toHaveBeenCalledWith({ _id: 'upload-1' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a cross-user deletion and never touches the other user\\u2019s Cloudinary asset', async () => {
    const req = createMockReq({ body: { publicId: 'devmind-ai/owned-by-user-A' } });
    const res = createMockRes();
    // No row matches publicId + this user => the file belongs to someone else
    mockUploadFindOne.mockResolvedValue(null);

    await expect(controller.deleteFile(req, res)).rejects.toThrow(ApiError);
    await expect(controller.deleteFile(req, res)).rejects.toThrow('File not found or access denied');

    expect(mockUploadFindOne).toHaveBeenCalledWith({
      publicId: 'devmind-ai/owned-by-user-A',
      userId: 'user-123',
    });
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockUploadDeleteOne).not.toHaveBeenCalled();
  });

  it('requires a publicId', async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    await controller.deleteFile(req, res);

    expect(mockUploadFindOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
