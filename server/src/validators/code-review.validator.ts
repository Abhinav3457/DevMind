import Joi from 'joi';

export const reviewRepoSchema = Joi.object({
  files: Joi.array().items(Joi.string().trim().min(1).max(500)).min(0).max(50).optional().messages({
    'array.max': 'Cannot review more than 50 specific files at once',
    'string.min': 'File path must be at least 1 character',
    'string.max': 'File path cannot exceed 500 characters',
  }),
});

export const reviewCodeSchema = Joi.object({
  code: Joi.string().trim().min(1).max(200000).required().messages({
    'string.empty': 'Code to review cannot be empty',
    'string.min': 'Code must be at least 1 character',
    'string.max': 'Code cannot exceed 200000 characters',
    'any.required': 'Code is required for review',
  }),
  language: Joi.string().trim().valid(
    'typescript', 'javascript', 'python', 'jsx', 'tsx', 'html', 'css', 'json', 'markdown',
    'go', 'rust', 'java', 'csharp', 'cpp', 'scss', 'yaml', 'dockerfile', 'graphql', 'sql', 'bash',
  ).default('typescript').messages({
    'any.only': 'Unsupported language. Supported: typescript, javascript, python, jsx, tsx, html, css, json, markdown, go, rust, java, csharp, cpp, scss, yaml, dockerfile, graphql, sql, bash',
  }),
  fileName: Joi.string().trim().max(255).optional(),
});
