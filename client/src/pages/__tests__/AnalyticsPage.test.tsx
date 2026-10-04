import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsPage } from '../AnalyticsPage';
import { fetchAnalytics } from '../../services/analytics';
import type { AnalyticsData } from '../../types';

// Chart.js needs a real canvas, which jsdom lacks — stub the chart components.
vi.mock('react-chartjs-2', async () => {
  const React = await import('react');
  return {
    Line: () => React.createElement('div', { 'data-testid': 'line-chart' }),
    Doughnut: () => React.createElement('div', { 'data-testid': 'doughnut-chart' }),
  };
});

vi.mock('../../services/analytics', () => ({
  fetchAnalytics: vi.fn(),
}));

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { data: { reports: [] } } }) },
}));

const days = Array.from({ length: 14 }, (_, i) => `10/${String(i + 1).padStart(2, '0')}`);

const FIXTURE: AnalyticsData = {
  overview: {
    repositories: 6,
    indexedRepos: 4,
    totalFiles: 512,
    totalChunks: 3200,
    aiOperations: 4,
  },
  languages: [
    { name: 'typescript', files: 300, percentage: 60, color: '#3178c6' },
    { name: 'python', files: 200, percentage: 40, color: '#3572A5' },
  ],
  linesOfCode: {
    total: 48000,
    byLanguage: [
      { language: 'typescript', lines: 30000, files: 300 },
      { language: 'python', lines: 18000, files: 200 },
    ],
  },
  repositoryHealth: {
    score: 84,
    level: 'excellent',
    metrics: {
      indexed: { value: 4, max: 10 },
      documented: { value: 3, max: 10 },
      analyzed: { value: 4, max: 10 },
      chunks: { value: 3200, max: 3200 },
    },
  },
  quality: {
    securityIssues: 0,
    bugCount: 1,
    reviewScore: 84,
    documentationCoverage: 75,
  },
  activity: {
    recentIndexes: 4,
    totalAiQueries: 4,
    avgReviewScore: 84,
    activityScore: 128,
  },
  trend: {
    days,
    operations: [1, 2, 0, 3, 4, 0, 1, 2, 5, 0, 2, 3, 1, 4],
    indexes: [0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1],
    reviews: [1, 0, 0, 1, 1, 0, 1, 0, 2, 0, 1, 1, 0, 1],
    documents: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1],
    practice: [0, 0, 0, 1, 1, 0, 0, 0, 2, 0, 0, 1, 0, 1],
  },
  operationBreakdown: [
    { type: 'repo_indexed', count: 12 },
    { type: 'review_completed', count: 8 },
    { type: 'doc_generated', count: 5 },
    { type: 'practice_solved', count: 3 },
    { type: 'legacy_event', count: 2 },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>,
  );
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAnalytics).mockResolvedValue(FIXTURE);
  });

  it('renders the hero, KPI cards and every analytics panel', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument());

    // KPI row (hero pill + stat card share some labels)
    expect(screen.getAllByText('Repositories').length).toBeGreaterThan(0);
    expect(screen.getByText('AI Operations')).toBeInTheDocument();

    // Panels
    expect(screen.getByText('Activity Trend')).toBeInTheDocument();
    expect(screen.getByText('Operation Mix')).toBeInTheDocument();
    expect(screen.getByText('Language Distribution')).toBeInTheDocument();
    expect(screen.getAllByText('Repository Health').length).toBeGreaterThan(0);
    expect(screen.getByText('Lines of Code by Language')).toBeInTheDocument();

    // Charts rendered from the fixture
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('doughnut-chart')).toHaveLength(2);

    // Operation mix falls back gracefully for unknown activity types
    expect(screen.getByText('legacy event')).toBeInTheDocument();
  });

  it('toggles trend series from the chips', async () => {
    renderPage();

    const reviewsChip = await screen.findByRole('button', { name: /Reviews/ });
    expect(reviewsChip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(reviewsChip);
    expect(reviewsChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the error state when analytics fail to load', async () => {
    vi.mocked(fetchAnalytics).mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Unable to load analytics')).toBeInTheDocument());
  });
});
