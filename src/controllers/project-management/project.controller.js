const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { projectService } = require('../../services');
const pick = require('../../utils/pick');

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
  // Support new mainContacts array field
  if (typeof body.mainContacts === 'string') {
    try { body.mainContacts = JSON.parse(body.mainContacts); } catch { body.mainContacts = []; }
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

  // Visibility: super_admin and manager can see all projects.
  // All other roles can only see projects they are assigned to.
  const privilegedRoles = ['super_admin', 'manager'];
  if (!privilegedRoles.includes(req.user.role)) {
    filter.members = req.user._id;
  }

  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await projectService.queryProjects(filter, options);
  res.send(result);
});

const getProject = catchAsync(async (req, res) => {
  const project = await projectService.getProjectById(req.params.projectId);

  // Enforce visibility: non-privileged users may only access projects they are assigned to.
  const privilegedRoles = ['super_admin', 'manager'];
  if (!privilegedRoles.includes(req.user.role)) {
    const userId = String(req.user._id);
    const isMember = project.members.some((m) => String(m._id ?? m) === userId);
    if (!isMember) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this project');
    }
  }

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
  // Support new mainContacts array field
  if (typeof body.mainContacts === 'string') {
    try { body.mainContacts = JSON.parse(body.mainContacts); } catch { body.mainContacts = []; }
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

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
};
