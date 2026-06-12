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
    client: clientCode.clientId,
    createdAt: { $gte: startOfYear, $lte: endOfYear },
  });

  const nextSequence = String(clientIssuesCount + 1).padStart(5, '0');
  return `${clientCode.code}-${currentYear}-${nextSequence}`;
};

/**
 * Calculate the Due Date based on priority SLA rules
 */
const calculateSlaDueDate = (priority) => {
  const now = moment();
  switch (priority) {
    case 'Critical':
      return now.add(4, 'hours').toDate();
    case 'High':
      return now.add(24, 'hours').toDate(); // 1 day
    case 'Medium':
      return now.add(72, 'hours').toDate(); // 3 days
    case 'Low':
      return now.add(168, 'hours').toDate(); // 1 week
    default:
      return now.add(72, 'hours').toDate(); // default medium (3 days)
  }
};

const createIssue = async (issueBody, userId) => {
  const client = await Client.findOne({ _id: issueBody.client, deletedAt: null });
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }

  const project = await Project.findOne({ _id: issueBody.project, deletedAt: null });
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Generate unique ID
  const issueId = await generateIssueId({ clientId: client._id, code: client.code });

  // Calculate Due Date based on SLA rules
  const dueDate = calculateSlaDueDate(issueBody.priority || 'Medium');

  const issueData = {
    ...issueBody,
    issueId,
    dueDate,
    createdBy: userId,
    status: issueBody.assignedTo ? 'Assigned' : 'Backlog',
  };

  return Issue.create(issueData);
};

const queryIssues = async (filter, options) => {
  const issues = await Issue.paginate({ ...filter, deletedAt: null }, { ...options, populate: 'client,project,assignedTo,createdBy' });
  return issues;
};

const getIssueById = async (id) => {
  const issue = await Issue.findOne({ _id: id, deletedAt: null }).populate('client project assignedTo createdBy');
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }
  return issue;
};

const getIssueByFormattedId = async (issueId) => {
  const issue = await Issue.findOne({ issueId, deletedAt: null }).populate('client project assignedTo createdBy');
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }
  return issue;
};

const updateIssueById = async (issueId, updateBody) => {
  const issue = await getIssueById(issueId);

  // If priority changes, re-calculate the SLA due date
  if (updateBody.priority && updateBody.priority !== issue.priority) {
    updateBody.dueDate = calculateSlaDueDate(updateBody.priority);
  }

  // Update status changes assigned status automatically
  if (updateBody.assignedTo && !issue.assignedTo && issue.status === 'Backlog') {
    updateBody.status = 'Assigned';
  }

  Object.assign(issue, updateBody);
  await issue.save();
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
