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
    brandingSetting.markModified('value');
    await brandingSetting.save();
  }

  return brandingSetting.value;
};

/**
 * Get system priorities / SLA configurations
 * @returns {Promise<Object>}
 */
const getPriorities = async () => {
  const prioritiesSetting = await Setting.findOne({ key: 'priorities' });
  if (!prioritiesSetting) {
    return {
      Critical: { firstResponse: 30, resolution: 240, escalation: 120 },
      High: { firstResponse: 120, resolution: 480, escalation: 480 },
      Medium: { firstResponse: 240, resolution: 4320, escalation: 2880 },
      Low: { firstResponse: 1440, resolution: 10080, escalation: 0 },
    };
  }
  return prioritiesSetting.value;
};

/**
 * Update system priorities / SLA configurations
 * @param {Object} prioritiesBody
 * @returns {Promise<Object>}
 */
const updatePriorities = async (prioritiesBody) => {
  let prioritiesSetting = await Setting.findOne({ key: 'priorities' });

  if (!prioritiesSetting) {
    prioritiesSetting = await Setting.create({
      key: 'priorities',
      value: prioritiesBody,
    });
  } else {
    prioritiesSetting.value = prioritiesBody;
    prioritiesSetting.markModified('value');
    await prioritiesSetting.save();
  }

  return prioritiesSetting.value;
};

/**
 * Get system categories
 * @returns {Promise<Array<string>>}
 */
const getCategories = async () => {
  const categoriesSetting = await Setting.findOne({ key: 'categories' });
  if (!categoriesSetting) {
    return ['Bug', 'Feature Request', 'Access Issue', 'Data Correction', 'Performance', 'Consultation'];
  }
  return categoriesSetting.value;
};

/**
 * Update system categories
 * @param {Object} categoriesBody
 * @returns {Promise<Array<string>>}
 */
const updateCategories = async (categoriesBody) => {
  let categoriesSetting = await Setting.findOne({ key: 'categories' });

  if (!categoriesSetting) {
    categoriesSetting = await Setting.create({
      key: 'categories',
      value: categoriesBody.categories,
    });
  } else {
    categoriesSetting.value = categoriesBody.categories;
    categoriesSetting.markModified('value');
    await categoriesSetting.save();
  }

  return categoriesSetting.value;
};

/**
 * Get system notification preferences
 * @returns {Promise<Object>}
 */
const getNotifications = async () => {
  const notificationsSetting = await Setting.findOne({ key: 'notifications' });
  if (!notificationsSetting) {
    return {
      emailCritical: true,
      inAppSlaBreach: true,
      dailySummary: false,
      projectHourWarning: true,
    };
  }
  return notificationsSetting.value;
};

/**
 * Update system notification preferences
 * @param {Object} notificationsBody
 * @returns {Promise<Object>}
 */
const updateNotifications = async (notificationsBody) => {
  let notificationsSetting = await Setting.findOne({ key: 'notifications' });

  if (!notificationsSetting) {
    notificationsSetting = await Setting.create({
      key: 'notifications',
      value: notificationsBody,
    });
  } else {
    notificationsSetting.value = {
      ...notificationsSetting.value,
      ...notificationsBody,
    };
    notificationsSetting.markModified('value');
    await notificationsSetting.save();
  }

  return notificationsSetting.value;
};

/**
 * Get report schedule settings
 * @returns {Promise<Object>}
 */
const getReportSchedule = async () => {
  const setting = await Setting.findOne({ key: 'reportSchedule' });
  if (!setting) {
    const { DEFAULT_SCHEDULE } = require('../../jobs/report.job');
    return DEFAULT_SCHEDULE;
  }
  return setting.value;
};

/**
 * Update report schedule settings
 * @param {Object} scheduleBody
 * @returns {Promise<Object>}
 */
const updateReportSchedule = async (scheduleBody) => {
  let setting = await Setting.findOne({ key: 'reportSchedule' });

  if (!setting) {
    setting = await Setting.create({
      key: 'reportSchedule',
      value: scheduleBody,
    });
  } else {
    setting.value = {
      ...setting.value,
      ...scheduleBody,
    };
    setting.markModified('value');
    await setting.save();
  }

  // Reload the scheduled jobs dynamically
  try {
    const { reloadReportJobs } = require('../../jobs/report.job');
    await reloadReportJobs();
  } catch (error) {
    const logger = require('../../config/logger');
    logger.error('Failed to reload report scheduled jobs after settings update', { error: error.message });
  }

  return setting.value;
};

module.exports = {
  getBranding,
  updateBranding,
  getPriorities,
  updatePriorities,
  getCategories,
  updateCategories,
  getNotifications,
  updateNotifications,
  getReportSchedule,
  updateReportSchedule,
};
