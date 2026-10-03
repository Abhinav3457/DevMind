import { useQuery } from '@tanstack/react-query';
import {
  fetchProblemsSolved,
  fetchReposIndexed,
  type ProblemsGranularity,
} from '../services/analytics';

/**
 * Problems solved over time for the dashboard chart.
 * `refreshKey` lets the parent force a refetch (e.g. the banner Refresh button)
 * without discarding the react-query cache.
 */
export function useProblemsSolved(granularity: ProblemsGranularity, refreshKey = 0) {
  return useQuery({
    queryKey: ['analytics', 'problems-solved', granularity, refreshKey],
    queryFn: () => fetchProblemsSolved(granularity),
  });
}

/** Repositories indexed over time for the dashboard chart. */
export function useReposIndexed(refreshKey = 0) {
  return useQuery({
    queryKey: ['analytics', 'repos-indexed', refreshKey],
    queryFn: () => fetchReposIndexed(),
  });
}
