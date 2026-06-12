const authController = require('./auth/auth.controller');
const userController = require('./user-management/user.controller');
const settingController = require('./system/setting.controller');
const reportController = require('./reports/report.controller');

module.exports = {
  authController,
  userController,
  settingController,
  reportController,
};
