const schedule = require('node-schedule');
const moment = require('moment');
const logger = require('../config/logger');

/**
 * Notification Scheduled Jobs
 * Covers: A4 (SLA Warning), A5 (SLA Breached), D3 (Task Deadline 24h),
 *         D4 (Task Overdue), E3 (Under-Logging Warning)
 */

/**
 * A4: SLA Warning — Check for issues approaching their SLA due date
 * Runs every 30 minutes
 */
const checkSlaWarnings = async () => {
  try {
    const { Issue } = require('../models');
    const notificationService = require('../services/system/notification.service');

    // Find issues that are due within the next 1 hour and NOT resolved/closed
    const now = new Date();
    const oneHourFromNow = moment().add(1, 'hour').toDate();

    const atRiskIssues = await Issue.find({
      deletedAt: null,
      status: { $nin: ['Resolved', 'Closed'] },
      dueDate: { $gt: now, $lte: oneHourFromNow },
    }).populate('project assignedTo');

    if (atRiskIssues.length === 0) return;

    for (const issue of atRiskIssues) {
      // Notify the assigned developer
      if (issue.assignedTo) {
        const recipientId = issue.assignedTo._id || issue.assignedTo;
        const projectId = issue.project ? (issue.project._id || issue.project) : '';
        const timeLeft = moment(issue.dueDate).diff(moment(), 'minutes');

        await notificationService.createNotification({
          recipient: recipientId,
          title: 'SLA Warning',
          message: `Issue "${issue.title}" (${issue.issueId}) has ${timeLeft} minutes left before SLA breach.`,
          type: 'warning',
          module: 'issues',
          relatedId: issue._id,
          relatedLink: `/issues?project=${projectId}`,
        });
      }
    }

    logger.info(`SLA Warning check completed: ${atRiskIssues.length} at-risk issues found`);
  } catch (error) {
    logger.error('SLA Warning check failed', { error: error.message });
  }
};

/**
 * A5: SLA Breached — Check for issues past their SLA due date
 * Runs every 30 minutes
 */
const checkSlaBreaches = async () => {
  try {
    const { Issue, User } = require('../models');
    const notificationService = require('../services/system/notification.service');

    const now = new Date();
    // Check within the last 30 minutes to avoid duplicate notifications
    const thirtyMinsAgo = moment().subtract(30, 'minutes').toDate();

    const breachedIssues = await Issue.find({
      deletedAt: null,
      status: { $nin: ['Resolved', 'Closed'] },
      dueDate: { $gte: thirtyMinsAgo, $lt: now },
    }).populate('project assignedTo');

    if (breachedIssues.length === 0) return;

    const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });

    for (const issue of breachedIssues) {
      const projectId = issue.project ? (issue.project._id || issue.project) : '';
      const recipients = new Set();

      // Notify the assigned developer
      if (issue.assignedTo) {
        recipients.add(String(issue.assignedTo._id || issue.assignedTo));
      }

      // Notify admins and managers
      for (const admin of adminsAndManagers) {
        recipients.add(String(admin._id));
      }

      for (const recipientId of recipients) {
        await notificationService.createNotification({
          recipient: recipientId,
          title: 'SLA Breached',
          message: `Issue "${issue.title}" (${issue.issueId}) has breached its SLA resolution target. Due: ${moment(issue.dueDate).format('MMM DD, YYYY hh:mm A')}.`,
          type: 'error',
          module: 'issues',
          relatedId: issue._id,
          relatedLink: `/issues?project=${projectId}`,
        });
      }
    }

    logger.info(`SLA Breach check completed: ${breachedIssues.length} breached issues found`);
  } catch (error) {
    logger.error('SLA Breach check failed', { error: error.message });
  }
};

/**
 * D3: Task Deadline (24h) — Check tasks due within the next 24 hours
 * Runs every hour
 */
const checkTaskDeadlines = async () => {
  try {
    const { Task } = require('../models');
    const notificationService = require('../services/system/notification.service');
    const twentyFourHoursFromNow = moment().add(24, 'hours').toDate();
    // Only check tasks with deadlines within the next 24 hours but not already overdue
    const twentyThreeHoursFromNow = moment().add(23, 'hours').toDate();

    const upcomingTasks = await Task.find({
      deletedAt: null,
      status: { $ne: 'Done' },
      endDate: { $gt: twentyThreeHoursFromNow, $lte: twentyFourHoursFromNow },
    }).populate('assignees', '_id name');

    if (upcomingTasks.length === 0) return;

    for (const task of upcomingTasks) {
      if (task.assignees && task.assignees.length > 0) {
        for (const assignee of task.assignees) {
          const assigneeId = assignee._id || assignee;
          await notificationService.createNotification({
            recipient: assigneeId,
            title: 'Task Deadline Approaching',
            message: `Task "${task.name}" is due in less than 24 hours (${moment(task.endDate).format('MMM DD, YYYY hh:mm A')}).`,
            type: 'warning',
            module: 'tasks',
            relatedId: task._id,
            relatedLink: `/projects/${task.project}`,
          });
        }
      }
    }

    logger.info(`Task deadline check completed: ${upcomingTasks.length} tasks approaching deadline`);
  } catch (error) {
    logger.error('Task deadline check failed', { error: error.message });
  }
};

