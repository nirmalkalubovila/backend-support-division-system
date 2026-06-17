const express = require('express');
const auth = require('../../../../middlewares/auth');
const validate = require('../../../../middlewares/validate');
const { uploadIssueAttachments } = require('../../../../middlewares/upload');
const crValidation = require('../../../../validations/project-management/cr.validation');
const crController = require('../../../../controllers/project-management/cr.controller');
const activityLogger = require('../../../../middlewares/activity-logger');

const router = express.Router({ mergeParams: true });

router.get('/stats', auth('projects.cr.read'), crController.getCRStats);

router
  .route('/')
  .get(auth('projects.cr.read'), validate(crValidation.getProjectCRs), crController.getProjectCRs)
  .post(auth('projects.cr.create'), validate(crValidation.createCR), activityLogger('Create change request'), crController.createCR);

router
  .route('/:crId')
  .get(auth('projects.cr.read'), validate(crValidation.getCR), crController.getCR)
  .patch(auth('projects.cr.update'), validate(crValidation.updateCR), activityLogger('Update change request'), crController.updateCR)
  .delete(auth('projects.cr.delete'), validate(crValidation.deleteCR), activityLogger('Delete change request'), crController.deleteCR);

router
  .route('/:crId/attachments')
  .post(auth('projects.cr.update'), uploadIssueAttachments.array('files', 10), crController.uploadAttachments);

router
  .route('/:crId/attachments/:attachmentId')
  .delete(auth('projects.cr.update'), crController.deleteAttachment);

router
  .route('/:crId/tasks')
  .get(auth('projects.cr.read'), crController.getCRTasks)
  .post(auth('projects.cr.update'), activityLogger('Link task to CR'), crController.linkTask);

router
  .route('/:crId/tasks/:taskId')
  .delete(auth('projects.cr.update'), activityLogger('Unlink task from CR'), crController.unlinkTask);

module.exports = router;
