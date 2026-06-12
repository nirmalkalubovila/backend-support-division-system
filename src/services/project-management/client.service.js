const httpStatus = require('http-status');
const { Client } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createClient = async (clientBody) => {
  const existingCode = await Client.findOne({ code: clientBody.code.toUpperCase(), deletedAt: null });
  if (existingCode) {
    throw new ApiError(httpStatus.CONFLICT, 'Client code already exists');
  }
  return Client.create(clientBody);
};

const queryClients = async (filter, options) => {
  const clients = await Client.paginate({ ...filter, deletedAt: null }, options);
  return clients;
};

const getClientById = async (id) => {
  const client = await Client.findOne({ _id: id, deletedAt: null });
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  return client;
};

const updateClientById = async (clientId, updateBody) => {
  const client = await getClientById(clientId);
  if (updateBody.code) {
    const existingCode = await Client.findOne({ code: updateBody.code.toUpperCase(), _id: { $ne: clientId }, deletedAt: null });
    if (existingCode) {
      throw new ApiError(httpStatus.CONFLICT, 'Client code already exists');
    }
  }
  Object.assign(client, updateBody);
  await client.save();
  return client;
};

const deleteClientById = async (clientId) => {
  const client = await getClientById(clientId);
  client.deletedAt = new Date();
  client.isActive = false;
  await client.save();
  return client;
};

module.exports = {
  createClient,
  queryClients,
  getClientById,
  updateClientById,
  deleteClientById,
};
