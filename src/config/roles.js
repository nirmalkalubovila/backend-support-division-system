/**
 * Role hierarchy and default permissions.
 * Roles listed from highest to lowest privilege.
 */
const roles = ['super_admin', 'manager', 'senior_engineer', 'engineer', 'intern'];

const roleRights = new Map();

// Intern — minimal: can only view own issues, log time
roleRights.set('intern', [
  'issues.issue.read',
  'time_tracking.time_log.create',
  'time_tracking.time_log.read',
  'reports.daily_report.read',
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
  'issues.issue.delete', // close
  'projects.project.read',
  'projects.client.read',
]);

// Manager / PM — full project + report access
roleRights.set('manager', [
  ...roleRights.get('senior_engineer'),
  'projects.project.create',
  'projects.project.update',
  'projects.project.delete',
  'projects.client.create',
  'projects.client.update',
  'projects.client.delete',
  'reports.daily_report.read',
  'reports.weekly_report.read',
  'reports.monthly_report.read',
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
]);

// Super Admin — everything
roleRights.set('super_admin', [
  ...roleRights.get('manager'),
  'user_management.user.create',
  'user_management.user.read',
  'user_management.user.update',
  'user_management.user.delete',
  'system.settings.update',
  'system.settings.delete',
]);

module.exports = { roles, roleRights };
