const httpStatus = require('http-status');
const { Project, Client, User } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createProject = async (projectBody) => {
  if (projectBody.client) {
    const client = await Client.findOne({ _id: projectBody.client, deletedAt: null });
    if (!client) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
    }
  }
  const project = await Project.create(projectBody);

  // B1: Notify assigned team members about the new project
  if (project.members && project.members.length > 0) {
    try {
      const notificationService = require('../system/notification.service');
      for (const memberId of project.members) {
        await notificationService.createNotification({
          recipient: memberId,
          title: 'Added to Project',
          message: `You have been added to the project "${project.name}".`,
          type: 'info',
          module: 'projects',
          relatedId: project._id,
          relatedLink: `/projects/${project._id}`,
        });
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send project creation notifications', { error: err.message });
    }
  }

  return project;
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

  // B2: Detect removed members and notify them
  if (updateBody.members) {
    const oldMemberIds = project.members.map((m) => String(m._id || m));
    const newMemberIds = updateBody.members.map((m) => String(m));
    const removedMembers = oldMemberIds.filter((id) => !newMemberIds.includes(id));
    const addedMembers = newMemberIds.filter((id) => !oldMemberIds.includes(id));

    try {
      const notificationService = require('../system/notification.service');

      // Notify removed members
      for (const memberId of removedMembers) {
        await notificationService.createNotification({
          recipient: memberId,
          title: 'Removed from Project',
          message: `You have been removed from the project "${project.name}".`,
          type: 'warning',
          module: 'projects',
          relatedId: project._id,
          relatedLink: `/projects`,
        });
      }

      // Notify newly added members
      for (const memberId of addedMembers) {
        await notificationService.createNotification({
          recipient: memberId,
          title: 'Added to Project',
          message: `You have been added to the project "${project.name}".`,
          type: 'info',
          module: 'projects',
          relatedId: project._id,
          relatedLink: `/projects/${project._id}`,
        });
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send project member change notifications', { error: err.message });
    }
  }

  Object.assign(project, updateBody);
  await project.save();
  return project;
};

/**
 * B3/B4: Check project budget thresholds and send notifications
 * Called after time log approval changes project usedHours
 * @param {Object} project - The project document
 */
const checkBudgetThresholds = async (project) => {
  if (!project || !project.allocatedHours || project.allocatedHours <= 0) return;

  const usageRatio = project.usedHours / project.allocatedHours;

  const fmtHms = (decimalHours) => {
    const totalSecs = Math.round(decimalHours * 3600);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h}h ${m}m ${s}s`;
  };

  try {
    const notificationService = require('../system/notification.service');
    const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });

    // B4: Budget exceeded (100%+)
    if (usageRatio >= 1.0) {
      for (const recipient of adminsAndManagers) {
        await notificationService.createNotification({
          recipient: recipient._id,
          title: 'Budget Exceeded',
          message: `Project "${project.name}" has exceeded its allocated hour budget. Used: ${fmtHms(project.usedHours)} / Allocated: ${fmtHms(project.allocatedHours)}.`,
          type: 'error',
          module: 'projects',
          relatedId: project._id,
          relatedLink: `/projects/${project._id}`,
        });
      }
    }
    // B3: Budget limit warning (80%+)
    else if (usageRatio >= 0.8) {
      for (const recipient of adminsAndManagers) {
        await notificationService.createNotification({
          recipient: recipient._id,
          title: 'Budget Warning (80%)',
          message: `Project "${project.name}" has consumed ${Math.round(usageRatio * 100)}% of allocated hours. Used: ${fmtHms(project.usedHours)} / Allocated: ${fmtHms(project.allocatedHours)}.`,
          type: 'warning',
          module: 'projects',
          relatedId: project._id,
          relatedLink: `/projects/${project._id}`,
        });
      }
    }
  } catch (err) {
    const logger = require('../../config/logger');
    logger.error('Failed to send budget threshold notifications', { error: err.message });
  }
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
  checkBudgetThresholds,
};
