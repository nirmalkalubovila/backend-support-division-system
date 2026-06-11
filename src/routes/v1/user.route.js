const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const userValidation = require('../../validations/user-management/user.validation');
const userController = require('../../controllers/user-management/user.controller');
const activityLogger = require('../../middlewares/activity-logger');

const router = express.Router();

router.post('/create', auth('user_management.user.create'), validate(userValidation.createUser), activityLogger('Create user'), userController.createUser);
router.get('/paginate', auth('user_management.user.read'), validate(userValidation.getUsers), userController.getUsers);
router.get('/all', auth('user_management.user.read'), userController.getAllUsers);
router.get('/:userId', auth('user_management.user.read'), validate(userValidation.getUser), userController.getUser);
router.patch('/:userId', auth('user_management.user.update'), validate(userValidation.updateUser), activityLogger('Update user'), userController.updateUser);
router.delete('/:userId', auth('user_management.user.delete'), validate(userValidation.deleteUser), activityLogger('Delete user'), userController.deleteUser);

module.exports = router;
