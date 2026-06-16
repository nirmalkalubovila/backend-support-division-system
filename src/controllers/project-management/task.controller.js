const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const taskService = require('../../services/project-management/task.service');
const { validateTransition, getRulesForClient } = require('../../config/task.workflow');
const { broadcast } = require('../../config/socket');

const createTask = catchAsync(async (req, res) => {
  const body = { ...req.body, project: req.params.projectId };

  if (typeof body.assignees === 'string') {
    try { body.assignees = JSON.parse(body.assignees); } catch { body.assignees = []; }
  }
  if (typeof body.relatedLinks === 'string') {
    try { body.relatedLinks = JSON.parse(body.relatedLinks); } catch { body.relatedLinks = []; }
  }

  const task = await taskService.createTask(body);
  broadcast(req.params.projectId, 'task:created', task);
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

  // ── Workflow validation on status change ──────────────────────
  if (body.status) {
    const current = await taskService.getTaskById(req.params.taskId);

    if (current.status !== body.status) {
      // Merge pending field updates into the task snapshot so field
      // requirements reflect the state AFTER this update.
      const snapshot = {
        ...current.toObject(),
        assignees: body.assignees ?? current.assignees,
        description: body.description ?? current.description,
        endDate: body.endDate ?? current.endDate,
      };

      const { valid, reason } = validateTransition({
        fromStatus: current.status,
        toStatus: body.status,
        userRole: req.user.role,
        task: snapshot,
      });

      if (!valid) {
        throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, reason);
      }
    }
  }

  const task = await taskService.updateTaskById(req.params.taskId, body);
  broadcast(req.params.projectId, 'task:updated', task);
  res.send(task);
});

const deleteTask = catchAsync(async (req, res) => {
  await taskService.deleteTaskById(req.params.taskId);
  broadcast(req.params.projectId, 'task:deleted', { _id: req.params.taskId });
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
  broadcast(req.params.projectId, 'task:updated', task);
  res.send(task);
});

const deleteAttachment = catchAsync(async (req, res) => {
  const task = await taskService.deleteTaskAttachment(req.params.taskId, req.params.attachmentId);
  broadcast(req.params.projectId, 'task:updated', task);
  res.send(task);
});

/** Return the workflow rules so the client can pre-validate */
const getWorkflowRules = catchAsync(async (req, res) => {
  res.send(getRulesForClient());
});

module.exports = { createTask, getProjectTasks, getTask, updateTask, deleteTask, uploadAttachments, deleteAttachment, getWorkflowRules };
