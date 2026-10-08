import Joi from 'joi';

const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'python3', 'java', 'cpp', 'c', 'csharp',
  'go', 'golang', 'rust', 'ruby', 'kotlin', 'swift', 'php', 'dart', 'scala', 'elixir', 'erlang', 'racket',
] as const;

/**
 * Both submission endpoints validate the same payload; the only difference is
 * the default language (DevMind bank problems ship TypeScript starters, the
 * LeetCode catalogue defaults to Python3), so the shared shape lives here and
 * the two exported schemas differ by that one argument.
 */
const buildSubmitSchema = (defaultLanguage: string) =>
  Joi.object({
    code: Joi.string().min(1).max(50000).required().messages({
      'string.empty': 'Your solution cannot be empty',
      'string.min': 'Your solution cannot be empty',
      'string.max': 'Solution cannot exceed 50000 characters',
      'any.required': 'A solution is required to submit',
    }),
    language: Joi.string()
      .trim()
      .valid(...SUPPORTED_LANGUAGES)
      .default(defaultLanguage)
      .messages({
        'any.only': 'Unsupported language. Supported: ' + SUPPORTED_LANGUAGES.join(', '),
      }),
  });

export const submitSolutionSchema = buildSubmitSchema('typescript');

export const leetcodeListQuerySchema = Joi.object({
  difficulty: Joi.string().trim().valid('easy', 'medium', 'hard').optional(),
  tags: Joi.string().trim().max(300).optional(),
  search: Joi.string().trim().max(100).optional(),
  page: Joi.number().integer().min(1).max(500).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

export const leetcodeSubmitSchema = buildSubmitSchema('python3');

export const problemSlugParamsSchema = Joi.object({
  slug: Joi.string()
    .trim()
    .pattern(/^[a-z0-9-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid problem slug',
      'any.required': 'Problem slug is required',
    }),
});

export const leetcodeUsernameParamsSchema = Joi.object({
  username: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z0-9_-]{1,50}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid LeetCode username',
      'any.required': 'A LeetCode username is required',
    }),
});

export const listProblemsQuerySchema = Joi.object({
  difficulty: Joi.string().trim().valid('easy', 'medium', 'hard').optional(),
  category: Joi.string().trim().max(100).optional(),
  search: Joi.string().trim().max(100).optional(),
});
