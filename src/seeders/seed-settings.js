const { Setting } = require('../models');
const logger = require('../config/logger');

const seedSettings = async () => {
  logger.info('Seeding System Settings...');

  // 1. Branding
  const existingBranding = await Setting.findOne({ key: 'branding' });
  if (!existingBranding) {
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
  } else {
    logger.info('Branding settings already seeded. Skipping...');
  }

  // 2. Priorities
  const existingPriorities = await Setting.findOne({ key: 'priorities' });
  if (!existingPriorities) {
    await Setting.create({
      key: 'priorities',
      value: {
        Critical: { firstResponse: 30, resolution: 240, escalation: 120 },
        High: { firstResponse: 120, resolution: 480, escalation: 480 },
        Medium: { firstResponse: 240, resolution: 4320, escalation: 2880 },
        Low: { firstResponse: 1440, resolution: 10080, escalation: 0 },
      },
    });
    logger.info('Default priorities SLA settings seeded successfully.');
  } else {
    logger.info('Priorities SLA settings already seeded. Skipping...');
  }

  // 3. Categories
  const existingCategories = await Setting.findOne({ key: 'categories' });
  if (!existingCategories) {
    await Setting.create({
      key: 'categories',
      value: ['Bug', 'Feature Request', 'Access Issue', 'Data Correction', 'Performance', 'Consultation'],
    });
    logger.info('Default categories settings seeded successfully.');
  } else {
    logger.info('Categories settings already seeded. Skipping...');
  }

  // 4. Notifications
  const existingNotifications = await Setting.findOne({ key: 'notifications' });
  if (!existingNotifications) {
    await Setting.create({
      key: 'notifications',
      value: {
        emailCritical: true,
        inAppSlaBreach: true,
        dailySummary: false,
        projectHourWarning: true,
      },
    });
    logger.info('Default notification settings seeded successfully.');
  } else {
    logger.info('Notification settings already seeded. Skipping...');
  }

  logger.info('System Settings seeding checked and complete.');
};

module.exports = seedSettings;
