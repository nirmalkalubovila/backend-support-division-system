const httpStatus = require('http-status');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const userPerformanceService = require('../../services/reports/user-performance.service');

const getTeamComparison = catchAsync(async (req, res) => {
  // Access control check: Only manager and super_admin see team comparison tables
  if (req.user.role !== 'super_admin' && req.user.role !== 'manager') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied. Managers only.');
  }
  const { startDate, endDate } = req.query;
  const data = await userPerformanceService.getTeamComparisonData(startDate, endDate);
  res.status(httpStatus.OK).send(data);
});

const getScorecard = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  let { userId } = req.query;

  // Access control check: If non-manager, force self-view of their own scorecard
  if (req.user.role !== 'super_admin' && req.user.role !== 'manager') {
    userId = req.user.id || req.user._id;
  } else if (!userId) {
    // If manager requests without userId, default to their own scorecard
    userId = req.user.id || req.user._id;
  }

  const data = await userPerformanceService.getUserScorecardData(userId, startDate, endDate);
  res.status(httpStatus.OK).send(data);
});

module.exports = {
  getTeamComparison,
  getScorecard,
};
