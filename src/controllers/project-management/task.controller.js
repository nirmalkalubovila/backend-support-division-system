const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../../utils/catchAsync');
const taskService = require('../../services/project-management/task.service');

const createTask = catchAsync(async (req, res) => {
  const body = { ...req.body, project: req.params.projectId };

  if (typeof body.assignees === 'string') {
    try { body.assignees = JSON.parse(body.assignees); } catch { body.assignees = []; }
  }
  if (typeof body.relatedLinks === 'string') {
    try { body.relatedLinks = JSON.parse(body.relatedLinks); } catch { body.relatedLinks = []; }
  }

  const task = await taskService.createTask(body);
  res.status(httpStatus.CREATED).send(task);
});

const getProjectTasks = catchAsync(async (req, res) => {
  const tasks = await taskService.getProjectTasks(req.params.projectId);
  res.send(tasks);
});

const getTask = catchAsync(async (req, res) => {
  const task = await taskService.getTaskById(req.params.taskId);
  res.send(task);
});

const updateTask = catchAsync(async (req, res) => {
  const body = { ...req.body };

  if (typeof body.assignees === 'string') {
    try { body.assignees = JSON.parse(body.assignees); } catch { body.assignees = []; }
  }
  if (typeof body.relatedLinks === 'string') {
    try { body.relatedLinks = JSON.parse(body.relatedLinks); } catch { body.relatedLinks = []; }
  }

  const task = await taskService.updateTaskById(req.params.taskId, body);
  res.send(task);
});

const deleteTask = catchAsync(async (req, res) => {
  await taskService.deleteTaskById(req.params.taskId);
  res.status(httpStatus.NO_CONTENT).send();
});

const uploadAttachments = catchAsync(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'No files uploaded' });
  }
  let task;
  for (const file of req.files) {
    task = await taskService.uploadTaskAttachment(req.params.taskId, file, req.user?._id);
  }
  res.send(task);
});

const deleteAttachment = catchAsync(async (req, res) => {
  const task = await taskService.deleteTaskAttachment(req.params.taskId, req.params.attachmentId);
  res.send(task);
});

module.exports = { createTask, getProjectTasks, getTask, updateTask, deleteTask, uploadAttachments, deleteAttachment };
