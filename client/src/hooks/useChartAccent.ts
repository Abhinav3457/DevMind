import { useMemo } from 'react';
import { useUIStore } from '../store';

export type ChartAccent =
  | 'blue'
  | 'cyan'
  | 'emerald'
  | 'teal'
  | 'amber'
  | 'purple'
  | 'rose'
  | 'indigo'
  | 'red';

type Rgb = readonly [number, number, number];

/**
 * Chart.js paints onto a canvas, which cannot parse CSS custom properties —
 * `rgb(var(--surface-400))` is silently rejected and the text/line falls back
 * to a dark default (invisible on a dark card). These maps mirror the
 * `surface` ramp in index.css and the accent shades used across the UI, and are
 * swapped when the theme flips. Keep them in sync with index.css.
 */
const DARK_ACCENTS: Record<ChartAccent, Rgb> = {
  blue: [96, 165, 250],
  cyan: [34, 211, 238],
  emerald: [52, 211, 153],
  teal: [45, 212, 191],
  amber: [251, 191, 36],
  purple: [192, 132, 252],
  rose: [251, 113, 133],
  indigo: [129, 140, 248],
  red: [248, 113, 113],
};

const LIGHT_ACCENTS: Record<ChartAccent, Rgb> = {
  blue: [37, 99, 235],
  cyan: [8, 145, 178],
  emerald: [5, 150, 105],
  teal: [13, 148, 136],
  amber: [217, 119, 6],
  purple: [147, 51, 234],
  rose: [225, 29, 72],
  indigo: [79, 70, 229],
  red: [220, 38, 38],
};

type SurfaceLevel = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

const DARK_SURFACES: Record<SurfaceLevel, Rgb> = {
  50: [250, 250, 250],
  100: [245, 245, 245],
  200: [229, 229, 229],
  300: [212, 212, 212],
  400: [163, 163, 163],
  500: [115, 115, 115],
  600: [82, 82, 82],
  700: [64, 64, 64],
  800: [38, 38, 38],
  900: [23, 23, 23],
  950: [10, 10, 10],
};

const LIGHT_SURFACES: Record<SurfaceLevel, Rgb> = {
  50: [10, 10, 10],
  100: [23, 23, 23],
  200: [38, 38, 38],
  300: [64, 64, 64],
  400: [82, 82, 82],
  500: [115, 115, 115],
  600: [163, 163, 163],
  700: [212, 212, 212],
  800: [229, 229, 229],
  900: [245, 245, 245],
  950: [250, 250, 250],
};

function toCss([r, g, b]: Rgb, alpha: number): string {
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolve an accent color from the active theme. The returned function is
 * recreated only when the theme changes, so it is safe as a `useMemo` dep.
 */
export function useChartAccent() {
  const theme = useUIStore((s) => s.theme);

  return useMemo(() => {
    const palette = theme === 'light' ? LIGHT_ACCENTS : DARK_ACCENTS;
    return (accent: ChartAccent, alpha = 1) => toCss(palette[accent], alpha);
  }, [theme]);
}

/**
 * Resolve a `surface` color (tooltips, axes, grids, borders) from the active
 * theme so canvas-drawn chrome matches the surrounding UI in both themes.
 */
export function useChartSurface() {
  const theme = useUIStore((s) => s.theme);

  return useMemo(() => {
    const palette = theme === 'light' ? LIGHT_SURFACES : DARK_SURFACES;
    return (level: SurfaceLevel, alpha = 1) => toCss(palette[level], alpha);
  }, [theme]);
}
