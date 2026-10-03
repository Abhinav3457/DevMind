import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ReposIndexedData } from '../../../services/analytics';
import { RepoIndexedChart } from '../RepoIndexedChart';

// Chart.js needs a real canvas, which jsdom lacks. Swap it for a lightweight
// stub that records the props so we can assert on the rendered data.
const chartSpy = vi.hoisted(() => ({ line: [] as Array<{ data: { labels: string[]; datasets: Array<{ data: number[] }> } }> }));

vi.mock('react-chartjs-2', async () => {
  const React = await import('react');
  return {
    Line: (props: { data: { labels: string[]; datasets: Array<{ data: number[] }> } }) => {
      chartSpy.line.push(props);
      return React.createElement('div', { 'data-testid': 'line-chart' });
    },
  };
});

const INDEXED_AT = '2026-09-20T10:00:00.000Z';

const POPULATED: ReposIndexedData = {
  total: 2,
  latest: { name: 'devmind', fullName: 'acme/devmind', indexedAt: INDEXED_AT },
  points: [
    { label: '09/19', date: '2026-09-19', count: 1, cumulative: 1 },
    { label: '09/20', date: '2026-09-20', count: 1, cumulative: 2 },
  ],
};

const EMPTY: ReposIndexedData = { total: 0, latest: null, points: [] };

type Props = Partial<ComponentProps<typeof RepoIndexedChart>>;

function renderChart(overrides: Props = {}) {
  const onGranularityChange = vi.fn();
  const result = render(
    <MemoryRouter>
      <RepoIndexedChart
        loading={false}
        granularity="daily"
        onGranularityChange={onGranularityChange}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { ...result, onGranularityChange };
}

describe('RepoIndexedChart', () => {
  beforeEach(() => {
    chartSpy.line.length = 0;
  });

  it('renders a skeleton while loading', () => {
    const { container } = renderChart({ loading: true });

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('shows the empty state with a link to import a repository', () => {
    renderChart({ data: EMPTY });

    expect(screen.getByText('No repositories indexed yet')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /import a repository/i });
    expect(link).toHaveAttribute('href', '/github');
  });

  it('renders the summary and chart when data is present', () => {
    renderChart({ data: POPULATED });

    expect(screen.getByText('Total indexed')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('devmind')).toBeInTheDocument();

    const expectedDate = new Date(INDEXED_AT).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    expect(screen.getByText(`Latest · ${expectedDate}`)).toBeInTheDocument();

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    const chart = chartSpy.line[chartSpy.line.length - 1];
    expect(chart?.data.labels).toEqual(['09/19', '09/20']);
    // The chart plots how many repos were indexed on each date.
    expect(chart?.data.datasets[0]?.data).toEqual([1, 1]);
  });

  it('handles a missing latest repository without breaking', () => {
    renderChart({ data: { ...POPULATED, latest: null } });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Latest index')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('reports granularity changes from the toggle', () => {
    const { onGranularityChange } = renderChart({ data: POPULATED });

    fireEvent.click(screen.getByRole('button', { name: 'weekly' }));
    expect(onGranularityChange).toHaveBeenCalledWith('weekly');

    fireEvent.click(screen.getByRole('button', { name: 'monthly' }));
    expect(onGranularityChange).toHaveBeenCalledWith('monthly');
  });

  it('shows an error message when the request fails', () => {
    renderChart({ error: true });

    expect(screen.getByText("Couldn't load repository analytics")).toBeInTheDocument();
  });
});
