const httpStatus = require('http-status');
const { Project } = require('../../models');

/**
 * Create a project
 * @param {Object} projectBody
 * @returns {Promise<Project>}
 */
const createProject = async (projectBody) => {
  return Project.create(projectBody);
};

/**
 * Query for projects
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryProjects = async (filter, options) => {
  const projects = await Project.paginate(filter, options);
  return projects;
};

/**
 * Get project by id
 * @param {ObjectId} id
 * @returns {Promise<Project>}
 */
const getProjectById = async (id) => {
  return Project.findById(id);
};

module.exports = {
  createProject,
  queryProjects,
  getProjectById,
};
