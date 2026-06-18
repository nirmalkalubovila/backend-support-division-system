/**
 * Role hierarchy and default permissions.
 * Roles listed from highest to lowest privilege.
 */
const roles = ['super_admin', 'manager', 'senior_engineer', 'engineer', 'intern'];

const roleRights = new Map();

// Intern — minimal: can only view own issues, log time
roleRights.set('intern', [
  'issues.issue.read',
  'projects.project.read',
  'projects.task.read',
  'projects.cr.read',
  'time_tracking.time_log.create',
  'time_tracking.time_log.read',
  'reports.user_performance.read',
]);

// Engineer — frontline resolution
roleRights.set('engineer', [
  ...roleRights.get('intern'),
  'issues.issue.update', // update status, add notes
  'time_tracking.time_log.update',
]);

// Senior Engineer — can also assign, close, create issues
roleRights.set('senior_engineer', [
  ...roleRights.get('engineer'),
  'issues.issue.create',
  'projects.project.read',
  'projects.client.read',
  'projects.task.read',
  'projects.cr.read',
  'finance.payment.read',
]);

// Manager / PM — full project + report + user access
roleRights.set('manager', [
  ...roleRights.get('senior_engineer'),
  'projects.project.create',
  'projects.project.update',
  'projects.project.delete',
  'projects.client.create',
  'projects.client.update',
  'projects.client.delete',
  'projects.task.create',
  'projects.task.update',
  'projects.task.delete',
  'projects.cr.create',
  'projects.cr.update',
  'projects.cr.delete',
  'reports.project_performance.create',
  'reports.project_performance.read',
  'reports.project_performance.update',
  'reports.project_performance.delete',
  'reports.user_performance.create',
  'reports.user_performance.update',
  'reports.user_performance.delete',
  'reports.executive_performance.create',
  'reports.executive_performance.read',
  'reports.executive_performance.update',
  'reports.executive_performance.delete',
  'time_tracking.time_log.delete',
  'system.settings.read',
  'system.priority.read',
  'system.priority.update',
  'system.category.read',
  'system.category.create',
  'system.category.update',
  'system.category.delete',
  'system.notification.read',
  'system.notification.update',
  'user_management.user.create',
  'user_management.user.read',
  'user_management.user.update',
  'user_management.user.delete',
  'finance.payment.read',
  'finance.payment.create',
  'finance.payment.update',
  'finance.payment.delete',
]);

// Super Admin — everything
roleRights.set('super_admin', [
  ...roleRights.get('manager'),
  'issues.issue.delete',
  'system.settings.update',
  'system.settings.delete',
]);

module.exports = { roles, roleRights };
