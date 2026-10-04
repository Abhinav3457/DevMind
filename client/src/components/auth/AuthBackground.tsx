import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { LOGIN_SNIPPETS } from './authSnippets';
import type { CodeSnippets } from './authSnippets';
import { useUIStore } from '../../store';

const TYPE_INTERVAL = 16;
const CHUNK = 3;
const PAUSE_AFTER_DONE = 2000;
const MAX_LINES = 50;
const GUTTER_WIDTH = 40;
const GUTTER_GAP = 16;
const COLUMN_STAGGER = 1400;
const MONO_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

type Palette = {
  base: string;
  keyword: string;
  string: string;
  comment: string;
  fn: string;
  lineNumber: string;
  cursor: string;
};

/* Muted tones so the code reads as ambient depth, not decoration */
const DARK_PALETTE: Palette = {
  base: 'rgba(148,163,184,0.55)',
  keyword: 'rgba(129,140,248,0.75)',
  string: 'rgba(110,231,183,0.6)',
  comment: 'rgba(100,116,139,0.5)',
  fn: 'rgba(96,165,250,0.7)',
  lineNumber: 'rgba(100,116,139,0.4)',
  cursor: 'rgba(96,165,250,0.85)',
};

/* Deeper, higher-alpha tones so the same code stays visible on light pages */
const LIGHT_PALETTE: Palette = {
  base: 'rgba(71,85,105,0.62)',
  keyword: 'rgba(79,70,229,0.6)',
  string: 'rgba(5,150,105,0.55)',
  comment: 'rgba(100,116,139,0.55)',
  fn: 'rgba(37,99,235,0.6)',
  lineNumber: 'rgba(100,116,139,0.55)',
  cursor: 'rgba(37,99,235,0.8)',
};

const TOKEN_RE =
  /('[^']*'|"[^"]*")|\b(const|let|var|await|async|function|return|if|else|for|while|new|import|from|export|class|typeof|this|of|in)\b|^(\$)|\b([A-Za-z_$][\w$]*)(?=\s*\()/g;

function windowLines(s: string) {
  const lines = s.split('\n');
  return lines.length > MAX_LINES ? lines.slice(-MAX_LINES).join('\n') : s;
}

function highlightLine(line: string, colors: Palette): ReactNode[] {
  let commentAt = -1;
  let quote: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '/' && line[i + 1] === '/') {
      commentAt = i;
      break;
    }
  }

  const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt >= 0 ? line.slice(commentAt) : '';

  const nodes: ReactNode[] = [];
  let key = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) nodes.push(code.slice(last, m.index));
    const color = m[1] ? colors.string : m[2] ? colors.keyword : m[3] ? colors.comment : colors.fn;
    nodes.push(
      <span key={`t${key++}`} style={{ color }}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) TOKEN_RE.lastIndex++;
  }
  if (last < code.length) nodes.push(code.slice(last));
  if (comment) {
    nodes.push(
      <span key={`c${key}`} style={{ color: colors.comment }}>
        {comment}
      </span>,
    );
  }
  return nodes;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return reduced;
}

/** Types one endless stream, appending snippets and scrolling a recent-lines window. */
function TypingCodeBlock({
  snippets,
  prefersReducedMotion,
  colors,
  startDelay = 0,
}: {
  snippets: string[];
  prefersReducedMotion: boolean;
  colors: Palette;
  startDelay?: number;
}) {
  const [text, setText] = useState(() =>
    prefersReducedMotion ? windowLines(snippets.join('\n\n')) : '',
  );
  const bufferRef = useRef('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setText(windowLines(snippets.join('\n\n')));
      return;
    }

    let cancelled = false;
    let snippetIndex = 0;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const typeNext = () => {
      if (cancelled) return;
      const snippet = snippets[snippetIndex % snippets.length];
      snippetIndex += 1;
      if (snippet === undefined) return;
      const prefix = bufferRef.current;
      let done = 0;

      const step = () => {
        if (cancelled) return;
        done = Math.min(done + CHUNK, snippet.length);
        setText(windowLines(prefix + snippet.slice(0, done)));

        if (done >= snippet.length) {
          bufferRef.current = prefix + snippet + '\n\n';
          timerRef.current = window.setTimeout(typeNext, PAUSE_AFTER_DONE);
        } else {
          timerRef.current = window.setTimeout(step, TYPE_INTERVAL);
        }
      };

      timerRef.current = window.setTimeout(step, TYPE_INTERVAL);
    };

    timerRef.current = window.setTimeout(typeNext, startDelay);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [snippets, prefersReducedMotion, startDelay]);

  const lines = text.length > 0 ? text.split('\n') : [''];

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="dm-line">
          <span
            className="dm-line-no"
            style={{ width: GUTTER_WIDTH, paddingRight: GUTTER_GAP, color: colors.lineNumber }}
          >
            {i + 1}
          </span>
          <span className="dm-line-code">
            {highlightLine(line, colors)}
            {i === lines.length - 1 && !prefersReducedMotion && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: '1em',
                  marginLeft: 2,
                  verticalAlign: '-0.15em',
                  backgroundColor: colors.cursor,
                  animation: 'dm-blink 1s steps(1) infinite',
                }}
              />
            )}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * Ambient background: two strictly left-aligned columns of code typing at
 * different times, covering the full viewport, softened by an edge fade mask.
 */
export function AuthCodeBackground({ snippets = LOGIN_SNIPPETS }: { snippets?: CodeSnippets }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const theme = useUIStore((s) => s.theme);
  const colors = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        userSelect: 'none',
        fontFamily: MONO_FONT,
        fontSize: 15,
        lineHeight: 1.75,
        color: colors.base,
        opacity: theme === 'light' ? 1 : 0.92,
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum" 1',
        letterSpacing: 0,
      }}
    >
      <style>{`
        @keyframes dm-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .dm-code {
          -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12%, #000 88%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0, #000 12%, #000 88%, transparent 100%);
        }
        .dm-col {
          position: absolute;
          top: 0;
          bottom: 0;
          overflow: hidden;
          padding: 16px 24px;
          box-sizing: border-box;
        }
        .dm-col-a { left: 0; width: 50%; padding-left: 20px; }
        .dm-col-b { left: 50%; width: 50%; padding-left: 36px; }
        .dm-line { display: flex; align-items: baseline; }
        .dm-line-no {
          flex: 0 0 auto;
          text-align: right;
          user-select: none;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1;
        }
        .dm-line-code { white-space: pre; min-width: 0; }
        @media (max-width: 767px) {
          .dm-code { font-size: 11px; }
          .dm-col-a { width: 100%; padding-left: 14px; padding-right: 14px; }
          .dm-col-b { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dm-line-code span { animation: none !important; }
        }
      `}</style>

      {/* Left column: code stream */}
      <div className="dm-code absolute inset-0 overflow-hidden">
        <div className="dm-col dm-col-a">
          <TypingCodeBlock
            snippets={snippets.blockA}
            prefersReducedMotion={prefersReducedMotion}
            colors={colors}
            startDelay={0}
          />
        </div>

        {/* Right column: terminal / helper stream, typed on a stagger */}
        <div className="dm-col dm-col-b">
          <TypingCodeBlock
            snippets={snippets.blockB}
            prefersReducedMotion={prefersReducedMotion}
            colors={colors}
            startDelay={COLUMN_STAGGER}
          />
        </div>
      </div>
    </div>
  );
}
