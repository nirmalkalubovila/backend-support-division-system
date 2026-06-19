const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { TimeLog, Issue, Project, User, Task, ChangeRequest } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getIO } = require('../../config/socket');
const logger = require('../../config/logger');

/**
 * Recalculate project total used hours based on approved time logs
 * @param {string} projectId
 * @returns {Promise<void>}
 */
const updateProjectUsedHours = async (projectId) => {
  const aggregate = await TimeLog.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
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

  const totalHours = aggregate.length > 0 ? aggregate[0].totalHours : 0;
  await Project.updateOne(
    { _id: projectId },
    { usedHours: parseFloat(totalHours.toFixed(2)) }
  );
};

/**
 * Check if the total tracked time on an issue has exceeded its estimated hours,
 * and notify admins and managers if it has just crossed the threshold.
 * @param {string} issueId
 * @param {number} sessionDuration - Duration of the current session in hours
 * @param {number} previousSessionDuration - Previous duration of the current session (if updating) in hours
 * @param {string} userId - ID of the user performing the action
 * @returns {Promise<void>}
 */
const checkAndNotifyTimeExceeded = async (issueId, sessionDuration = 0, previousSessionDuration = 0, userId = null) => {
  try {
    const issue = await Issue.findOne({ _id: issueId, deletedAt: null }).populate('project');
    if (!issue || !issue.estimatedHours || issue.estimatedHours <= 0) {
      return;
    }

    const estimatedHours = issue.estimatedHours;

    // Fetch all active time logs for this issue (not deleted)
    const logs = await TimeLog.find({ issue: issueId, deletedAt: null });

    // Calculate sum of durations
    const totalDurationAfter = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const totalDurationBefore = totalDurationAfter - (sessionDuration || 0) + (previousSessionDuration || 0);

    // If total duration just exceeded estimated hours
    if (totalDurationBefore <= estimatedHours && totalDurationAfter > estimatedHours) {
      const notificationService = require('../system/notification.service');
      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });
      const projectId = issue.project ? (issue.project._id || issue.project) : '';

      for (const recipient of adminsAndManagers) {
        if (userId && String(recipient._id) === String(userId)) {
          continue;
        }
        await notificationService.createNotification({
          recipient: recipient._id,
          sender: userId,
          title: `Time Estimate Exceeded: ${issue.issueId}`,
          message: `The total tracked time on issue "${issue.title}" (${issue.issueId}) has reached ${totalDurationAfter.toFixed(2)} hours, exceeding the estimated ${estimatedHours} hours.`,
          type: 'warning',
          module: 'issues',
          relatedId: issue._id,
          relatedLink: `/issues?project=${projectId}`,
        });
      }
    }
  } catch (error) {
    const logger = require('../../config/logger');
    logger.error('Error checking or sending time estimate exceeded notification', { error: error.message });
  }
};

/**
 * Start active stopwatch timer for a user on an issue, task, or CR
 */
