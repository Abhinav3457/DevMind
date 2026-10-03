import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ReposIndexedData } from '../../../services/analytics';
import { RepoIndexedChart } from '../RepoIndexedChart';

// Chart.js needs a real canvas, which jsdom lacks. Swap it for a lightweight
// stub that records the props so we can assert on the rendered data.
const chartSpy = vi.hoisted(() => ({ bar: [] as Array<{ data: { labels: string[] } }> }));

vi.mock('react-chartjs-2', async () => {
  const React = await import('react');
  return {
    Bar: (props: { data: { labels: string[] } }) => {
      chartSpy.bar.push(props);
      return React.createElement('div', { 'data-testid': 'bar-chart' });
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
  return render(
    <MemoryRouter>
      <RepoIndexedChart loading={false} {...overrides} />
    </MemoryRouter>,
  );
}

describe('RepoIndexedChart', () => {
  beforeEach(() => {
    chartSpy.bar.length = 0;
  });

  it('renders a skeleton while loading', () => {
    const { container } = renderChart({ loading: true });

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('shows the empty state with a link to import a repository', () => {
    renderChart({ data: EMPTY });

    expect(screen.getByText('No repositories indexed yet')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();

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

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(chartSpy.bar[chartSpy.bar.length - 1]?.data.labels).toEqual(['09/19', '09/20']);
  });

  it('handles a missing latest repository without breaking', () => {
    renderChart({ data: { ...POPULATED, latest: null } });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Latest index')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', () => {
    renderChart({ error: true });

    expect(screen.getByText("Couldn't load repository analytics")).toBeInTheDocument();
  });
});
