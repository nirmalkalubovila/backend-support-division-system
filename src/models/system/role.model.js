const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

roleSchema.plugin(toJSON);

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
