import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Code2, Brain, Bug, FileText,
  Github, BarChart3, LogOut, ChevronLeft, ChevronRight,
  Bell, Menu, X, Users,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../../store';

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
  const { user, clearUser } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    clearUser();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-surface-950">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={
        'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-surface-800 bg-surface-900/95 backdrop-blur-xl transition-all duration-300 lg:static lg:z-auto ' +
        (sidebarOpen ? 'w-64' : 'w-0 lg:w-16') +
        (mobileOpen ? ' translate-x-0' : ' -translate-x-full lg:translate-x-0')
      }>
        {/* Logo */}
        <div className={'flex h-16 items-center border-b border-surface-800 px-4 ' + (sidebarOpen ? 'justify-between' : 'justify-center')}>
          {sidebarOpen && (
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Code2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-100">DevMind AI</span>
            </NavLink>
          )}
          <button onClick={toggleSidebar} className="hidden rounded-lg p-1.5 text-gray-500 hover:bg-surface-800 hover:text-gray-300 lg:block">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-800 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ' +
                (isActive
                  ? 'bg-primary-500/10 text-primary-400'
                  : 'text-gray-500 hover:bg-surface-800 hover:text-gray-300')
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-surface-800 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-surface-800 bg-surface-900/50 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-800 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-400">Welcome back,</span>
            <span className="text-sm font-medium text-gray-200">{user?.name || 'Developer'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-2 text-gray-500 hover:bg-surface-800 hover:text-gray-300 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
