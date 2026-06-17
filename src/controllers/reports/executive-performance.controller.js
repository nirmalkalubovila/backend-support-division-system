const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const executivePerformanceService = require('../../services/reports/executive-performance.service');

const getExecutivePerformanceData = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executivePerformanceService.getExecutivePerformanceData(startDate, endDate);
  res.status(httpStatus.OK).send(data);
});

module.exports = {
  getExecutivePerformanceData,
};
