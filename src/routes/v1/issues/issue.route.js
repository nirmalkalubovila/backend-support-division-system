const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const issueValidation = require('../../../validations/issue-management/issue.validation');
const issueController = require('../../../controllers/issue-management/issue.controller');
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

module.exports = router;
