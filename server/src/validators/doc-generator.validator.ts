import Joi from 'joi';

export const generateDocSchema = Joi.object({
  type: Joi.string()
    .valid(
      'readme', 'installation', 'folder-structure', 'architecture',
      'api-docs', 'env-vars', 'deployment', 'contributing', 'license',
    )
    .required()
    .messages({
      'any.only': 'Document type must be one of: readme, installation, folder-structure, architecture, api-docs, env-vars, deployment, contributing, license',
      'any.required': 'Document type is required',
    }),
});

export const generateDirectDocSchema = Joi.object({
  type: Joi.string()
    .valid(
      'readme', 'installation', 'folder-structure', 'architecture',
      'api-docs', 'env-vars', 'deployment', 'contributing', 'license',
    )
    .required()
    .messages({
      'any.only': 'Invalid document type',
      'any.required': 'Document type is required',
    }),
  context: Joi.string().trim().min(1).max(10000).required().messages({
    'string.empty': 'Project context is required',
    'string.min': 'Context must be at least 1 character',
    'string.max': 'Context cannot exceed 10000 characters',
    'any.required': 'Project context is required',
  }),
});
