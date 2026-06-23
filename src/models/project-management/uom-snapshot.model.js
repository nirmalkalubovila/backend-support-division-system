const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

/**
 * A single UOM line item within a monthly snapshot.
 * Copied from the baseline but counts can be edited before finalisation.
 */
const snapshotLineSchema = new mongoose.Schema(
  {
    uomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    // Count for this billing period (editable until snapshot is locked)
    count: {
      type: Number,
      required: true,
      min: 0,
    },
    // Count from the previous month's snapshot (for diff display in UI)
    previousCount: {
      type: Number,
      default: null,
    },
    // Active pricing as of this month
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
    },
    unit: {
      type: String,
      default: null,
    },
    // Auto-calculated: count × pricePerUnit
    lineTotal: {
      type: Number,
      default: 0,
    },
    // Whether this line was manually edited vs auto-filled
    isManuallyEdited: {
      type: Boolean,
      default: false,
    },
    // pricingVersionId used to look up this price
    pricingVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

/**
 * Override entry — recorded when a locked snapshot must be corrected.
 * The snapshot lines are NOT modified; overrides are tracked separately.
 */
const snapshotOverrideSchema = new mongoose.Schema(
  {
    uomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    uomTypeName: {
      type: String,
      required: true,
    },
    previousCount: {
      type: Number,
      required: true,
    },
    newCount: {
      type: Number,
      required: true,
    },
    previousPricePerUnit: {
      type: Number,
      required: true,
    },
    newPricePerUnit: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

/**
 * Audit trail for each snapshot state change.
 */
const snapshotAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'generated',      // auto-created by scheduler
        'count_updated',  // user edited a UOM count
        'finalized',      // snapshot locked for billing
        'unlocked',       // manager unlocked a finalised snapshot
        'override_added', // post-lock correction submitted
        'payment_linked', // a payment was associated
        'payment_created', // system auto-created a payment on finalisation
        'payment_voided',  // linked payment voided on unlock
      ],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

/**
 * UomSnapshot — one per project per billing month ("YYYY-MM").
 *
 * Lifecycle:
 *   draft → (user edits counts) → finalized → (payment linked)
 *
 * Once finalized the snapshot is locked; further corrections must be
 * submitted as override entries, preserving full audit history.
 */
const uomSnapshotSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    baseline: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UomBaseline',
      required: true,
    },
    // Billing period in "YYYY-MM" format — used as human-readable identifier
    billingMonth: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    snapshotId: {
      type: String,
      unique: true,
    },
    status: {
      type: String,
      enum: ['draft', 'finalized'],
      default: 'draft',
    },
    lines: {
      type: [snapshotLineSchema],
      default: [],
    },
    // Sum of all line totals
    grandTotal: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
    },
    // Whether this snapshot was seeded from the previous month's snapshot (true)
    // or from the baseline directly (false — first snapshot ever)
    seededFromPrevious: {
      type: Boolean,
      default: false,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Linked payment (allocated against this snapshot's total)
    linkedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    overrides: {
      type: [snapshotOverrideSchema],
      default: [],
    },
    auditLog: {
      type: [snapshotAuditSchema],
      default: [],
    },
    notes: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index: one snapshot per project per billing month
uomSnapshotSchema.index({ project: 1, billingMonth: 1 }, { unique: true });

// Auto-generate snapshotId and recalculate grandTotal before save
uomSnapshotSchema.pre('save', async function (next) {
  // Recalculate each line total and the grand total
  let grand = 0;
  for (const line of this.lines) {
    line.lineTotal = parseFloat((line.count * line.pricePerUnit).toFixed(2));
    grand += line.lineTotal;
  }
  this.grandTotal = parseFloat(grand.toFixed(2));

  // Auto-generate snapshotId on first save
  if (!this.snapshotId) {
    const count = await mongoose.model('UomSnapshot').countDocuments();
    this.snapshotId = `SNAP-${String(count + 1).padStart(5, '0')}`;
  }

  next();
});

uomSnapshotSchema.plugin(toJSON);
uomSnapshotSchema.plugin(paginate);

const UomSnapshot = mongoose.model('UomSnapshot', uomSnapshotSchema);
module.exports = UomSnapshot;
