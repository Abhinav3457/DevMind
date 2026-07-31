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
      { file: createVirtualFile('sample.ts'), content: 'x' },
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
