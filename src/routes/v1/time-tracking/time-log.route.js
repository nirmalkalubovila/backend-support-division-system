const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const { timeLogValidation } = require('../../../validations');
const { timeLogController } = require('../../../controllers');
const activityLogger = require('../../../middlewares/activity-logger');

const router = express.Router();

router
  .route('/')
  .get(auth('time_tracking.time_log.read'), validate(timeLogValidation.getLogs), timeLogController.getTimeLogs);

router
  .route('/start')
  .post(auth('time_tracking.time_log.create'), validate(timeLogValidation.startTimer), activityLogger('Start time tracker'), timeLogController.startTimer);

router
  .route('/stop')
  .post(auth('time_tracking.time_log.create'), validate(timeLogValidation.stopTimer), activityLogger('Stop time tracker'), timeLogController.stopTimer);

router
  .route('/manual')
  .post(auth('time_tracking.time_log.create'), validate(timeLogValidation.createManualLog), activityLogger('Create manual time log'), timeLogController.createManualLog);

router
  .route('/:logId')
  .patch(auth('time_tracking.time_log.update'), validate(timeLogValidation.updateLog), activityLogger('Update time log'), timeLogController.updateTimeLog)
  .delete(auth('time_tracking.time_log.delete'), validate(timeLogValidation.deleteLog), activityLogger('Delete time log'), timeLogController.deleteTimeLog);

module.exports = router;
