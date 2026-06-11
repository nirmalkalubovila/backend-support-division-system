const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
    },
    feature: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

permissionSchema.plugin(toJSON);

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;
