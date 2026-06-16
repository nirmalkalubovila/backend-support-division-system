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
  const attachments = [];
  // Automatically attach branding logo if referenced in the HTML via cid:logo
  if (html.includes('cid:logo')) {
    const fs = require('fs');
    const path = require('path');
    let logoFilename = 'logo-1781585906524-749196031.webp'; // Fallback to the latest transparent logo
    try {
      const { Setting } = require('../../models');
      const brandingSetting = await Setting.findOne({ key: 'branding' });
      if (brandingSetting && brandingSetting.value && brandingSetting.value.logoUrl) {
        const urlParts = brandingSetting.value.logoUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        if (filename && filename.startsWith('logo-')) {
          logoFilename = filename;
        }
      }
    } catch (error) {
      logger.warn('Failed to dynamically fetch logo from db, using fallback:', error.message);
    }
    const logoPath = path.join(__dirname, '../../../uploads', logoFilename);
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: 'logo.webp',
        path: logoPath,
        cid: 'logo',
        contentType: 'image/webp',
      });
    }
  }
  const msg = { from: config.email.from, to, subject, html, attachments };
  await transport.sendMail(msg);
};

/**
 * Base template layout wrapper for consistent branding and aesthetics
 */
const getEmailHtmlWrapper = (headerTitle, headerSubtitle, contentHtml) => {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f8fafc;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 48px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: 6px solid #7ac82d;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #ffffff;
      padding: 40px 40px 28px 40px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .header h1 {
      margin: 0;
      color: #0f172a;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 6px 0 0 0;
      color: #64748b;
      font-size: 14px;
      font-weight: 500;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
      font-size: 15px;
      color: #334155;
    }
    .footer {
      padding: 32px 40px;
      background-color: #fafafa;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="cid:logo" alt="Prologics Logo" width="247" height="38" style="width: 247px; height: 38px; display: block; margin: 0 auto 20px auto;" />
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700;">${headerTitle}</h1>
        ${headerSubtitle ? `<p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">${headerSubtitle}</p>` : ''}
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p style="margin: 0;">This is an automated notification from the <strong>Support Division System</strong>.</p>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">&copy; ${currentYear} Prologics (Pvt) Ltd. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send reset password email
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = 'Reset your password — Support Division';
  const resetPasswordUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  
  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 12px;">Hi there,</h2>
    <p style="color: #475569; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6;">We received a request to reset your password. You can reset your credentials by clicking the button below:</p>
    <div style="text-align: center; margin: 36px 0;">
      <a href="${resetPasswordUrl}" 
         style="background-color: #7ac82d; background: linear-gradient(135deg, #7ac82d, #54a206); color: #ffffff !important; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(122, 200, 45, 0.25);">
        Reset Password
      </a>
    </div>
    
    <div style="background-color: #fbfbfe; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px; margin: 24px 0 12px 0;">
      <p style="margin: 0; color: #1e3a8a; font-size: 13px; font-weight: 600; line-height: 1.5;">⏰ Link Expiration Notice</p>
      <p style="margin: 4px 0 0 0; color: #2563eb; font-size: 13px; line-height: 1.5;">This password reset link will expire in <strong>10 minutes</strong>. After that, you will need to request a new reset link.</p>
    </div>
    
    <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0 0; text-align: center;">If you did not request this password reset, please ignore this email. Your credentials will remain secure.</p>
  `;

  const html = getEmailHtmlWrapper('Support Division', 'Password Reset Request', contentHtml);
  await sendEmail(to, subject, html);
};

/**
 * Send notification email
 */
const sendNotificationEmail = async (to, subject, titleOrMessage, message, relatedLink, type, metadata) => {
  // Handle signature variations: (to, subject, message) vs (to, subject, title, message, relatedLink, type, metadata)
  let displayTitle = subject.replace('[Support Portal] ', '');
  let displayMessage = titleOrMessage;
  let displayLink = null;
  let displayType = 'info';

  if (message !== undefined) {
    displayTitle = titleOrMessage;
    displayMessage = message;
    displayLink = relatedLink;
    displayType = type || 'info';
  }

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const actionUrl = displayLink ? `${baseUrl}${displayLink}` : `${baseUrl}/dashboard`;

  let borderColor = '#7ac82d'; // Info / default
  let badgeBgColor = '#f1fdf4';
  let badgeTextColor = '#16a34a';
  
  if (displayType === 'warning') {
    borderColor = '#f59e0b';
    badgeBgColor = '#fffbeb';
    badgeTextColor = '#d97706';
  } else if (displayType === 'error' || displayType === 'destructive') {
    borderColor = '#ef4444';
    badgeBgColor = '#fef2f2';
    badgeTextColor = '#dc2626';
  } else if (displayType === 'success') {
    borderColor = '#22c55e';
    badgeBgColor = '#f0fdf4';
    badgeTextColor = '#15803d';
  }

  let metadataHtml = '';
  if (metadata && (metadata.project || metadata.dueDate || metadata.slaDuration)) {
    const moment = require('moment');
    metadataHtml = `
      <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 18px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
          ${metadata.project ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 500; width: 130px; color: #64748b; vertical-align: middle;">Project:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">
              <span style="background-color: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 600;">${metadata.project}</span>
            </td>
          </tr>` : ''}
          ${metadata.slaDuration ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 500; color: #64748b; vertical-align: middle;">Resolution SLA:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">
              <span style="background-color: ${badgeBgColor}; color: ${badgeTextColor}; padding: 4px 10px; border-radius: 6px; display: inline-block; border: 1px solid ${borderColor}40; font-size: 12px; font-weight: 600;">${metadata.slaDuration}</span>
            </td>
          </tr>` : ''}
          ${metadata.dueDate ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 500; color: #64748b; vertical-align: middle;">Due Date:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">
              <span style="background-color: #f8fafc; color: #475569; padding: 4px 10px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 600;">${moment(metadata.dueDate).format('MMM DD, YYYY hh:mm A')}</span>
            </td>
          </tr>` : ''}
        </table>
      </div>
    `;
  }

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">${displayTitle}</h2>
    <div style="background-color: #ffffff; border-left: 4px solid ${borderColor}; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin: 24px 0; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
      <p style="color: #334155; font-size: 15px; margin: 0; font-weight: 500; line-height: 1.6;">${displayMessage}</p>
      ${metadataHtml}
    </div>
    <div style="text-align: center; margin: 36px 0 16px 0;">
      <a href="${actionUrl}" 
         style="background-color: #7ac82d; background: linear-gradient(135deg, #7ac82d, #54a206); color: #ffffff !important; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(122, 200, 45, 0.25);">
        View in Support Portal
      </a>
    </div>
  `;

  const html = getEmailHtmlWrapper('Support Division', 'System Notification', contentHtml);
  await sendEmail(to, displayTitle ? `[Support Portal] ${displayTitle}` : subject, html);
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (to, name, email, password, role) => {
  const subject = 'Welcome to Support Division Portal — Your Account is Ready!';
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 12px;">Welcome onboard, ${name}!</h2>
    <p style="color: #475569; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6;">Your account has been successfully created. You can now log in using the credentials below:</p>
    
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 28px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; color: #64748b; font-weight: 500; font-size: 14px; width: 140px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">Portal URL:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; vertical-align: middle;">
            <a href="${loginUrl}" style="color: #7ac82d; text-decoration: none; font-weight: 600;">${loginUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #64748b; font-weight: 500; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">Email Address:</td>
          <td style="padding: 12px 0; color: #0f172a; font-family: monospace; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">${email}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #64748b; font-weight: 500; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">Temporary Password:</td>
          <td style="padding: 12px 0; color: #0f172a; font-family: monospace; font-weight: bold; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; letter-spacing: 0.5px;">${password}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #64748b; font-weight: 500; font-size: 14px; vertical-align: middle;">Assigned Role:</td>
          <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-transform: capitalize; vertical-align: middle;">
            <span style="background-color: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0; font-size: 12px;">${role.replace('_', ' ')}</span>
          </td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${loginUrl}" 
         style="background-color: #7ac82d; background: linear-gradient(135deg, #7ac82d, #54a206); color: #ffffff !important; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(122, 200, 45, 0.25);">
        Log In to Portal
      </a>
    </div>
    
    <div style="background-color: #fff5f5; border-left: 4px solid #f56565; border-radius: 6px; padding: 16px; margin-top: 28px;">
      <p style="color: #c53030; font-size: 13px; font-weight: 600; margin: 0; display: inline-block;">
        ⚠️ Important Security Notice:
      </p>
      <p style="color: #9b2c2c; font-size: 13px; margin: 4px 0 0 0; line-height: 1.5;">For security reasons, please change your password immediately after logging in for the first time.</p>
    </div>
  `;

  const html = getEmailHtmlWrapper('Support Division Portal', 'Welcome Onboard', contentHtml);
  await sendEmail(to, subject, html);
};

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendNotificationEmail,
  sendWelcomeEmail,
};
