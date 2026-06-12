const authService = require('./auth/auth.service');
const tokenService = require('./auth/token.service');
const userService = require('./user-management/user.service');
const emailService = require('./email/email.service');
const settingService = require('./system/setting.service');
const reportService = require('./reports/report.service');
const exportService = require('./reports/export.service');

module.exports = {
  authService,
  tokenService,
  userService,
  emailService,
  settingService,
  reportService,
  exportService,
};
