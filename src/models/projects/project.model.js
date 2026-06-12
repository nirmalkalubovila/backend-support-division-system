const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const projectSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    client: {
      type: String,
      trim: true,
      default: 'Unknown Client',
    },
    clientContact: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'On Hold'],
      default: 'Active',
    },
    usedHours: {
      type: Number,
      default: 0,
    },
    allocatedHours: {
      type: Number,
      default: 0,
    },
    openIssues: {
      type: Number,
      default: 0,
    },
    closedIssues: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    projectTypes: {
      type: [String],
    },
    photoUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
projectSchema.plugin(toJSON);
projectSchema.plugin(paginate);

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
