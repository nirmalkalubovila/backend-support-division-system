const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const clientValidation = require('../../../validations/project-management/client.validation');
const clientController = require('../../../controllers/project-management/client.controller');
const activityLogger = require('../../../middlewares/activity-logger');

const router = express.Router();

router
  .route('/')
  .post(auth('projects.client.create'), validate(clientValidation.createClient), activityLogger('Create client'), clientController.createClient)
  .get(auth('projects.client.read'), validate(clientValidation.getClients), clientController.getClients);

router
  .route('/:clientId')
  .get(auth('projects.client.read'), validate(clientValidation.getClient), clientController.getClient)
  .patch(auth('projects.client.update'), validate(clientValidation.updateClient), activityLogger('Update client'), clientController.updateClient)
  .delete(auth('projects.client.delete'), validate(clientValidation.deleteClient), activityLogger('Delete client'), clientController.deleteClient);

module.exports = router;
