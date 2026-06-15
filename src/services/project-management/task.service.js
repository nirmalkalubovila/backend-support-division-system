const httpStatus = require('http-status');
const path = require('path');
const { Task, Project } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createTask = async (taskBody) => {
  const project = await Project.findOne({ _id: taskBody.project, deletedAt: null });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  if (taskBody.parent) {
    const parent = await Task.findOne({ _id: taskBody.parent, deletedAt: null });
    if (!parent) throw new ApiError(httpStatus.NOT_FOUND, 'Parent task not found');
  }
  const task = await Task.create(taskBody);

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
    .sort({ order: 1, createdAt: 1 });
  return tasks;
};

const getTaskById = async (taskId) => {
  const task = await Task.findOne({ _id: taskId, deletedAt: null })
    .populate('assignees', 'name email role avatar')
    .populate('parent', 'name');
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

  const newStatus = task.status;
  const statusChanged = oldStatus !== newStatus;

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
  task.deletedAt = new Date();
  await task.save();
  // Soft-delete all children too
  await Task.updateMany({ parent: taskId, deletedAt: null }, { deletedAt: new Date() });
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
};
