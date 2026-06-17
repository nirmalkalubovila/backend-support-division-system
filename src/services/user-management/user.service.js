const httpStatus = require('http-status');
const { User } = require('../../models');
const ApiError = require('../../utils/ApiError');

/**
 * Create a user
 */
const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }

  const rawPassword = userBody.password;
  const user = await User.create(userBody);

  // Send Welcome Email (non-blocking)
  const config = require('../../config/config');
  if (config.email.smtp.host && user.email) {
    const emailService = require('../email/email.service');
    const logger = require('../../config/logger');
    Promise.resolve().then(async () => {
      try {
        await emailService.sendWelcomeEmail(user.email, user.name, user.email, rawPassword, user.role);
        logger.info(`Welcome email sent to newly created user: ${user.email}`);
      } catch (err) {
        logger.warn(`Failed to send welcome email to new user ${user.email}: ${err.message}`);
      }
    });
  }

  return user;
};

/**
 * Query users with pagination
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate({ ...filter, deletedAt: null }, options);
  return users;
};

/**
 * Get all users (no pagination)
 */
const getAllUsers = async () => {
  return User.find({ deletedAt: null }).select('-password').sort({ createdAt: -1 });
};

/**
 * Get user by ID
 */
const getUserById = async (id) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

/**
 * Get user by email
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email, deletedAt: null });
};

/**
 * Update user by ID
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  const oldRole = user.role;
  const oldIsActive = user.isActive;

  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();

  // F2: Notify user if their role/permissions were changed
  if (updateBody.role && updateBody.role !== oldRole) {
    try {
      const notificationService = require('../system/notification.service');
      await notificationService.createNotification({
        recipient: user._id,
        title: 'Permissions Changed',
        message: `Your role has been updated from "${oldRole.replace('_', ' ')}" to "${updateBody.role.replace('_', ' ')}". Your permissions have been adjusted accordingly.`,
        type: 'system',
        module: 'system',
        relatedId: user._id,
        relatedLink: '/profile',
      });
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send role change notification', { error: err.message });
    }
  }

  // F3 partial: Notify user if their account was deactivated
  if (updateBody.isActive === false && oldIsActive === true) {
    const config = require('../../config/config');
    if (config.email.smtp.host && user.email) {
      const emailService = require('../email/email.service');
      const logger = require('../../config/logger');
      Promise.resolve().then(async () => {
        try {
          await emailService.sendNotificationEmail(
            user.email,
            'Account Deactivated',
            'Account Status Update',
            'Your account on the Support Division Portal has been deactivated. If you believe this is an error, please contact your administrator.',
            '/login',
            'warning',
            {}
          );
          logger.info(`Account deactivation email sent to ${user.email}`);
        } catch (err) {
          logger.warn(`Failed to send deactivation email to ${user.email}: ${err.message}`);
        }
      });
    }
  }

  return user;
};

/**
 * Soft delete user by ID
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  user.deletedAt = new Date();
  user.isActive = false;
  await user.save();

  // F3: Send deactivation email
  const config = require('../../config/config');
  if (config.email.smtp.host && user.email) {
    const emailService = require('../email/email.service');
    const logger = require('../../config/logger');
    Promise.resolve().then(async () => {
      try {
        await emailService.sendNotificationEmail(
          user.email,
          'Account Deactivated',
          'Account Status Update',
          'Your account on the Support Division Portal has been deactivated. If you believe this is an error, please contact your administrator.',
          '/login',
          'warning',
          {}
        );
        logger.info(`Account deactivation email sent to ${user.email}`);
      } catch (err) {
        logger.warn(`Failed to send deactivation email to ${user.email}: ${err.message}`);
      }
    });
  }

  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
};
