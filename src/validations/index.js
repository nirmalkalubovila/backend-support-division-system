const authValidation = require('./auth/auth.validation');
const userValidation = require('./user-management/user.validation');
const settingValidation = require('./system/setting.validation');

module.exports = { authValidation, userValidation, settingValidation };
