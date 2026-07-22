import Joi from 'joi';

export const createWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Workspace name is required',
    'string.min': 'Name must be at least 1 character',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Workspace name is required',
  }),
  slug: Joi.string().trim().lowercase().min(3).max(50).pattern(/^[a-z0-9-]+$/).required().messages({
    'string.empty': 'Slug is required',
    'string.min': 'Slug must be at least 3 characters',
    'string.max': 'Slug cannot exceed 50 characters',
    'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens',
    'any.required': 'Slug is required',
  }),
  description: Joi.string().max(500).allow('', null).messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

export const updateWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  description: Joi.string().max(500).allow('', null),
  settings: Joi.object(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

export const inviteMemberSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),
  role: Joi.string().valid('admin', 'member', 'guest').default('member').messages({
    'any.only': 'Role must be one of: admin, member, guest',
  }),
});

export const changeMemberRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'member', 'guest').required().messages({
    'any.only': 'Role must be one of: admin, member, guest',
    'any.required': 'Role is required',
  }),
});

export const transferOwnershipSchema = Joi.object({
  newOwnerId: Joi.string().required().messages({
    'string.empty': 'New owner ID is required',
    'any.required': 'New owner ID is required',
  }),
});
