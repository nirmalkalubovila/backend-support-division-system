const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const crAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true }
);

const crTimelineEventSchema = new mongoose.Schema(
  {
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const crSchema = new mongoose.Schema(
  {
    crNumber: { type: String, required: true, unique: true, trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    crType: {
      type: String,
      enum: ['Enhancement', 'New Feature', 'Modification', 'Integration', 'UI/UX Change', 'Data Change', 'Bug Fix', 'Other'],
      default: 'Enhancement',
    },
    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'In Development', 'Testing', 'Completed', 'Closed'],
      default: 'Draft',
    },
    requestedBy: { type: String, trim: true, default: null },
    requestedDate: { type: Date, default: Date.now },
    targetReleaseDate: { type: Date, default: null },
    estimatedHours: { type: Number, default: null },
    actualHours: { type: Number, default: null },
    estimatedCost: { type: Number, default: null },
    assignedProjectManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedDevelopers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    description: { type: String, default: null },
    businessJustification: { type: String, default: null },
    technicalApproach: { type: String, default: null },
    impactAnalysis: { type: String, default: null },
    dependencies: { type: String, default: null },
    risks: { type: String, default: null },
    relatedLinks: [{ label: String, url: String }],
    attachments: [crAttachmentSchema],
    timeline: [crTimelineEventSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Number, default: 0 },
    taskProgress: {
      total: { type: Number, default: 0 },
      done: { type: Number, default: 0 },
      completionPercentage: { type: Number, default: 0 },
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

crSchema.plugin(toJSON);
crSchema.plugin(paginate);

const ChangeRequest = mongoose.model('ChangeRequest', crSchema);
module.exports = ChangeRequest;
