const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

settingSchema.plugin(toJSON);

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
