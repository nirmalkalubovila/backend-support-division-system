const Joi = require('joi');

const createProject = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    client: Joi.string().allow('', null),
    clientContact: Joi.string().allow('', null),
    status: Joi.string().valid('Active', 'Inactive', 'On Hold').default('Active'),
    description: Joi.string().allow('', null),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    projectTypes: Joi.array().items(Joi.string()).allow(null),
    photoUrl: Joi.string().allow('', null),
    usedHours: Joi.number().default(0),
    allocatedHours: Joi.number().default(0),
    openIssues: Joi.number().default(0),
    closedIssues: Joi.number().default(0),
  }),
};

const getProjects = {
  query: Joi.object().keys({
    name: Joi.string(),
    client: Joi.string(),
    status: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getProject = {
  params: Joi.object().keys({
    projectId: Joi.string().required(), // or Joi.string().custom(objectId) if they use objectId validation
  }),
};

module.exports = {
  createProject,
  getProjects,
  getProject,
};
