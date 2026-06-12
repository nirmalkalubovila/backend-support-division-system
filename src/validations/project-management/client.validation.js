const Joi = require('joi');

const createClient = {
  body: Joi.object().keys({
    name: Joi.string().required().max(100),
    code: Joi.string().required().length(3).uppercase(),
    contactEmail: Joi.string().email().allow(null, ''),
  }),
};

const getClients = {
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    isActive: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getClient = {
  params: Joi.object().keys({
    clientId: Joi.string().required(),
  }),
};

const updateClient = {
  params: Joi.object().keys({
    clientId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().max(100),
      code: Joi.string().length(3).uppercase(),
      contactEmail: Joi.string().email().allow(null, ''),
      isActive: Joi.boolean(),
    })
    .min(1),
};

const deleteClient = {
  params: Joi.object().keys({
    clientId: Joi.string().required(),
  }),
};

module.exports = {
  createClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
};
