const express = require('express');
const auth = require('../../../../middlewares/auth');
const validate = require('../../../../middlewares/validate');
const { uploadIssueAttachments } = require('../../../../middlewares/upload');
const taskValidation = require('../../../../validations/project-management/task.validation');
const taskController = require('../../../../controllers/project-management/task.controller');
const activityLogger = require('../../../../middlewares/activity-logger');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(auth('projects.project.read'), validate(taskValidation.getProjectTasks), taskController.getProjectTasks)
  .post(auth('projects.project.update'), validate(taskValidation.createTask), activityLogger('Create task'), taskController.createTask);

router
  .route('/:taskId')
  .get(auth('projects.project.read'), validate(taskValidation.getTask), taskController.getTask)
  .patch(auth('projects.project.update'), validate(taskValidation.updateTask), activityLogger('Update task'), taskController.updateTask)
  .delete(auth('projects.project.update'), validate(taskValidation.deleteTask), activityLogger('Delete task'), taskController.deleteTask);

router
  .route('/:taskId/attachments')
  .post(auth('projects.project.update'), uploadIssueAttachments.array('files', 5), taskController.uploadAttachments);

router
  .route('/:taskId/attachments/:attachmentId')
  .delete(auth('projects.project.update'), taskController.deleteAttachment);

module.exports = router;
