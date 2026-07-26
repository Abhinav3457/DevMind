import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Code2, Brain, Bug, FileText,
  Github, BarChart3, LogOut, ChevronLeft,
  Bell, Menu, X, Users, Sun, Moon,
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

// ── Animation Variants ─────────────────────────────────────────────

const sidebarVariants = {
  closed: {
    x: '-100%',
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 35,
      mass: 1,
    },
  },
  open: {
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      mass: 0.8,
      staggerChildren: 0.04,
      delayChildren: 0.06,
    },
  },
};

const navItemVariants = {
  closed: { opacity: 0, x: -20 },
  open: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
};

const iconSwapVariants = {
  initial: { rotate: -90, opacity: 0, scale: 0.5 },
  animate: { rotate: 0, opacity: 1, scale: 1 },
  exit: { rotate: 90, opacity: 0, scale: 0.5 },
};

export function AppLayout() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuthStore();
  const { theme, setTheme, sidebarOpen, toggleSidebar } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    clearUser();
    navigate('/auth/login', { replace: true });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex min-h-screen min-h-dvh bg-surface-950">
      {/* ── Mobile Sidebar Overlay ─────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      {/* Desktop: static flow, pushes content. Mobile: fixed overlay with spring slide-in. */}
      <aside
        className={
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-surface-700 bg-surface-900/95 backdrop-blur-xl safe-top transition-all duration-300 ' +
          'lg:static lg:z-auto ' +
          (sidebarOpen ? 'w-64' : 'w-0 lg:w-16') +
          (mobileOpen
            ? ' translate-x-0 shadow-2xl shadow-black/40'
            : ' -translate-x-full lg:translate-x-0')
        }
      >
        <SidebarContent
          sidebarOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          closeMobile={() => setMobileOpen(false)}
          animate={false}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile Animated Sidebar (overlays via AnimatePresence) ── */}
      {/* Only rendered when mobileOpen = true */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="mobile-sidebar"
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-surface-700 bg-surface-900/95 backdrop-blur-xl safe-top shadow-2xl shadow-black/40 lg:!hidden"
          >
            <SidebarContent
              sidebarOpen={true}
              toggleSidebar={() => setMobileOpen(false)}
              closeMobile={() => setMobileOpen(false)}
              animate={true}
              variants={navItemVariants}
              onLogout={handleLogout}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col min-w-0 transition-all duration-300 lg:ml-16"
        style={sidebarOpen ? { marginLeft: '16rem' } : { marginLeft: '4rem' }}
      >
        {/* Top Bar */}
        <header className="flex h-14 sm:h-16 items-center justify-between border-b border-surface-700 bg-surface-900/50 px-3 sm:px-4 lg:px-6 backdrop-blur-xl safe-top sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.button
              onClick={() => setMobileOpen(!mobileOpen)}
              whileTap={{ scale: 0.9 }}
              className="relative rounded-lg p-1.5 sm:p-2 text-surface-400 hover:bg-surface-800 lg:hidden transition-colors overflow-hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <motion.div
                animate={mobileOpen ? { rotate: 90, scale: 1.1 } : { rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </motion.div>
            </motion.button>

            <span className="hidden xs:inline text-xs sm:text-sm text-surface-400">Welcome back,</span>
            <span className="text-xs sm:text-sm font-medium text-surface-200 truncate max-w-[100px] sm:max-w-[150px]">{user?.name || 'Developer'}</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="rounded-lg p-1.5 sm:p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={theme}
                  variants={iconSwapVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="relative rounded-lg p-1.5 sm:p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
                className="absolute right-1 sm:right-1.5 top-1 sm:top-1.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500"
              />
            </motion.button>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] sm:text-xs font-bold text-white ml-1 sm:ml-2 cursor-default"
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </motion.div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── Sidebar Content Component ──────────────────────────────────────

interface SidebarContentProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeMobile: () => void;
  animate?: boolean;
  variants?: typeof navItemVariants;
  onLogout?: () => void;
}

function SidebarContent({
  sidebarOpen,
  toggleSidebar,
  closeMobile,
  animate = false,
  variants = navItemVariants,
  onLogout,
}: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className={`flex h-14 sm:h-16 items-center border-b border-surface-700 px-3 sm:px-4 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
        {sidebarOpen && (
          <NavLink to="/dashboard" className="flex items-center gap-2 min-w-0" onClick={closeMobile}>
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600"
            >
              <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </motion.div>
            <motion.span
              initial={animate ? { opacity: 0, x: -10 } : false}
              animate={animate ? { opacity: 1, x: 0 } : false}
              transition={{ delay: 0.08, duration: 0.3 }}
              className="text-xs sm:text-sm font-bold text-surface-100 truncate"
            >
              DevMind AI
            </motion.span>
          </NavLink>
        )}
        <button
          onClick={sidebarOpen ? toggleSidebar : closeMobile}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Close menu'}
        >
          <motion.div
            animate={{ rotate: sidebarOpen ? 0 : 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 sm:p-3">
        {navItems.map((item) => (
          <motion.div
            key={item.to}
            variants={animate ? variants : undefined}
          >
            <NavLink
              to={item.to}
              onClick={closeMobile}
              className={({ isActive }) =>
                'group flex items-center gap-3 rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-sm font-medium transition-all duration-200 relative ' +
                (isActive
                  ? 'bg-primary-500/10 text-primary-400'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200')
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {sidebarOpen && (
                <span className="truncate">{item.label}</span>
              )}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-surface-700 p-2 sm:p-3 safe-bottom">
        <motion.button
          onClick={() => {
            onLogout?.();
            closeMobile();
          }}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 sm:px-3 py-2.5 text-sm font-medium text-surface-400 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {sidebarOpen && (
            <motion.span
              initial={animate ? { opacity: 0, x: -10 } : false}
              animate={animate ? { opacity: 1, x: 0 } : false}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              Sign Out
            </motion.span>
          )}
        </motion.button>
      </div>
    </>
  );
}
