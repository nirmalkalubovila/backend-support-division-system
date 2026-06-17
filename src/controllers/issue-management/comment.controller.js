const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const commentService = require('../../services/issue-management/comment.service');
const pick = require('../../utils/pick');

const addComment = catchAsync(async (req, res) => {
  const comment = await commentService.addComment(req.params.issueId, req.user.id, req.body.content);
  res.status(httpStatus.CREATED).send(comment);
});

const getComments = catchAsync(async (req, res) => {
  const options = pick(req.query, ['limit', 'page']);
  const result = await commentService.getIssueComments(req.params.issueId, options);
  res.send(result);
});

const deleteComment = catchAsync(async (req, res) => {
  await commentService.deleteComment(req.params.commentId, req.user.id, req.user.role);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  addComment,
  getComments,
  deleteComment,
};
