const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { projectService } = require('../../services');
const pick = require('../../utils/pick');

const createProject = catchAsync(async (req, res) => {
  const project = await projectService.createProject(req.body);
  res.status(httpStatus.CREATED).send(project);
});

const getProjects = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'status', 'client']);
  if (filter.name) {
    filter.name = { $regex: filter.name, $options: 'i' };
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await projectService.queryProjects(filter, options);
  res.send(result);
});

const getProject = catchAsync(async (req, res) => {
  const project = await projectService.getProjectById(req.params.projectId);
  if (!project) {
    res.status(httpStatus.NOT_FOUND).send();
    return;
  }
  res.send(project);
});

module.exports = {
  createProject,
  getProjects,
  getProject,
};
