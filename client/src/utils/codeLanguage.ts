export interface CodeLanguage {
  value: string;
  label: string;
  ext: string;
  monaco: string;
}

// Must match the allow-list in server/src/validators/code-review.validator.ts
export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: 'typescript', label: 'TypeScript', ext: 'ts', monaco: 'typescript' },
  { value: 'javascript', label: 'JavaScript', ext: 'js', monaco: 'javascript' },
  { value: 'jsx', label: 'JSX', ext: 'jsx', monaco: 'javascript' },
  { value: 'tsx', label: 'TSX', ext: 'tsx', monaco: 'typescript' },
  { value: 'python', label: 'Python', ext: 'py', monaco: 'python' },
  { value: 'cpp', label: 'C++', ext: 'cpp', monaco: 'cpp' },
  { value: 'java', label: 'Java', ext: 'java', monaco: 'java' },
  { value: 'csharp', label: 'C#', ext: 'cs', monaco: 'csharp' },
  { value: 'go', label: 'Go', ext: 'go', monaco: 'go' },
  { value: 'rust', label: 'Rust', ext: 'rs', monaco: 'rust' },
  { value: 'html', label: 'HTML', ext: 'html', monaco: 'html' },
  { value: 'css', label: 'CSS', ext: 'css', monaco: 'css' },
  { value: 'scss', label: 'SCSS', ext: 'scss', monaco: 'scss' },
  { value: 'json', label: 'JSON', ext: 'json', monaco: 'json' },
  { value: 'sql', label: 'SQL', ext: 'sql', monaco: 'sql' },
  { value: 'graphql', label: 'GraphQL', ext: 'graphql', monaco: 'graphql' },
  { value: 'yaml', label: 'YAML', ext: 'yaml', monaco: 'yaml' },
  { value: 'dockerfile', label: 'Dockerfile', ext: '', monaco: 'dockerfile' },
  { value: 'bash', label: 'Bash', ext: 'sh', monaco: 'shell' },
  { value: 'markdown', label: 'Markdown', ext: 'md', monaco: 'markdown' },
];

const byValue = new Map(CODE_LANGUAGES.map((l) => [l.value, l]));

export function getLanguage(value: string): CodeLanguage {
  return byValue.get(value) || byValue.get('typescript')!;
}

export function fileForLanguage(value: string): string {
  const lang = getLanguage(value);
  return lang.ext ? `input.${lang.ext}` : 'Dockerfile';
}

type Rule = { value: string; test: (code: string) => boolean };

// Ordered: first match wins, so the most specific/quirky syntax comes first.
const RULES: Rule[] = [
  { value: 'bash', test: (c) => /^#!\s*\/.*\b(ba)?sh\b/m.test(c) },
  { value: 'dockerfile', test: (c) => /^\s*FROM\s+\S+/im.test(c) && /\b(RUN|COPY|CMD|WORKDIR|ENTRYPOINT)\b/m.test(c) },
  { value: 'html', test: (c) => /<!doctype\s+html|<html[\s>]|<body[\s>]/i.test(c) },
  { value: 'python', test: (c) =>
      /(^|\n)\s*def\s+\w+\s*\(/.test(c) ||
      /if\s+__name__\s*==/.test(c) ||
      /(^|\n)\s*class\s+\w+\s*(\([^)]*\))?\s*:\s*(\n|$)/.test(c) ||
      (/^\s*(import|from)\s+\w+/m.test(c) && /:\s*(#.*)?(\n|$)/.test(c) && !/[{};]/.test(c)) },
  { value: 'cpp', test: (c) =>
      /#\s*include\s*[<"]/.test(c) ||
      /\bstd::/.test(c) ||
      /\bpush_back\s*\(/.test(c) ||
      /\bcout\s*<</.test(c) ||
      /\bpublic\s*:/.test(c) },
  { value: 'java', test: (c) =>
      /\bpublic\s+static\s+void\s+main\b/.test(c) ||
      /\bSystem\.out\.print/.test(c) ||
      /\bimport\s+java\./.test(c) ||
      (/\bpublic\s+class\b/.test(c) && /;\s*(\n|$)/.test(c)) },
  { value: 'csharp', test: (c) => /using\s+System[.;]/.test(c) || /Console\.WriteLine/.test(c) },
  { value: 'go', test: (c) => /^\s*package\s+(main|\w+)\s*$/m.test(c) && /(^|\n)\s*func\s/.test(c) },
  { value: 'rust', test: (c) => /(^|\n)\s*fn\s+\w+\s*\(/.test(c) && /let\s+mut|impl\s+|::|println!\s*\(/.test(c) },
  { value: 'sql', test: (c) => /^\s*(select\b.*\bfrom\b|insert\s+into\b|update\s+\w+\s+set\b|delete\s+from\b|create\s+table\b)/im.test(c) },
  { value: 'graphql', test: (c) => /^\s*(query|mutation|subscription)\s*[\w({]/m.test(c) },
  { value: 'scss', test: (c) => /\$[\w-]+|&\s*[:.]/.test(c) && /[.#&][\w-][^{]*\{/.test(c) },
  { value: 'css', test: (c) =>
      /(^|\n)\s*[.#@][\w-][^{]*\{[^}]*[\w-]+\s*:\s*[^;]+;/.test(c) &&
      !/\b(const|let|var|function|=>|console\.)/.test(c) },
  { value: 'json', test: (c) => {
      const t = c.trim();
      if (!/^[[{]/.test(t)) return false;
      try { JSON.parse(t); return true; } catch { return false; }
    } },
  { value: 'yaml', test: (c) => !/[{}]/.test(c) && /^\s*-?\s*[\w"'.-]+:\s*\S+/m.test(c) && !/\bfunction\b|\bconst\b/.test(c) },
  { value: 'markdown', test: (c) => /^\s{0,3}#{1,6}\s+\S/m.test(c) && (/^\s*[-*]\s+\S/m.test(c) || /```/.test(c)) },
  { value: 'tsx', test: (c) => /<[A-Z][\w.]*[\s/>]/.test(c) && /:\s*(string|number|boolean|any|void|never)\b|interface\s+\w+\s*\{|<[A-Z]\w*>/.test(c) },
  { value: 'jsx', test: (c) => /<[A-Z][\w.]*[\s/>]/.test(c) && /^\s*import\s.+from\s+['"]/m.test(c) },
  { value: 'typescript', test: (c) =>
      /\binterface\s+\w+\s*\{/.test(c) ||
      /\btype\s+\w+\s*=/.test(c) ||
      /:\s*(string|number|boolean|any|void|unknown)\b/.test(c) ||
      /useState<|useRef<|useEffect\s*\(\s*\(\)\s*=>/.test(c) ||
      /\bas\s+const\b/.test(c) ||
      /\benum\s+\w+\s*\{/.test(c) },
  { value: 'javascript', test: (c) => /module\.exports|require\s*\(|console\.log|=>|\bfunction\s+\w+\s*\(/.test(c) },
];

export function detectCodeLanguage(code: string): string {
  if (!code.trim()) return 'typescript';
  const sample = code.slice(0, 5000);
  for (const rule of RULES) {
    if (rule.test(sample)) return rule.value;
  }
  return 'typescript';
}
