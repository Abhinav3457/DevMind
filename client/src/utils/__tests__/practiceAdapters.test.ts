import { describe, it, expect } from 'vitest';
import {
  composeStatement,
  devmindProblemToQuestion,
  devmindProblemToSummary,
  starterCodeToSnippets,
} from '../practiceAdapters';
import type { PracticeProblemDetail } from '../../services/practice';

const detail: PracticeProblemDetail = {
  id: 'p1',
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy',
  category: 'Arrays & Hashing',
  description: 'Return the indices of the two numbers.',
  examples: [
    {
      input: 'nums = [2,7,11,15], target = 9',
      output: '[0,1]',
      explanation: 'nums[0] + nums[1] = 9.',
    },
  ],
  constraints: ['2 <= nums.length <= 10^4'],
  hints: ['Use a hash map'],
  functionName: 'twoSum',
  starterCode: {
    typescript: 'function twoSum(nums: number[], target: number): number[] {\n  return [];\n}\n',
    python: 'def two_sum(nums, target):\n    return []\n',
  },
  tags: ['array', 'hash-map'],
  testCases: [{ input: '[2,7], 9', expectedOutput: '[0,1]' }],
};

describe('practiceAdapters', () => {
  it('maps starter code into labelled snippets', () => {
    expect(starterCodeToSnippets(detail.starterCode)).toEqual([
      {
        langSlug: 'typescript',
        lang: 'TypeScript',
        code: 'function twoSum(nums: number[], target: number): number[] {\n  return [];\n}\n',
      },
      { langSlug: 'python', lang: 'Python', code: 'def two_sum(nums, target):\n    return []\n' },
    ]);
  });

  it('drops blank starter code entries', () => {
    expect(starterCodeToSnippets({ typescript: '   ', python: 'x' })).toEqual([
      { langSlug: 'python', lang: 'Python', code: 'x' },
    ]);
  });

  it('renders the bank examples and constraints into the statement', () => {
    const statement = composeStatement(detail);

    expect(statement).toContain('Return the indices of the two numbers.');
    expect(statement).toContain('**Example 1**');
    expect(statement).toContain('nums[0] + nums[1] = 9.');
    expect(statement).toContain('### Constraints');
    expect(statement).toContain('2 <= nums.length <= 10^4');
  });

  it('omits empty example and constraint sections', () => {
    const statement = composeStatement({ ...detail, examples: [], constraints: [] });

    expect(statement).toBe('Return the indices of the two numbers.');
  });

  it('adapts a bank problem to the question shape the page renders', () => {
    const question = devmindProblemToQuestion(detail);

    expect(question.slug).toBe('two-sum');
    // Bank problems have no numeric front-end id, so the header omits it.
    expect(question.id).toBe('');
    expect(question.paidOnly).toBe(false);
    expect(question.functionName).toBe('twoSum');
    expect(question.codeSnippets).toHaveLength(2);
    expect(question.hints).toEqual(['Use a hash map']);
    // Test cases stay server-side; the client never receives them.
    expect(question.exampleTestcases).toEqual([]);
  });

  it('numbers bank rows for display and carries the user progress', () => {
    const summary = devmindProblemToSummary(
      {
        id: 'mongo-id',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        category: 'Arrays & Hashing',
        tags: ['array'],
        solved: true,
        bestScore: 90,
        attempts: 2,
      },
      4,
    );

    expect(summary.id).toBe('5');
    expect(summary.title).toBe('Two Sum');
    expect(summary.bestScore).toBe(90);
    expect(summary.attempts).toBe(2);
    expect(summary.paidOnly).toBe(false);
  });
});
