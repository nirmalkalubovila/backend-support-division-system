const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');

const taskAttachmentSchema = new mongoose.Schema(
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

const taskSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    cr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChangeRequest',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Review', 'Done'],
      default: 'To Do',
    },
    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium',
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: [] }],
    relatedLinks: [{ label: String, url: String }],
    attachments: [taskAttachmentSchema],
    order: { type: Number, default: 0 },
    isReopened: {
      type: Boolean,
      default: false,
    },
    submittedForReview: {
      type: Boolean,
      default: false,
    },
    reopenReason: {
      type: String,
      default: null,
    },
    reassignRequest: {
      requestedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, default: null },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: null },
      requestedAt: { type: Date, default: null },
    },
    deletedAt: { type: Date, default: null },
    totalTimeSpent: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

taskSchema.plugin(toJSON);
taskSchema.plugin(paginate);

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
