const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Project, Client, User, TimeLog } = require('../../models');
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

  // Dynamically compute live usedHours from approved TimeLogs so the
  // dashboard always reflects the true burned time regardless of
  // whether the cached project.usedHours was properly updated.
  if (projects.data && projects.data.length > 0) {
    const projectIds = projects.data.map((p) => new mongoose.Types.ObjectId(p._id || p.id));

    const usedHoursAgg = await TimeLog.aggregate([
      {
        $match: {
          project: { $in: projectIds },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$project',
          totalHours: { $sum: '$duration' },
        },
      },
    ]);

    // Build a map of projectId -> totalHours for O(1) lookup
    const hoursMap = {};
    usedHoursAgg.forEach((entry) => {
      hoursMap[String(entry._id)] = parseFloat(entry.totalHours.toFixed(2));
    });

    // Merge live usedHours onto each project result.
    // We mutate the usedHours field directly on the Mongoose document so that
    // the toJSON plugin still runs correctly when res.send() serializes the response.
    projects.data.forEach((project) => {
      const id = String(project._id || project.id);
      project.usedHours = hoursMap[id] !== undefined ? hoursMap[id] : 0;
    });
  }

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

  try {
    const notificationService = require('../system/notification.service');
    const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });

    // B4: Budget exceeded (100%+)
    if (usageRatio >= 1.0) {
      for (const recipient of adminsAndManagers) {
        await notificationService.createNotification({
          recipient: recipient._id,
          title: 'Budget Exceeded',
          message: `Project "${project.name}" has exceeded its allocated hour budget. Used: ${project.usedHours.toFixed(1)}h / Allocated: ${project.allocatedHours}h.`,
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
          message: `Project "${project.name}" has consumed ${Math.round(usageRatio * 100)}% of allocated hours. Used: ${project.usedHours.toFixed(1)}h / Allocated: ${project.allocatedHours}h.`,
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
