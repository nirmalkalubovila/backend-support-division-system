const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { issueService } = require('../../services');
const pick = require('../../utils/pick');

const createIssue = catchAsync(async (req, res) => {
  const issue = await issueService.createIssue(req.body, req.user.id);
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

  // Role scope filtering
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
  // We can retrieve either by ObjectId or format ID (e.g. AQF-2026-00001)
  let issue;
  if (req.params.issueId.match(/^[0-9a-fA-F]{24}$/)) {
    issue = await issueService.getIssueById(req.params.issueId);
  } else {
    issue = await issueService.getIssueByFormattedId(req.params.issueId);
  }
  res.send(issue);
});

const updateIssue = catchAsync(async (req, res) => {
  // Find issue first to verify permissions if needed
  const issue = await issueService.updateIssueById(req.params.issueId, req.body);
  res.send(issue);
});

const deleteIssue = catchAsync(async (req, res) => {
  await issueService.deleteIssueById(req.params.issueId);
  res.status(httpStatus.NO_CONTENT).send();
});

const uploadAttachments = catchAsync(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'No files uploaded' });
  }
  const issue = await issueService.addAttachments(req.params.issueId, req.files, req.user.id);
  res.send(issue);
});

const deleteAttachment = catchAsync(async (req, res) => {
  const issue = await issueService.removeAttachment(req.params.issueId, req.params.attachmentId);
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
