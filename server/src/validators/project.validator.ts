import Joi from 'joi';

export const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Project name is required',
    'string.min': 'Name must be at least 1 character',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Project name is required',
  }),
  description: Joi.string().max(1000).allow('', null).messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),
  workspace: Joi.string().required().messages({
    'string.empty': 'Workspace ID is required',
    'any.required': 'Workspace ID is required',
  }),
});

export const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).messages({
    'string.min': 'Name must be at least 1 character',
    'string.max': 'Name cannot exceed 100 characters',
  }),
  description: Joi.string().max(1000).allow('', null),
  status: Joi.string().valid('active', 'archived', 'deleted').messages({
    'any.only': 'Status must be one of: active, archived, deleted',
  }),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

export const projectIdParams = Joi.object({
  id: Joi.string().required().messages({
    'string.empty': 'Project ID is required',
    'any.required': 'Project ID is required',
  }),
});

export const listProjectsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  search: Joi.string().allow('', null).max(100),
  status: Joi.string().valid('active', 'archived', 'deleted'),
  workspace: Joi.string(),
});

export const addCollaboratorSchema = Joi.object({
  userId: Joi.string().required().messages({
    'string.empty': 'User ID is required',
    'any.required': 'User ID is required',
  }),
});
