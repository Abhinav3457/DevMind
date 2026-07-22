import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore();
  const token = localStorage.getItem('accessToken');
  const location = useLocation();

  if (!isAuthenticated && !token) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
