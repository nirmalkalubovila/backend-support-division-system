const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const issueSchema = new mongoose.Schema(
  {
    issueId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium',
    },
    type: {
      type: String,
      enum: ['Bug', 'Feature Request', 'Access Issue', 'Data Correction', 'Performance', 'Consultation'],
      default: 'Bug',
    },
    status: {
      type: String,
      enum: [
        'Backlog',
        'Assigned',
        'Planned Solution',
        'In Progress',
        'Testing',
        'On Hold',
        'Pending Client',
        'Resolved',
        'Closed',
        'Reopened',
      ],
      default: 'Backlog',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    technicalApproach: {
      type: String,
      default: null,
    },
    estimatedHours: {
      type: Number,
      default: null,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    attachments: [
      {
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        path: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
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
issueSchema.plugin(toJSON);
issueSchema.plugin(paginate);

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
