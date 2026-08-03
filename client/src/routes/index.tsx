import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { WorkspaceDetailPage } from '../pages/WorkspaceDetailPage';
import { InvitationsPage } from '../pages/InvitationsPage';
import { AiChatPage } from '../pages/AiChatPage';
import { CodeReviewPage } from '../pages/CodeReviewPage';
import { DocGeneratorPage } from '../pages/DocGeneratorPage';
import { GitHubPage } from '../pages/GitHubPage';
import { GitHubCallback } from '../pages/GitHubCallback';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { CodeSearchPage } from '../pages/CodeSearchPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthGuard } from '../components/layout/AuthGuard';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/auth/verify-email/:token" element={<VerifyEmailPage />} />
      <Route path="/auth/github/callback" element={<GitHubCallback />} />
      <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/workspace/:id" element={<WorkspaceDetailPage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/invitations/:token" element={<InvitationsPage />} />
        <Route path="/github" element={<GitHubPage />} />
        <Route path="/ai/chat" element={<AiChatPage />} />
        <Route path="/ai/code-review" element={<CodeReviewPage />} />
        <Route path="/ai/docs" element={<DocGeneratorPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/search" element={<CodeSearchPage />} />
        <Route path="/settings" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}
