import Joi from 'joi';

export const generateChatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(4000).required().messages({
    'string.empty': 'Message is required',
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 4000 characters',
    'any.required': 'Message is required',
  }),
  history: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().required(),
      }),
    )
    .max(50)
    .optional(),
});
