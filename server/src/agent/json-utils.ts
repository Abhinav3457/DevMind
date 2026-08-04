/**
 * Robustly extract a JSON object or array from LLM output that may be wrapped
 * in prose, markdown code fences, or trailing explanation text.
 */
export function extractJson<T>(text: string): T | null {
  const LF = String.fromCharCode(10);
  let cleaned = text.trim();

  // Strip markdown code fences if present (```json ... ```)
  const firstFence = cleaned.indexOf('```');
  if (firstFence !== -1) {
    const afterOpen = cleaned.indexOf(LF, firstFence);
    const lastFence = cleaned.lastIndexOf('```');
    if (afterOpen !== -1 && lastFence > afterOpen) {
      cleaned = cleaned.slice(afterOpen + 1, lastFence).trim();
    }
  }

  // Try the whole cleaned text first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to block extraction
  }

  // Find the first balanced { ... } or [ ... ] block, respecting strings
  const BACKSLASH = 92;
  for (const open of ['{', '['] as const) {
    const close = open === '{' ? '}' : ']';
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch.charCodeAt(0) === BACKSLASH) escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === open) depth++;
      else if (ch === close) depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
