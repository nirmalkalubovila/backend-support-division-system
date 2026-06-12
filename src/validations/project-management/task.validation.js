const Joi = require('joi');

const createTask = {
  params: Joi.object().keys({ projectId: Joi.string().required() }),
  body: Joi.object().keys({
    name: Joi.string().required().max(200),
    description: Joi.string().allow('', null),
    status: Joi.string().valid('To Do', 'In Progress', 'Review', 'Done').default('To Do'),
    priority: Joi.string().valid('Critical', 'High', 'Medium', 'Low').default('Medium'),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null),
    assignees: Joi.array().items(Joi.string()),
    relatedLinks: Joi.array().items(Joi.object({ label: Joi.string().allow(''), url: Joi.string().allow('') })),
    parent: Joi.string().allow(null),
    order: Joi.number().default(0),
  }),
};

const getProjectTasks = {
  params: Joi.object().keys({ projectId: Joi.string().required() }),
};

const getTask = {
  params: Joi.object().keys({ projectId: Joi.string().required(), taskId: Joi.string().required() }),
};

const updateTask = {
  params: Joi.object().keys({ projectId: Joi.string().required(), taskId: Joi.string().required() }),
  body: Joi.object().keys({
    name: Joi.string().max(200),
    description: Joi.string().allow('', null),
    status: Joi.string().valid('To Do', 'In Progress', 'Review', 'Done'),
    priority: Joi.string().valid('Critical', 'High', 'Medium', 'Low'),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null),
    assignees: Joi.array().items(Joi.string()),
    relatedLinks: Joi.array().items(Joi.object({ label: Joi.string().allow(''), url: Joi.string().allow('') })),
    parent: Joi.string().allow(null),
    order: Joi.number(),
  }).min(1),
};

const deleteTask = {
  params: Joi.object().keys({ projectId: Joi.string().required(), taskId: Joi.string().required() }),
};

module.exports = { createTask, getProjectTasks, getTask, updateTask, deleteTask };
