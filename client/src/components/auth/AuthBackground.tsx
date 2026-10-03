import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { LOGIN_SNIPPETS } from './authSnippets';
import type { CodeSnippets } from './authSnippets';

const TYPE_INTERVAL = 32;
const PAUSE_AFTER_DONE = 2200;
const MONO_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const COLORS = {
  base: '#5b6070',
  keyword: '#a78bfa',
  string: '#6ee7b7',
  comment: '#4a5163',
  prompt: '#6ee7b7',
  fn: '#60a5fa',
  lineNumber: '#2a2c3a',
  cursor: '#60a5fa',
};

const TOKEN_RE =
  /('[^']*'|"[^"]*")|\b(const|let|var|await|async|function|return|if|else|for|while|new|import|from|export|class|typeof|this|of|in)\b|^(\$)|\b([A-Za-z_$][\w$]*)(?=\s*\()/g;

function highlightLine(line: string): ReactNode[] {
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
    const color = m[1]
      ? COLORS.string
      : m[2]
        ? COLORS.keyword
        : m[3]
          ? COLORS.prompt
          : COLORS.fn;
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
      <span key={`c${key}`} style={{ color: COLORS.comment }}>
        {comment}
      </span>,
    );
  }
  return nodes;
}

function TypingCodeBlock({
  snippets,
  startDelay,
  prefersReducedMotion,
}: {
  snippets: string[];
  startDelay: number;
  prefersReducedMotion: boolean;
}) {
  const [text, setText] = useState(() => (prefersReducedMotion ? snippets.join('\n\n') : ''));
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setText(snippets.join('\n\n'));
      return;
    }

    let cancelled = false;
    let index = 0;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const typeSnippet = (snippet: string) => {
      let charIndex = 0;
      setText('');

      const step = () => {
        if (cancelled) return;
        charIndex += 1;
        setText(snippet.slice(0, charIndex));

        if (charIndex >= snippet.length) {
          timerRef.current = window.setTimeout(() => {
            if (cancelled) return;
            index = (index + 1) % snippets.length;
            const next = snippets[index];
            if (next) typeSnippet(next);
          }, PAUSE_AFTER_DONE);
        } else {
          timerRef.current = window.setTimeout(step, TYPE_INTERVAL);
        }
      };

      timerRef.current = window.setTimeout(step, TYPE_INTERVAL);
    };

    timerRef.current = window.setTimeout(() => {
      const first = snippets[0];
      if (first) typeSnippet(first);
    }, startDelay);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [snippets, startDelay, prefersReducedMotion]);

  const lines = text.length > 0 ? text.split('\n') : [''];

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex' }}>
          <span
            style={{
              width: 26,
              flexShrink: 0,
              textAlign: 'right',
              paddingRight: 12,
              color: COLORS.lineNumber,
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {i + 1}
          </span>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {highlightLine(line)}
            {i === lines.length - 1 && !prefersReducedMotion && (
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: '1em',
                  marginLeft: 2,
                  verticalAlign: '-0.15em',
                  backgroundColor: COLORS.cursor,
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

export function AuthCodeBackground({
  prefersReducedMotion,
  snippets = LOGIN_SNIPPETS,
}: {
  prefersReducedMotion: boolean;
  snippets?: CodeSnippets;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        userSelect: 'none',
        fontFamily: MONO_FONT,
        fontSize: 13,
        lineHeight: 1.8,
        color: COLORS.base,
        backgroundColor: 'transparent',
      }}
    >
      <style>{`
        @keyframes dm-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes dm-glow-pulse { from { opacity: 0.8; } to { opacity: 1; } }
        .dm-code-block {
          position: absolute;
          white-space: pre-wrap;
          overflow: hidden;
          word-break: break-word;
        }
        @media (max-width: 819px) {
          .dm-code-block--b { display: none; }
        }
        @media (max-width: 767px) {
          .dm-code-block { font-size: 11px !important; width: calc(100% - 24px) !important; }
          .dm-card-glow { width: 260px !important; height: 260px !important; }
        }
      `}</style>

      <div className="dm-code-block dm-code-block--a" style={{ top: 32, left: 32, width: '45%' }}>
        <TypingCodeBlock
          snippets={snippets.blockA}
          startDelay={0}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>

      <div
        className="dm-code-block dm-code-block--b"
        style={{ bottom: 32, right: 16, width: '26%', maxWidth: 460 }}
      >
        <TypingCodeBlock
          snippets={snippets.blockB}
          startDelay={1000}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>
    </div>
  );
}

export function AuthVignette() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1]"
      aria-hidden="true"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(9,9,13,0.92) 0%, rgba(9,9,13,0.9) 30%, rgba(9,9,13,0) 72%)',
      }}
    />
  );
}

export function CardGlow({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <div
      className={`dm-card-glow pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
        prefersReducedMotion ? '' : 'animate-[dm-glow-pulse_7s_ease-in-out_infinite_alternate]'
      }`}
      aria-hidden="true"
      style={{
        background:
          'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(59,130,246,0.14) 45%, rgba(59,130,246,0) 70%)',
      }}
    />
  );
}