const startTimer = async (userId, issueId, taskId, crId, workType, note = '', isBillable = true) => {
  let project = null;

  if (issueId) {
    const issue = await Issue.findOne({ _id: issueId, deletedAt: null });
    if (!issue) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
    }
    if (issue.status === 'Backlog' || issue.status === 'Closed') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Time logs cannot be created for Backlog or Closed issues');
    }
    project = issue.project;
  } else if (taskId) {
    const task = await Task.findOne({ _id: taskId, deletedAt: null });
    if (!task) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
    }
    project = task.project;
  } else if (crId) {
    const cr = await ChangeRequest.findOne({ _id: crId, deletedAt: null });
    if (!cr) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Change Request not found');
    }
    project = cr.project;
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Either issueId, taskId, or crId must be provided');
  }

  // Clean up any existing active timers for the exact same item to avoid duplicates
  const existingQuery = { user: userId, endTime: null, deletedAt: null };
  if (issueId) existingQuery.issue = issueId;
  else if (taskId) existingQuery.task = taskId;
  else if (crId) existingQuery.cr = crId;

  const existingLogs = await TimeLog.find(existingQuery);
  if (existingLogs.length > 0) {
    const duplicateIds = existingLogs.map(log => log._id);
    await TimeLog.deleteMany({ _id: { $in: duplicateIds } });
    logger.info(`Cleaned up ${duplicateIds.length} existing active log(s) for the same item before starting a new one`);
  }

  const timeLog = await TimeLog.create({
    issue: issueId || null,
    task: taskId || null,
    cr: crId || null,
    user: userId,
    project,
    startTime: new Date(),
    workType,
    note,
    isBillable,
    approved: false, // Must be approved by manager later
  });

  // Auto-transitions
  if (issueId) {
    const issue = await Issue.findOne({ _id: issueId, deletedAt: null });
    if (issue && issue.status !== 'In Progress') {
      issue.status = 'In Progress';
      await issue.save();
    }
  } else if (taskId) {
    const task = await Task.findOne({ _id: taskId, deletedAt: null });
    if (task && task.status !== 'In Progress') {
      task.status = 'In Progress';
      await task.save();
    }
  } else if (crId) {
    const cr = await ChangeRequest.findOne({ _id: crId, deletedAt: null });
    if (cr && cr.status !== 'In Development') {
      cr.status = 'In Development';
      await cr.save();
    }
  }

  // Emit WebSocket event
  try {
    const io = getIO();
    if (io) {
      const itemId = issueId || taskId || crId;
      io.to(`user:${userId}`).emit('timer:started', {
        itemId: String(itemId),
        workType,
        startTime: timeLog.startTime,
        timeLog: timeLog.toJSON ? timeLog.toJSON() : timeLog,
      });
      logger.info(`WebSocket timer:started emitted to user:${userId} for item ${itemId}`);
    }
  } catch (error) {
    logger.error('Failed to emit timer:started via WebSocket', { error: error.message });
  }

  return timeLog;
};

/**
 * Stop active stopwatch timer for a user
 */
