import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../project.service';
import { ApiError } from '../../utils/apiResponse';
import Project from '../../models/Project';
import WorkspaceMember from '../../models/WorkspaceMember';

vi.mock('../../models/Project', () => ({
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
    find: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue([]) }),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const USER_ID = '507f191e810c19729de860ea';
const WS_ID = '507f191e810c19729de860eb';
const PROJ_ID = '507f191e810c19729de860ec';
const OTHER_ID = '507f191e810c19729de860ed';
const COLLAB_ID = '507f191e810c19729de860ee';

const mockObjectId = (id: string) => ({ toString: () => id });

function createMockProject(overrides = {}) {
  return {
    _id: PROJ_ID,
    name: 'Test Project',
    description: 'A test project',
    owner: mockObjectId(USER_ID),
    workspace: mockObjectId(WS_ID),
    collaborators: [] as { toString(): string }[],
    files: [],
    status: 'active',
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create project successfully', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue({ role: 'owner' } as never);
      vi.mocked(Project.findOne).mockResolvedValue(null);
      vi.mocked(Project.create).mockResolvedValue(createMockProject() as never);

      const result = await service.create({ name: 'New Project', workspaceId: WS_ID, ownerId: USER_ID });
      expect(Project.create).toHaveBeenCalled();
      expect(result.name).toBe('Test Project');
    });

    it('should throw 403 if not workspace member', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(null);
      await expect(service.create({ name: 'X', workspaceId: WS_ID, ownerId: OTHER_ID })).rejects.toThrow(ApiError);
    });

    it('should throw 409 if duplicate name in workspace', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue({ role: 'owner' } as never);
      vi.mocked(Project.findOne).mockResolvedValue(createMockProject() as never);
      await expect(service.create({ name: 'Existing', workspaceId: WS_ID, ownerId: USER_ID })).rejects.toThrow(ApiError);
    });
  });

  describe('getById', () => {
    it('should return project for owner', async () => {
      vi.mocked(Project.findById).mockResolvedValue(createMockProject() as never);
      const result = await service.getById(PROJ_ID, USER_ID);
      expect(result._id).toBe(PROJ_ID);
    });

    it('should throw 404 if not found', async () => {
      vi.mocked(Project.findById).mockResolvedValue(null);
      await expect(service.getById(PROJ_ID, USER_ID)).rejects.toThrow('Project not found');
    });
  });

  describe('update', () => {
    it('should update project by owner', async () => {
      vi.mocked(Project.findById).mockResolvedValue(createMockProject() as never);
      vi.mocked(Project.findByIdAndUpdate).mockResolvedValue(createMockProject({ name: 'Updated' }) as never);
      const result = await service.update(PROJ_ID, USER_ID, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should allow update by workspace admin', async () => {
      vi.mocked(Project.findById).mockResolvedValue(createMockProject({ owner: mockObjectId(OTHER_ID) }) as never);
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue({ role: 'admin' } as never);
      vi.mocked(Project.findByIdAndUpdate).mockResolvedValue(createMockProject({ name: 'Admin Updated' }) as never);
      const result = await service.update(PROJ_ID, OTHER_ID, { name: 'Admin Updated' });
      expect(result.name).toBe('Admin Updated');
    });

    it('should reject update by non-owner non-admin', async () => {
      vi.mocked(Project.findById).mockResolvedValue(createMockProject({ owner: mockObjectId(USER_ID) }) as never);
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue({ role: 'guest' } as never);
      await expect(service.update(PROJ_ID, OTHER_ID, { name: 'X' })).rejects.toThrow(ApiError);
    });
  });

  describe('hardDelete', () => {
    it('should hard delete by owner', async () => {
      vi.mocked(Project.findById).mockResolvedValue(createMockProject() as never);
      vi.mocked(Project.findByIdAndDelete).mockResolvedValue({} as never);
      await service.hardDelete(PROJ_ID, USER_ID);
      expect(Project.findByIdAndDelete).toHaveBeenCalledWith(PROJ_ID);
    });

    it('should reject hard delete by non-owner', async () => {
      vi.mocked(Project.findById).mockResolvedValue(createMockProject({ owner: mockObjectId(USER_ID) }) as never);
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue({ role: 'admin' } as never);
      await expect(service.hardDelete(PROJ_ID, OTHER_ID)).rejects.toThrow(ApiError);
    });
  });

  describe('addCollaborator', () => {
    it('should add collaborator by owner', async () => {
      const project = createMockProject({ collaborators: [], save: vi.fn().mockResolvedValue(true) });
      vi.mocked(Project.findById).mockResolvedValue(project as never);
      await service.addCollaborator(PROJ_ID, USER_ID, COLLAB_ID);
      expect(project.save).toHaveBeenCalled();
    });

    it('should reject duplicate collaborator', async () => {
      const project = createMockProject({ collaborators: [{ toString: () => COLLAB_ID }], save: vi.fn() });
      vi.mocked(Project.findById).mockResolvedValue(project as never);
      await expect(service.addCollaborator(PROJ_ID, USER_ID, COLLAB_ID)).rejects.toThrow(ApiError);
    });
  });
});
