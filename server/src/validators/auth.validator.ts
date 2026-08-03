import Joi from 'joi';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const passwordMessage = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 1 character',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string().email().lowercase().trim().max(255).required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'string.max': 'Email cannot exceed 255 characters',
    'any.required': 'Email is required',
  }),
  username: Joi.string().trim().min(3).max(30).pattern(/^[a-zA-Z0-9_-]+$/).required().messages({
    'string.empty': 'Username is required',
    'string.min': 'Username must be at least 3 characters',
    'string.max': 'Username cannot exceed 30 characters',
    'string.pattern.base': 'Username can only contain letters, numbers, hyphens, and underscores',
    'any.required': 'Username is required',
  }),
  password: Joi.string().min(8).max(128).pattern(passwordPattern).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': passwordMessage,
    'any.required': 'Password is required',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Reset token is required',
    'any.required': 'Reset token is required',
  }),
  password: Joi.string().min(8).max(128).pattern(passwordPattern).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': passwordMessage,
    'any.required': 'Password is required',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required',
  }),
  newPassword: Joi.string().min(8).max(128).pattern(passwordPattern).invalid(Joi.ref('currentPassword')).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 8 characters',
    'string.max': 'New password cannot exceed 128 characters',
    'string.pattern.base': passwordMessage,
    'any.required': 'New password is required',
    'any.invalid': 'New password must differ from current password',
  }),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  username: Joi.string().trim().min(3).max(30).pattern(/^[a-zA-Z0-9_-]+$/),
  bio: Joi.string().max(500).allow('', null),
  avatar: Joi.string().uri().allow('', null).max(500),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });
