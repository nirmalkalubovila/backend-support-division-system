const httpStatus = require('http-status');
const { Project, Client } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createProject = async (projectBody) => {
  const client = await Client.findOne({ _id: projectBody.client, deletedAt: null });
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  return Project.create(projectBody);
};

const queryProjects = async (filter, options) => {
  const projects = await Project.paginate({ ...filter, deletedAt: null }, { ...options, populate: 'client,members' });
  return projects;
};

const getProjectById = async (id) => {
  const project = await Project.findOne({ _id: id, deletedAt: null }).populate('client members');
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }
  return project;
};

const updateProjectById = async (projectId, updateBody) => {
  const project = await getProjectById(projectId);
  if (updateBody.client) {
    const client = await Client.findOne({ _id: updateBody.client, deletedAt: null });
    if (!client) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
    }
  }
  Object.assign(project, updateBody);
  await project.save();
  return project;
};

const deleteProjectById = async (projectId) => {
  const project = await getProjectById(projectId);
  project.deletedAt = new Date();
  project.isActive = false;
  await project.save();
  return project;
};

module.exports = {
  createProject,
  queryProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
};
