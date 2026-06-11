const httpStatus = require('http-status');
const { Setting } = require('../../models');
const ApiError = require('../../utils/ApiError');

/**
 * Get system branding settings
 * @returns {Promise<Object>}
 */
const getBranding = async () => {
  const brandingSetting = await Setting.findOne({ key: 'branding' });
  if (!brandingSetting) {
    // Return default values if seeder hasn't run or document is deleted
    return {
      companyName: 'Prologics (Pvt) Ltd',
      slogan: 'Support Division System',
      primaryColor: '#2dae47',
      logoUrl: '',
    };
  }
  return brandingSetting.value;
};

/**
 * Update system branding settings
 * @param {Object} brandingBody
 * @returns {Promise<Object>}
 */
const updateBranding = async (brandingBody) => {
  let brandingSetting = await Setting.findOne({ key: 'branding' });

  if (!brandingSetting) {
    brandingSetting = await Setting.create({
      key: 'branding',
      value: brandingBody,
    });
  } else {
    brandingSetting.value = {
      ...brandingSetting.value,
      ...brandingBody,
    };
    await brandingSetting.save();
  }

  return brandingSetting.value;
};

module.exports = {
  getBranding,
  updateBranding,
};
