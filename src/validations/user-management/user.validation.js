const Joi = require('joi');
const { roles } = require('../../config/roles');

const createUser = {
  body: Joi.object().keys({
    name: Joi.string().required().max(100),
    email: Joi.string().required().email(),
    password: Joi.string().required().min(8).max(128),
    role: Joi.string().valid(...roles).default('engineer'),
    phone: Joi.string().allow(null, ''),
    designation: Joi.string().allow(null, ''),
  }),
};

const getUsers = {
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    role: Joi.string().valid(...roles),
    isActive: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().max(100),
      email: Joi.string().email(),
      role: Joi.string().valid(...roles),
      phone: Joi.string().allow(null, ''),
      designation: Joi.string().allow(null, ''),
      isActive: Joi.boolean(),
      permissions: Joi.array().items(Joi.string()),
    })
    .min(1),
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

module.exports = { createUser, getUsers, getUser, updateUser, deleteUser };
