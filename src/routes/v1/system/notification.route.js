const express = require('express');
const auth = require('../../../middlewares/auth');
const { notificationController } = require('../../../controllers');

const router = express.Router();

router.get('/', auth(), notificationController.getNotifications);
router.patch('/read-all', auth(), notificationController.markAllAsRead);
router.patch('/:notificationId/read', auth(), notificationController.markAsRead);
router.delete('/:notificationId', auth(), notificationController.deleteNotification);

module.exports = router;
