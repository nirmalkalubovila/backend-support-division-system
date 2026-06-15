const authValidation = require('./auth/auth.validation');
const userValidation = require('./user-management/user.validation');
const settingValidation = require('./system/setting.validation');
const reportValidation = require('./reports/report.validation');
const timeLogValidation = require('./time-tracking/time-log.validation');

module.exports = {
  authValidation,
  userValidation,
  settingValidation,
  reportValidation,
  timeLogValidation,
};
