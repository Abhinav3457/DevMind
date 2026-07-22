import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/apiResponse';

type ValidationSchemas = {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
};

/**
 * Middleware factory that validates request data using Joi schemas.
 * Validates req.body, req.params, and/or req.query based on provided schemas.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    if (schemas.body) {
      const { error } = schemas.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (schemas.params) {
      const { error } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (schemas.query) {
      const { error } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (errors.length > 0) {
      next(new ApiError(400, errors.join('; ')));
      return;
    }

    next();
  };
}
