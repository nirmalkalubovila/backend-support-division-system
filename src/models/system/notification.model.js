const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error', 'system'],
      default: 'info',
    },
    module: {
      type: String,
      enum: ['issues', 'projects', 'crs', 'tasks', 'system'],
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedLink: {
      type: String,
      default: null,
    },
    readStatus: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.plugin(toJSON);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
