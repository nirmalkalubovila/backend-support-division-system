const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { roleRights } = require('../config/roles');

const verifyCallback = (req, resolve, reject, requiredRight) => async (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.user = user;

  if (requiredRight) {
    const userRights = roleRights.get(user.role) || [];
    // Check role-based rights first, then user-specific permissions
    let hasRight = userRights.includes(requiredRight) || (user.permissions && user.permissions.includes(requiredRight));
    
    // Custom check: Allow assigned developer to update CR
    if (!hasRight && requiredRight === 'projects.cr.update' && req.params.crId) {
      try {
        const { ChangeRequest } = require('../models');
        const cr = await ChangeRequest.findOne({ _id: req.params.crId, deletedAt: null });
        if (cr && cr.assignedDevelopers && cr.assignedDevelopers.some(id => id.toString() === user.id.toString())) {
          hasRight = true;
        }
      } catch (err) {}
    }

    // Custom check: Allow assigned task user to update Task
    if (!hasRight && requiredRight === 'projects.task.update' && req.params.taskId) {
      try {
        const { Task } = require('../models');
        const task = await Task.findOne({ _id: req.params.taskId, deletedAt: null });
        if (task && task.assignees && task.assignees.some(id => id.toString() === user.id.toString())) {
          hasRight = true;
        }
      } catch (err) {}
    }

    // Custom check: Allow user to delete their own time log
    if (!hasRight && requiredRight === 'time_tracking.time_log.delete' && req.params.logId) {
      try {
        const { TimeLog } = require('../models');
        const log = await TimeLog.findOne({ _id: req.params.logId, deletedAt: null });
        if (log && log.user && log.user.toString() === user.id.toString()) {
          hasRight = true;
        }
      } catch (err) {}
    }

    if (!hasRight && user.role !== 'super_admin') {
      return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden — insufficient permissions'));
    }
  }

  resolve();
};

/**
 * Auth middleware — validates JWT and optionally checks permissions.
 * Usage: auth() for auth-only, auth('issues.issue.create') for auth + permission
 */
const auth = (requiredRight) => async (req, res, next) => {
  return new Promise((resolve, reject) => {
    passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRight))(req, res, next);
  })
    .then(() => next())
    .catch((err) => next(err));
};

module.exports = auth;
