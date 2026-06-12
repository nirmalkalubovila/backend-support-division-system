const express = require('express');
const auth = require('../../../middlewares/auth');
const activityLogger = require('../../../middlewares/activity-logger');
const { uploadLogo } = require('../../../middlewares/upload');
const brandingController = require('../../../controllers/system/branding.controller');

const router = express.Router();

router
  .route('/branding')
  .get(brandingController.getBranding)
  .patch(auth('system.settings.update'), activityLogger('Update branding'), brandingController.updateBranding);

router
  .route('/logo')
  .post(auth('system.settings.update'), uploadLogo.single('logo'), activityLogger('Upload branding logo'), brandingController.uploadLogo);

module.exports = router;
