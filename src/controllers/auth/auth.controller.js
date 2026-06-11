const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { authService, tokenService, userService, emailService } = require('../../services');

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send(tokens);
});

const forgotPassword = catchAsync(async (req, res) => {
  const user = await userService.getUserByEmail(req.body.email);
  if (user) {
    const resetPasswordToken = await tokenService.generateResetPasswordToken(user._id);
    await emailService.sendResetPasswordEmail(user.email, resetPasswordToken);
  }
  // Always return success to prevent email enumeration
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const getMe = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.user._id);
  res.send(user);
});

module.exports = { login, logout, refreshTokens, forgotPassword, resetPassword, getMe };
