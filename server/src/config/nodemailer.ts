import nodemailer from 'nodemailer';
import { env } from './environment';

export function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"DevMind AI" <${env.SMTP_FROM}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
