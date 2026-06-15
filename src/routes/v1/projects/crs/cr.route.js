const express = require('express');
const auth = require('../../../../middlewares/auth');
const validate = require('../../../../middlewares/validate');
const { uploadIssueAttachments } = require('../../../../middlewares/upload');
const crValidation = require('../../../../validations/project-management/cr.validation');
const crController = require('../../../../controllers/project-management/cr.controller');
const activityLogger = require('../../../../middlewares/activity-logger');

const router = express.Router({ mergeParams: true });

router.get('/stats', auth('projects.project.read'), crController.getCRStats);

router
  .route('/')
  .get(auth('projects.project.read'), validate(crValidation.getProjectCRs), crController.getProjectCRs)
  .post(auth('projects.project.update'), validate(crValidation.createCR), activityLogger('Create change request'), crController.createCR);

router
  .route('/:crId')
  .get(auth('projects.project.read'), validate(crValidation.getCR), crController.getCR)
  .patch(auth('projects.project.update'), validate(crValidation.updateCR), activityLogger('Update change request'), crController.updateCR)
  .delete(auth('projects.project.update'), validate(crValidation.deleteCR), activityLogger('Delete change request'), crController.deleteCR);

router
  .route('/:crId/attachments')
  .post(auth('projects.project.update'), uploadIssueAttachments.array('files', 10), crController.uploadAttachments);

router
  .route('/:crId/attachments/:attachmentId')
  .delete(auth('projects.project.update'), crController.deleteAttachment);

module.exports = router;
