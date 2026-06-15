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

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (to, name, email, password, role) => {
  const subject = 'Welcome to Support Division Portal — Your Account is Ready!';
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #6366f1; margin: 0; font-size: 24px;">Support Division Portal</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Welcome onboard, ${name}!</p>
      </div>
      
      <p>Hi ${name},</p>
      <p>Your account has been successfully created. You can now log in using the credentials below:</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: bold; width: 140px;">Portal URL:</td>
            <td style="padding: 6px 0; color: #0f172a;"><a href="${loginUrl}" style="color: #6366f1; text-decoration: none;">${loginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Email Address:</td>
            <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Password:</td>
            <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${password}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: bold;">System Role:</td>
            <td style="padding: 6px 0; color: #0f172a; text-transform: capitalize;">${role.replace('_', ' ')}</td>
          </tr>
        </table>
      </div>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" 
           style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Log In to Portal
        </a>
      </p>
      
      <p style="color: #ef4444; font-size: 13px; font-weight: 500;">
        Important: For security reasons, please change your password immediately after logging in for the first time.
      </p>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0;">
        This is an automated system email. If you did not expect this account, please contact system admin.
      </p>
    </div>
  `;
  await sendEmail(to, subject, html);
};

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendNotificationEmail,
  sendWelcomeEmail,
};
