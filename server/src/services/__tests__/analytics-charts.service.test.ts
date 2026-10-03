import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../analytics.service';
import PracticeSubmission from '../../models/PracticeSubmission';
import IndexReport from '../../models/IndexReport';
import ImportedRepository from '../../models/ImportedRepository';

vi.mock('../../models/PracticeSubmission', () => ({ default: { find: vi.fn() } }));
vi.mock('../../models/IndexReport', () => ({ default: { find: vi.fn() } }));
vi.mock('../../models/ImportedRepository', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../models/ActivityLog', () => ({ default: { aggregate: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../models/IndexedFile', () => ({ default: { aggregate: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { aggregate: vi.fn() } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const VALID_USER_ID = '507f191e810c19729de860ea';

// Query chains: find → select → sort → lean, and findOne → select → lean.
function makeFindChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('AnalyticsService chart insights', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    service = new AnalyticsService();
    vi.clearAllMocks();
  });

  describe('getProblemsSolved', () => {
    it('returns zeroed defaults when there are no submissions', async () => {
      vi.mocked(PracticeSubmission.find).mockReturnValue(makeFindChain([]) as never);

      const result = await service.getProblemsSolved(VALID_USER_ID, 'daily');

      expect(result.total).toBe(0);
      expect(result.thisWeek).toBe(0);
      expect(result.points).toHaveLength(14);
      expect(result.points.every((p) => p.total === 0)).toBe(true);
    });

    it('counts a problem once on the day of its first acceptance', async () => {
      const createdAt = new Date();
      vi.mocked(PracticeSubmission.find).mockReturnValue(makeFindChain([
        { problemSlug: 'two-sum', difficulty: 'easy', createdAt },
        // second acceptance of the same problem must not double-count
        { problemSlug: 'two-sum', difficulty: 'easy', createdAt },
      ]) as never);

      const result = await service.getProblemsSolved(VALID_USER_ID, 'daily');

      expect(result.total).toBe(1);
      expect(result.thisWeek).toBe(1);
      expect(result.byDifficulty).toEqual({ easy: 1, medium: 0, hard: 0 });
      const today = result.points.find((p) => p.date === todayIso());
      expect(today?.total).toBe(1);
      expect(today?.easy).toBe(1);
    });

    it('splits multiple solves across difficulty and buckets', async () => {
      const yesterday = new Date(Date.now() - 86_400_000);
      vi.mocked(PracticeSubmission.find).mockReturnValue(makeFindChain([
        { problemSlug: 'a', difficulty: 'easy', createdAt: new Date() },
        { problemSlug: 'b', difficulty: 'medium', createdAt: yesterday },
        { problemSlug: 'c', difficulty: 'hard', createdAt: yesterday },
      ]) as never);

      const result = await service.getProblemsSolved(VALID_USER_ID, 'daily');

      expect(result.total).toBe(3);
      expect(result.byDifficulty).toEqual({ easy: 1, medium: 1, hard: 1 });
      const yesterdayPoint = result.points.find((p) => p.date === yesterday.toISOString().slice(0, 10));
      expect(yesterdayPoint?.total).toBe(2);
    });

    it('uses 12 buckets for weekly and monthly granularities', async () => {
      vi.mocked(PracticeSubmission.find).mockReturnValue(makeFindChain([]) as never);

      const weekly = await service.getProblemsSolved(VALID_USER_ID, 'weekly');
      const monthly = await service.getProblemsSolved(VALID_USER_ID, 'monthly');

      expect(weekly.points).toHaveLength(12);
      expect(weekly.granularity).toBe('weekly');
      expect(monthly.points).toHaveLength(12);
      expect(monthly.points[0].label).toMatch(/^[A-Z][a-z]{2} '\d{2}$/);
    });
  });

  describe('getReposIndexed', () => {
    it('returns an empty series when nothing has been indexed', async () => {
      vi.mocked(IndexReport.find).mockReturnValue(makeFindChain([]) as never);

      const result = await service.getReposIndexed(VALID_USER_ID);

      expect(result.total).toBe(0);
      expect(result.latest).toBeNull();
      expect(result.points).toEqual([]);
    });

    it('summarises a single indexed repository', async () => {
      const completedAt = new Date();
      vi.mocked(IndexReport.find).mockReturnValue(makeFindChain([
        { repositoryId: 'repo-1', completedAt, createdAt: completedAt },
      ]) as never);
      vi.mocked(ImportedRepository.findOne).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({ name: 'devmind', fullName: 'acme/devmind' }),
      } as never);

      const result = await service.getReposIndexed(VALID_USER_ID);

      expect(result.total).toBe(1);
      expect(result.latest?.name).toBe('devmind');
      expect(result.latest?.fullName).toBe('acme/devmind');
      // A full daily window is returned; today's bucket holds the single event.
      expect(result.points).toHaveLength(14);
      const today = result.points.find((p) => p.date === todayIso());
      expect(today?.count).toBe(1);
      expect(today?.cumulative).toBe(1);
    });

    it('builds a cumulative series across several indexed repositories', async () => {
      const first = new Date(Date.now() - 3 * 86_400_000);
      const second = new Date(Date.now() - 2 * 86_400_000);
      const third = new Date();
      vi.mocked(IndexReport.find).mockReturnValue(makeFindChain([
        { repositoryId: 'repo-1', completedAt: first, createdAt: first },
        { repositoryId: 'repo-2', completedAt: second, createdAt: second },
        { repositoryId: 'repo-3', completedAt: third, createdAt: third },
      ]) as never);
      vi.mocked(ImportedRepository.findOne).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({ name: 'third', fullName: 'acme/third' }),
      } as never);

      const result = await service.getReposIndexed(VALID_USER_ID);

      expect(result.total).toBe(3);
      expect(result.latest?.name).toBe('third');
      const final = result.points[result.points.length - 1];
      expect(final.cumulative).toBe(3);
      expect(result.points.reduce((sum, p) => sum + p.count, 0)).toBe(3);
    });

    it('honours an explicit granularity instead of auto-selecting one', async () => {
      const completedAt = new Date();
      vi.mocked(IndexReport.find).mockReturnValue(makeFindChain([
        { repositoryId: 'repo-1', completedAt, createdAt: completedAt },
      ]) as never);
      vi.mocked(ImportedRepository.findOne).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({ name: 'devmind', fullName: 'acme/devmind' }),
      } as never);

      const result = await service.getReposIndexed(VALID_USER_ID, 'monthly');

      // 12 monthly buckets, with today's event landing in the final bucket.
      expect(result.points).toHaveLength(12);
      expect(result.points[0].label).toMatch(/^[A-Z][a-z]{2} '\d{2}$/);
      const last = result.points[result.points.length - 1];
      expect(last.count).toBe(1);
      expect(last.cumulative).toBe(1);
    });
  });
});
