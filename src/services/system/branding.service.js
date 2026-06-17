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

  // F4: Notify admins about branding update
  try {
    const { User } = require('../../models');
    const notificationService = require('./notification.service');
    const admins = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });
    for (const admin of admins) {
      await notificationService.createNotification({
        recipient: admin._id,
        title: 'Branding Updated',
        message: 'The system branding settings (logo, company name, or colors) have been modified.',
        type: 'info',
        module: 'system',
        relatedId: branding._id,
        relatedLink: '/system',
      });
    }
  } catch (err) {
    const logger = require('../../config/logger');
    logger.error('Failed to send branding update notifications', { error: err.message });
  }

  return branding;
};

module.exports = {
  getBranding,
  updateBranding,
};
