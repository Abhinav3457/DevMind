import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRoutes } from './routes';
import { useUIStore } from './store';

function App() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.style.backgroundColor = '#fafafa';
    } else {
      root.classList.remove('light');
      root.style.backgroundColor = '#0a0a0a';
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      {/* min-h-dvh (not min-h-screen) so the wrapper matches the dashboard
          shell's dynamic viewport height on mobile and can't force the body
          to scroll. Kept as `min-h-*` so tall auth pages still scroll. */}
      <div className="min-h-dvh">
        <AppRoutes />
      </div>
    </ErrorBoundary>
  );
}

export default App;
