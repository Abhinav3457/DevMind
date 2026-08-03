import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Code2, Brain, Bug, FileText,
  Github, BarChart3, LogOut, ChevronLeft,
  Bell, Menu, X, Users, Sun, Moon, Loader2,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store';
import { logout as logoutApi } from '../../services/auth';
import apiClient from '../../api/axios';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/workspace', icon: Users, label: 'Workspaces' },
  { to: '/github', icon: Github, label: 'GitHub' },
  { to: '/ai/chat', icon: Brain, label: 'AI Chat' },
  { to: '/ai/code-review', icon: Bug, label: 'Code Review' },
  { to: '/ai/docs', icon: FileText, label: 'Documentation' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearUser } = useAuthStore();
  const { theme, setTheme, sidebarOpen, toggleSidebar } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  // Fetch pending invitation count so the bell shows a badge
  useEffect(() => {
    apiClient.get('/invitations')
      .then((res) => setInviteCount(res.data.data?.invitations?.length || 0))
      .catch(() => { /* ignore */ });
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutApi();
    } catch {
      // Even if the API call fails, clear local state
    } finally {
      clearUser();
      navigate('/auth/login', { replace: true });
      setLoggingOut(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex min-h-screen min-h-dvh overflow-x-hidden bg-surface-950">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — single element, responsive with Tailwind */}
      <aside
        className={
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-surface-700 bg-surface-900/95 backdrop-blur-xl safe-top shadow-2xl shadow-black/40 transition-all duration-200 ' +
          'lg:static lg:z-auto lg:shadow-none ' +
          (sidebarOpen ? 'w-64' : 'w-0 lg:w-16') +
          (mobileOpen ? ' translate-x-0' : ' -translate-x-full lg:translate-x-0')
        }
      >
        {/* Logo */}
        <div className={`flex h-14 sm:h-16 items-center border-b border-surface-700 px-3 sm:px-4 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {sidebarOpen && (
            <NavLink to="/dashboard" className="flex items-center gap-2 min-w-0" onClick={() => setMobileOpen(false)}>
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-surface-100 truncate">DevMind AI</span>
            </NavLink>
          )}
          <button
            onClick={() => mobileOpen ? setMobileOpen(false) : toggleSidebar()}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Close menu'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2 sm:p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                'group flex items-center gap-3 rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-sm font-medium transition-all duration-200 ' +
                (isActive
                  ? 'bg-primary-500/10 text-primary-400'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200')
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-surface-700 p-2 sm:p-3 safe-bottom">
          <button
            onClick={() => { handleLogout(); setMobileOpen(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 sm:px-3 py-2.5 text-sm font-medium text-surface-400 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            disabled={loggingOut}
          >
            {loggingOut ? <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" /> : <LogOut className="h-5 w-5 flex-shrink-0" />}
            {sidebarOpen && <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content — sidebar is lg:static on desktop so it pushes content naturally */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex h-14 sm:h-16 items-center justify-between border-b border-surface-700 bg-surface-900/50 px-3 sm:px-4 lg:px-6 backdrop-blur-xl safe-top sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-1.5 sm:p-2 text-surface-400 hover:bg-surface-800 lg:hidden transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="hidden sm:inline text-xs sm:text-sm text-surface-400">Welcome back,</span>
            <span className="text-xs sm:text-sm font-medium text-surface-200 truncate max-w-[100px] sm:max-w-[150px]">{user?.name || 'Developer'}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-1.5 sm:p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
            <button
              onClick={() => navigate('/invitations')}
              className="relative rounded-lg p-1.5 sm:p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
              title="Invitations"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {inviteCount > 0 && (
                <span className="absolute right-0.5 sm:right-1 top-0.5 sm:top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                  {inviteCount > 9 ? '9+' : inviteCount}
                </span>
              )}
            </button>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] sm:text-xs font-bold text-white ml-1 sm:ml-2">
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
