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

export async function sendWorkspaceInviteEmail(
  to: string,
  inviterName: string,
  workspaceName: string,
  acceptUrl: string,
  declineUrl: string,
): Promise<void> {
  const html = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #3b82f6;">You're invited to a workspace!</h1>
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> invited you to join the workspace <strong>${workspaceName}</strong> on DevMind AI.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${acceptUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 6px;">Accept Invitation</a>
        <a href="${declineUrl}" style="background-color: #475569; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 6px;">Decline</a>
      </div>
      <p>If you don't have a DevMind AI account yet, you'll be able to create one and then accept the invitation.</p>
      <p style="color: #64748b; font-size: 12px;">This invitation will expire in 7 days.</p>
      <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({ to, subject: `${inviterName} invited you to "${workspaceName}" on DevMind AI`, html });
    logger.info('Workspace invitation email sent to:', to);
  } catch (error) {
    logger.error('Failed to send workspace invitation email:', error);
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
