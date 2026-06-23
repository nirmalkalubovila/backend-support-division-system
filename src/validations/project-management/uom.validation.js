const Joi = require('joi');

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': '{{#label}} must be a valid MongoDB ObjectId' });

const yearMonth = Joi.string()
  .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
  .messages({ 'string.pattern.base': '{{#label}} must be in YYYY-MM format (e.g. 2025-06)' });

// ─────────────────────────────────────────────────────────────────────────────
// Baseline
// ─────────────────────────────────────────────────────────────────────────────

const configureBaseline = {
  params: Joi.object({ projectId: Joi.string().required() }),
  body: Joi.object({
    billingMonth: yearMonth.optional(),
    uomTypes: Joi.array()
      .items(
        Joi.object({
          _id: objectId.optional(), // omit for new types
          name: Joi.string().max(100).required(),
          description: Joi.string().allow(null, '').optional(),
          defaultCount: Joi.number().min(0).required(),
          baselinePrice: Joi.number().min(0).required(),
          currency: Joi.string().max(10).default('USD').optional(),
          unit: Joi.string().max(50).allow(null, '').optional(),
          isActive: Joi.boolean().default(true).optional(),
          order: Joi.number().integer().min(0).optional(),
        })
      )
      .min(1)
      .required(),
  }),
};

const getBaseline = {
  params: Joi.object({ projectId: Joi.string().required() }),
};

const updateUomPrice = {
  params: Joi.object({
    projectId: Joi.string().required(),
    uomTypeId: objectId.required(),
  }),
  body: Joi.object({
    pricePerUnit: Joi.number().min(0).required(),
    defaultCount: Joi.number().min(0).optional(),
    effectiveFrom: yearMonth.optional(),
    notes: Joi.string().allow(null, '').optional(),
  }),
};

const getUomPricingHistory = {
  params: Joi.object({
    projectId: Joi.string().required(),
    uomTypeId: objectId.required(),
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots
// ─────────────────────────────────────────────────────────────────────────────

const generateSnapshot = {
  params: Joi.object({ projectId: Joi.string().required() }),
  body: Joi.object({
    billingMonth: yearMonth.optional(),
  }),
};

const getSnapshots = {
  params: Joi.object({ projectId: Joi.string().required() }),
  query: Joi.object({
    status: Joi.string().valid('draft', 'finalized').optional(),
    billingMonth: yearMonth.optional(),
    sortBy: Joi.string().optional(),
    limit: Joi.number().integer().min(1).optional(),
    page: Joi.number().integer().min(1).optional(),
  }),
};

const getSnapshot = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
};

const getSnapshotByMonth = {
  params: Joi.object({
    projectId: Joi.string().required(),
    billingMonth: yearMonth.required(),
  }),
};

const updateSnapshotCounts = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
  body: Joi.object({
    lines: Joi.array()
      .items(
        Joi.object({
          uomTypeId: objectId.required(),
          count: Joi.number().min(0).required(),
        })
      )
      .min(1)
      .required(),
    notes: Joi.string().allow(null, '').optional(),
  }),
};

const finalizeSnapshot = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
  body: Joi.object({
    dueDate: Joi.string().isoDate().allow(null, '').optional(),
    paymentStatus: Joi.string().valid('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled').optional(),
    paymentMethod: Joi.string().valid('Bank Transfer', 'Cash', 'Online Payment').allow(null, '').optional(),
    paymentDate: Joi.string().isoDate().allow(null, '').optional(),
    referenceNumber: Joi.string().allow(null, '').optional(),
    notes: Joi.string().allow(null, '').optional(),
    partiallyPaidAmount: Joi.number().min(0.01).optional(),
  }),
};

const unlockSnapshot = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
  body: Joi.object({
    reason: Joi.string().min(1).required(),
  }),
};

const addSnapshotOverride = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
  body: Joi.object({
    uomTypeId: objectId.required(),
    newCount: Joi.number().min(0).required(),
    newPricePerUnit: Joi.number().min(0).optional(),
    reason: Joi.string().min(1).required(),
    approvedBy: objectId.optional(),
  }),
};

const linkPaymentToSnapshot = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
  body: Joi.object({
    paymentId: objectId.required(),
  }),
};

const deleteSnapshot = {
  params: Joi.object({
    projectId: Joi.string().required(),
    snapshotId: objectId.required(),
  }),
};

module.exports = {
  configureBaseline,
  getBaseline,
  updateUomPrice,
  getUomPricingHistory,
  generateSnapshot,
  getSnapshots,
  getSnapshot,
  getSnapshotByMonth,
  updateSnapshotCounts,
  finalizeSnapshot,
  unlockSnapshot,
  addSnapshotOverride,
  linkPaymentToSnapshot,
  deleteSnapshot,
};
