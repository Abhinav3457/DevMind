import apiClient from '../api/axios';
import { User, LoginCredentials, RegisterData } from '../types';

interface AuthResponse {
  user: User;
  accessToken: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/login', credentials);
  const { user, accessToken } = response.data.data;
  localStorage.setItem('accessToken', accessToken);
  return { user, accessToken };
}

export async function register(data: RegisterData): Promise<{ userId: string; email: string }> {
  const response = await apiClient.post('/auth/register', data);
  return response.data.data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    localStorage.removeItem('accessToken');
  }
}

export async function refreshToken(): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/refresh-token');
  const { user, accessToken } = response.data.data;
  localStorage.setItem('accessToken', accessToken);
  return { user, accessToken };
}

export async function getProfile(): Promise<User> {
  const response = await apiClient.get('/auth/me');
  return response.data.data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/auth/change-password', { currentPassword, newPassword });
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { token, password });
}

export async function verifyEmail(token: string): Promise<void> {
  await apiClient.get(`/auth/verify-email/${token}`);
}

export async function updateProfile(data: { name?: string; username?: string; bio?: string }): Promise<User> {
  const response = await apiClient.patch('/auth/profile', data);
  return response.data.data.user;
}
