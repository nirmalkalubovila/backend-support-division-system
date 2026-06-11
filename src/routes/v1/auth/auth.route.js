const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const authValidation = require('../../../validations/auth/auth.validation');
const authController = require('../../../controllers/auth/auth.controller');
const activityLogger = require('../../../middlewares/activity-logger');

const router = express.Router();

router.post('/login', validate(authValidation.login), activityLogger('User login'), authController.login);
router.post('/logout', validate(authValidation.logout), activityLogger('User logout'), authController.logout);
router.post('/refresh-tokens', validate(authValidation.refreshTokens), activityLogger('Refresh JWT tokens'), authController.refreshTokens);
router.post('/forgot-password', validate(authValidation.forgotPassword), activityLogger('Forgot password request'), authController.forgotPassword);
router.post('/reset-password', validate(authValidation.resetPassword), activityLogger('Reset password'), authController.resetPassword);
router.get('/me', auth(), authController.getMe);

module.exports = router;
