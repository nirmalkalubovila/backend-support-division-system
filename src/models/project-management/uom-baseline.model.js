const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

/**
 * Individual UOM type definition within a baseline.
 * Each entry represents one billable unit (e.g., "Users", "Warehouses", "Transactions").
 */
const uomTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    defaultCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // Pricing metadata — versioned separately in UomPricing, but stored here
    // as the "original" reference price when the baseline was created.
    baselinePrice: {
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
      trim: true, // e.g. "per user", "per warehouse"
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

/**
 * Versioned pricing record for a single UOM type.
 * Each time the price changes a new entry is pushed; previous records are
 * never mutated so historical billing amounts remain accurate.
 */
const pricingVersionSchema = new mongoose.Schema(
  {
    uomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    uomTypeName: {
      type: String,
      required: true,
      trim: true,
    },
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
    effectiveFrom: {
      type: String, // "YYYY-MM" format
      required: true,
      trim: true,
    },
    effectiveTo: {
      type: String, // "YYYY-MM" or null (still active)
      default: null,
      trim: true,
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
  },
  { _id: true, timestamps: true }
);

/**
 * Audit trail entry — records every change to the baseline.
 */
const baselineAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'uom_type_added', 'uom_type_removed', 'uom_type_updated', 'price_updated'],
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
 * UomBaseline — one per project.
 * Acts as the master template for all future billing snapshots.
 * Contains the canonical list of UOM types, their default counts,
 * and a versioned pricing history per type.
 */
const uomBaselineSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true, // one baseline per project
    },
    uomTypes: {
      type: [uomTypeSchema],
      default: [],
    },
    pricingVersions: {
      type: [pricingVersionSchema],
      default: [],
    },
    auditLog: {
      type: [baselineAuditSchema],
      default: [],
    },
    isConfigured: {
      type: Boolean,
      default: false, // false until at least one UOM type is defined
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
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

uomBaselineSchema.plugin(toJSON);
uomBaselineSchema.plugin(paginate);

const UomBaseline = mongoose.model('UomBaseline', uomBaselineSchema);
module.exports = UomBaseline;