const stopTimer = async (userId, issueId, taskId, crId, note = '', activeDuration = null) => {
  const query = { user: userId, endTime: null, deletedAt: null };
  if (issueId) query.issue = issueId;
  else if (taskId) query.task = taskId;
  else if (crId) query.cr = crId;

  const activeLogs = await TimeLog.find(query);
  if (activeLogs.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No active timer running for this item and user');
  }

  // Use the first active log to store the time, and clean up the rest to resolve duplicate/orphaned active logs
  const activeLog = activeLogs[0];
  if (activeLogs.length > 1) {
    const duplicateIds = activeLogs.slice(1).map(log => log._id);
    await TimeLog.deleteMany({ _id: { $in: duplicateIds } });
    logger.info(`Cleaned up ${duplicateIds.length} duplicate active logs for user ${userId} on item ${issueId || taskId || crId}`);
  }

  const endTime = new Date();
  let diffMins;

  if (activeDuration !== null && activeDuration !== undefined && activeDuration !== '') {
    diffMins = Number(activeDuration) / 60;
  } else {
    const diffMs = endTime - activeLog.startTime;
    diffMins = diffMs / (1000 * 60);
  }

  if (diffMins < 5) {
    const itemId = activeLog.issue || activeLog.task || activeLog.cr;
    // Emit WebSocket event before discard
    try {
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('timer:stopped', {
          itemId: String(itemId),
          discarded: true,
        });
      }
    } catch (error) {
      logger.error('Failed to emit timer:stopped via WebSocket', { error: error.message });
    }

    // Minimum duration: 5 minutes. Reject and discard the log to avoid clutter.
    await activeLog.deleteOne();
    throw new ApiError(httpStatus.BAD_REQUEST, 'Time log duration is less than 5 minutes. The session has been discarded.');
  }

  let duration = diffMins / 60;
  let finalNote = note || activeLog.note;
  if (duration > 12) {
    duration = 12; // Cap duration at 12 hours
    finalNote = finalNote ? `${finalNote} [FLAGGED: Session exceeded 12 hours]` : '[FLAGGED: Session exceeded 12 hours]';
  }

  activeLog.endTime = endTime;
  activeLog.duration = parseFloat(duration.toFixed(2));
  activeLog.note = finalNote;

  await activeLog.save();

  // Recalculate project total used hours
  await updateProjectUsedHours(activeLog.project);

  // Trigger project budget threshold check
  Promise.resolve().then(async () => {
    try {
      const projectDoc = await Project.findById(activeLog.project);
      if (projectDoc) {
        const projectService = require('../project-management/project.service');
        await projectService.checkBudgetThresholds(projectDoc);
      }
    } catch (err) {
      logger.error('Failed to check budget thresholds after timer stop', { error: err.message });
    }
  });

  // Emit WebSocket event
  try {
    const io = getIO();
    if (io) {
      const itemId = activeLog.issue || activeLog.task || activeLog.cr;
      io.to(`user:${userId}`).emit('timer:stopped', {
        itemId: String(itemId),
        discarded: false,
        timeLog: activeLog.toJSON ? activeLog.toJSON() : activeLog,
      });
      logger.info(`WebSocket timer:stopped emitted to user:${userId} for item ${itemId}`);
    }
  } catch (error) {
    logger.error('Failed to emit timer:stopped via WebSocket', { error: error.message });
  }

  // Auto-transition item status when timer stops
  // Auto-transition issue to Testing
  if (activeLog.issue) {
    await Issue.updateOne({ _id: activeLog.issue }, { status: 'Testing' });
  }

  // Auto-transition task to Review
  if (activeLog.task) {
    await Task.updateOne({ _id: activeLog.task, status: { $ne: 'Done' } }, { status: 'Review' });
  }

  // Trigger time limit exceeded check in a non-blocking block
  Promise.resolve().then(() => {
    checkAndNotifyTimeExceeded(issueId, activeLog.duration, 0, userId);
  });
  // Trigger time limit exceeded check in a non-blocking block (only for issues)
  // Auto-transition issue to Testing (only when this is an issue log)
  if (activeLog.issue) {
    await Issue.updateOne({ _id: activeLog.issue }, { status: 'Testing' });
    // Trigger time limit exceeded check (only for issues)
    Promise.resolve().then(() => {
      checkAndNotifyTimeExceeded(activeLog.issue, activeLog.duration, 0, userId);
    });
  } else if (activeLog.task) {
    await Task.updateOne({ _id: activeLog.task }, { status: 'Review' });
  } else if (activeLog.cr) {
    await ChangeRequest.updateOne({ _id: activeLog.cr }, { status: 'Submitted' });
  }

  // E1: Notify project managers that a time log has been submitted for review
  Promise.resolve().then(async () => {
    try {
      const notificationService = require('../system/notification.service');
      let itemName = 'an item';
      let typeLabel = 'item';
      let relatedLink = `/projects/${activeLog.project}`;

      if (activeLog.issue) {
        const issue = await Issue.findById(activeLog.issue);
        itemName = issue ? issue.title : 'an issue';
        typeLabel = 'issue';
        relatedLink = `/issues?project=${activeLog.project}`;
      } else if (activeLog.task) {
        const task = await Task.findById(activeLog.task);
        itemName = task ? task.name : 'a task';
        typeLabel = 'task';
      } else if (activeLog.cr) {
        const cr = await ChangeRequest.findById(activeLog.cr);
        itemName = cr ? cr.title : 'a CR';
        typeLabel = 'CR';
      }

      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });
      const logUser = await User.findById(userId);
      const userName = logUser ? logUser.name : 'A team member';

      for (const recipient of adminsAndManagers) {
        if (String(recipient._id) === String(userId)) continue;
        await notificationService.createNotification({
          recipient: recipient._id,
          sender: userId,
          title: 'Time Log Submitted',
          message: `${userName} submitted a time log of ${activeLog.duration.toFixed(2)}h for ${typeLabel} "${itemName}" — pending your approval.`,
          type: 'info',
          module: 'time-tracking',
          relatedId: activeLog._id,
          relatedLink,
        });
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send time log submission notification', { error: err.message });
    }
  });

  return activeLog;
};

/**
 * Create a manual time log entry
 */
