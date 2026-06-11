const authService = require('./auth/auth.service');
const tokenService = require('./auth/token.service');
const userService = require('./user-management/user.service');
const emailService = require('./email/email.service');
const settingService = require('./system/setting.service');

module.exports = {
  authService,
  tokenService,
  userService,
  emailService,
  settingService,
};
