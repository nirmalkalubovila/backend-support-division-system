const User = require('./user-management/user.model');
const { Token, tokenTypes } = require('./auth/token.model');
const ActivityLog = require('./system/activity-log.model');
const Permission = require('./system/permission.model');
const Role = require('./system/role.model');
const Setting = require('./system/setting.model');
const Report = require('./reports/report.model');
const Client = require('./project-management/client.model');
const Project = require('./project-management/project.model');
const Task = require('./project-management/task.model');
const Issue = require('./issue-management/issue.model');

module.exports = {
  User,
  Token,
  tokenTypes,
  ActivityLog,
  Permission,
  Role,
  Setting,
  Report,
  Client,
  Project,
  Task,
  Issue,
};
