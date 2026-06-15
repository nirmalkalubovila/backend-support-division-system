const httpStatus = require('http-status');
const { Payment, Project } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createPayment = async (projectId, body) => {
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  return Payment.create({ ...body, project: projectId });
};

const queryPayments = async (projectId, filter, options) => {
  return Payment.paginate(
    { project: projectId, deletedAt: null, ...filter },
    { ...options, populate: 'project' }
  );
};

const getPaymentById = async (id) => {
  const payment = await Payment.findOne({ _id: id, deletedAt: null }).populate('project');
  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  return payment;
};

const updatePaymentById = async (id, updateBody) => {
  const payment = await getPaymentById(id);
  Object.assign(payment, updateBody);
  await payment.save();
  return payment;
};

const deletePaymentById = async (id) => {
  const payment = await getPaymentById(id);
  payment.deletedAt = new Date();
  await payment.save();
};

/**
 * Returns per-project billing summary: totalBilled, totalReceived, outstanding, entries count
 */
const getProjectFinanceSummary = async (projectId) => {
  const payments = await Payment.find({ project: projectId, deletedAt: null });
  const totalBilled = payments.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const totalReceived = payments
    .filter((p) => p.paymentStatus === 'Paid')
    .reduce((s, p) => s + (p.totalAmount || 0), 0);
  const partiallyPaid = payments
    .filter((p) => p.paymentStatus === 'Partially Paid')
    .reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);
  const outstanding = totalBilled - totalReceived - partiallyPaid;
  return { totalBilled, totalReceived, partiallyPaid, outstanding, count: payments.length };
};

/**
 * Global finance KPIs across all projects
 */
const getGlobalFinanceKPIs = async () => {
  const payments = await Payment.find({ deletedAt: null }).populate('project');
  const projects = await Project.find({ deletedAt: null }).countDocuments();

  const totalRevenue = payments.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const paid = payments
    .filter((p) => p.paymentStatus === 'Paid')
    .reduce((s, p) => s + (p.totalAmount || 0), 0);
  const pending = payments
    .filter((p) => p.paymentStatus === 'Pending')
    .reduce((s, p) => s + (p.totalAmount || 0), 0);
  const overdue = payments
    .filter((p) => p.paymentStatus === 'Overdue')
    .reduce((s, p) => s + (p.totalAmount || 0), 0);

  // Monthly revenue: sum of Paid payments in current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = payments
    .filter((p) => p.paymentStatus === 'Paid' && p.paymentDate && new Date(p.paymentDate) >= monthStart)
    .reduce((s, p) => s + (p.totalAmount || 0), 0);

  return { totalProjects: projects, totalRevenue, paid, pending, overdue, monthlyRevenue };
};

/**
 * All projects with their finance summary (for finance table)
 */
const getAllProjectsFinance = async (filter = {}) => {
  const query = { deletedAt: null };
  if (filter.client) query.client = filter.client;
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  if (filter.search) query.name = { $regex: filter.search, $options: 'i' };

  const projects = await Project.find(query).populate('client').lean();

  const results = await Promise.all(
    projects.map(async (project) => {
      const summary = await getProjectFinanceSummary(project._id);
      return { ...project, finance: summary };
    })
  );

  // Apply payment status filter post-aggregation
  if (filter.paymentStatus) {
    return results.filter((p) => {
      if (filter.paymentStatus === 'Overdue') return p.finance.outstanding > 0 && p.finance.totalBilled > 0;
      if (filter.paymentStatus === 'Paid') return p.finance.outstanding <= 0 && p.finance.totalBilled > 0;
      if (filter.paymentStatus === 'Pending') return p.finance.count === 0;
      return true;
    });
  }

  return results;
};

module.exports = {
  createPayment,
  queryPayments,
  getPaymentById,
  updatePaymentById,
  deletePaymentById,
  getProjectFinanceSummary,
  getGlobalFinanceKPIs,
  getAllProjectsFinance,
};
