import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { ApiError } from '../../utils/apiResponse';
import Workspace from '../../models/Workspace';
import WorkspaceMember from '../../models/WorkspaceMember';
import WorkspaceInvite from '../../models/WorkspaceInvite';
import Notification from '../../models/Notification';
import User from '../../models/User';
import { sendWorkspaceInviteEmail } from '../../helpers/email.helper';

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

vi.mock('../../models/WorkspaceInvite', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

vi.mock('../../models/Notification', () => ({
  default: { create: vi.fn() },
}));

vi.mock('../../models/User', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../helpers/email.helper', () => ({
  sendWorkspaceInviteEmail: vi.fn().mockResolvedValue(undefined),
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

function createMockInvite(overrides = {}) {
  return {
    _id: 'invite-1',
    workspaceId: WS_ID,
    inviterId: INVITER_ID,
    email: 'friend@example.com',
    role: 'member',
    status: 'pending',
    token: 'token-123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
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

  describe('listMembers', () => {
    it('returns members with real user ids', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }) as never);
      vi.mocked(WorkspaceMember.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([
            {
              _id: 'member-1',
              workspaceId: WS_ID,
              userId: { _id: USER_ID, name: 'Test User', email: 'test@example.com', avatar: null },
              role: 'admin',
              joinedAt: new Date(),
            },
          ]),
        }),
      } as never);

      const result = await service.listMembers(WS_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: USER_ID,
        name: 'Test User',
        email: 'test@example.com',
      });
      expect(result[0].userId).not.toBe('[object Object]');
    });

    it('falls back gracefully when the populated user is null (no crash)', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }) as never);
      vi.mocked(WorkspaceMember.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([
            {
              _id: 'member-1',
              workspaceId: WS_ID,
              userId: null,
              role: 'member',
              joinedAt: new Date(),
            },
          ]),
        }),
      } as never);

      const result = await service.listMembers(WS_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('');
      expect(result[0].name).toBe('Unknown');
    });
  });

  describe('getActivityTimeline', () => {
    it('should return activities with real user ids (not "[object Object]")', async () => {
      const populatedMembers = [
        {
          workspaceId: WS_ID,
          userId: {
            _id: USER_ID,
            name: 'Test User',
            email: 'test@example.com',
          },
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ];
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember() as never);
      vi.mocked(WorkspaceMember.countDocuments).mockResolvedValue(1);
      vi.mocked(WorkspaceMember.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(populatedMembers),
              }),
            }),
          }),
        }),
      } as never);

      const result = await service.getActivityTimeline(WS_ID, USER_ID);

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0]).toMatchObject({
        type: 'member_joined',
        description: 'Test User',
        userId: USER_ID,
      });
      expect(result.activities[0].userId).not.toBe('[object Object]');
    });

    it('should fall back gracefully when populated user is null', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember() as never);
      vi.mocked(WorkspaceMember.countDocuments).mockResolvedValue(1);
      vi.mocked(WorkspaceMember.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                  {
                    workspaceId: WS_ID,
                    userId: null,
                    joinedAt: new Date(),
                  },
                ]),
              }),
            }),
          }),
        }),
      } as never);

      const result = await service.getActivityTimeline(WS_ID, USER_ID);

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].description).toBe('A user');
      expect(result.activities[0].userId).toBe('');
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

  describe('sendInvitation', () => {
    it('creates a pending invite, notifies registered users, and sends an email', async () => {
      // First findOne call: permission check (admin). Second: "already a member" check → null.
      vi.mocked(WorkspaceMember.findOne)
        .mockResolvedValueOnce(createMockMember({ role: 'admin' }) as never)
        .mockResolvedValueOnce(null);
      vi.mocked(User.findOne).mockResolvedValue({ _id: OTHER_ID, name: 'Friend', email: 'friend@example.com' } as never);
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(null);
      vi.mocked(WorkspaceInvite.create).mockResolvedValue(createMockInvite() as never);
      vi.mocked(Workspace.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(createMockWorkspace()) } as never);
      vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue({ name: 'Owner' }) } as never);
      vi.mocked(Notification.create).mockResolvedValue({} as never);

      const result = await service.sendInvitation(WS_ID, INVITER_ID, 'friend@example.com');

      expect(result.status).toBe('pending');
      expect(WorkspaceInvite.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'friend@example.com' }));
      expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: OTHER_ID,
        type: 'workspace_invite',
      }));
      expect(sendWorkspaceInviteEmail).toHaveBeenCalledWith(
        'friend@example.com', 'Owner', 'Test Workspace',
        expect.stringContaining('/invitations/token-123'),
        expect.stringContaining('action=decline'),
      );
    });

    it('rejects when the invited user is already a member', async () => {
      vi.mocked(WorkspaceMember.findOne)
        .mockResolvedValueOnce(createMockMember({ role: 'admin' }) as never)
        .mockResolvedValueOnce(createMockMember({ role: 'member' }) as never);
      vi.mocked(User.findOne).mockResolvedValue({ _id: OTHER_ID, email: 'friend@example.com' } as never);

      await expect(service.sendInvitation(WS_ID, INVITER_ID, 'friend@example.com')).rejects.toThrow('already a member');
    });

    it('allows inviting an unregistered email (email sent, no notification)', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }) as never);
      vi.mocked(User.findOne).mockResolvedValue(null);
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(null);
      vi.mocked(WorkspaceInvite.create).mockResolvedValue(createMockInvite() as never);
      vi.mocked(Workspace.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(createMockWorkspace()) } as never);
      vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue({ name: 'Owner' }) } as never);

      const result = await service.sendInvitation(WS_ID, INVITER_ID, 'newuser@example.com');

      expect(result.email).toBe('newuser@example.com');
      expect(Notification.create).not.toHaveBeenCalled();
      expect(sendWorkspaceInviteEmail).toHaveBeenCalled();
    });

    it('rejects duplicate pending invitations for the same email', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }) as never);
      vi.mocked(User.findOne).mockResolvedValue(null);
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(createMockInvite() as never);

      await expect(service.sendInvitation(WS_ID, INVITER_ID, 'friend@example.com')).rejects.toThrow('already been sent');
    });

    it('rejects invitations from non-admin members', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'guest' }) as never);

      await expect(service.sendInvitation(WS_ID, INVITER_ID, 'friend@example.com')).rejects.toThrow(ApiError);
    });
  });

  describe('acceptInvitation', () => {
    it('adds the user as a member and marks the invite accepted', async () => {
      const mockInvite = createMockInvite();
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(mockInvite as never);
      vi.mocked(Workspace.findById).mockResolvedValue(createMockWorkspace() as never);
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(null);
      vi.mocked(WorkspaceMember.create).mockResolvedValue(createMockMember({ role: 'member' }) as never);
      vi.mocked(User.findById).mockResolvedValue({ _id: OTHER_ID, name: 'Friend', email: 'friend@example.com', avatar: null } as never);

      const result = await service.acceptInvitation('token-123', OTHER_ID, 'friend@example.com');

      expect(result.email).toBe('friend@example.com');
      expect(WorkspaceMember.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'member' }));
      expect(mockInvite.status).toBe('accepted');
      expect(mockInvite.save).toHaveBeenCalled();
    });

    it('rejects when the token is invalid', async () => {
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(null);

      await expect(service.acceptInvitation('bad-token', OTHER_ID, 'friend@example.com')).rejects.toThrow('Invitation not found');
    });

    it('rejects expired invitations', async () => {
      const mockInvite = createMockInvite({ expiresAt: new Date(Date.now() - 1000) });
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(mockInvite as never);

      await expect(service.acceptInvitation('token-123', OTHER_ID, 'friend@example.com')).rejects.toThrow('expired');
    });

    it('rejects when the invite email does not match the logged-in user', async () => {
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(createMockInvite() as never);

      await expect(service.acceptInvitation('token-123', OTHER_ID, 'someone-else@example.com')).rejects.toThrow('different email');
    });
  });

  describe('declineInvitation', () => {
    it('marks the invite as declined', async () => {
      const mockInvite = createMockInvite();
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(mockInvite as never);

      await service.declineInvitation('token-123', OTHER_ID, 'friend@example.com');

      expect(mockInvite.status).toBe('declined');
      expect(mockInvite.save).toHaveBeenCalled();
    });

    it('rejects when the email does not match', async () => {
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(createMockInvite() as never);

      await expect(service.declineInvitation('token-123', OTHER_ID, 'other@example.com')).rejects.toThrow('different email');
    });
  });

  describe('revokeInvitation', () => {
    it('deletes a pending invitation (admin)', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }) as never);
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(createMockInvite() as never);
      vi.mocked(WorkspaceInvite.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);

      await service.revokeInvitation(WS_ID, USER_ID, 'invite-1');

      expect(WorkspaceInvite.deleteOne).toHaveBeenCalled();
    });

    it('throws 404 when no pending invite matches', async () => {
      vi.mocked(WorkspaceMember.findOne).mockResolvedValue(createMockMember({ role: 'admin' }) as never);
      vi.mocked(WorkspaceInvite.findOne).mockResolvedValue(null);

      await expect(service.revokeInvitation(WS_ID, USER_ID, 'invite-1')).rejects.toThrow('Pending invitation not found');
    });
  });

  describe('listMyInvitations', () => {
    it('returns pending invitations with workspace and inviter names', async () => {
      vi.mocked(WorkspaceInvite.find).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: 'invite-1',
                workspaceId: WS_ID,
                email: 'me@example.com',
                role: 'member',
                status: 'pending',
                token: 'tok',
                expiresAt: new Date(),
                createdAt: new Date(),
                inviterId: { name: 'Owner' },
              },
            ]),
          }),
        }),
      } as never);
      vi.mocked(Workspace.find).mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: WS_ID, name: 'Test Workspace' }]) }),
      } as never);

      const result = await service.listMyInvitations(USER_ID, 'me@example.com');

      expect(result).toHaveLength(1);
      expect(result[0].workspaceName).toBe('Test Workspace');
      expect(result[0].inviterName).toBe('Owner');
    });
  });

  describe('getInvitationByToken', () => {
    it('returns invite details with workspace and inviter names', async () => {
      vi.mocked(WorkspaceInvite.findOne).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: 'invite-1',
            workspaceId: WS_ID,
            email: 'friend@example.com',
            role: 'member',
            status: 'pending',
            expiresAt: new Date(Date.now() + 100000),
            inviterId: { name: 'Owner' },
          }),
        }),
      } as never);
      vi.mocked(Workspace.findById).mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: WS_ID, name: 'Test Workspace', isActive: true }) }),
      } as never);

      const result = await service.getInvitationByToken('tok');

      expect(result.workspaceName).toBe('Test Workspace');
      expect(result.inviterName).toBe('Owner');
      expect(result.status).toBe('pending');
    });

    it('throws 404 when the invite is not found', async () => {
      vi.mocked(WorkspaceInvite.findOne).mockReturnValue({
        populate: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
      } as never);

      await expect(service.getInvitationByToken('nope')).rejects.toThrow('Invitation not found');
    });
  });
});
