import type {
  LeetCodeCodeSnippet,
  LeetCodeProblemSummary,
  LeetCodeQuestion,
  ProblemListItem,
  PracticeProblemDetail,
} from '../services/practice';

/**
 * A problem-list row that can come from either source. DevMind bank rows carry
 * the user's own progress instead of a public acceptance rate.
 */
export type PracticeSummary = LeetCodeProblemSummary & {
  bestScore?: number;
  attempts?: number;
};

const STARTER_LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  python3: 'Python3',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  kotlin: 'Kotlin',
  swift: 'Swift',
  php: 'PHP',
  dart: 'Dart',
  scala: 'Scala',
  elixir: 'Elixir',
  erlang: 'Erlang',
  racket: 'Racket',
};

/**
 * The curated bank stores starter code as a language map while the Practice UI
 * is driven by LeetCode-style snippets — adapt rather than duplicate rendering.
 */
export function starterCodeToSnippets(
  starterCode: Record<string, string> | undefined,
): LeetCodeCodeSnippet[] {
  if (!starterCode) return [];
  return Object.entries(starterCode)
    .filter(([, code]) => typeof code === 'string' && code.trim().length > 0)
    .map(([langSlug, code]) => ({
      langSlug,
      lang: STARTER_LANGUAGE_LABELS[langSlug] || langSlug,
      code,
    }));
}

/**
 * Bank problems have no numeric front-end id, so the 1-based list position is
 * used for display, matching how LeetCode problems are numbered in the list.
 */
export function devmindProblemToSummary(item: ProblemListItem, index: number): PracticeSummary {
  return {
    id: String(index + 1),
    slug: item.slug,
    title: item.title,
    difficulty: item.difficulty,
    acRate: 0,
    paidOnly: false,
    tags: item.tags || [],
    bestScore: item.bestScore,
    attempts: item.attempts,
  };
}

/**
 * Build the statement shown in the problem panel. The bank keeps examples and
 * constraints as structured fields, so they are rendered from that trusted data
 * instead of being re-parsed out of a scraped statement.
 */
export function composeStatement(problem: PracticeProblemDetail): string {
  const sections: string[] = [];

  const description = (problem.description || '').trim();
  if (description) sections.push(description);

  const examples = problem.examples || [];
  if (examples.length > 0) {
    const rendered = examples.map((example, i) => {
      const lines = ['```', `Input:  ${example.input}`, `Output: ${example.output}`];
      if (example.explanation) lines.push(`Explanation: ${example.explanation}`);
      lines.push('```');
      return `**Example ${i + 1}**\n${lines.join('\n')}`;
    });
    sections.push(`### Examples\n\n${rendered.join('\n\n')}`);
  }

  const constraints = problem.constraints || [];
  if (constraints.length > 0) {
    sections.push(`### Constraints\n\n${constraints.map((c) => `- ${c}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Adapt a curated bank problem to the shape the Practice page already renders.
 * Test cases are deliberately not sent to the client: the server judges against
 * the full set it stores, hidden cases included.
 */
export function devmindProblemToQuestion(problem: PracticeProblemDetail): LeetCodeQuestion {
  return {
    id: '',
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    description: composeStatement(problem),
    exampleTestcases: [],
    hints: problem.hints || [],
    tags: problem.tags || [],
    functionName: problem.functionName,
    codeSnippets: starterCodeToSnippets(problem.starterCode),
    paidOnly: false,
  };
}
