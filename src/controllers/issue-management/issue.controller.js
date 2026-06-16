const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { issueService } = require('../../services');
const pick = require('../../utils/pick');
const ApiError = require('../../utils/ApiError');
const { broadcast } = require('../../config/socket');

const createIssue = catchAsync(async (req, res) => {
  const issue = await issueService.createIssue(req.body, req.user.id);
  // Broadcast to all users in this project's room
  if (issue.project) {
    const projectId = typeof issue.project === 'object' ? String(issue.project._id) : String(issue.project);
    broadcast(projectId, 'issue:created', issue);
  }
  res.status(httpStatus.CREATED).send(issue);
});

const getIssues = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { issueId: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  if (req.query.client) filter.client = req.query.client;
  if (req.query.project) filter.project = req.query.project;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  if (req.user.role === 'engineer' || req.user.role === 'intern') {
    filter.assignedTo = req.user.id;
  } else if (req.query.assignedTo) {
    filter.assignedTo = req.query.assignedTo === 'null' ? null : req.query.assignedTo;
  }

  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await issueService.queryIssues(filter, options);
  res.send(result);
});

const getIssue = catchAsync(async (req, res) => {
  let issue;
  if (req.params.issueId.match(/^[0-9a-fA-F]{24}$/)) {
    issue = await issueService.getIssueById(req.params.issueId);
  } else {
    issue = await issueService.getIssueByFormattedId(req.params.issueId);
  }
  res.send(issue);
});

const updateIssue = catchAsync(async (req, res) => {
  const issueToUpdate = await issueService.getIssueById(req.params.issueId);

  if (req.body.status === 'Closed' && req.user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only super admins can close issues');
  }
  if (issueToUpdate.status === 'Closed' && req.user.role !== 'super_admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Closed issues cannot be modified by non-super admins');
  }

  const issue = await issueService.updateIssueById(req.params.issueId, req.body);
  const projectId = typeof issue.project === 'object' ? String(issue.project._id) : String(issue.project);
  broadcast(projectId, 'issue:updated', issue);
  res.send(issue);
});

const deleteIssue = catchAsync(async (req, res) => {
  const issue = await issueService.getIssueById(req.params.issueId);
  const projectId = typeof issue.project === 'object' ? String(issue.project._id) : String(issue.project);
  await issueService.deleteIssueById(req.params.issueId);
  broadcast(projectId, 'issue:deleted', { _id: req.params.issueId });
  res.status(httpStatus.NO_CONTENT).send();
});

const uploadAttachments = catchAsync(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'No files uploaded' });
  }
  const issue = await issueService.addAttachments(req.params.issueId, req.files, req.user.id);
  const projectId = typeof issue.project === 'object' ? String(issue.project._id) : String(issue.project);
  broadcast(projectId, 'issue:updated', issue);
  res.send(issue);
});

const deleteAttachment = catchAsync(async (req, res) => {
  const issue = await issueService.removeAttachment(req.params.issueId, req.params.attachmentId);
  const projectId = typeof issue.project === 'object' ? String(issue.project._id) : String(issue.project);
  broadcast(projectId, 'issue:updated', issue);
  res.send(issue);
});

module.exports = {
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssue,
  uploadAttachments,
  deleteAttachment,
};
