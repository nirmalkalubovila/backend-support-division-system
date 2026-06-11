const { ActivityLog } = require('../models');

const activityLogger = (action) => (req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - start;
      const logData = {
        user: req.user ? req.user.id || req.user._id : null,
        action,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
        status: res.statusCode,
        responseTime,
        details: {
          query: req.query,
          // Avoid logging sensitive fields
          body: { ...req.body },
        },
      };

      if (logData.details.body.password) {
        logData.details.body.password = '******';
      }
      if (logData.details.body.refreshToken) {
        logData.details.body.refreshToken = '******';
      }

      await ActivityLog.create(logData);
    } catch (error) {
      const logger = require('../config/logger');
      logger.error('Failed to save activity log', { error });
    }
  });

  next();
};

module.exports = activityLogger;
