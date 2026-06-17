const httpStatus = require('http-status');
const path = require('path');
const { Task, Project } = require('../../models');
const ApiError = require('../../utils/ApiError');

// Recalculate and persist CR implementation progress after any task change
const recalcCRProgress = async (crId) => {
  if (!crId) return;
  try {
    const ChangeRequest = require('../../models/project-management/cr.model');
    const tasks = await Task.find({ cr: crId, deletedAt: null }).select('status');
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'Done').length;
    const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
    await ChangeRequest.findByIdAndUpdate(crId, { taskProgress: { total, done, completionPercentage } });
  } catch (err) {
    const logger = require('../../config/logger');
    logger.error('Failed to recalc CR progress', { error: err.message });
  }
};

const createTask = async (taskBody) => {
  const project = await Project.findOne({ _id: taskBody.project, deletedAt: null });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  if (taskBody.parent) {
    const parent = await Task.findOne({ _id: taskBody.parent, deletedAt: null });
    if (!parent) throw new ApiError(httpStatus.NOT_FOUND, 'Parent task not found');
  }
  const task = await Task.create(taskBody);

  // D2: If this is a sub-task, notify the parent task assignees
  if (task.parent) {
    try {
      const notificationService = require('../system/notification.service');
      const parentTask = await Task.findOne({ _id: task.parent, deletedAt: null }).populate('assignees', '_id');
      if (parentTask && parentTask.assignees && parentTask.assignees.length > 0) {
        for (const assignee of parentTask.assignees) {
          const assigneeId = assignee._id || assignee;
          // Don't notify if the parent assignee is also an assignee of this sub-task
          const subTaskAssigneeIds = (task.assignees || []).map((a) => String(a));
          if (subTaskAssigneeIds.includes(String(assigneeId))) continue;
          await notificationService.createNotification({
            recipient: assigneeId,
            title: 'Sub-Task Added',
            message: `New sub-task "${task.name}" has been added to your task "${parentTask.name}".`,
            type: 'info',
            module: 'tasks',
            relatedId: task._id,
            relatedLink: `/projects/${task.project}`,
          });
        }
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send sub-task notification', { error: err.message });
    }
  }

  // D1: Notify task assignees
  if (task.assignees && task.assignees.length > 0) {
    try {
      const notificationService = require('../system/notification.service');
      for (const assigneeId of task.assignees) {
        await notificationService.createNotification({
          recipient: assigneeId,
          title: 'New Task Assigned',
          message: `You have been assigned the task: ${task.name} under project: ${project.name}.`,
          type: 'info',
          module: 'tasks',
          relatedId: task._id,
          relatedLink: `/projects/${task.project}`,
        });
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send task assignment notifications', { error: err.message });
    }
  }

  return task;
};

const getProjectTasks = async (projectId) => {
  const tasks = await Task.find({ project: projectId, deletedAt: null })
    .populate('assignees', 'name email role avatar')
    .populate('parent', 'name')
    .populate('cr', 'crNumber title _id')
    .sort({ order: 1, createdAt: 1 });
  return tasks;
};

const getTaskById = async (taskId) => {
  const task = await Task.findOne({ _id: taskId, deletedAt: null })
    .populate('assignees', 'name email role avatar')
    .populate('parent', 'name')
    .populate('cr', 'crNumber title _id');
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  return task;
};

const updateTaskById = async (taskId, updateBody) => {
  const task = await getTaskById(taskId);
  const oldStatus = task.status;
  const oldAssignees = task.assignees.map((id) => id.toString());

  Object.assign(task, updateBody);
  await task.save();
  await task.populate('assignees', 'name email role avatar');
  await task.populate('cr', 'crNumber title _id');

  const newStatus = task.status;
  const statusChanged = oldStatus !== newStatus;

  // Recalculate CR progress if this task is linked to a CR
  if (task.cr) {
    const crId = task.cr._id || task.cr;
    await recalcCRProgress(crId);
  }

  // Detect newly added assignees
  const currentAssignees = task.assignees.map((u) => u._id ? u._id.toString() : u.toString());
  const newlyAddedAssignees = currentAssignees.filter((id) => !oldAssignees.includes(id));

  // Send notifications
  try {
    const notificationService = require('../system/notification.service');
    const { Project } = require('../../models');
    const project = await Project.findById(task.project);
    const projectName = project ? project.name : 'Unknown Project';

    // 1. Notify newly added assignees
    for (const assigneeId of newlyAddedAssignees) {
      await notificationService.createNotification({
        recipient: assigneeId,
        title: 'Task Assigned',
        message: `You have been assigned the task: ${task.name} under project: ${projectName}.`,
        type: 'info',
        module: 'tasks',
        relatedId: task._id,
        relatedLink: `/projects/${task.project}`,
      });
    }

    // 2. Notify current assignees if status changed
    if (statusChanged) {
      for (const assignee of task.assignees) {
        const assigneeId = assignee._id || assignee;
        await notificationService.createNotification({
          recipient: assigneeId,
          title: 'Task Status Updated',
          message: `The status of your task "${task.name}" has been updated from "${oldStatus}" to "${newStatus}".`,
          type: newStatus === 'Done' ? 'success' : 'info',
          module: 'tasks',
          relatedId: task._id,
          relatedLink: `/projects/${task.project}`,
        });
      }
    }
  } catch (err) {
    const logger = require('../../config/logger');
    logger.error('Failed to trigger notification on task update', { error: err.message });
  }

  return task;
};

const deleteTaskById = async (taskId) => {
  const task = await getTaskById(taskId);
  const crId = task.cr ? (task.cr._id || task.cr) : null;
  task.deletedAt = new Date();
  await task.save();
  // Soft-delete all children too
  await Task.updateMany({ parent: taskId, deletedAt: null }, { deletedAt: new Date() });
  if (crId) await recalcCRProgress(crId);
  return task;
};

const uploadTaskAttachment = async (taskId, file, userId) => {
  const task = await getTaskById(taskId);
  task.attachments.push({
    filename: file.filename,
    originalName: file.originalname,
    path: `/uploads/tasks/${path.basename(file.path)}`,
    mimetype: file.mimetype,
    size: file.size,
    uploadedBy: userId || null,
  });
  await task.save();
  return task;
};

const deleteTaskAttachment = async (taskId, attachmentId) => {
  const task = await getTaskById(taskId);
  task.attachments = task.attachments.filter((a) => a._id.toString() !== attachmentId);
  await task.save();
  return task;
};

module.exports = {
  createTask,
  getProjectTasks,
  getTaskById,
  updateTaskById,
  deleteTaskById,
  uploadTaskAttachment,
  deleteTaskAttachment,
  recalcCRProgress,
};
