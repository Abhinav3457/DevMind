import Joi from 'joi';

export const askQuestionSchema = Joi.object({
  question: Joi.string().trim().min(3).max(1000).required().messages({
    'string.empty': 'Question is required',
    'string.min': 'Question must be at least 3 characters',
    'string.max': 'Question cannot exceed 1000 characters',
    'any.required': 'Question is required',
  }),
});

export const queryQuestionSchema = Joi.object({
  question: Joi.string().trim().min(3).max(1000).required().messages({
    'string.empty': 'Question is required',
    'string.min': 'Question must be at least 3 characters',
    'string.max': 'Question cannot exceed 1000 characters',
    'any.required': 'Question is required',
  }),
  reportId: Joi.string().trim().required().messages({
    'string.empty': 'Report ID is required',
    'any.required': 'Report ID is required',
  }),
});
