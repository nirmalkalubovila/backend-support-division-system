const Joi = require('joi');

const getDailyReport = {
  query: Joi.object().keys({
    date: Joi.date().iso().optional(),
  }),
};

const getWeeklyReport = {
  query: Joi.object().keys({
    weekStart: Joi.date().iso().optional(),
  }),
};

const generateMonthlyReport = {
  body: Joi.object().keys({
    month: Joi.number().integer().min(1).max(12).required(),
    year: Joi.number().integer().min(2020).max(2099).required(),
  }),
};

const getMonthlyReport = {
  query: Joi.object().keys({
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2020).max(2099).optional(),
  }),
};

const buildExecutiveReport = {
  body: Joi.object().keys({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    projectId: Joi.string().optional().allow(null, ''),
    clientId: Joi.string().optional().allow(null, ''),
  }),
};

const getKpiAnalytics = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    granularity: Joi.string().valid('day', 'week', 'month').optional().default('day'),
  }),
};

const getUtilizationReport = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    projectId: Joi.string().optional().allow(null, ''),
  }),
};

const paginateReports = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'executive').optional(),
    sortBy: Joi.string().optional(),
  }),
};

const exportReport = {
  query: Joi.object().keys({
    format: Joi.string().valid('pdf', 'excel').required(),
  }),
};

const generateReport = {
  body: Joi.object().keys({
    type: Joi.string().valid('daily', 'weekly').required(),
    date: Joi.date().iso().optional(),
  }),
};

module.exports = {
  getDailyReport,
  getWeeklyReport,
  generateMonthlyReport,
  getMonthlyReport,
  buildExecutiveReport,
  getKpiAnalytics,
  getUtilizationReport,
  paginateReports,
  exportReport,
  generateReport,
};
