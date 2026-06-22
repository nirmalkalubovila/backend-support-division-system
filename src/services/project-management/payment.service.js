const httpStatus = require('http-status');
const { Payment, Project } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createPayment = async (projectId, body) => {
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  // If payment is created with Paid or Partially Paid status, seed the initial transaction
  const seedTransaction =
    body.paymentStatus === 'Paid' || body.paymentStatus === 'Partially Paid';

  const transactionEntry = seedTransaction
    ? {
        amount:
          body.paymentStatus === 'Paid'
            ? undefined // resolved after totalAmount is calculated (post-save)
            : parseFloat((body.partiallyPaidAmount || 0).toFixed(2)),
        paymentDate: body.paymentDate || null,
        paymentMethod: body.paymentMethod || null,
        referenceNumber: body.referenceNumber || null,
        notes: body.notes || null,
      }
    : null;

  const payment = await Payment.create({ ...body, project: projectId });

  // After creation totalAmount is available; push the seeded transaction
  if (seedTransaction) {
    const txAmount =
      body.paymentStatus === 'Paid'
        ? payment.totalAmount
        : parseFloat((body.partiallyPaidAmount || 0).toFixed(2));

    if (txAmount > 0) {
      await Payment.findByIdAndUpdate(payment._id, {
        $push: {
          transactions: {
            amount: txAmount,
            paymentDate: transactionEntry.paymentDate,
            paymentMethod: transactionEntry.paymentMethod,
            referenceNumber: transactionEntry.referenceNumber,
            notes: transactionEntry.notes,
          },
        },
      });
    }
  }

  return Payment.findById(payment._id).populate('project');
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
  const prevStatus = payment.paymentStatus;

  Object.assign(payment, updateBody);
  await payment.save();

  // If status transitioned to Paid/Partially Paid from a non-transactional state
  // and there are no transactions yet, seed the first transaction from the updated fields
  const newStatus = payment.paymentStatus;
  const shouldSeed =
    ['Paid', 'Partially Paid'].includes(newStatus) &&
    !['Paid', 'Partially Paid'].includes(prevStatus) &&
    payment.transactions.length === 0;

  if (shouldSeed) {
    const txAmount =
      newStatus === 'Paid'
        ? payment.totalAmount
        : parseFloat((payment.partiallyPaidAmount || 0).toFixed(2));

    if (txAmount > 0) {
      await Payment.findByIdAndUpdate(id, {
        $push: {
          transactions: {
            amount: txAmount,
            paymentDate: payment.paymentDate || null,
            paymentMethod: payment.paymentMethod || null,
            referenceNumber: payment.referenceNumber || null,
            notes: payment.notes || null,
          },
        },
      });
    }
  }

  return Payment.findById(id).populate('project');
};

/**
 * Allocate a payment amount against a Pending or Partially Paid payment.
 * Stores each allocation as a separate transaction entry.
 * Derives partiallyPaidAmount from the sum of all transactions.
 * Auto-transitions status to Paid or Partially Paid.
 */
const allocatePayment = async (id, { amount, paymentMethod, paymentDate, referenceNumber, notes }) => {
  const payment = await getPaymentById(id);

  if (!['Pending', 'Partially Paid'].includes(payment.paymentStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only Pending or Partially Paid payments can be allocated');
  }

  const alreadyPaid = payment.partiallyPaidAmount || 0;
  const outstanding = parseFloat((payment.totalAmount - alreadyPaid).toFixed(2));

  if (amount <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Allocation amount must be greater than zero');
  }
  if (parseFloat(amount.toFixed(2)) > outstanding) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Allocation amount (${amount}) exceeds outstanding balance (${outstanding})`
    );
  }

  // Build the transaction entry
  const transaction = {
    amount: parseFloat(amount.toFixed(2)),
    paymentDate: paymentDate || null,
    paymentMethod: paymentMethod || null,
    referenceNumber: referenceNumber || null,
    notes: notes || null,
  };

  // Push transaction and recalculate totals atomically
  const newPaid = parseFloat((alreadyPaid + transaction.amount).toFixed(2));
  const newStatus = newPaid >= payment.totalAmount ? 'Paid' : 'Partially Paid';

  // Most recent transaction details bubble up to the parent for quick display
  const updated = await Payment.findByIdAndUpdate(
    id,
    {
      $push: { transactions: transaction },
      $set: {
        partiallyPaidAmount: newPaid,
        paymentStatus: newStatus,
        // Update top-level fields with the latest transaction values for display
        paymentDate: transaction.paymentDate || payment.paymentDate,
        paymentMethod: transaction.paymentMethod || payment.paymentMethod,
        referenceNumber: transaction.referenceNumber || payment.referenceNumber,
        notes: transaction.notes || payment.notes,
      },
    },
    { new: true }
  ).populate('project');

  return updated;
};

/**
 * Get all payment transactions for a given payment record.
 */
const getPaymentTransactions = async (id) => {
  const payment = await Payment.findOne({ _id: id, deletedAt: null }).select(
    'paymentId totalAmount partiallyPaidAmount paymentStatus transactions'
  );
  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  return {
    paymentId: payment.paymentId,
    totalAmount: payment.totalAmount,
    partiallyPaidAmount: payment.partiallyPaidAmount || 0,
    paymentStatus: payment.paymentStatus,
    outstanding: parseFloat(((payment.totalAmount || 0) - (payment.partiallyPaidAmount || 0)).toFixed(2)),
    transactions: payment.transactions.slice().reverse(), // newest first
  };
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
  const fullyReceived = payments
    .filter((p) => p.paymentStatus === 'Paid')
    .reduce((s, p) => s + (p.totalAmount || 0), 0);
  const partiallyPaid = payments
    .filter((p) => p.paymentStatus === 'Partially Paid')
    .reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);
  const totalReceived = parseFloat((fullyReceived + partiallyPaid).toFixed(2));
  const outstanding = parseFloat((totalBilled - totalReceived).toFixed(2));
  return { totalBilled, totalReceived, outstanding, count: payments.length };
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
  allocatePayment,
  getPaymentTransactions,
  deletePaymentById,
  getProjectFinanceSummary,
  getGlobalFinanceKPIs,
  getAllProjectsFinance,
};
