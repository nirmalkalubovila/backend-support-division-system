const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const issueValidation = require('../../../validations/issue-management/issue.validation');
const issueController = require('../../../controllers/issue-management/issue.controller');
const commentController = require('../../../controllers/issue-management/comment.controller');
const activityLogger = require('../../../middlewares/activity-logger');
const { uploadIssueAttachments } = require('../../../middlewares/upload');

const router = express.Router();

router
  .route('/')
  .post(auth('issues.issue.create'), validate(issueValidation.createIssue), activityLogger('Create issue'), issueController.createIssue)
  .get(auth('issues.issue.read'), validate(issueValidation.getIssues), issueController.getIssues);

router
  .route('/:issueId')
  .get(auth('issues.issue.read'), validate(issueValidation.getIssue), issueController.getIssue)
  .patch(auth('issues.issue.update'), validate(issueValidation.updateIssue), activityLogger('Update issue'), issueController.updateIssue)
  .delete(auth('issues.issue.delete'), validate(issueValidation.deleteIssue), activityLogger('Delete issue'), issueController.deleteIssue);

// Attachment upload route
router
  .route('/:issueId/attachments')
  .post(auth('issues.issue.update'), uploadIssueAttachments.array('files', 5), activityLogger('Upload attachments'), issueController.uploadAttachments);

// Delete individual attachment
router
  .route('/:issueId/attachments/:attachmentId')
  .delete(auth('issues.issue.update'), activityLogger('Delete attachment'), issueController.deleteAttachment);

// Notify time limit exceeded route (A5 / E+)
router
  .route('/:issueId/time-exceeded')
  .post(auth('time_tracking.time_log.create'), validate(issueValidation.notifyTimeExceeded), issueController.notifyTimeExceeded);

// Comment routes (A7)
router
  .route('/:issueId/comments')
  .post(auth('issues.issue.read'), validate(issueValidation.addComment), commentController.addComment)
  .get(auth('issues.issue.read'), validate(issueValidation.getComments), commentController.getComments);

router
  .route('/:issueId/comments/:commentId')
  .delete(auth('issues.issue.read'), validate(issueValidation.deleteComment), commentController.deleteComment);

module.exports = router;

