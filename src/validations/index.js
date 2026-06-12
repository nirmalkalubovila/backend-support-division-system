const authValidation = require('./auth/auth.validation');
const userValidation = require('./user-management/user.validation');
const projectValidation = require('./projects/project.validation');

module.exports = { authValidation, userValidation, projectValidation };
