import Joi from 'joi';

export const oAuthCallbackSchema = Joi.object({
  code: Joi.string().required().messages({
    'string.empty': 'Authorization code is required',
    'any.required': 'Authorization code is required',
  }),
  state: Joi.string().required().messages({
    'string.empty': 'OAuth state parameter is required for security',
    'any.required': 'OAuth state parameter is required for security',
  }),
});

export const importRepoSchema = Joi.object({
  owner: Joi.string().required().messages({
    'string.empty': 'Repository owner is required',
    'any.required': 'Repository owner is required',
  }),
  repo: Joi.string().required().messages({
    'string.empty': 'Repository name is required',
    'any.required': 'Repository name is required',
  }),
  workspaceId: Joi.string().optional(),
  isPrivate: Joi.boolean().default(false),
});

export const syncRepoSchema = Joi.object({
  owner: Joi.string().required(),
  repo: Joi.string().required(),
});

export const repoParamsSchema = Joi.object({
  owner: Joi.string().required(),
  repo: Joi.string().required(),
});
