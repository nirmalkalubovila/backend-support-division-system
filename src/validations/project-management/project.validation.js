const Joi = require('joi');

const mainContactSchema = Joi.object({
  name: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().allow('', null),
});

const createProject = {
  body: Joi.object().keys({
    name: Joi.string().required().max(150),
    client: Joi.string().allow('', null),
    contractType: Joi.string().valid('Monthly Retainer', 'Per-Incident', 'Time & Material', 'Fixed').allow(null),
    allocatedHours: Joi.number().min(0).default(0),
    members: Joi.array().items(Joi.string()),
    description: Joi.string().allow('', null),
    completion: Joi.number().min(0).max(100).default(0),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null),
    projectType: Joi.array().items(Joi.string().valid('New Development', 'CR', 'Support')),
    mainContact: mainContactSchema,
    techStack: Joi.array().items(Joi.string()),
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
      client: Joi.string().allow('', null),
      contractType: Joi.string().valid('Monthly Retainer', 'Per-Incident', 'Time & Material', 'Fixed').allow(null),
      allocatedHours: Joi.number().min(0),
      members: Joi.array().items(Joi.string()),
      isActive: Joi.boolean(),
      description: Joi.string().allow('', null),
      completion: Joi.number().min(0).max(100),
      startDate: Joi.date().allow(null),
      endDate: Joi.date().allow(null),
      projectType: Joi.array().items(Joi.string().valid('New Development', 'CR', 'Support')),
      mainContact: mainContactSchema,
      techStack: Joi.array().items(Joi.string()),
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
