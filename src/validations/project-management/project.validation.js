const Joi = require('joi');

const createProject = {
  body: Joi.object().keys({
    name: Joi.string().required().max(150),
    client: Joi.string().required(),
    contractType: Joi.string().required().valid('Monthly Retainer', 'Per-Incident', 'Time & Material', 'Fixed'),
    allocatedHours: Joi.number().min(0).default(0),
    members: Joi.array().items(Joi.string()),
  }),
};

const getProjects = {
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    client: Joi.string(),
    isActive: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getProject = {
  params: Joi.object().keys({
    projectId: Joi.string().required(),
  }),
};

const updateProject = {
  params: Joi.object().keys({
    projectId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().max(150),
      client: Joi.string(),
      contractType: Joi.string().valid('Monthly Retainer', 'Per-Incident', 'Time & Material', 'Fixed'),
      allocatedHours: Joi.number().min(0),
      members: Joi.array().items(Joi.string()),
      isActive: Joi.boolean(),
    })
    .min(1),
};

const deleteProject = {
  params: Joi.object().keys({
    projectId: Joi.string().required(),
  }),
};

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
};
