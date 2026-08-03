export const ROLES = { USER: 'user', ADMIN: 'admin' } as const;
export const AI_MODELS = { GEMINI_FLASH: 'gemini-3.5-flash', GEMINI_PRO: 'gemini-3.5-pro' } as const;
export const PAGINATION = { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 100 } as const;
export const HTTP_STATUS = { OK: 200, CREATED: 201, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INTERNAL_SERVER: 500 } as const;
