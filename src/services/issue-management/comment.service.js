const httpStatus = require('http-status');
const { Comment, Issue, User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');

/**
 * Add a comment to an issue and trigger notifications (A7)
 * @param {string} issueId
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<Comment>}
 */
const addComment = async (issueId, userId, content) => {
  const issue = await Issue.findOne({ _id: issueId, deletedAt: null }).populate('project');
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }

  const comment = await Comment.create({
    issue: issueId,
    author: userId,
    content,
  });

  const populatedComment = await Comment.findById(comment._id).populate('author', 'name email avatar role');

  // A7: Notify the assignee and the issue creator about the new comment
  try {
    const notificationService = require('../system/notification.service');
    const commenter = await User.findById(userId);
    const commenterName = commenter ? commenter.name : 'Someone';
    const projectId = issue.project ? (issue.project._id || issue.project) : '';
    const recipientSet = new Set();

    // Notify the assignee
    if (issue.assignedTo) {
      recipientSet.add(String(issue.assignedTo._id || issue.assignedTo));
    }

    // Notify the issue creator (reporter)
    if (issue.createdBy) {
      recipientSet.add(String(issue.createdBy._id || issue.createdBy));
    }

    // Remove the commenter themselves from notification recipients
    recipientSet.delete(String(userId));

    for (const recipientId of recipientSet) {
      await notificationService.createNotification({
        recipient: recipientId,
        sender: userId,
        title: 'New Comment',
        message: `${commenterName} commented on issue "${issue.title}" (${issue.issueId}): "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
        type: 'info',
        module: 'issues',
        relatedId: issue._id,
        relatedLink: `/issues?project=${projectId}`,
      });
    }
  } catch (err) {
    logger.error('Failed to send comment notification', { error: err.message });
  }

  return populatedComment;
};

/**
 * Get all comments for an issue
 * @param {string} issueId
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>}
 */
const getIssueComments = async (issueId, options = {}) => {
  const issue = await Issue.findOne({ _id: issueId, deletedAt: null });
  if (!issue) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Issue not found');
  }

  const limit = parseInt(options.limit, 10) || 50;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  const comments = await Comment.find({ issue: issueId, deletedAt: null })
    .populate('author', 'name email avatar role')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit);

  const totalResults = await Comment.countDocuments({ issue: issueId, deletedAt: null });
  const totalPages = Math.ceil(totalResults / limit);

  return {
    results: comments,
    page,
    limit,
    totalPages,
    totalResults,
  };
};

/**
 * Delete a comment (soft delete)
 * @param {string} commentId
 * @param {string} userId
 * @param {string} userRole
 * @returns {Promise<void>}
 */
const deleteComment = async (commentId, userId, userRole) => {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Only the author or admins/managers can delete a comment
  const isAdminOrManager = userRole === 'super_admin' || userRole === 'manager';
  if (String(comment.author) !== String(userId) && !isAdminOrManager) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to delete this comment');
  }

  comment.deletedAt = new Date();
  await comment.save();
};

module.exports = {
  addComment,
  getIssueComments,
  deleteComment,
};
