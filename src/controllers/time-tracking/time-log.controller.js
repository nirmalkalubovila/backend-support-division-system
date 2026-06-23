const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { timeLogService } = require('../../services');
const pick = require('../../utils/pick');

const startTimer = catchAsync(async (req, res) => {
  const { issueId, taskId, crId, workType, note, isBillable } = req.body;
  const timeLog = await timeLogService.startTimer(req.user._id, issueId, taskId, crId, workType, note, isBillable);
  res.status(httpStatus.CREATED).send(timeLog);
});

const stopTimer = catchAsync(async (req, res) => {
  const { issueId, taskId, crId, note, activeDuration } = req.body;
  const timeLog = await timeLogService.stopTimer(req.user._id, issueId, taskId, crId, note, activeDuration);
  res.status(httpStatus.OK).send(timeLog);
});

const createManualLog = catchAsync(async (req, res) => {
  const { issueId, taskId, crId, startTime, endTime, workType, note, isBillable } = req.body;
  const timeLog = await timeLogService.createManualLog(
    req.user._id,
    issueId,
    taskId,
    crId,
    startTime,
    endTime,
    workType,
    note,
    isBillable
  );
  res.status(httpStatus.CREATED).send(timeLog);
});

const getTimeLogs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['issue', 'task', 'cr', 'user', 'project', 'approved', 'active']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await timeLogService.queryTimeLogs(filter, options);
  res.status(httpStatus.OK).send(result);
});

const updateTimeLog = catchAsync(async (req, res) => {
  const timeLog = await timeLogService.updateTimeLog(
    req.params.logId,
    req.body,
    req.user._id,
    req.user.role
  );
  res.status(httpStatus.OK).send(timeLog);
});

const deleteTimeLog = catchAsync(async (req, res) => {
  await timeLogService.deleteTimeLog(req.params.logId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  startTimer,
  stopTimer,
  createManualLog,
  getTimeLogs,
  updateTimeLog,
  deleteTimeLog,
};
