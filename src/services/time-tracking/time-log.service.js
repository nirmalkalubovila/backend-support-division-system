const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { TimeLog, Issue, Project, User } = require('../../models');
const ApiError = require('../../utils/ApiError');

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
        approved: true,
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
 * Start active stopwatch timer for a user on an issue
 */
const startTimer = async (userId, issueId, workType, note = '', isBillable = true) => {
  const issue = await Issue.findOne({ _id: issueId, deletedAt: null });
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }

  if (issue.status === 'Backlog' || issue.status === 'Closed') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Time logs cannot be created for Backlog or Closed issues');
  }

  // Check if user already has any active timer
  const activeLog = await TimeLog.findOne({ user: userId, endTime: null, deletedAt: null });
  if (activeLog) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You already have an active running timer. Please pause or stop it first.');
  }

  const timeLog = await TimeLog.create({
    issue: issueId,
    user: userId,
    project: issue.project,
    startTime: new Date(),
    workType,
    note,
    isBillable,
    approved: false, // Must be approved by manager later
  });

  // If issue status is not 'In Progress', auto-transition it
  if (issue.status !== 'In Progress') {
    issue.status = 'In Progress';
    await issue.save();
  }

  return timeLog;
};

/**
 * Stop active stopwatch timer for a user on an issue
 */
const stopTimer = async (userId, issueId, note = '') => {
  const activeLog = await TimeLog.findOne({ user: userId, issue: issueId, endTime: null, deletedAt: null });
  if (!activeLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No active timer running for this issue and user');
  }

  const endTime = new Date();
  const diffMs = endTime - activeLog.startTime;
  const diffMins = diffMs / (1000 * 60);

  if (diffMins < 5) {
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

  // Auto-transition issue to Testing
  await Issue.updateOne({ _id: issueId }, { status: 'Testing' });

  // Trigger time limit exceeded check in a non-blocking block
  Promise.resolve().then(() => {
    checkAndNotifyTimeExceeded(issueId, activeLog.duration, 0, userId);
  });

  // E1: Notify project managers that a time log has been submitted for review
  Promise.resolve().then(async () => {
    try {
      const notificationService = require('../system/notification.service');
      const issue = await Issue.findById(issueId).populate('project');
      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });
      const logUser = await User.findById(userId);
      const userName = logUser ? logUser.name : 'A team member';
      const issueName = issue ? issue.title : 'an issue';
      const projectId = issue && issue.project ? (issue.project._id || issue.project) : '';

      for (const recipient of adminsAndManagers) {
        if (String(recipient._id) === String(userId)) continue;
        await notificationService.createNotification({
          recipient: recipient._id,
          sender: userId,
          title: 'Time Log Submitted',
          message: `${userName} submitted a time log of ${activeLog.duration.toFixed(2)}h for "${issueName}" — pending your approval.`,
          type: 'info',
          module: 'time-tracking',
          relatedId: activeLog._id,
          relatedLink: `/issues?project=${projectId}`,
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
const createManualLog = async (userId, issueId, startTime, endTime, workType, note = '', isBillable = true) => {
  const issue = await Issue.findOne({ _id: issueId, deletedAt: null });
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }

  if (issue.status === 'Backlog' || issue.status === 'Closed') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Time logs cannot be created for Backlog or Closed issues');
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

  // Check for overlaps for this user
  const overlappingLog = await TimeLog.findOne({
    user: userId,
    deletedAt: null,
    $or: [
      { startTime: { $lt: end }, endTime: { $gt: start } },
      { startTime: { $lt: end }, endTime: null },
    ],
  });

  if (overlappingLog) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Manual time log overlaps with an existing time log or active timer.');
  }

  const duration = parseFloat((diffMins / 60).toFixed(2));

  const timeLog = await TimeLog.create({
    issue: issueId,
    user: userId,
    project: issue.project,
    startTime: start,
    endTime: end,
    duration,
    workType,
    note,
    isBillable,
    approved: false, // Managers must approve
  });

  // Trigger time limit exceeded check in a non-blocking block
  Promise.resolve().then(() => {
    checkAndNotifyTimeExceeded(issueId, timeLog.duration, 0, userId);
  });

  // E1: Notify project managers that a manual time log has been submitted
  Promise.resolve().then(async () => {
    try {
      const notificationService = require('../system/notification.service');
      const issue = await Issue.findById(issueId).populate('project');
      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });
      const logUser = await User.findById(userId);
      const userName = logUser ? logUser.name : 'A team member';
      const issueName = issue ? issue.title : 'an issue';
      const projectId = issue && issue.project ? (issue.project._id || issue.project) : '';

      for (const recipient of adminsAndManagers) {
        if (String(recipient._id) === String(userId)) continue;
        await notificationService.createNotification({
          recipient: recipient._id,
          sender: userId,
          title: 'Time Log Submitted',
          message: `${userName} submitted a manual time log of ${timeLog.duration.toFixed(2)}h for "${issueName}" — pending your approval.`,
          type: 'info',
          module: 'time-tracking',
          relatedId: timeLog._id,
          relatedLink: `/issues?project=${projectId}`,
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
  const logs = await TimeLog.paginate(queryFilter, {
    ...options,
    populate: 'issue,user,project',
  });
  return logs;
};

/**
 * Get time log by ID
 */
const getTimeLogById = async (id) => {
  const timeLog = await TimeLog.findOne({ _id: id, deletedAt: null }).populate('issue user project');
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

  // If approval status was modified, update project stats
  await updateProjectUsedHours(timeLog.project._id);

  // B3/B4: Check project budget thresholds after hour recalculation
  if (approvalChanged && currentApproved) {
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
  }

  // E2: Notify the developer when their time log is approved/rejected
  if (approvalChanged) {
    Promise.resolve().then(async () => {
      try {
        const notificationService = require('../system/notification.service');
        const developerId = timeLog.user._id || timeLog.user;
        if (String(developerId) !== String(currentUserId)) {
          const issueDoc = timeLog.issue;
          const issueName = issueDoc && issueDoc.title ? issueDoc.title : 'an issue';
          const projectId = timeLog.project._id || timeLog.project;
          const status = currentApproved ? 'approved' : 'rejected';
          await notificationService.createNotification({
            recipient: developerId,
            sender: currentUserId,
            title: `Time Log ${currentApproved ? 'Approved' : 'Rejected'}`,
            message: `Your time log for "${issueName}" has been ${status} by a manager.`,
            type: currentApproved ? 'success' : 'warning',
            module: 'time-tracking',
            relatedId: timeLog._id,
            relatedLink: `/issues?project=${projectId}`,
          });
        }
      } catch (err) {
        const logger = require('../../config/logger');
        logger.error('Failed to send time log approval notification', { error: err.message });
      }
    });
  }

  const issueId = timeLog.issue._id || timeLog.issue;
  Promise.resolve().then(() => {
    checkAndNotifyTimeExceeded(issueId, timeLog.duration, previousDuration, currentUserId);
  });

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
