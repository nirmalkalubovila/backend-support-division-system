const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { projectService } = require('../../services');
const pick = require('../../utils/pick');

const createProject = catchAsync(async (req, res) => {
  const project = await projectService.createProject(req.body);
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
  const project = await projectService.updateProjectById(req.params.projectId, req.body);
  res.send(project);
});

const deleteProject = catchAsync(async (req, res) => {
  await projectService.deleteProjectById(req.params.projectId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
};
