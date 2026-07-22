export const APP_NAME = 'DevMind AI';
export const APP_DESCRIPTION = 'Full Stack AI Software Engineer Workspace';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DASHBOARD: '/dashboard',
  WORKSPACE: '/workspace',
} as const;

export const FILE_LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'JSX', value: 'jsx' },
  { label: 'TSX', value: 'tsx' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'Python', value: 'python' },
  { label: 'JSON', value: 'json' },
  { label: 'Markdown', value: 'markdown' },
] as const;

export const QUERY_KEYS = {
  USER: 'user',
  PROJECTS: 'projects',
  PROJECT: 'project',
  FILES: 'files',
} as const;
