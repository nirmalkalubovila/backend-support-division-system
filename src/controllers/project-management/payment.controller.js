const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../../utils/catchAsync');
const { paymentService } = require('../../services');
const pick = require('../../utils/pick');

const createPayment = catchAsync(async (req, res) => {
  const body = { ...req.body };
  if (body.quantity !== undefined) body.quantity = Number(body.quantity);
  if (body.pricePerUnit !== undefined) body.pricePerUnit = Number(body.pricePerUnit);
  if (req.file) body.attachment = `/uploads/payments/${path.basename(req.file.path)}`;
  const payment = await paymentService.createPayment(req.params.projectId, body);
  res.status(httpStatus.CREATED).send(payment);
});

const getPayments = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['paymentStatus', 'paymentType', 'uom']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await paymentService.queryPayments(req.params.projectId, filter, options);
  res.send(result);
});

const getPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.paymentId);
  res.send(payment);
});

const updatePayment = catchAsync(async (req, res) => {
  const body = { ...req.body };
  if (body.quantity !== undefined) body.quantity = Number(body.quantity);
  if (body.pricePerUnit !== undefined) body.pricePerUnit = Number(body.pricePerUnit);
  if (req.file) body.attachment = `/uploads/payments/${path.basename(req.file.path)}`;
  const payment = await paymentService.updatePaymentById(req.params.paymentId, body);
  res.send(payment);
});

const deletePayment = catchAsync(async (req, res) => {
  await paymentService.deletePaymentById(req.params.paymentId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getProjectFinanceSummary = catchAsync(async (req, res) => {
  const summary = await paymentService.getProjectFinanceSummary(req.params.projectId);
  res.send(summary);
});

const getGlobalFinanceKPIs = catchAsync(async (req, res) => {
  const kpis = await paymentService.getGlobalFinanceKPIs();
  res.send(kpis);
});

const getAllProjectsFinance = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['client', 'isActive', 'search', 'paymentStatus']);
  const results = await paymentService.getAllProjectsFinance(filter);
  res.send(results);
});

module.exports = {
  createPayment,
  getPayments,
  getPayment,
  updatePayment,
  deletePayment,
  getProjectFinanceSummary,
  getGlobalFinanceKPIs,
  getAllProjectsFinance,
};
