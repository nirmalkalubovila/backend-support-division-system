const authService = require('./auth/auth.service');
const tokenService = require('./auth/token.service');
const userService = require('./user-management/user.service');
const emailService = require('./email/email.service');

module.exports = {
  authService,
  tokenService,
  userService,
  emailService,
};
