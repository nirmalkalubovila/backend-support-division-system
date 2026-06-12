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
  return Task.create(taskBody);
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
  Object.assign(task, updateBody);
  await task.save();
  await task.populate('assignees', 'name email role avatar');
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
