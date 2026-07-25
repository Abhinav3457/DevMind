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
      root.style.backgroundColor = '#f8fafc';
    } else {
      root.classList.remove('light');
      root.style.backgroundColor = '#020617';
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <AppRoutes />
      </div>
    </ErrorBoundary>
  );
}

export default App;
