import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRoutes } from './routes';

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface-950">
        <AppRoutes />
      </div>
    </ErrorBoundary>
  );
}

export default App;
