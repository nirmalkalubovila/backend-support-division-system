const { Branding } = require('../../models');

/**
 * Get branding settings
 * @returns {Promise<Branding>}
 */
const getBranding = async () => {
  let branding = await Branding.findOne({});
  if (!branding) {
    branding = await Branding.create({});
  }
  return branding;
};

/**
 * Update branding settings
 * @param {Object} updateBody
 * @returns {Promise<Branding>}
 */
const updateBranding = async (updateBody) => {
  let branding = await Branding.findOne({});
  if (!branding) {
    branding = await Branding.create(updateBody);
  } else {
    Object.assign(branding, updateBody);
    await branding.save();
  }
  return branding;
};

module.exports = {
  getBranding,
  updateBranding,
};
