const Joi = require('joi');

const getTeamComparison = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
  }),
};

const getScorecard = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    userId: Joi.string().optional(),
  }),
};

module.exports = {
  getTeamComparison,
  getScorecard,
};
