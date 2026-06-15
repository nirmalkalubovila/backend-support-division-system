const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { notificationService } = require('../../services');
const pick = require('../../utils/pick');

const getNotifications = catchAsync(async (req, res) => {
  const options = pick(req.query, ['limit', 'page']);
  const result = await notificationService.getNotificationsForUser(req.user.id, options);
  res.send(result);
});

const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.notificationId, req.user.id);
  res.send(notification);
});

const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.status(httpStatus.NO_CONTENT).send();
});

const deleteNotification = catchAsync(async (req, res) => {
  await notificationService.deleteNotification(req.params.notificationId, req.user.id);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
