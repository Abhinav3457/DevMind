import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthState['user']) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'auth-store' },
  ),
);

interface UIState {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ui-store' },
  ),
);
