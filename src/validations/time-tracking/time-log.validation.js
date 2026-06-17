const Joi = require('joi');

const startTimer = {
  body: Joi.object().keys({
    issueId: Joi.string().required(),
    workType: Joi.string().valid('Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client').required(),
    note: Joi.string().allow(''),
    isBillable: Joi.boolean().default(true),
  }),
};

const stopTimer = {
  body: Joi.object().keys({
    issueId: Joi.string().required(),
    note: Joi.string().allow(''),
  }),
};

const createManualLog = {
  body: Joi.object().keys({
    issueId: Joi.string().required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    workType: Joi.string().valid('Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client').required(),
    note: Joi.string().allow(''),
    isBillable: Joi.boolean().default(true),
  }),
};

const updateLog = {
  params: Joi.object().keys({
    logId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      workType: Joi.string().valid('Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client'),
      note: Joi.string().allow(''),
      duration: Joi.number().min(0).allow(null),
      isBillable: Joi.boolean(),
      approved: Joi.boolean(),
      startTime: Joi.date().iso(),
      endTime: Joi.date().iso(),
    })
    .min(1),
};

const getLogs = {
  query: Joi.object().keys({
    issue: Joi.string(),
    user: Joi.string(),
    project: Joi.string(),
    approved: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const deleteLog = {
  params: Joi.object().keys({
    logId: Joi.string().required(),
  }),
};

module.exports = {
  startTimer,
  stopTimer,
  createManualLog,
  updateLog,
  getLogs,
  deleteLog,
};
