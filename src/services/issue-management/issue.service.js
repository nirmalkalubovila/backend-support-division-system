const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const { Issue, Client, Project, User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const moment = require('moment');

/**
 * Generate a unique Issue ID formatted as: [CLIENT_CODE]-YYYY-NNNNN
 * e.g., AQF-2026-00014
 */
const generateIssueId = async (clientCode) => {
  const currentYear = moment().year();
  const startOfYear = moment().startOf('year').toDate();
  const endOfYear = moment().endOf('year').toDate();

  // Count issues for this client in the current calendar year
  const clientIssuesCount = await Issue.countDocuments({
    client: clientCode.clientId || null,
    createdAt: { $gte: startOfYear, $lte: endOfYear },
  });

  const nextSequence = String(clientIssuesCount + 1).padStart(5, '0');
  return `${clientCode.code}-${currentYear}-${nextSequence}`;
};

const calculateSlaDueDate = async (priority) => {
  const settingService = require('../system/setting.service');
  const priorities = await settingService.getPriorities();
  const config = priorities[priority] || priorities['Medium'];
  const minutes = config ? config.resolution : 4320;
  return moment().add(minutes, 'minutes').toDate();
};

const createIssue = async (issueBody, userId) => {
  const settingService = require('../system/setting.service');
  const categories = await settingService.getCategories();
  const type = issueBody.type || 'Bug';
  if (!categories.includes(type)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid issue type: ${type}`);
  }

  const project = await Project.findOne({ _id: issueBody.project, deletedAt: null });
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // If client is not provided, resolve it from the project if available
  let clientId = issueBody.client;
  if (!clientId && project.client) {
    clientId = project.client;
  }

  let clientCode = 'GEN';
  let resolvedClientId = null;

  if (clientId) {
    const client = await Client.findOne({ _id: clientId, deletedAt: null });
    if (client) {
      resolvedClientId = client._id;
      clientCode = client.code;
    }
  }

  // Set the resolved client ID back to the issue body
  issueBody.client = resolvedClientId;

  // Generate unique ID
  const issueId = await generateIssueId({ clientId: resolvedClientId, code: clientCode });

  // Calculate Due Date based on SLA rules
  const dueDate = await calculateSlaDueDate(issueBody.priority || 'Medium');

  const issueData = {
    ...issueBody,
    issueId,
    dueDate,
    createdBy: userId,
    status: issueBody.assignedTo ? 'Assigned' : 'Backlog',
  };

  const issue = await Issue.create(issueData);

  // Send notification if assigned on creation
  if (issue.assignedTo) {
    try {
      const notificationService = require('../system/notification.service');
      await notificationService.createNotification({
        recipient: issue.assignedTo,
        sender: userId,
        title: 'New Issue Assigned',
        message: `You have been assigned a new issue: ${issue.title} (${issue.issueId}).`,
        type: 'info',
        module: 'issues',
        relatedId: issue._id,
        relatedLink: `/issues?project=${issue.project}`,
      });
    } catch (err) {
      const logger = require('../../config/logger');
      logger.error('Failed to trigger notification on issue creation', { error: err.message });
    }
  }

  return issue;
};

const queryIssues = async (filter, options) => {
  const issues = await Issue.paginate({ ...filter, deletedAt: null }, { ...options, populate: 'client,project,assignedTo,createdBy,timeRequest.requestedBy' });
  return issues;
};

const getIssueById = async (id) => {
  const issue = await Issue.findOne({ _id: id, deletedAt: null }).populate('client project assignedTo createdBy timeRequest.requestedBy');
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }
  return issue;
};

const getIssueByFormattedId = async (issueId) => {
  const issue = await Issue.findOne({ issueId, deletedAt: null }).populate('client project assignedTo createdBy timeRequest.requestedBy');
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }
  return issue;
};

const updateIssueById = async (issueId, updateBody, updaterUser = null) => {
  if (updateBody.type) {
    const settingService = require('../system/setting.service');
    const categories = await settingService.getCategories();
    if (!categories.includes(updateBody.type)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid issue type: ${updateBody.type}`);
    }
  }

  const issue = await getIssueById(issueId);

  // Extract expandReason if present
  const expandReason = updateBody.expandReason;
  delete updateBody.expandReason;

  // Track time expansion
  let timeExpanded = false;
  let expandedByHours = 0;
  if (updateBody.estimatedHours !== undefined && updateBody.estimatedHours !== null) {
    const newEst = parseFloat(updateBody.estimatedHours);
    const oldEst = issue.estimatedHours || 0;
    if (newEst > oldEst) {
      timeExpanded = true;
      expandedByHours = newEst - oldEst;
    }
  }

  // Handle time request payload
  let timeRequested = false;
  let timeRequestData = null;
  if (updateBody.timeRequest) {
    timeRequested = true;
    timeRequestData = {
      hours: parseFloat(updateBody.timeRequest.hours),
      reason: updateBody.timeRequest.reason,
      requestedBy: updaterUser ? updaterUser._id : null
    };
    issue.timeRequest = timeRequestData;
    delete updateBody.timeRequest;
  } else if (updateBody.timeRequest === null) {
    issue.timeRequest = null;
    delete updateBody.timeRequest;
  }

  // If priority changes, re-calculate the SLA due date
  if (updateBody.priority && updateBody.priority !== issue.priority) {
    updateBody.dueDate = await calculateSlaDueDate(updateBody.priority);
  }

  // Update status changes assigned status automatically
  if (updateBody.assignedTo && !issue.assignedTo && issue.status === 'Backlog') {
    updateBody.status = 'Assigned';
  }

  const oldAssignee = issue.assignedTo ? String(issue.assignedTo._id || issue.assignedTo) : null;
  const newAssignee = updateBody.assignedTo ? String(updateBody.assignedTo) : null;
  const assigneeChanged = newAssignee && oldAssignee !== newAssignee;
  const oldStatus = issue.status;
  const statusChangedToReopened = updateBody.status === 'Reopened' && oldStatus !== 'Reopened';

  Object.assign(issue, updateBody);
  await issue.save();

  // Send notifications
  try {
    const notificationService = require('../system/notification.service');
    const projectId = issue.project ? (issue.project._id || issue.project) : '';
    if (assigneeChanged) {
      await notificationService.createNotification({
        recipient: newAssignee,
        title: 'Issue Assigned',
        message: `You have been assigned the issue: ${issue.title} (${issue.issueId}).`,
        type: 'info',
        module: 'issues',
        relatedId: issue._id,
        relatedLink: `/issues?project=${projectId}`,
      });
    }

    if (statusChangedToReopened && issue.assignedTo) {
      const recipientId = issue.assignedTo._id || issue.assignedTo;
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Issue Reopened',
        message: `The issue assigned to you has been reopened: ${issue.title} (${issue.issueId}).`,
        type: 'warning',
        module: 'issues',
        relatedId: issue._id,
        relatedLink: `/issues?project=${projectId}`,
      });
    }

    // Notify Admins and Managers for Time Expansion
    if (timeExpanded) {
      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] } });
      const updaterName = updaterUser ? updaterUser.name : 'An engineer';
      for (const recipient of adminsAndManagers) {
        if (updaterUser && String(recipient._id) === String(updaterUser._id)) continue;
        await notificationService.createNotification({
          recipient: recipient._id,
          title: `Time Expanded: ${issue.issueId}`,
          message: `${updaterName} expanded the estimated hours for "${issue.title}" by +${expandedByHours.toFixed(1)} hrs. Reason: ${expandReason || 'No reason provided'}`,
          type: 'info',
          module: 'issues',
          relatedId: issue._id,
          relatedLink: `/issues?project=${projectId}`,
        });
      }
    }

    // Notify Admins and Managers for Time Request
    if (timeRequested && timeRequestData) {
      const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] } });
      const requesterName = updaterUser ? updaterUser.name : 'An engineer';
      for (const recipient of adminsAndManagers) {
        if (updaterUser && String(recipient._id) === String(updaterUser._id)) continue;
        await notificationService.createNotification({
          recipient: recipient._id,
          title: `Time Request: ${issue.issueId}`,
          message: `${requesterName} requested a time extension of +${timeRequestData.hours.toFixed(1)} hrs for "${issue.title}". Reason: ${timeRequestData.reason}`,
          type: 'warning',
          module: 'issues',
          relatedId: issue._id,
          relatedLink: `/issues?project=${projectId}`,
        });
      }
    }
  } catch (err) {
    const logger = require('../../config/logger');
    logger.error('Failed to trigger notification on issue update', { error: err.message });
  }

  return issue;
};

const deleteIssueById = async (issueId) => {
  const issue = await getIssueById(issueId);
  issue.deletedAt = new Date();
  await issue.save();
  return issue;
};

/**
 * Add attachments to an issue
 */
const addAttachments = async (issueId, files, userId) => {
  const issue = await getIssueById(issueId);

  const attachments = files.map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    path: `/uploads/issues/${file.filename}`,
    mimetype: file.mimetype,
    size: file.size,
    uploadedAt: new Date(),
    uploadedBy: userId,
  }));

  issue.attachments.push(...attachments);
  await issue.save();
  return issue;
};

/**
 * Remove an attachment from an issue
 */
const removeAttachment = async (issueId, attachmentId) => {
  const issue = await getIssueById(issueId);

  const attachment = issue.attachments.id(attachmentId);
  if (!attachment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Attachment not found');
  }

  // Delete file from disk
  const filePath = path.join(__dirname, '../../../uploads/issues', attachment.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  issue.attachments.pull(attachmentId);
  await issue.save();
  return issue;
};

module.exports = {
  createIssue,
  queryIssues,
  getIssueById,
  getIssueByFormattedId,
  updateIssueById,
  deleteIssueById,
  addAttachments,
  removeAttachment,
};
