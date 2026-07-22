import Joi from 'joi';

export const indexRepoSchema = Joi.object({
  repoDir: Joi.string().required().min(1).messages({
    'string.empty': 'Repository directory path is required',
    'any.required': 'Repository directory path is required',
  }),
});
