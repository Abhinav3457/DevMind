import { sendEmail } from '../config/nodemailer';
import logger from '../utils/logger';

export async function sendVerificationEmail(
  to: string,
  name: string,
  verificationToken: string,
): Promise<void> {
  const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/verify-email/${verificationToken}`;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #3b82f6;">Welcome to DevMind AI!</h1>
      <p>Hi ${name},</p>
      <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="color: #64748b; word-break: break-all;">${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
      <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you did not create an account, please ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({ to, subject: 'Verify your DevMind AI account', html });
    logger.info('Verification email sent to:', to);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
  }
}

export async function sendReviewCompleteEmail(
  to: string,
  name: string,
  info: { repoName: string; score: number; totalIssues: number },
): Promise<void> {
  const html = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #3b82f6;">Code Review Complete ✨</h1>
      <p>Hi ${name},</p>
      <p>Your AI code review for <strong>${info.repoName}</strong> has finished.</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Quality Score</p>
        <p style="margin: 4px 0 0; font-size: 32px; font-weight: bold; color: #0f172a;">${info.score}/100</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${info.totalIssues} issue${info.totalIssues === 1 ? '' : 's'} found</p>
      </div>
      <p style="color: #64748b; font-size: 13px;">Open DevMind AI to view the full report with suggestions and a fixed version.</p>
      <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">— DevMind AI</p>
    </div>
  `;

  try {
    await sendEmail({ to, subject: 'Your code review is ready', html });
    logger.info('Review complete email sent to:', to);
  } catch (error) {
    logger.error('Failed to send review complete email:', error);
  }
}

export async function sendIndexCompleteEmail(
  to: string,
  name: string,
  info: { repoName: string; fileCount: number; chunkCount: number },
): Promise<void> {
  const html = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #3b82f6;">Repository Indexed 🚀</h1>
      <p>Hi ${name},</p>
      <p><strong>${info.repoName}</strong> has been successfully indexed and is ready for AI questions, code review, and documentation generation.</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">${info.fileCount} files · ${info.chunkCount} chunks</p>
      </div>
      <p style="color: #64748b; font-size: 13px;">Ask your codebase anything in the AI Chat → Repo mode.</p>
      <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">— DevMind AI</p>
    </div>
  `;

  try {
    await sendEmail({ to, subject: 'Your repository finished indexing', html });
    logger.info('Index complete email sent to:', to);
  } catch (error) {
    logger.error('Failed to send index complete email:', error);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string,
): Promise<void> {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/reset-password/${resetToken}`;

  const html = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #3b82f6;">Reset Your Password</h1>
      <p>Hi ${name},</p>
      <p>You requested a password reset. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="color: #64748b; word-break: break-all;">${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({ to, subject: 'Reset your DevMind AI password', html });
    logger.info('Password reset email sent to:', to);
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
  }
}
