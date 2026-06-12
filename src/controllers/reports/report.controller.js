const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { reportService, exportService } = require('../../services');
const pick = require('../../utils/pick');

const getDailyReport = catchAsync(async (req, res) => {
  const report = await reportService.getLatestReport('daily', req.query.date);
  res.send(report || { message: 'No daily report available for this date. Generate one manually.' });
});

const getWeeklyReport = catchAsync(async (req, res) => {
  const report = await reportService.getLatestReport('weekly', req.query.weekStart);
  res.send(report || { message: 'No weekly report available for this period. Generate one manually.' });
});

const generateDailyReport = catchAsync(async (req, res) => {
  const report = await reportService.generateDailyReport(req.body.date, req.user._id);
  res.status(httpStatus.CREATED).send(report);
});

const generateWeeklyReport = catchAsync(async (req, res) => {
  const report = await reportService.generateWeeklyReport(req.body.date, req.user._id);
  res.status(httpStatus.CREATED).send(report);
});

const generateMonthlyReport = catchAsync(async (req, res) => {
  const { month, year } = req.body;
  const report = await reportService.generateMonthlyReport(month, year, req.user._id);
  res.status(httpStatus.CREATED).send(report);
});

const getMonthlyReport = catchAsync(async (req, res) => {
  const { month, year } = req.query;
  if (month && year) {
    // Find the latest monthly report for the given month/year
    const { Report } = require('../../models');
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    const report = await Report.findOne({
      type: 'monthly',
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: new Date(periodEnd.getTime() + 86400000) },
      deletedAt: null,
      status: 'completed',
    }).sort({ createdAt: -1 });
    res.send(report || { message: 'No monthly report found for this period.' });
  } else {
    // Return the latest monthly report
    const { Report } = require('../../models');
    const report = await Report.findOne({
      type: 'monthly',
      deletedAt: null,
      status: 'completed',
    }).sort({ createdAt: -1 });
    res.send(report || { message: 'No monthly report available.' });
  }
});

const buildExecutiveReport = catchAsync(async (req, res) => {
  const report = await reportService.buildExecutiveReport(req.body, req.user._id);
  res.status(httpStatus.CREATED).send(report);
});

const getKpiAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate, granularity } = req.query;
  const data = reportService.getKpiAnalytics(startDate, endDate, granularity);
  res.send(data);
});

const getUtilizationReport = catchAsync(async (req, res) => {
  const { startDate, endDate, projectId } = req.query;
  const data = reportService.getUtilizationReport(startDate, endDate, projectId);
  res.send(data);
});

const paginateReports = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['type']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await reportService.paginateReports(filter, options);
  res.send(result);
});

const getReportById = catchAsync(async (req, res) => {
  const report = await reportService.getReportById(req.params.id);
  res.send(report);
});

const exportReport = catchAsync(async (req, res) => {
  const report = await reportService.getReportById(req.params.id);
  const { format } = req.query;

  if (format === 'pdf') {
    const buffer = await exportService.exportReportAsPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${report.type}-${report._id}.pdf`);
    res.send(buffer);
  } else {
    const buffer = await exportService.exportReportAsExcel(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report-${report.type}-${report._id}.xlsx`);
    res.send(buffer);
  }
});

module.exports = {
  getDailyReport,
  getWeeklyReport,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getMonthlyReport,
  buildExecutiveReport,
  getKpiAnalytics,
  getUtilizationReport,
  paginateReports,
  getReportById,
  exportReport,
};
