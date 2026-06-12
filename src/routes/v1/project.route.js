const express = require('express');
const validate = require('../../middlewares/validate');
const { projectValidation } = require('../../validations');
const { projectController } = require('../../controllers');
const auth = require('../../middlewares/auth');

const router = express.Router();

router
  .route('/')
  .post(auth('projects.project.create'), validate(projectValidation.createProject), projectController.createProject)
  .get(auth('projects.project.read'), validate(projectValidation.getProjects), projectController.getProjects);

router
  .route('/:projectId')
  .get(auth('projects.project.read'), validate(projectValidation.getProject), projectController.getProject);

module.exports = router;
