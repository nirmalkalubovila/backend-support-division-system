const jwt = require('jsonwebtoken');
const config = require('../../config/config');
const { Token, tokenTypes } = require('../../models');

/**
 * Generate a JWT token
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expires.getTime() / 1000),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token to the database
 */
const saveToken = async (token, userId, expires, type, blacklisted = false) => {
  const tokenDoc = await Token.create({
    token,
    user: userId,
    expires,
    type,
    blacklisted,
  });
  return tokenDoc;
};

/**
 * Verify token and return token doc (or throw error)
 */
const verifyToken = async (token, type) => {
  const payload = jwt.verify(token, config.jwt.secret);
  const tokenDoc = await Token.findOne({ token, type, user: payload.sub, blacklisted: false });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

/**
 * Generate auth tokens (access + refresh)
 */
const generateAuthTokens = async (user) => {
  const accessExpires = new Date(Date.now() + config.jwt.accessExpirationMinutes * 60 * 1000);
  const accessToken = generateToken(user.id || user._id, accessExpires, tokenTypes.ACCESS);

  const refreshExpires = new Date(Date.now() + config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000);
  const refreshToken = generateToken(user.id || user._id, refreshExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, user.id || user._id, refreshExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessExpires.toISOString(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshExpires.toISOString(),
    },
  };
};

/**
 * Generate reset password token
 */
const generateResetPasswordToken = async (userId) => {
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const resetPasswordToken = generateToken(userId, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, userId, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

module.exports = {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
};
