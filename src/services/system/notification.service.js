const httpStatus = require('http-status');
const { Notification, User } = require('../../models');
const emailService = require('../email/email.service');
const { getIO } = require('../../config/socket');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const config = require('../../config/config');

/**
 * Create a notification and trigger Socket.io & Email deliveries
 * @param {Object} notificationBody
 * @returns {Promise<Notification>}
 */
const createNotification = async (notificationBody) => {
  const { recipient, sender, title, message, type, module, relatedId, relatedLink } = notificationBody;

  // Verify recipient exists
  const recipientUser = await User.findById(recipient);
  if (!recipientUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Recipient user not found');
  }

  // Create notification in DB
  const notification = await Notification.create({
    recipient,
    sender: sender || null,
    title,
    message,
    type: type || 'info',
    module,
    relatedId: relatedId || null,
    relatedLink: relatedLink || null,
  });

  // Emit WebSocket event
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${recipient}`).emit('new_notification', notification.toJSON());
      logger.info(`WebSocket notification emitted to user:${recipient}`);
    }
  } catch (error) {
    logger.error('Failed to emit real-time notification via WebSocket', { error: error.message });
  }

  // Send Email Notification (non-blocking, try-catch secured)
  // Check if SMTP host is configured to avoid crashes
  if (config.email.smtp.host && recipientUser.email) {
    // Run asynchronously without awaiting so response isn't blocked
    Promise.resolve().then(async () => {
      try {
        const subject = `[Support Portal] ${title}`;
        await emailService.sendNotificationEmail(recipientUser.email, subject, message);
        logger.info(`Notification email sent successfully to ${recipientUser.email}`);
      } catch (emailError) {
        logger.warn(`Failed to send notification email to ${recipientUser.email}: ${emailError.message}`);
      }
    });
  }

  return notification;
};

/**
 * Get notifications for a user (paginated, sorted by newest first)
 * @param {ObjectId} userId
 * @param {Object} options - Pagination options
 * @param {number} [options.limit] - Max number of notifications
 * @param {number} [options.page] - Page number
 * @returns {Promise<Object>}
 */
const getNotificationsForUser = async (userId, options = {}) => {
  const limit = parseInt(options.limit, 10) || 20;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  const query = { recipient: userId };

  const notifications = await Notification.find(query)
    .populate('sender', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalResults = await Notification.countDocuments(query);
  const totalPages = Math.ceil(totalResults / limit);
  const unreadCount = await Notification.countDocuments({ recipient: userId, readStatus: false });

  return {
    results: notifications,
    page,
    limit,
    totalPages,
    totalResults,
    unreadCount,
  };
};

/**
 * Mark a notification as read
 * @param {ObjectId} notificationId
 * @param {ObjectId} userId
 * @returns {Promise<Notification>}
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  notification.readStatus = true;
  await notification.save();
  return notification;
};

/**
 * Mark all notifications as read for a user
 * @param {ObjectId} userId
 * @returns {Promise<void>}
 */
const markAllAsRead = async (userId) => {
  await Notification.updateMany({ recipient: userId, readStatus: false }, { readStatus: true });
};

/**
 * Delete a notification
 * @param {ObjectId} notificationId
 * @param {ObjectId} userId
 * @returns {Promise<void>}
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  await notification.remove ? await notification.remove() : await Notification.deleteOne({ _id: notificationId });
};

module.exports = {
  createNotification,
  getNotificationsForUser,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
