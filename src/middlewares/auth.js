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
    const hasRight = userRights.includes(requiredRight) || (user.permissions && user.permissions.includes(requiredRight));
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
