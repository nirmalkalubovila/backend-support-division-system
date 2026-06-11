const rateLimit = require('express-rate-limit');
const config = require('../config/config');

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  skipSuccessfulRequests: false,
  message: { code: 429, message: 'Too many requests, please try again later.' },
});

module.exports = rateLimiter;