/**
 * D4: Task Overdue — Check tasks past their end date
 * Runs every hour
 */
const checkOverdueTasks = async () => {
  try {
    const { Task, User } = require('../models');
    const notificationService = require('../services/system/notification.service');

    const now = new Date();
    const oneHourAgo = moment().subtract(1, 'hour').toDate();

    // Only tasks that just became overdue (within the last hour window to avoid duplicate notifications)
    const overdueTasks = await Task.find({
      deletedAt: null,
      status: { $ne: 'Done' },
      endDate: { $gte: oneHourAgo, $lt: now },
    }).populate('assignees', '_id name').populate('project', '_id name');

    if (overdueTasks.length === 0) return;

    const adminsAndManagers = await User.find({ role: { $in: ['super_admin', 'manager'] }, deletedAt: null });

    for (const task of overdueTasks) {
      const recipients = new Set();

      // Notify task assignees
      if (task.assignees) {
        for (const assignee of task.assignees) {
          recipients.add(String(assignee._id || assignee));
        }
      }

      // Notify admins and managers (PM role)
      for (const admin of adminsAndManagers) {
        recipients.add(String(admin._id));
      }

      for (const recipientId of recipients) {
        await notificationService.createNotification({
          recipient: recipientId,
          title: 'Task Overdue',
          message: `Task "${task.name}" has missed its deadline (${moment(task.endDate).format('MMM DD, YYYY')}).`,
          type: 'warning',
          module: 'tasks',
          relatedId: task._id,
          relatedLink: `/projects/${task.project._id || task.project}`,
        });
      }
    }

    logger.info(`Overdue task check completed: ${overdueTasks.length} overdue tasks found`);
  } catch (error) {
    logger.error('Overdue task check failed', { error: error.message });
  }
};

/**
 * E3: Under-Logging Warning — Weekly check for developers with low time logs
 * Runs every Monday at 9 AM
 */
const checkUnderLogging = async () => {
  try {
    const { User, TimeLog } = require('../models');
    const emailService = require('../services/email/email.service');
    const config = require('../config/config');

    // Only process if SMTP is configured
    if (!config.email.smtp.host) {
      logger.info('Skipping under-logging check: SMTP not configured');
      return;
    }

    // Look at the previous work week (Mon-Fri)
    const lastMonday = moment().subtract(1, 'week').startOf('isoWeek').toDate();
    const lastFriday = moment().subtract(1, 'week').endOf('isoWeek').subtract(2, 'days').endOf('day').toDate();

    const developers = await User.find({
      role: { $in: ['engineer', 'intern'] },
      isActive: true,
      deletedAt: null,
    });

    const MINIMUM_WEEKLY_HOURS = 20; // Minimum expected hours per week

    for (const dev of developers) {
      // Calculate total hours logged during the previous work week
      const logs = await TimeLog.find({
        user: dev._id,
        deletedAt: null,
        startTime: { $gte: lastMonday, $lte: lastFriday },
      });

      const totalHours = logs.reduce((sum, log) => sum + (log.duration || 0), 0);

      if (totalHours < MINIMUM_WEEKLY_HOURS) {
        try {
          await emailService.sendNotificationEmail(
            dev.email,
            'Timesheet Reminder',
            'Under-Logging Notice',
            `You logged only ${totalHours.toFixed(1)} hours last week (expected minimum: ${MINIMUM_WEEKLY_HOURS}h). Please ensure your time logs are up to date.`,
            '/issues',
            'warning',
            {}
          );
          logger.info(`Under-logging reminder email sent to ${dev.email} (${totalHours.toFixed(1)}h logged)`);
        } catch (emailErr) {
          logger.warn(`Failed to send under-logging email to ${dev.email}: ${emailErr.message}`);
        }
      }
    }

    logger.info('Under-logging check completed');
  } catch (error) {
    logger.error('Under-logging check failed', { error: error.message });
  }
};

/**
 * Initialize all notification scheduled jobs
 * Called on server startup
 */
const initNotificationJobs = () => {
  // A4: SLA Warning — every 30 minutes
  schedule.scheduleJob('*/30 * * * *', checkSlaWarnings);
  logger.info('SLA Warning job scheduled: every 30 minutes');

  // A5: SLA Breach — every 30 minutes
  schedule.scheduleJob('15,45 * * * *', checkSlaBreaches);
  logger.info('SLA Breach job scheduled: every 30 minutes (offset)');

  // D3: Task Deadline (24h) — every hour
  schedule.scheduleJob('0 * * * *', checkTaskDeadlines);
  logger.info('Task Deadline job scheduled: every hour');

  // D4: Task Overdue — every hour (offset by 5 min)
  schedule.scheduleJob('5 * * * *', checkOverdueTasks);
  logger.info('Task Overdue job scheduled: every hour');

  // E3: Under-Logging Warning — every Monday at 9 AM
  schedule.scheduleJob('0 9 * * 1', checkUnderLogging);
  logger.info('Under-Logging Warning job scheduled: every Monday at 9 AM');

  logger.info('All notification scheduled jobs initialized');
};

module.exports = {
  initNotificationJobs,
  // Exported for testing
  checkSlaWarnings,
  checkSlaBreaches,
  checkTaskDeadlines,
  checkOverdueTasks,
  checkUnderLogging,
};
