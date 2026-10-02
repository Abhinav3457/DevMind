import { PracticeDifficulty, PracticeExample, PracticeTestCase } from '../models/PracticeProblem';

export interface SeedProblem {
  slug: string;
  title: string;
  difficulty: PracticeDifficulty;
  category: string;
  description: string;
  examples: PracticeExample[];
  constraints: string[];
  hints: string[];
  functionName: string;
  starterCode: Record<string, string>;
  testCases: PracticeTestCase[];
  tags: string[];
  order: number;
}

/**
 * DevMind's own curated practice set. These are original problem statements
 * inspired by classic interview patterns — no third-party problem text is
 * reproduced, so the bank is safe to ship and extend.
 */
export const PROBLEM_BANK: SeedProblem[] = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    category: 'Arrays & Hashing',
    description:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice. Return the answer in any order.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 9.' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i], target <= 10^9', 'Only one valid answer exists.'],
    hints: ['A brute-force O(n^2) scan is a good baseline — then remove the inner loop.', 'Can a hash map of value -> index replace the inner loop?'],
    functionName: 'twoSum',
    starterCode: {
      typescript: 'function twoSum(nums: number[], target: number): number[] {\n  // your code here\n  return [];\n}\n',
      javascript: 'function twoSum(nums, target) {\n  // your code here\n  return [];\n}\n',
      python: 'def two_sum(nums, target):\n    # your code here\n    return []\n',
    },
    testCases: [
      { input: '[2,7,11,15], 9', expectedOutput: '[0,1]' },
      { input: '[3,2,4], 6', expectedOutput: '[1,2]' },
      { input: '[3,3], 6', expectedOutput: '[0,1]' },
      { input: '[-1,-2,-3,-4,-5], -8', expectedOutput: '[2,4]', hidden: true },
    ],
    tags: ['array', 'hash-map'],
    order: 1,
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    category: 'Stacks',
    description:
      'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nA string is valid if open brackets are closed by the same type of bracket in the correct order, and every close bracket has a matching open bracket.',
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
      { input: 's = "([)]"', output: 'false', explanation: 'Brackets must close in the reverse order they opened.' },
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists only of bracket characters.'],
    hints: ['Push every opening bracket and pop on a closing one.', 'A stack is the natural data structure — check for an empty stack on close.'],
    functionName: 'isValid',
    starterCode: {
      typescript: 'function isValid(s: string): boolean {\n  // your code here\n  return false;\n}\n',
      javascript: 'function isValid(s) {\n  // your code here\n  return false;\n}\n',
      python: 'def is_valid(s):\n    # your code here\n    return False\n',
    },
    testCases: [
      { input: '"()"', expectedOutput: 'true' },
      { input: '"()[]{}"', expectedOutput: 'true' },
      { input: '"(]"', expectedOutput: 'false' },
      { input: '"([)]"', expectedOutput: 'false', hidden: true },
      { input: '"{[]}"', expectedOutput: 'true', hidden: true },
    ],
    tags: ['stack', 'string'],
    order: 2,
  },
  {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    category: 'Binary Search',
    description:
      'Given a sorted array of integers `nums` and a `target`, return the index of `target` if it exists, otherwise return `-1`.\n\nYou must write an algorithm with O(log n) runtime complexity.',
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1' },
    ],
    constraints: ['1 <= nums.length <= 10^4', 'nums is sorted in ascending order.', 'All values are unique.'],
    hints: ['Keep two pointers, lo and hi, and shrink the search window each step.', 'Guard against infinite loops with lo <= hi and a consistent mid update.'],
    functionName: 'search',
    starterCode: {
      typescript: 'function search(nums: number[], target: number): number {\n  // your code here\n  return -1;\n}\n',
      javascript: 'function search(nums, target) {\n  // your code here\n  return -1;\n}\n',
      python: 'def search(nums, target):\n    # your code here\n    return -1\n',
    },
    testCases: [
      { input: '[-1,0,3,5,9,12], 9', expectedOutput: '4' },
      { input: '[-1,0,3,5,9,12], 2', expectedOutput: '-1' },
      { input: '[5], 5', expectedOutput: '0' },
      { input: '[1,2,3,4,5,6,7,8,9,10], 1', expectedOutput: '0', hidden: true },
    ],
    tags: ['binary-search', 'array'],
    order: 3,
  },
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'easy',
    category: 'Dynamic Programming',
    description:
      'You are climbing a staircase with `n` steps. Each time you can climb either 1 or 2 steps. In how many distinct ways can you climb to the top?',
    examples: [
      { input: 'n = 2', output: '2', explanation: '1+1 or 2.' },
      { input: 'n = 3', output: '3', explanation: '1+1+1, 1+2, or 2+1.' },
    ],
    constraints: ['1 <= n <= 45'],
    hints: ['The number of ways to reach step n is the sum of ways to reach n-1 and n-2.', 'You only need to remember the last two values, not the whole table.'],
    functionName: 'climbStairs',
    starterCode: {
      typescript: 'function climbStairs(n: number): number {\n  // your code here\n  return 0;\n}\n',
      javascript: 'function climbStairs(n) {\n  // your code here\n  return 0;\n}\n',
      python: 'def climb_stairs(n):\n    # your code here\n    return 0\n',
    },
    testCases: [
      { input: '1', expectedOutput: '1' },
      { input: '2', expectedOutput: '2' },
      { input: '3', expectedOutput: '3' },
      { input: '10', expectedOutput: '89', hidden: true },
      { input: '45', expectedOutput: '1836311903', hidden: true },
    ],
    tags: ['dp', 'recursion'],
    order: 4,
  },
  {
    slug: 'product-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'medium',
    category: 'Arrays & Hashing',
    description:
      'Given an integer array `nums`, return an array `output` where `output[i]` is the product of every element of `nums` except `nums[i]`.\n\nSolve it without using division and in O(n) time.',
    examples: [
      { input: 'nums = [1,2,3,4]', output: '[24,12,8,6]' },
      { input: 'nums = [-1,1,0,-3,3]', output: '[0,0,9,0,0]' },
    ],
    constraints: ['2 <= nums.length <= 10^5', 'The product of any prefix or suffix fits in a 32-bit integer.'],
    hints: ['Compute prefix products left-to-right, then fold in suffix products right-to-left.', 'Division breaks when a zero is present — the two-pass product avoids it.'],
    functionName: 'productExceptSelf',
    starterCode: {
      typescript: 'function productExceptSelf(nums: number[]): number[] {\n  // your code here\n  return [];\n}\n',
      javascript: 'function productExceptSelf(nums) {\n  // your code here\n  return [];\n}\n',
      python: 'def product_except_self(nums):\n    # your code here\n    return []\n',
    },
    testCases: [
      { input: '[1,2,3,4]', expectedOutput: '[24,12,8,6]' },
      { input: '[-1,1,0,-3,3]', expectedOutput: '[0,0,9,0,0]' },
      { input: '[2,3]', expectedOutput: '[3,2]' },
      { input: '[0,0]', expectedOutput: '[0,0]', hidden: true },
    ],
    tags: ['array', 'prefix-product'],
    order: 5,
  },
  {
    slug: 'longest-substring-without-repeating',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium',
    category: 'Sliding Window',
    description:
      'Given a string `s`, find the length of the longest substring that contains no repeated characters.',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: '"abc" is the longest.' },
      { input: 's = "bbbbb"', output: '1', explanation: '"b".' },
      { input: 's = "pwwkew"', output: '3', explanation: '"wke".' },
    ],
    constraints: ['0 <= s.length <= 5 * 10^4', 's consists of printable ASCII characters.'],
    hints: ['Grow a window with a right pointer and shrink from the left on a repeat.', 'A map from character -> last index lets you jump the left pointer forward.'],
    functionName: 'lengthOfLongestSubstring',
    starterCode: {
      typescript: 'function lengthOfLongestSubstring(s: string): number {\n  // your code here\n  return 0;\n}\n',
      javascript: 'function lengthOfLongestSubstring(s) {\n  // your code here\n  return 0;\n}\n',
      python: 'def length_of_longest_substring(s):\n    # your code here\n    return 0\n',
    },
    testCases: [
      { input: '"abcabcbb"', expectedOutput: '3' },
      { input: '"bbbbb"', expectedOutput: '1' },
      { input: '"pwwkew"', expectedOutput: '3' },
      { input: '""', expectedOutput: '0', hidden: true },
      { input: '"dvdf"', expectedOutput: '3', hidden: true },
    ],
    tags: ['sliding-window', 'string', 'hash-map'],
    order: 6,
  },
  {
    slug: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'medium',
    category: 'Intervals',
    description:
      'Given an array of intervals where `intervals[i] = [start, end]`, merge all overlapping intervals and return the non-overlapping intervals that cover all the input.',
    examples: [
      { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' },
      { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]', explanation: 'Touching intervals merge.' },
    ],
    constraints: ['1 <= intervals.length <= 10^4', 'intervals[i].length == 2', '0 <= start <= end <= 10^4'],
    hints: ['Sort by start first — then overlaps become adjacent.', 'While scanning, merge into the last interval when its end >= current start.'],
    functionName: 'mergeIntervals',
    starterCode: {
      typescript: 'function mergeIntervals(intervals: number[][]): number[][] {\n  // your code here\n  return [];\n}\n',
      javascript: 'function mergeIntervals(intervals) {\n  // your code here\n  return [];\n}\n',
      python: 'def merge_intervals(intervals):\n    # your code here\n    return []\n',
    },
    testCases: [
      { input: '[[1,3],[2,6],[8,10],[15,18]]', expectedOutput: '[[1,6],[8,10],[15,18]]' },
      { input: '[[1,4],[4,5]]', expectedOutput: '[[1,5]]' },
      { input: '[[1,4],[0,4]]', expectedOutput: '[[0,4]]' },
      { input: '[[1,4],[2,3]]', expectedOutput: '[[1,4]]', hidden: true },
    ],
    tags: ['intervals', 'sorting'],
    order: 7,
  },
  {
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'hard',
    category: 'Two Pointers',
    description:
      'Given `n` non-negative integers representing an elevation map where each bar has width 1, compute how much water it can trap after raining.',
    examples: [
      { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
      { input: 'height = [4,2,0,3,2,5]', output: '9' },
    ],
    constraints: ['1 <= height.length <= 2 * 10^4', '0 <= height[i] <= 10^5'],
    hints: ['Water above a bar equals min(maxLeft, maxRight) - height at that bar.', 'Two pointers + running left/right maxima give an O(n) time, O(1) space solution.'],
    functionName: 'trap',
    starterCode: {
      typescript: 'function trap(height: number[]): number {\n  // your code here\n  return 0;\n}\n',
      javascript: 'function trap(height) {\n  // your code here\n  return 0;\n}\n',
      python: 'def trap(height):\n    # your code here\n    return 0\n',
    },
    testCases: [
      { input: '[0,1,0,2,1,0,1,3,2,1,2,1]', expectedOutput: '6' },
      { input: '[4,2,0,3,2,5]', expectedOutput: '9' },
      { input: '[3]', expectedOutput: '0' },
      { input: '[5,4,3,2,1]', expectedOutput: '0', hidden: true },
    ],
    tags: ['two-pointers', 'monotonic-stack', 'array'],
    order: 8,
  },
];
