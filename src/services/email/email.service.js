const nodemailer = require('nodemailer');
const config = require('../../config/config');
const logger = require('../../config/logger');

const transport = nodemailer.createTransport(config.email.smtp);

// Verify transport on startup (non-blocking)
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() => logger.warn('Unable to connect to email server. Check SMTP config in .env'));
}

/**
 * Send an email
 */
const sendEmail = async (to, subject, html) => {
  const msg = { from: config.email.from, to, subject, html };
  await transport.sendMail(msg);
};

/**
 * Send reset password email
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = 'Reset your password — Support Division';
  const resetPasswordUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Support Division</h2>
      <p>Hi,</p>
      <p>You requested a password reset. Click the button below to set a new password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetPasswordUrl}" 
           style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p style="color: #64748b; font-size: 12px;">This link expires in 10 minutes. If you didn't request this, please ignore this email.</p>
    </div>
  `;
  await sendEmail(to, subject, html);
};

/**
 * Send notification email
 */
const sendNotificationEmail = async (to, subject, message) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Support Division</h2>
      <p>${message}</p>
      <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="color: #64748b; font-size: 12px;">This is an automated notification from the Support Division System.</p>
    </div>
  `;
  await sendEmail(to, subject, html);
};

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendNotificationEmail,
};
