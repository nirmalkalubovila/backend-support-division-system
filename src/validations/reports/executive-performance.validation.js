const Joi = require('joi');

const getExecutivePerformanceData = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
  }),
};

module.exports = {
  getExecutivePerformanceData,
};