const createManualLog = async (userId, issueId, taskId, crId, startTime, endTime, workType, note = '', isBillable = true) => {
  let project = null;

  if (issueId) {
    const issue = await Issue.findOne({ _id: issueId, deletedAt: null });
    if (!issue) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
    }
    if (issue.status === 'Backlog' || issue.status === 'Closed') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Time logs cannot be created for Backlog or Closed issues');
    }
    project = issue.project;
  } else if (taskId) {
    const task = await Task.findOne({ _id: taskId, deletedAt: null });
    if (!task) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
    }
    project = task.project;
  } else if (crId) {
    const cr = await ChangeRequest.findOne({ _id: crId, deletedAt: null });
    if (!cr) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Change Request not found');
    }
    project = cr.project;
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Either issueId, taskId, or crId must be provided');
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'End time must be after start time');
  }

  const diffMs = end - start;
  const diffMins = diffMs / (1000 * 60);

  if (diffMins < 5) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Time log duration must be at least 5 minutes');
  }

  if (diffMins > 12 * 60) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Single time log entry cannot exceed 12 hours');
  }

  // Check for overlaps for this user on this specific item
  const overlapQuery = {
    user: userId,
    deletedAt: null,
    $or: [
      { startTime: { $lt: end }, endTime: { $gt: start } },
      { startTime: { $lt: end }, endTime: null },
    ],
  };
  if (issueId) overlapQuery.issue = issueId;
  else if (taskId) overlapQuery.task = taskId;
  else if (crId) overlapQuery.cr = crId;

  const overlappingLog = await TimeLog.findOne(overlapQuery);
  if (overlappingLog) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Manual time log overlaps with an existing time log or active timer for this item.');
  }

  const duration = parseFloat((diffMins / 60).toFixed(2));

  const timeLog = await TimeLog.create({
    issue: issueId || null,
    task: taskId || null,
    cr: crId || null,
    user: userId,
    project,
    startTime: start,
    endTime: end,
    duration,
    workType,
    note,
    isBillable,
    approved: false, // Managers must approve
  });

  // Recalculate project total used hours
  await updateProjectUsedHours(project);

  // Trigger project budget threshold check
  Promise.resolve().then(async () => {
    try {
      const projectDoc = await Project.findById(project);
      if (projectDoc) {
        const projectService = require('../project-management/project.service');
        await projectService.checkBudgetThresholds(projectDoc);
      }
    } catch (err) {
      logger.error('Failed to check budget thresholds after manual log creation', { error: err.message });
    }
  });

  // Trigger time limit exceeded check in a non-blocking block (only for issues)
  if (issueId) {
    Promise.resolve().then(() => {
      checkAndNotifyTimeExceeded(issueId, timeLog.duration, 0, userId);
    });
  }

  // E1: Notify project managers that a manual time log has been submitted
  Promise.resolve().then(async () => {
    try {
      const notificationService = require('../system/notification.service');
      let itemName = 'an item';
      let typeLabel = 'item';
      let relatedLink = `/projects/${project}`;

      if (issueId) {
        const issue = await Issue.findById(issueId);
        itemName = issue ? issue.title : 'an issue';
        typeLabel = 'issue';
        relatedLink = `/issues?project=${project}`;
      } else if (taskId) {
        const task = await Task.findById(taskId);
        itemName = task ? task.name : 'a task';
        typeLabel = 'task';
      } else if (crId) {
        const cr = await ChangeRequest.findById(crId);
        itemName = cr ? cr.title : 'a CR';
        typeLabel = 'CR';
      }

      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });
      const logUser = await User.findById(userId);
      const userName = logUser ? logUser.name : 'A team member';

      for (const recipient of adminsAndManagers) {
        if (String(recipient._id) === String(userId)) continue;
        await notificationService.createNotification({
          recipient: recipient._id,
          sender: userId,
          title: 'Time Log Submitted',
          message: `${userName} submitted a manual time log of ${timeLog.duration.toFixed(2)}h for ${typeLabel} "${itemName}" — pending your approval.`,
          type: 'info',
          module: 'time-tracking',
          relatedId: timeLog._id,
          relatedLink,
        });
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to send manual time log submission notification', { error: err.message });
    }
  });

  return timeLog;
};

/**
 * Paginate and query time logs
 */
const queryTimeLogs = async (filter, options) => {
  const queryFilter = { ...filter, deletedAt: null };
  if (queryFilter.active === 'true' || queryFilter.active === true) {
    queryFilter.endTime = null;
    delete queryFilter.active;
  } else if (queryFilter.active === 'false' || queryFilter.active === false) {
    queryFilter.endTime = { $ne: null };
    delete queryFilter.active;
  }
  const logs = await TimeLog.paginate(queryFilter, {
    ...options,
    populate: 'issue task cr user project',
  });
  return logs;
};

/**
 * Get time log by ID
 */
const getTimeLogById = async (id) => {
  const timeLog = await TimeLog.findOne({ _id: id, deletedAt: null }).populate('issue task cr user project');
  if (!timeLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Time log not found');
  }
  return timeLog;
};

/**
 * Update time log entry
 */
