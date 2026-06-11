const { Setting } = require('../models');
const logger = require('../config/logger');

const seedSettings = async () => {
  logger.info('Seeding System Settings...');

  const existingBranding = await Setting.findOne({ key: 'branding' });

  if (existingBranding) {
    logger.info('Branding settings already seeded. Skipping...');
    return;
  }

  await Setting.create({
    key: 'branding',
    value: {
      companyName: 'Prologics (Pvt) Ltd',
      slogan: 'Support Division System',
      primaryColor: '#2dae47',
      logoUrl: '',
    },
  });

  logger.info('Default branding settings seeded successfully.');
};

module.exports = seedSettings;
