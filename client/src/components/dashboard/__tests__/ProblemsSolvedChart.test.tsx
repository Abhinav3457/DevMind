import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ProblemsSolvedData } from '../../../services/analytics';
import { ProblemsSolvedChart } from '../ProblemsSolvedChart';

// Chart.js needs a real canvas, which jsdom lacks. Swap it for a lightweight
// stub that records the props so we can assert on the rendered data.
const chartSpy = vi.hoisted(() => ({ line: [] as Array<{ data: { labels: string[] } }> }));

vi.mock('react-chartjs-2', async () => {
  const React = await import('react');
  return {
    Line: (props: { data: { labels: string[] } }) => {
      chartSpy.line.push(props);
      return React.createElement('div', { 'data-testid': 'line-chart' });
    },
  };
});

const POPULATED: ProblemsSolvedData = {
  granularity: 'daily',
  total: 3,
  thisWeek: 2,
  byDifficulty: { easy: 1, medium: 1, hard: 1 },
  points: [
    { label: '10/01', date: '2026-10-01', total: 1, easy: 1, medium: 0, hard: 0 },
    { label: '10/02', date: '2026-10-02', total: 2, easy: 0, medium: 1, hard: 1 },
  ],
};

const EMPTY: ProblemsSolvedData = {
  granularity: 'daily',
  total: 0,
  thisWeek: 0,
  byDifficulty: { easy: 0, medium: 0, hard: 0 },
  points: [
    { label: '10/01', date: '2026-10-01', total: 0, easy: 0, medium: 0, hard: 0 },
    { label: '10/02', date: '2026-10-02', total: 0, easy: 0, medium: 0, hard: 0 },
  ],
};

type Props = Partial<ComponentProps<typeof ProblemsSolvedChart>>;

function renderChart(overrides: Props = {}) {
  const onGranularityChange = vi.fn();
  const result = render(
    <MemoryRouter>
      <ProblemsSolvedChart
        loading={false}
        granularity="daily"
        onGranularityChange={onGranularityChange}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { ...result, onGranularityChange };
}

describe('ProblemsSolvedChart', () => {
  beforeEach(() => {
    chartSpy.line.length = 0;
  });

  it('renders a skeleton while loading', () => {
    const { container } = renderChart({ loading: true });

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('No problems solved yet')).not.toBeInTheDocument();
  });

  it('shows the empty state with a link to the practice arena', () => {
    renderChart({ data: EMPTY });

    expect(screen.getByText('No problems solved yet')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /try the practice arena/i });
    expect(link).toHaveAttribute('href', '/practice');
  });

  it('renders the summary and chart when data is present', () => {
    renderChart({ data: POPULATED });

    expect(screen.getByText('Total solved')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(chartSpy.line[chartSpy.line.length - 1]?.data.labels).toEqual(['10/01', '10/02']);
  });

  it('reports granularity changes from the toggle', () => {
    const { onGranularityChange } = renderChart({ data: POPULATED });

    fireEvent.click(screen.getByRole('button', { name: 'weekly' }));
    expect(onGranularityChange).toHaveBeenCalledWith('weekly');

    fireEvent.click(screen.getByRole('button', { name: 'monthly' }));
    expect(onGranularityChange).toHaveBeenCalledWith('monthly');
  });

  it('shows a period message when total is non-zero but the window is empty', () => {
    renderChart({
      data: {
        ...POPULATED,
        points: POPULATED.points.map((point) => ({ ...point, total: 0, easy: 0, medium: 0, hard: 0 })),
      },
    });

    expect(screen.getByText('No solves in this period')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('shows an error message when the request fails', () => {
    renderChart({ error: true });

    expect(screen.getByText("Couldn't load practice analytics")).toBeInTheDocument();
  });
});
