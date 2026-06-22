const httpStatus = require('http-status');
const path = require('path');
const { Task, Project } = require('../../models');
const ApiError = require('../../utils/ApiError');

const checkCircular = async (taskId, dependenciesToCheck) => {
  const visited = new Set();
  const queue = [...dependenciesToCheck];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (String(currentId) === String(taskId)) {
      return true;
    }
    if (visited.has(currentId.toString())) continue;
    visited.add(currentId.toString());

    const currentTask = await Task.findOne({ _id: currentId, deletedAt: null }).select('dependencies');
    if (currentTask && currentTask.dependencies) {
      queue.push(...currentTask.dependencies);
    }
  }
  return false;
};

const validateTaskSchedulingAndDependencies = async (taskId, updatedData, existingTask = null) => {
  const taskName = updatedData.name || (existingTask ? existingTask.name : 'Task');
  
  const getVal = (field) => {
    if (updatedData[field] !== undefined) {
      return updatedData[field] ? new Date(updatedData[field]) : null;
    }
    return existingTask && existingTask[field] ? new Date(existingTask[field]) : null;
  };

  const startDate = getVal('startDate');
  const endDate = getVal('endDate');

  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Start date cannot be after end date for task "${taskName}".`);
  }

  const dependencies = updatedData.dependencies !== undefined ? updatedData.dependencies : (existingTask ? existingTask.dependencies : []);

  if (taskId && dependencies && dependencies.length > 0) {
    const hasCycle = await checkCircular(taskId, dependencies);
    if (hasCycle) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Circular dependency detected. A task cannot depend on itself or on tasks that depend on it.`);
    }
  }

  if (startDate && dependencies && dependencies.length > 0) {
    for (const depId of dependencies) {
      if (taskId && String(depId) === String(taskId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, `A task cannot depend on itself.`);
      }
      const predecessor = await Task.findOne({ _id: depId, deletedAt: null });
      if (!predecessor) {
        throw new ApiError(httpStatus.NOT_FOUND, `Predecessor task not found.`);
      }
      if (predecessor.endDate && startDate < predecessor.endDate) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid schedule: Task "${taskName}" starts on ${startDate.toLocaleDateString()} which is before predecessor task "${predecessor.name}" ends on ${predecessor.endDate.toLocaleDateString()}.`
        );
      }
    }
  }

  if (taskId && endDate) {
    const successors = await Task.find({ dependencies: taskId, deletedAt: null });
    for (const successor of successors) {
      if (successor.startDate && endDate > successor.startDate) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid schedule: Task "${taskName}" ends on ${endDate.toLocaleDateString()} which is after successor task "${successor.name}" starts on ${successor.startDate.toLocaleDateString()}.`
        );
      }
    }
  }
};

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
  await validateTaskSchedulingAndDependencies(null, taskBody);
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
    .populate('dependencies', 'name startDate endDate status')
    .sort({ order: 1, createdAt: 1 });

  const { TimeLog } = require('../../models');
  const taskIds = tasks.map(task => task._id);
  const timeLogs = await TimeLog.aggregate([
    { $match: { task: { $in: taskIds }, deletedAt: null } },
    { $group: { _id: '$task', totalHours: { $sum: '$duration' } } }
  ]);

  const timeLogMap = timeLogs.reduce((acc, log) => {
    acc[log._id.toString()] = parseFloat((log.totalHours || 0).toFixed(2));
    return acc;
  }, {});

  tasks.forEach(task => {
    task.totalTimeSpent = timeLogMap[task._id.toString()] || 0;
  });

  return tasks;
};

const getTaskById = async (taskId) => {
  const task = await Task.findOne({ _id: taskId, deletedAt: null })
    .populate('assignees', 'name email role avatar')
    .populate('parent', 'name')
    .populate('cr', 'crNumber title _id')
    .populate('dependencies', 'name startDate endDate status');
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');

  const { TimeLog } = require('../../models');
  const logs = await TimeLog.find({ task: taskId, deletedAt: null });
  task.totalTimeSpent = parseFloat(logs.reduce((sum, log) => sum + (log.duration || 0), 0).toFixed(2));

  return task;
};

const updateTaskById = async (taskId, updateBody) => {
  const task = await getTaskById(taskId);
  const oldStatus = task.status;
  const oldAssignees = task.assignees.map((id) => id.toString());

  await validateTaskSchedulingAndDependencies(taskId, updateBody, task);

  Object.assign(task, updateBody);
  await task.save();
  await task.populate('assignees', 'name email role avatar');
  await task.populate('cr', 'crNumber title _id');
  await task.populate('dependencies', 'name startDate endDate status');

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
