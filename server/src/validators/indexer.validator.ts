import Joi from 'joi';

// A client must never be able to point indexing at a server filesystem path.
// Repository working copies are created server-side by the GitHub import flow,
// so any client-supplied `repoDir` is rejected outright.
export const indexRepoSchema = Joi.object({
  repoDir: Joi.any().forbidden().messages({
    'any.unknown': 'repoDir is not allowed. Repositories are indexed from GitHub into a server-managed directory.',
  }),
});
