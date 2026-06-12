const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    contractType: {
      type: String,
      enum: ['Monthly Retainer', 'Per-Incident', 'Time & Material', 'Fixed'],
      required: true,
    },
    allocatedHours: {
      type: Number,
      default: 0,
    },
    usedHours: {
      type: Number,
      default: 0,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
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
projectSchema.plugin(toJSON);
projectSchema.plugin(paginate);

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
