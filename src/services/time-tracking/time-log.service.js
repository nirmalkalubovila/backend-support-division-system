const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { TimeLog, Issue, Project } = require('../../models');
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

  // Note: Since approval is false by default, we don't recalculate project usedHours yet.
  // It will be calculated when the manager approves the log.
  
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

  await timeLog.save();

  // If approval status was modified, update project stats
  await updateProjectUsedHours(timeLog.project._id);

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
