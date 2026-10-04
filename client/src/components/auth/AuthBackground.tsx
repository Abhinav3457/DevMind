import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { LOGIN_SNIPPETS } from './authSnippets';
import type { CodeSnippets } from './authSnippets';
import { useUIStore } from '../../store';

const TYPE_INTERVAL = 16;
const CHUNK = 3;
const PAUSE_AFTER_DONE = 2000;
const MAX_LINES = 50;
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
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
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
}: {
  snippets: string[];
  prefersReducedMotion: boolean;
  colors: Palette;
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

    timerRef.current = window.setTimeout(typeNext, 0);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [snippets, prefersReducedMotion]);

  const lines = text.length > 0 ? text.split('\n') : [''];

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex' }}>
          <span
            style={{
              width: 30,
              flexShrink: 0,
              textAlign: 'right',
              paddingRight: 14,
              color: colors.lineNumber,
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {i + 1}
          </span>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
 * Ambient background: one snippet stream typed across the full viewport on a
 * single tilted plane, so the code covers the whole screen with 3D depth.
 */
export function AuthCodeBackground({ snippets = LOGIN_SNIPPETS }: { snippets?: CodeSnippets }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const theme = useUIStore((s) => s.theme);
  const colors = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  const stream = [...snippets.blockA, ...snippets.blockB];

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
        perspective: '1600px',
        perspectiveOrigin: '50% 50%',
      }}
    >
      <style>{`
        @keyframes dm-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @media (max-width: 767px) { .dm-code-full { font-size: 12px !important; } }
      `}</style>

      {/* Single full-screen plane, tipped back for depth */}
      <div
        className="dm-code-full h-full w-full overflow-hidden px-4 py-3 sm:px-8"
        style={{
          transform: 'rotateX(7deg) scale(1.06)',
          transformOrigin: 'center',
          opacity: theme === 'light' ? 1 : 0.9,
        }}
      >
        <TypingCodeBlock
          snippets={stream}
          prefersReducedMotion={prefersReducedMotion}
          colors={colors}
        />
      </div>
    </div>
  );
}
