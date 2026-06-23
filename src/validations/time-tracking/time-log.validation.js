const Joi = require('joi');

const startTimer = {
  body: Joi.object().keys({
    issueId: Joi.string().allow('', null),
    taskId: Joi.string().allow('', null),
    crId: Joi.string().allow('', null),
    workType: Joi.string().valid('Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client', 'To Do', 'Review', 'Done', 'Submitted', 'Rejected', 'In Development', 'Completed', 'Development', 'Investigation', 'Communication', 'Documentation', 'Docs', 'Deployment').required(),
    note: Joi.string().allow(''),
    isBillable: Joi.boolean().default(true),
  }).or('issueId', 'taskId', 'crId'),
};
 
const stopTimer = {
  body: Joi.object().keys({
    issueId: Joi.string().allow('', null),
    taskId: Joi.string().allow('', null),
    crId: Joi.string().allow('', null),
    note: Joi.string().allow(''),
    activeDuration: Joi.number().min(0).allow(null, ''),
  }).or('issueId', 'taskId', 'crId'),
};
 
const createManualLog = {
  body: Joi.object().keys({
    issueId: Joi.string().allow('', null),
    taskId: Joi.string().allow('', null),
    crId: Joi.string().allow('', null),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    workType: Joi.string().valid('Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client', 'To Do', 'Review', 'Done', 'Submitted', 'Rejected', 'In Development', 'Completed', 'Development', 'Investigation', 'Communication', 'Documentation', 'Docs', 'Deployment').required(),
    note: Joi.string().allow(''),
    isBillable: Joi.boolean().default(true),
  }).or('issueId', 'taskId', 'crId'),
};
 
const updateLog = {
  params: Joi.object().keys({
    logId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      workType: Joi.string().valid('Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client', 'To Do', 'Review', 'Done', 'Submitted', 'Rejected', 'In Development', 'Completed', 'Development', 'Investigation', 'Communication', 'Documentation', 'Docs', 'Deployment'),
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
    task: Joi.string(),
    cr: Joi.string(),
    user: Joi.string(),
    project: Joi.string(),
    approved: Joi.boolean(),
    active: Joi.boolean(),
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
