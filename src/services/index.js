const authService = require('./auth/auth.service');
const tokenService = require('./auth/token.service');
const userService = require('./user-management/user.service');
const emailService = require('./email/email.service');
const clientService = require('./project-management/client.service');
const projectService = require('./project-management/project.service');
const issueService = require('./issue-management/issue.service');

module.exports = {
  authService,
  tokenService,
  userService,
  emailService,
  projectService: require('./projects/project.service'),
  clientService,
  projectService,
  issueService,
};
