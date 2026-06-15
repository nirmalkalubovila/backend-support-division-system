const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const pick = require('../../utils/pick');
const crService = require('../../services/project-management/cr.service');

const createCR = catchAsync(async (req, res) => {
  const body = { ...req.body, project: req.params.projectId };
  if (typeof body.assignedDevelopers === 'string') {
    try { body.assignedDevelopers = JSON.parse(body.assignedDevelopers); } catch { body.assignedDevelopers = []; }
  }
  if (typeof body.relatedLinks === 'string') {
    try { body.relatedLinks = JSON.parse(body.relatedLinks); } catch { body.relatedLinks = []; }
  }
  const cr = await crService.createCR(body, req.user.id);
  res.status(httpStatus.CREATED).send(cr);
});

const getProjectCRs = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.crType) filter.crType = req.query.crType;
  if (req.query.search) filter.$or = [{ title: { $regex: req.query.search, $options: 'i' } }, { crNumber: { $regex: req.query.search, $options: 'i' } }];
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  if (!options.limit) options.limit = 200;
  const result = await crService.getProjectCRs(req.params.projectId, filter, options);
  res.send(result);
});

const getCR = catchAsync(async (req, res) => {
  const cr = await crService.getCRById(req.params.crId);
  res.send(cr);
});

const updateCR = catchAsync(async (req, res) => {
  const body = { ...req.body };
  if (typeof body.assignedDevelopers === 'string') {
    try { body.assignedDevelopers = JSON.parse(body.assignedDevelopers); } catch { body.assignedDevelopers = []; }
  }
  if (typeof body.relatedLinks === 'string') {
    try { body.relatedLinks = JSON.parse(body.relatedLinks); } catch { body.relatedLinks = []; }
  }
  const cr = await crService.updateCRById(req.params.crId, body, req.user.id);
  res.send(cr);
});

const deleteCR = catchAsync(async (req, res) => {
  await crService.deleteCRById(req.params.crId);
  res.status(httpStatus.NO_CONTENT).send();
});

const uploadAttachments = catchAsync(async (req, res) => {
  if (!req.files?.length) return res.status(httpStatus.BAD_REQUEST).send({ message: 'No files uploaded' });
  const cr = await crService.addAttachments(req.params.crId, req.files, req.user.id);
  res.send(cr);
});

const deleteAttachment = catchAsync(async (req, res) => {
  const cr = await crService.removeAttachment(req.params.crId, req.params.attachmentId);
  res.send(cr);
});

const getCRStats = catchAsync(async (req, res) => {
  const stats = await crService.getCRStats(req.params.projectId);
  res.send(stats);
});

module.exports = { createCR, getProjectCRs, getCR, updateCR, deleteCR, uploadAttachments, deleteAttachment, getCRStats };
