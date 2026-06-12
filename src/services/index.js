const authService = require('./auth/auth.service');
const tokenService = require('./auth/token.service');
const userService = require('./user-management/user.service');
const emailService = require('./email/email.service');
const settingService = require('./system/setting.service');
const reportService = require('./reports/report.service');
const exportService = require('./reports/export.service');
const clientService = require('./project-management/client.service');
const projectService = require('./project-management/project.service');
const taskService = require('./project-management/task.service');
const issueService = require('./issue-management/issue.service');
const brandingService = require('./system/branding.service');

module.exports = {
  authService,
  tokenService,
  userService,
  emailService,
  settingService,
  reportService,
  exportService,
  clientService,
  projectService,
  taskService,
  issueService,
  brandingService,
};
