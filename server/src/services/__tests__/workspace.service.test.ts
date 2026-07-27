import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { ApiError } from '../../utils/apiResponse';
import Workspace from '../../models/Workspace';
import WorkspaceMember from '../../models/WorkspaceMember';
import User from '../../models/User';

vi.mock('../../models/Workspace', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../../models/WorkspaceMember', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    deleteOne: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
  hasMinimumRole: vi.fn((userRole: string, minRole: string) => {
    const hierarchy: Record<string, number> = { owner: 100, admin: 80, member: 50, guest: 20 };
    return (hierarchy[userRole] || 0) >= (hierarchy[minRole] || 0);
  }),
  WORKSPACE_ROLES: ['owner', 'admin', 'member', 'guest'],
  ROLE_HIERARCHY: { owner: 100, admin: 80, member: 50, guest: 20 },
}));

vi.mock('../../models/User', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../models/ImportedRepository', () => ({
  default: {
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../models/IndexReport', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const WS_ID = '507f191e810c19729de860ea';
const USER_ID = '507f191e810c19729de860eb';
const OTHER_ID = '507f191e810c19729de860ec';
const INVITER_ID = '507f191e810c19729de860ed';

function createMockWorkspace(overrides = {}) {
  return {
    _id: WS_ID,
    id: WS_ID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    description: 'A test workspace',
    ownerId: USER_ID,
    isActive: true,
    plan: 'free',
    toJSON: vi.fn().mockReturnValue({
      _id: WS_ID,
      name: 'Test Workspace',
      slug: 'test-workspace',
      description: 'A test workspace',
      ownerId: USER_ID,
      isActive: true,
      plan: 'free',
    }),
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createMockMember(overrides = {}) {
  return {
    _id: 'member-1',
    workspaceId: WS_ID,
    userId: USER_ID,
    role: 'owner',
    invitedBy: INVITER_ID,
    joinedAt: new Date(),
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create workspace and owner membership', async () => {
      vi.mocked(Workspace.findOne).mockResolvedValue(null);
      const mockWs = createMockWorkspace();
      vi.mocked(Workspace.create).mockResolvedValue(mockWs as never);
      vi.mocked(WorkspaceMember.create).mockResolvedValue(createMockMember() as never);

            const result = await service.create({ name: 'Test', slug: 'test', ownerId: USER_ID });

      expect(Workspace.findOne).toHaveBeenCalledWith({ slug: 'test' });
      expect(Workspace.create).toHaveBeenCalled();
      expect(WorkspaceMember.create).toHaveBeenCalled();
      expect(result.userRole).toBe('owner');
      expect(result.memberCount).toBe(1);
    });

    it('should throw 409 if slug exists', async () => {
      vi.mocked(Workspace.findOne).mockResolvedValue(createMockWorkspace());
            await expect(service.create({ name: 'Test', slug: 'taken', ownerId: USER_ID })).rejects.toThrow('A workspace with this slug already exists');
    });
  });

  describe('getById', () => {
    it('should return workspace with role', async () => {
      const mockWs = createMockWorkspace();
      vi.mocked(Workspace.findById).mockResolvedValue(mockWs as never);
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember());
      vi.mocked(WorkspaceMember.countDocuments).mockResolvedValue(5);

      const result = await service.getById(WS_ID, USER_ID);

      expect(result.userRole).toBe('owner');
      expect(result.memberCount).toBe(5);
    });

    it('should throw 404 if workspace not found', async () => {
      vi.mocked(Workspace.findById).mockResolvedValue(null);
      await expect(service.getById(WS_ID, USER_ID)).rejects.toThrow('Workspace not found');
    });

    it('should throw 404 if workspace is archived', async () => {
      const mockWs = createMockWorkspace({ isActive: false });
      vi.mocked(Workspace.findById).mockResolvedValue(mockWs as never);
      await expect(service.getById(WS_ID, USER_ID)).rejects.toThrow('Workspace not found');
    });

    it('should throw 403 if user is not a member', async () => {
      const mockWs = createMockWorkspace();
      vi.mocked(Workspace.findById).mockResolvedValue(mockWs as never);
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(null);
      await expect(service.getById(WS_ID, OTHER_ID)).rejects.toThrow('You are not a member');
    });
  });

  describe('listByUser', () => {
    it('should return empty array if no memberships', async () => {
      vi.mocked(WorkspaceMember.find).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as never);
            const result = await service.listByUser(USER_ID);
      expect(result.workspaces).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('update', () => {
    it('should update workspace with admin role', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }));
      vi.mocked(Workspace.findByIdAndUpdate).mockResolvedValue(createMockWorkspace({ name: 'Updated' }) as never);

            const result = await service.update(WS_ID, USER_ID, { name: 'Updated' });

      expect(Workspace.findByIdAndUpdate).toHaveBeenCalledWith(
        WS_ID, { $set: { name: 'Updated' } }, expect.any(Object),
      );
    });

    it('should reject non-admin updates', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'guest' }));
            await expect(service.update(WS_ID, USER_ID, { name: 'X' })).rejects.toThrow(ApiError);
    });

    it('should reject updating ownerId', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'owner' }));
            await expect(service.update(WS_ID, USER_ID, { ownerId: OTHER_ID } as never)).rejects.toThrow('Cannot update "ownerId"');
    });
  });

  describe('archive / unarchive / delete', () => {
    it('should archive workspace (admin role)', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }));
      vi.mocked(Workspace.findByIdAndUpdate).mockResolvedValue(createMockWorkspace() as never);
            await service.archive(WS_ID, USER_ID);
      expect(Workspace.findByIdAndUpdate).toHaveBeenCalledWith(WS_ID, { isActive: false });
    });

    it('should unarchive workspace (owner only)', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'owner' }));
      vi.mocked(Workspace.findByIdAndUpdate).mockResolvedValue(createMockWorkspace() as never);
            await service.unarchive(WS_ID, USER_ID);
      expect(Workspace.findByIdAndUpdate).toHaveBeenCalledWith(WS_ID, { isActive: true });
    });

    it('should reject unarchive by non-owner', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }));
            await expect(service.unarchive(WS_ID, USER_ID)).rejects.toThrow(ApiError);
    });

    it('should delete workspace and members (owner only)', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'owner' }));
      const mockWs = createMockWorkspace();
      vi.mocked(Workspace.findByIdAndDelete).mockResolvedValue(mockWs as never);
      vi.mocked(WorkspaceMember.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);

            await service.delete(WS_ID, USER_ID);
      expect(Workspace.findByIdAndDelete).toHaveBeenCalledWith(WS_ID);
      expect(WorkspaceMember.deleteMany).toHaveBeenCalledWith({ workspaceId: WS_ID });
    });
  });
});
