const authController = require('./auth/auth.controller');
const userController = require('./user-management/user.controller');
const settingController = require('./system/setting.controller');

module.exports = {
  authController,
  userController,
  settingController,
};
