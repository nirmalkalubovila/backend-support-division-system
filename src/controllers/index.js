const authController = require('./auth/auth.controller');
const userController = require('./user-management/user.controller');
const settingController = require('./system/setting.controller');
const reportController = require('./reports/report.controller');
const timeLogController = require('./time-tracking/time-log.controller');
const notificationController = require('./system/notification.controller');
const commentController = require('./issue-management/comment.controller');

module.exports = {
  authController,
  userController,
  settingController,
  reportController,
  timeLogController,
  notificationController,
  commentController,
};