const updateTimeLog = async (logId, updateBody, currentUserId, currentUserRole) => {
  const timeLog = await getTimeLogById(logId);
  const previousDuration = timeLog.duration || 0;
  const previousApprovalStatus = timeLog.approved;

  // Authorization checks
  const isManagerOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'manager';

  if (updateBody.hasOwnProperty('approved') && !isManagerOrAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only managers and admins can approve time logs');
  }

  if (!isManagerOrAdmin) {
    if (timeLog.user._id.toString() !== currentUserId.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to modify this time log');
    }

    const hoursSinceCreation = (new Date() - timeLog.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Manual corrections are only allowed within 24 hours of creation.');
    }

    if (!updateBody.note || updateBody.note.trim() === '') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'A reason note is required for manual corrections');
    }
  }

  // Handle updates to times
  if (updateBody.startTime || updateBody.endTime) {
    const start = updateBody.startTime ? new Date(updateBody.startTime) : timeLog.startTime;
    const end = updateBody.endTime ? new Date(updateBody.endTime) : timeLog.endTime;

    if (end && start >= end) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'End time must be after start time');
    }

    if (end) {
      const diffMs = end - start;
      const diffMins = diffMs / (1000 * 60);

      if (diffMins < 5) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Duration must be at least 5 minutes');
      }
      if (diffMins > 12 * 60) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Duration cannot exceed 12 hours');
      }

      timeLog.duration = parseFloat((diffMins / 60).toFixed(2));
      timeLog.endTime = end;
    }
    timeLog.startTime = start;
  }

  // Set individual fields
  Object.keys(updateBody).forEach((key) => {
    if (key !== 'startTime' && key !== 'endTime') {
      timeLog[key] = updateBody[key];
    }
  });

  const currentApproved = timeLog.approved;
  const approvalChanged = updateBody.hasOwnProperty('approved') && previousApprovalStatus !== currentApproved;

  await timeLog.save();

  // Recalculate project stats
  await updateProjectUsedHours(timeLog.project._id);

  // B3/B4: Check project budget thresholds after hour recalculation
  Promise.resolve().then(async () => {
    try {
      const projectDoc = await Project.findById(timeLog.project._id || timeLog.project);
      if (projectDoc) {
        const projectService = require('../project-management/project.service');
        await projectService.checkBudgetThresholds(projectDoc);
      }
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to check budget thresholds', { error: err.message });
    }
  });

  // E2: Notify the developer when their time log is approved/rejected
  if (approvalChanged) {
    Promise.resolve().then(async () => {
      try {
        const notificationService = require('../system/notification.service');
        const developerId = timeLog.user._id || timeLog.user;
        if (String(developerId) !== String(currentUserId)) {
          let itemName = 'an item';
          if (timeLog.issue) {
            itemName = timeLog.issue.title || 'an issue';
          } else if (timeLog.task) {
            itemName = timeLog.task.name || 'a task';
          } else if (timeLog.cr) {
            itemName = timeLog.cr.title || 'a CR';
          }
          const projectId = timeLog.project._id || timeLog.project;
          const status = currentApproved ? 'approved' : 'rejected';
          await notificationService.createNotification({
            recipient: developerId,
            sender: currentUserId,
            title: `Time Log ${currentApproved ? 'Approved' : 'Rejected'}`,
            message: `Your time log for "${itemName}" has been ${status} by a manager.`,
            type: currentApproved ? 'success' : 'warning',
            module: 'time-tracking',
            relatedId: timeLog._id,
            relatedLink: timeLog.issue ? `/issues?project=${projectId}` : `/projects/${projectId}`,
          });
        }
      } catch (err) {
        const logger = require('../../config/logger');
        logger.error('Failed to send time log approval notification', { error: err.message });
      }
    });
  }

  if (timeLog.issue) {
    const issueId = timeLog.issue._id || timeLog.issue;
    Promise.resolve().then(() => {
      checkAndNotifyTimeExceeded(issueId, timeLog.duration, previousDuration, currentUserId);
    });
  }

  return timeLog;
};

/**
 * Delete a time log entry
 */
const deleteTimeLog = async (logId) => {
  const timeLog = await getTimeLogById(logId);
  timeLog.deletedAt = new Date();
  await timeLog.save();

  // Recalculate project hours
  await updateProjectUsedHours(timeLog.project._id);

  return timeLog;
};

module.exports = {
  startTimer,
  stopTimer,
  createManualLog,
  queryTimeLogs,
  getTimeLogById,
  updateTimeLog,
  deleteTimeLog,
  updateProjectUsedHours,
};
