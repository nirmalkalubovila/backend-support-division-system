const Joi = require('joi');

const CR_TYPES = ['Enhancement', 'New Feature', 'Modification', 'Integration', 'UI/UX Change', 'Data Change', 'Bug Fix', 'Other'];
const CR_STATUSES = ['To Do', 'Rejected', 'In Progress', 'Review', 'Done', 'Closed'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const createCR = {
  params: Joi.object().keys({ projectId: Joi.string().required() }),
  body: Joi.object().keys({
    title: Joi.string().required().max(200),
    crType: Joi.string().valid(...CR_TYPES).default('Enhancement'),
    priority: Joi.string().valid(...PRIORITIES).default('Medium'),
    status: Joi.string().valid(...CR_STATUSES).default('To Do'),
    requestedBy: Joi.string().allow('', null),
    requestedDate: Joi.date().allow(null),
    targetReleaseDate: Joi.date().allow(null),
    estimatedHours: Joi.number().min(0).allow(null),
    estimatedCost: Joi.number().min(0).allow(null),
    assignedProjectManager: Joi.string().allow('', null),
    assignedDevelopers: Joi.array().items(Joi.string()),
    description: Joi.string().allow('', null),
    businessJustification: Joi.string().allow('', null),
    technicalApproach: Joi.string().allow('', null),
    impactAnalysis: Joi.string().allow('', null),
    dependencies: Joi.string().allow('', null),
    risks: Joi.string().allow('', null),
    relatedLinks: Joi.array().items(Joi.object({ label: Joi.string().allow(''), url: Joi.string().allow('') })),
  }),
};

const getProjectCRs = {
  params: Joi.object().keys({ projectId: Joi.string().required() }),
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    status: Joi.string().valid(...CR_STATUSES),
    priority: Joi.string().valid(...PRIORITIES),
    crType: Joi.string().valid(...CR_TYPES),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getCR = {
  params: Joi.object().keys({ projectId: Joi.string().required(), crId: Joi.string().required() }),
};

const updateCR = {
  params: Joi.object().keys({ projectId: Joi.string().required(), crId: Joi.string().required() }),
  body: Joi.object().keys({
    title: Joi.string().max(200),
    crType: Joi.string().valid(...CR_TYPES),
    priority: Joi.string().valid(...PRIORITIES),
    status: Joi.string().valid(...CR_STATUSES),
    statusNote: Joi.string().allow('', null),
    requestedBy: Joi.string().allow('', null),
    requestedDate: Joi.date().allow(null),
    targetReleaseDate: Joi.date().allow(null),
    estimatedHours: Joi.number().min(0).allow(null),
    actualHours: Joi.number().min(0).allow(null),
    estimatedCost: Joi.number().min(0).allow(null),
    assignedProjectManager: Joi.string().allow('', null),
    assignedDevelopers: Joi.array().items(Joi.string()),
    description: Joi.string().allow('', null),
    businessJustification: Joi.string().allow('', null),
    technicalApproach: Joi.string().allow('', null),
    impactAnalysis: Joi.string().allow('', null),
    dependencies: Joi.string().allow('', null),
    risks: Joi.string().allow('', null),
    relatedLinks: Joi.array().items(Joi.object({ label: Joi.string().allow(''), url: Joi.string().allow('') })),
    order: Joi.number(),
  }).min(1),
};

const deleteCR = {
  params: Joi.object().keys({ projectId: Joi.string().required(), crId: Joi.string().required() }),
};

module.exports = { createCR, getProjectCRs, getCR, updateCR, deleteCR };
