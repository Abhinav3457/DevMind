import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewerService } from '../reviewer.service';
import { generateFromAI } from '../../config/ai';
import { IIndexedFile } from '../../models/IndexedFile';

vi.mock('../../config/ai', () => ({
  generateFromAI: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createVirtualFile(path: string, language = 'typescript'): IIndexedFile {
  return {
    _id: 'file-1',
    reportId: 'report-1',
    path,
    name: path.split('/').pop() || path,
    language,
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    dependencies: [],
    size: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IIndexedFile;
}

const REALISTIC_RESPONSE = `### REVIEW SCORE
Score: 72 - The code has security and correctness issues.

### EXECUTIVE SUMMARY
The code is generally well written but has SQL injection risks and a potential null reference.

### CORRECTNESS & BUGS
#### Issue 1: Potential null reference
- **Location**: File: sample.ts, Line: 3
- **Severity**: MAJOR
- **Explanation**: The function assumes users[0] exists, which throws if the array is empty.
- **Current Code**:
  \`\`\`typescript
  return users[0].name;
  \`\`\`
- **Recommended Fix**:
  \`\`\`typescript
  if (users.length > 0) return users[0].name;
  \`\`\`
- **Effort**: Minutes

### SECURITY
#### Issue 2: SQL Injection
- **Location**: sample.ts:1
- **Severity**: CRITICAL
- **Explanation**: User input is concatenated directly into a SQL query.
- **Current Code**:
  \`\`\`typescript
  db.query('SELECT * FROM users WHERE id = ' + id);
  \`\`\`
- **Recommended Fix**:
  \`\`\`typescript
  db.query('SELECT * FROM users WHERE id = $1', [id]);
  \`\`\`
- **Effort**: Minutes

### TOP RECOMMENDATIONS
1. **Fix the SQL injection** - Use parameterized queries.

### FIXED VERSION (Most Critical File)
\`\`\`typescript
function getUser(id: number) {
  return db.query('SELECT * FROM users WHERE id = $1', [id])[0]?.name ?? null;
}
\`\`\`
`;

describe('ReviewerService', () => {
  let service: ReviewerService;

  beforeEach(() => {
    service = new ReviewerService();
    vi.clearAllMocks();
    vi.mocked(generateFromAI).mockResolvedValue(REALISTIC_RESPONSE);
  });

  it('should parse issues from sections with #### Issue headers (regression: extractSection lookahead)', async () => {
    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'const users = [];\nreturn users[0].name;' },
    ]);

    expect(result.totalIssues).toBe(2);
    expect(result.categories.bugs.issues).toHaveLength(1);
    expect(result.categories.security.issues).toHaveLength(1);
    expect(result.score).toBe(72);
  });

  it('should resolve "File: path, Line: N" locations', async () => {
    const result = await service.reviewFiles([
      // Enough lines that "Line: 3" is within the visible range.
      { file: createVirtualFile('sample.ts'), content: 'const a = 1;\nconst b = 2;\nconst c = 3;' },
    ]);

    const bug = result.categories.bugs.issues[0]!;
    expect(bug.file).toBe('sample.ts');
    expect(bug.line).toBe(3);
    expect(bug.severity).toBe('major');
    expect(bug.message).toContain('null reference');
  });

  it('should resolve "path:line" locations', async () => {
    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'x' },
    ]);

    const securityIssue = result.categories.security.issues[0]!;
    expect(securityIssue.file).toBe('sample.ts');
    expect(securityIssue.line).toBe(1);
    expect(securityIssue.severity).toBe('critical');
  });

  it('should extract refactoring suggestions and fixed version', async () => {
    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'x' },
    ]);

    expect(result.refactoringSuggestions.length).toBeGreaterThan(0);
    expect(result.refactoringSuggestions[0]!.title).toContain('SQL injection');
    expect(result.fixedVersion).toContain('function getUser');
  });

  it('should drop issues that reference files not in the reviewed set', async () => {
    const response = `### REVIEW SCORE
Score: 60

### CORRECTNESS & BUGS
#### Issue 1: Real bug in reviewed file
- **Location**: sample.ts:3
- **Severity**: MAJOR
- **Explanation**: Actual problem.
- **Recommended Fix**:
  \`\`\`typescript
  fix();
  \`\`\`
- **Effort**: Minutes

### SECURITY
#### Issue 2: Hallucinated issue in unreviewed file
- **Location**: README.md:10
- **Severity**: CRITICAL
- **Explanation**: Not in scope.
- **Recommended Fix**:
  \`\`\`typescript
  fix();
  \`\`\`
- **Effort**: Minutes
`;
    vi.mocked(generateFromAI).mockResolvedValue(response);

    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'x' },
      { file: createVirtualFile('app.ts'), content: 'y' },
    ]);

    expect(result.totalIssues).toBe(1);
    expect(result.categories.bugs.issues).toHaveLength(1);
    expect(result.categories.security.issues).toHaveLength(0);
  });

  it('should clamp hallucinated line numbers beyond the visible lines to 0', async () => {
    const response = `### REVIEW SCORE
Score: 70

### CORRECTNESS & BUGS
#### Issue 1: Bug
- **Location**: sample.ts:999
- **Severity**: MAJOR
- **Explanation**: Way out of range.
- **Recommended Fix**:
  \`\`\`typescript
  fix();
  \`\`\`
- **Effort**: Minutes
`;
    vi.mocked(generateFromAI).mockResolvedValue(response);

    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'const a = 1;\nconst b = 2;' },
    ]);

    const bug = result.categories.bugs.issues[0]!;
    expect(bug.line).toBe(0);
    expect(result.categories.bugs.issues).toHaveLength(1);
  });

  it('should not clamp lines within the visible range of a truncated file', async () => {
    const response = `### REVIEW SCORE
Score: 60

### CORRECTNESS & BUGS
#### Issue 1: Bug
- **Location**: sample.ts:100
- **Severity**: MAJOR
- **Explanation**: Line 100 is within the 100-line window.
- **Recommended Fix**:
  \`\`\`typescript
  fix();
  \`\`\`
- **Effort**: Minutes
`;
    vi.mocked(generateFromAI).mockResolvedValue(response);

    // 300 lines -> truncated to 100 shown lines; the truncation marker line
    // must not count as a real code line.
    const longContent = Array.from({ length: 300 }, (_, i) => 'const x' + i + ' = ' + i + ';').join('\n');
    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: longContent },
    ]);

    const bug = result.categories.bugs.issues[0]!;
    expect(bug.line).toBe(100);
  });

  it('should rank files by code volume so dense code outranks sparse long files', async () => {
    await service.reviewFiles([
      // Sparse: spans 400 lines but has ZERO non-blank lines, so it must rank
      // strictly below every other file (ties keep input order with a stable
      // sort, so this guarantees it's excluded from the top-5 selection).
      { file: createVirtualFile('sparse.ts'), content: Array.from({ length: 400 }, () => '').join('\n') },
      // Dense: 200 lines of real code.
      { file: createVirtualFile('dense.ts'), content: Array.from({ length: 200 }, (_, i) => 'const x' + i + ' = ' + i + ';').join('\n') },
      // Also dense: 150 lines.
      { file: createVirtualFile('mid.ts'), content: Array.from({ length: 150 }, (_, i) => 'let y' + i + ' = ' + i + ';').join('\n') },
      { file: createVirtualFile('small.ts'), content: 'const z = 1;' },
      { file: createVirtualFile('tiny.ts'), content: 'const w = 1;' },
      { file: createVirtualFile('extra.ts'), content: 'const v = 1;' },
    ]);

    // Dense and mid must be selected over the sparse 400-line file.
    const prompt = vi.mocked(generateFromAI).mock.calls[0]![0].prompt;
    expect(prompt).toContain('--- File: dense.ts');
    expect(prompt).toContain('--- File: mid.ts');
    expect(prompt).not.toContain('--- File: sparse.ts');
  });

  it('should include numbered lines and scope constraints in the review prompt', async () => {
    await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'const a = 1;\nconst b = 2;' },
    ]);

    const prompt = vi.mocked(generateFromAI).mock.calls[0]![0].prompt;
    expect(prompt).toContain('1: const a = 1;');
    expect(prompt).toContain('2: const b = 2;');
    expect(prompt).toContain('SCOPE CONSTRAINTS');
    expect(prompt).toContain('sample.ts');
  });

  it('should retry once on an empty AI response and use the retried result', async () => {
    vi.mocked(generateFromAI)
      .mockResolvedValueOnce('\n')
      .mockResolvedValueOnce(REALISTIC_RESPONSE);

    const result = await service.reviewFiles([
      // Enough lines that "Line: 3" stays within the visible range.
      { file: createVirtualFile('sample.ts'), content: 'const a = 1;\nconst b = 2;\nconst c = 3;' },
    ]);

    expect(vi.mocked(generateFromAI)).toHaveBeenCalledTimes(2);
    expect(result.totalIssues).toBe(2);
    expect(result.score).toBe(72);
  });

  it('should fall back to the neutral review when the AI returns empty twice', async () => {
    vi.mocked(generateFromAI).mockResolvedValue('  \n ');

    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'x' },
    ]);

    expect(vi.mocked(generateFromAI)).toHaveBeenCalledTimes(2);
    expect(result.score).toBe(50);
    expect(result.summary).toContain('AI review was unavailable');
    expect(result.summary).toContain('empty response twice');
    expect(result.totalIssues).toBe(0);
  });

  it('should return the neutral fallback when the AI call fails', async () => {
    vi.mocked(generateFromAI).mockRejectedValue(new Error('Model not found'));

    const result = await service.reviewFiles([
      { file: createVirtualFile('sample.ts'), content: 'x' },
    ]);

    expect(result.score).toBe(50);
    expect(result.summary).toContain('AI review was unavailable');
    expect(result.summary).toContain('Model not found');
    expect(result.totalIssues).toBe(0);
  });
});
