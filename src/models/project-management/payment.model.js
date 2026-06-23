const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

// Sub-schema for individual payment allocation transactions
const paymentTransactionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Online Payment', null],
      default: null,
    },
    referenceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    paymentId: {
      type: String,
      unique: true,
    },
    paymentType: {
      type: String,
      enum: ['Advance', 'Project Fixed Price', 'CR Based', 'UOM Based', 'Other'],
      required: true,
    },
    uom: {
      type: String,
      default: null,
    },
    month: {
      type: String,
      default: null,
      trim: true,
    },
    quantity: {
      type: Number,
      default: null,
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Online Payment'],
      default: null,
    },
    referenceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    partiallyPaidAmount: {
      type: Number,
      default: null,
    },
    attachment: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    transactions: {
      type: [paymentTransactionSchema],
      default: [],
    },
    // Reference to the UOM snapshot that generated this payment (system-generated only)
    uomSnapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UomSnapshot',
      default: null,
    },
    // True for payments auto-created when a UOM snapshot is finalised
    isSystemGenerated: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-calculate totalAmount and generate paymentId
paymentSchema.pre('save', async function (next) {
  // System-generated UOM payments store the snapshot grandTotal in pricePerUnit directly
  if (this.isSystemGenerated) {
    this.totalAmount = parseFloat(this.pricePerUnit.toFixed(2));
  } else if (this.paymentType === 'UOM Based' && this.quantity != null) {
    this.totalAmount = parseFloat((this.quantity * this.pricePerUnit).toFixed(2));
  } else {
    this.totalAmount = parseFloat(this.pricePerUnit.toFixed(2));
  }
  if (!this.paymentId) {
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentId = `PAY-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

paymentSchema.plugin(toJSON);
paymentSchema.plugin(paginate);

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
