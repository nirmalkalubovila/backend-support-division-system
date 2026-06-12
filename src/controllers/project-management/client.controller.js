const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { clientService } = require('../../services');
const pick = require('../../utils/pick');

const createClient = catchAsync(async (req, res) => {
  const client = await clientService.createClient(req.body);
  res.status(httpStatus.CREATED).send(client);
});

const getClients = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { code: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive;
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await clientService.queryClients(filter, options);
  res.send(result);
});

const getClient = catchAsync(async (req, res) => {
  const client = await clientService.getClientById(req.params.clientId);
  res.send(client);
});

const updateClient = catchAsync(async (req, res) => {
  const client = await clientService.updateClientById(req.params.clientId, req.body);
  res.send(client);
});

const deleteClient = catchAsync(async (req, res) => {
  await clientService.deleteClientById(req.params.clientId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
};
