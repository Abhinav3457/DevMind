import Joi from 'joi';

export const indexRepoSchema = Joi.object({
  repoDir: Joi.string().min(1).optional().messages({
    'string.empty': 'Repository directory path is required',
  }),
});
