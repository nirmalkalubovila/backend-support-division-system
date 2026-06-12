const mongoose = require('mongoose');
const toJSON = require('../plugins/toJSON.plugin');

const brandingSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      default: 'Prologics Support',
      trim: true,
    },
    slogan: {
      type: String,
      required: true,
      default: 'Support Division System',
      trim: true,
    },
    primaryColor: {
      type: String,
      required: true,
      default: '#6366f1',
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
brandingSchema.plugin(toJSON);

const Branding = mongoose.model('Branding', brandingSchema);

module.exports = Branding;
