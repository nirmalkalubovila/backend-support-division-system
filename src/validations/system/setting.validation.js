const Joi = require('joi');

const updateBranding = {
  body: Joi.object().keys({
    companyName: Joi.string().required().max(100),
    slogan: Joi.string().required().max(150),
    primaryColor: Joi.string().required().regex(/^#[0-9A-Fa-f]{6}$/),
    logoUrl: Joi.string().allow(null, '').max(500),
  }),
};

module.exports = {
  updateBranding,
};
