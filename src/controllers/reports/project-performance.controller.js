const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const projectPerformanceService = require('../../services/reports/project-performance.service');

const getPerformanceData = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await projectPerformanceService.getPerformanceData(startDate, endDate);
  res.status(httpStatus.OK).send(data);
});

module.exports = {
  getPerformanceData,
};
