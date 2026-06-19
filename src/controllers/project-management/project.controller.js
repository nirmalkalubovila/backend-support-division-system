const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../../utils/catchAsync');
const { projectService } = require('../../services');
const pick = require('../../utils/pick');
const ApiError = require('../../utils/ApiError');

const createProject = catchAsync(async (req, res) => {
  const body = { ...req.body };

  // Parse JSON-encoded array/object fields sent via multipart
  if (typeof body.projectType === 'string') {
    try { body.projectType = JSON.parse(body.projectType); } catch { body.projectType = []; }
  }
  if (typeof body.techStack === 'string') {
    try { body.techStack = JSON.parse(body.techStack); } catch { body.techStack = []; }
  }
  if (typeof body.members === 'string') {
    try { body.members = JSON.parse(body.members); } catch { body.members = []; }
  }
  if (typeof body.mainContact === 'string') {
    try { body.mainContact = JSON.parse(body.mainContact); } catch { body.mainContact = {}; }
  }
  if (body.completion !== undefined) body.completion = Number(body.completion);

  if (req.file) {
    body.photo = `/uploads/projects/${path.basename(req.file.path)}`;
  }

  const project = await projectService.createProject(body);
  res.status(httpStatus.CREATED).send(project);
});

const getProjects = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: 'i' };
  }
  if (req.query.client) {
    filter.client = req.query.client;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive;
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await projectService.queryProjects(filter, options);
  res.send(result);
});

const getProject = catchAsync(async (req, res) => {
  const project = await projectService.getProjectById(req.params.projectId);
  res.send(project);
});

const updateProject = catchAsync(async (req, res) => {
  const body = { ...req.body };

  if (typeof body.projectType === 'string') {
    try { body.projectType = JSON.parse(body.projectType); } catch { body.projectType = []; }
  }
  if (typeof body.techStack === 'string') {
    try { body.techStack = JSON.parse(body.techStack); } catch { body.techStack = []; }
  }
  if (typeof body.members === 'string') {
    try { body.members = JSON.parse(body.members); } catch { body.members = []; }
  }
  if (typeof body.mainContact === 'string') {
    try { body.mainContact = JSON.parse(body.mainContact); } catch { body.mainContact = {}; }
  }
  if (body.completion !== undefined) body.completion = Number(body.completion);
  if (typeof body.isActive === 'string') body.isActive = body.isActive === 'true';

  if (req.file) {
    body.photo = `/uploads/projects/${path.basename(req.file.path)}`;
  }

  const project = await projectService.updateProjectById(req.params.projectId, body);
  res.send(project);
});

const deleteProject = catchAsync(async (req, res) => {
  await projectService.deleteProjectById(req.params.projectId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getMonthlyUsage = catchAsync(async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'month query parameter is required (Format: YYYY-MM)');
  }
  const parts = month.split('-');
  const year = parseInt(parts[0], 10);
  const monthNum = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid month format. Use YYYY-MM');
  }

  const result = await projectService.getProjectsMonthlyUsage(year, monthNum);
  res.send(result);
});

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  getMonthlyUsage,
};
