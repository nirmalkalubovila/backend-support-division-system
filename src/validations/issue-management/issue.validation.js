const Joi = require('joi');

const createIssue = {
  body: Joi.object().keys({
    title: Joi.string().required().max(150),
    description: Joi.string().required(),
    client: Joi.string().allow(null, ''),
    project: Joi.string().required(),
    priority: Joi.string().valid('Critical', 'High', 'Medium', 'Low').default('Medium'),
    type: Joi.string().default('Bug'),
    assignedTo: Joi.string().allow(null, ''),
    estimatedHours: Joi.number().min(0).allow(null),
  }),
};

const getIssues = {
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    client: Joi.string(),
    project: Joi.string(),
    priority: Joi.string().valid('Critical', 'High', 'Medium', 'Low'),
    type: Joi.string(),
    status: Joi.string().valid(
      'Backlog',
      'Assigned',
      'Planned Solution',
      'In Progress',
      'Testing',
      'On Hold',
      'Pending Client',
      'Resolved',
      'Closed',
      'Reopened'
    ),
    assignedTo: Joi.string().allow(null, 'null', ''),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getIssue = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
};

const updateIssue = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string().max(150),
      description: Joi.string(),
      priority: Joi.string().valid('Critical', 'High', 'Medium', 'Low'),
      type: Joi.string(),
      status: Joi.string().valid(
        'Backlog',
        'Assigned',
        'Planned Solution',
        'In Progress',
        'Testing',
        'On Hold',
        'Pending Client',
        'Resolved',
        'Closed',
        'Reopened'
      ),
      assignedTo: Joi.string().allow(null, ''),
      estimatedHours: Joi.number().min(0).allow(null),
      expandReason: Joi.string().allow(null, ''),
      technicalApproach: Joi.string().allow(null, ''),
      timeRequest: Joi.object().keys({
        hours: Joi.number().min(0.1).required(),
        reason: Joi.string().required().max(1000),
      }).allow(null),
    })
    .min(1),
};

const deleteIssue = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
};

const addComment = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    content: Joi.string().required().min(1).max(5000),
  }),
};

const getComments = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
  }),
};

const deleteComment = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
    commentId: Joi.string().required(),
  }),
};

const notifyTimeExceeded = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    activeDuration: Joi.number().required().min(0),
  }),
};

module.exports = {
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssue,
  addComment,
  getComments,
  deleteComment,
  notifyTimeExceeded,
};
