const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const timeLogSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: false,
      default: null,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    cr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChangeRequest',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0, // In hours (can be decimal)
    },
    workType: {
      type: String,
      enum: ['Backlog', 'Assigned', 'Planned Solution', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Reopened', 'On Hold', 'Pending Client'],
      required: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    isBillable: {
      type: Boolean,
      default: true,
    },
    approved: {
      type: Boolean,
      default: false,
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
timeLogSchema.plugin(toJSON);
timeLogSchema.plugin(paginate);

const TimeLog = mongoose.model('TimeLog', timeLogSchema);

module.exports = TimeLog;
