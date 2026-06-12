const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const { uploadProjectPhoto } = require('../../../middlewares/upload');
const projectValidation = require('../../../validations/project-management/project.validation');
const projectController = require('../../../controllers/project-management/project.controller');
const activityLogger = require('../../../middlewares/activity-logger');

const router = express.Router();

router
  .route('/')
  .post(
    auth('projects.project.create'),
    uploadProjectPhoto.single('photo'),
    activityLogger('Create project'),
    projectController.createProject
  )
  .get(auth('projects.project.read'), validate(projectValidation.getProjects), projectController.getProjects);

router
  .route('/:projectId')
  .get(auth('projects.project.read'), validate(projectValidation.getProject), projectController.getProject)
  .patch(
    auth('projects.project.update'),
    uploadProjectPhoto.single('photo'),
    activityLogger('Update project'),
    projectController.updateProject
  )
  .delete(auth('projects.project.delete'), validate(projectValidation.deleteProject), activityLogger('Delete project'), projectController.deleteProject);

module.exports = router;
