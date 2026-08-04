import Joi from 'joi';

export const createAgentRunSchema = Joi.object({
  reportId: Joi.string().trim().required().messages({
    'string.empty': 'Report ID is required',
    'any.required': 'Report ID is required',
  }),
  task: Joi.string().trim().min(10).max(2000).required().messages({
    'string.empty': 'Task description is required',
    'string.min': 'Task must be at least 10 characters',
    'string.max': 'Task cannot exceed 2000 characters',
    'any.required': 'Task description is required',
  }),
});
