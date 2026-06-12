const schedule = require('node-schedule');
const logger = require('../config/logger');
const { reportService } = require('../services');
const { Setting } = require('../models');

/**
 * Report schedule settings (stored in Settings collection)
 * Key: 'reportSchedule'
 * Value: {
 *   dailyEnabled: boolean,
 *   dailyCron: string (cron expression),
 *   weeklyEnabled: boolean,
 *   weeklyCron: string,
 *   monthlyEnabled: boolean,
 *   monthlyCron: string,
 * }
 */

const DEFAULT_SCHEDULE = {
  dailyEnabled: true,
  dailyCron: '0 18 * * 1-5', // 6 PM weekdays
  weeklyEnabled: true,
  weeklyCron: '0 17 * * 5', // 5 PM every Friday
  monthlyEnabled: true,
  monthlyCron: '0 18 L * *', // 6 PM last day of month (node-schedule supports 'L')
};

let dailyJob = null;
let weeklyJob = null;
let monthlyJob = null;

/**
 * Get report schedule settings from DB or return defaults
 * @returns {Promise<Object>}
 */
const getScheduleSettings = async () => {
  try {
    const setting = await Setting.findOne({ key: 'reportSchedule' });
    if (setting && setting.value) {
      return { ...DEFAULT_SCHEDULE, ...setting.value };
    }
  } catch (err) {
    logger.warn('Failed to read report schedule settings, using defaults', { error: err.message });
  }
  return DEFAULT_SCHEDULE;
};

/**
 * Schedule the daily report job
 * @param {string} cronExpression
 */
const scheduleDailyJob = (cronExpression) => {
  if (dailyJob) {
    dailyJob.cancel();
  }

  dailyJob = schedule.scheduleJob(cronExpression, async () => {
    try {
      logger.info('Running scheduled daily report generation');
      await reportService.generateDailyReport(null, null);
      logger.info('Scheduled daily report completed successfully');
    } catch (error) {
      logger.error('Scheduled daily report failed', { error: error.message });
    }
  });

  logger.info(`Daily report job scheduled: ${cronExpression}`);
};

/**
 * Schedule the weekly report job
 * @param {string} cronExpression
 */
const scheduleWeeklyJob = (cronExpression) => {
  if (weeklyJob) {
    weeklyJob.cancel();
  }

  weeklyJob = schedule.scheduleJob(cronExpression, async () => {
    try {
      logger.info('Running scheduled weekly report generation');
      await reportService.generateWeeklyReport(null, null);
      logger.info('Scheduled weekly report completed successfully');
    } catch (error) {
      logger.error('Scheduled weekly report failed', { error: error.message });
    }
  });

  logger.info(`Weekly report job scheduled: ${cronExpression}`);
};

/**
 * Schedule the monthly report job
 * @param {string} cronExpression
 */
const scheduleMonthlyJob = (cronExpression) => {
  if (monthlyJob) {
    monthlyJob.cancel();
  }

  // node-schedule doesn't support 'L' natively, so we use a workaround
  // Schedule at 6 PM on the 28th and check if it's the last day
  const monthlyCron = cronExpression.includes('L')
    ? '0 18 28-31 * *' // Run on 28-31 and check inside
    : cronExpression;

  monthlyJob = schedule.scheduleJob(monthlyCron, async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Only run if tomorrow is a new month (i.e., today is last day)
      if (tomorrow.getDate() === 1) {
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        logger.info(`Running scheduled monthly report generation for ${year}-${String(month).padStart(2, '0')}`);
        await reportService.generateMonthlyReport(month, year, null);
        logger.info('Scheduled monthly report completed successfully');
      }
    } catch (error) {
      logger.error('Scheduled monthly report failed', { error: error.message });
    }
  });

  logger.info(`Monthly report job scheduled: ${monthlyCron}`);
};

/**
 * Initialize all report scheduled jobs
 * Called on server startup
 */
const initReportJobs = async () => {
  const settings = await getScheduleSettings();

  if (settings.dailyEnabled) {
    scheduleDailyJob(settings.dailyCron);
  } else {
    logger.info('Daily report auto-generation is disabled');
  }

  if (settings.weeklyEnabled) {
    scheduleWeeklyJob(settings.weeklyCron);
  } else {
    logger.info('Weekly report auto-generation is disabled');
  }

  if (settings.monthlyEnabled) {
    scheduleMonthlyJob(settings.monthlyCron);
  } else {
    logger.info('Monthly report auto-generation is disabled');
  }

  logger.info('Report scheduled jobs initialized');
};

/**
 * Reload scheduled jobs (called when settings are updated)
 */
const reloadReportJobs = async () => {
  logger.info('Reloading report scheduled jobs');
  await initReportJobs();
};

module.exports = {
  initReportJobs,
  reloadReportJobs,
  getScheduleSettings,
  DEFAULT_SCHEDULE,
};
