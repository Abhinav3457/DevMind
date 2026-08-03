interface ReviewIssue {
  type: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  explanation: string;
  recommendation: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bugs: 'Bugs & Correctness',
  security: 'Security',
  performance: 'Performance',
  codeSmells: 'Code Smells & Maintainability',
  solidViolations: 'Architecture & Design (SOLID)',
};

/**
 * Build a readable markdown report from the structured review payload so the
 * user sees every issue, its fix, the score and the refactoring suggestions —
 * not just a one-line summary.
 */
export function renderReviewMarkdown(data: Record<string, unknown>): string {
  const parts: string[] = [];

  const score = data.score;
  if (typeof score === 'number') {
    parts.push(`## Review Score\n\n**${score}/100**\n`);
  }
  if (typeof data.summary === 'string' && data.summary.trim()) {
    parts.push(`## Summary\n\n${data.summary}\n`);
  }

  const cats = (data.categories || {}) as Record<string, { issues?: ReviewIssue[]; summary?: string }>;
  for (const [key, cat] of Object.entries(cats)) {
    const issues = cat?.issues || [];
    if (issues.length === 0) continue;
    parts.push(`## ${CATEGORY_LABELS[key] || key}\n`);
    if (cat.summary) parts.push(`> ${cat.summary}\n`);
    issues.forEach((issue) => {
      const loc = issue.file && issue.file !== 'unknown'
        ? `\`${issue.file}${issue.line ? ':' + issue.line : ''}\``
        : 'Location unknown';
      const sev = issue.severity ? `**${issue.severity.toUpperCase()}**` : '';
      parts.push(`- **${issue.message || 'Issue'}** ${sev} — ${loc}`);
      if (issue.explanation) parts.push(`  ${issue.explanation}`);
      if (issue.recommendation) parts.push(`  **Fix:** ${issue.recommendation.replace(/\n/g, '\n  ')}`);
      parts.push('');
    });
  }

  const suggestions = (data.refactoringSuggestions || []) as {
    title?: string;
    description?: string;
    file?: string;
    priority?: string;
  }[];
  if (suggestions.length > 0) {
    parts.push(`## Refactoring Suggestions\n`);
    suggestions.forEach((s) => {
      parts.push(`- **${s.title || 'Suggestion'}**${s.file ? ` — \`${s.file}\`` : ''}${s.priority ? ` (${s.priority})` : ''}`);
      if (s.description) parts.push(`  ${s.description}`);
    });
    parts.push('');
  }

  const complexity = data.complexity as { averageComplexity?: number; highComplexityFiles?: unknown[] } | undefined;
  if (complexity) {
    parts.push(`## Complexity Analysis\n`);
    parts.push(`- Average complexity: **${complexity.averageComplexity ?? 'N/A'}**`);
    parts.push(`- High complexity files: **${(complexity.highComplexityFiles || []).length}**\n`);
  }

  if (Array.isArray(data.duplicateCode) && (data.duplicateCode as unknown[]).length > 0) {
    parts.push(`## Duplicate Code\n\nFound **${(data.duplicateCode as unknown[]).length}** duplicate block(s).\n`);
  }

  if (typeof data.fixedVersion === 'string' && data.fixedVersion.trim()) {
    parts.push(`## Fixed Version\n\n${data.fixedVersion}\n`);
  }

  return parts.join('\n') || 'Review completed. No issues found.';
}
