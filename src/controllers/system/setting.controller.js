const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { settingService } = require('../../services');
const ApiError = require('../../utils/ApiError');

const getBranding = catchAsync(async (req, res) => {
  const branding = await settingService.getBranding();
  res.send(branding);
});

const updateBranding = catchAsync(async (req, res) => {
  const branding = await settingService.updateBranding(req.body);
  res.send(branding);
});

const getPriorities = catchAsync(async (req, res) => {
  const priorities = await settingService.getPriorities();
  res.send(priorities);
});

const updatePriorities = catchAsync(async (req, res) => {
  const priorities = await settingService.updatePriorities(req.body);
  res.send(priorities);
});

const getCategories = catchAsync(async (req, res) => {
  const categories = await settingService.getCategories();
  res.send(categories);
});

const updateCategories = catchAsync(async (req, res) => {
  const categories = await settingService.updateCategories(req.body);
  res.send(categories);
});

const getNotifications = catchAsync(async (req, res) => {
  const notifications = await settingService.getNotifications();
  res.send(notifications);
});

const updateNotifications = catchAsync(async (req, res) => {
  const notifications = await settingService.updateNotifications(req.body);
  res.send(notifications);
});

const uploadLogo = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please upload an image file');
  }
  const logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(httpStatus.CREATED).send({ logoUrl });
});

const getReportSchedule = catchAsync(async (req, res) => {
  const schedule = await settingService.getReportSchedule();
  res.send(schedule);
});

const updateReportSchedule = catchAsync(async (req, res) => {
  const schedule = await settingService.updateReportSchedule(req.body);
  res.send(schedule);
});

module.exports = {
  getBranding,
  updateBranding,
  getPriorities,
  updatePriorities,
  getCategories,
  updateCategories,
  getNotifications,
  updateNotifications,
  uploadLogo,
  getReportSchedule,
  updateReportSchedule,
};
