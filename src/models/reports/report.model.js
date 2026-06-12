const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const reportSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'executive'],
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      comment: 'null = auto-generated, ObjectId = manually triggered by user',
    },
    generationMode: {
      type: String,
      enum: ['automatic', 'manual'],
      required: true,
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      required: true,
      default: 'generating',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Plugins
reportSchema.plugin(toJSON);
reportSchema.plugin(paginate);

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
