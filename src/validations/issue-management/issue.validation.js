const Joi = require('joi');

const createIssue = {
  body: Joi.object().keys({
    title: Joi.string().required().max(150),
    description: Joi.string().required(),
    client: Joi.string().required(),
    project: Joi.string().required(),
    priority: Joi.string().valid('Critical', 'High', 'Medium', 'Low').default('Medium'),
    type: Joi.string().valid('Bug', 'Feature Request', 'Access Issue', 'Data Correction', 'Performance', 'Consultation').default('Bug'),
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
    type: Joi.string().valid('Bug', 'Feature Request', 'Access Issue', 'Data Correction', 'Performance', 'Consultation'),
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
      type: Joi.string().valid('Bug', 'Feature Request', 'Access Issue', 'Data Correction', 'Performance', 'Consultation'),
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
      technicalApproach: Joi.string().allow(null, ''),
    })
    .min(1),
};

const deleteIssue = {
  params: Joi.object().keys({
    issueId: Joi.string().required(),
  }),
};

module.exports = {
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssue,
};
