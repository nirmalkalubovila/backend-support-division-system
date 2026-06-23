const schedule = require('node-schedule');
const logger = require('../config/logger');
const { uomService } = require('../services');

/**
 * UOM Snapshot Scheduler
 *
 * Runs at 00:05 on the 1st of every month (5 minutes after midnight to avoid
 * any midnight-boundary edge cases with the month string calculation).
 *
 * For every project that has a configured UOM baseline, it auto-generates a
 * draft snapshot for the new month by copying counts from the previous month's
 * snapshot (or from the baseline defaults if this is the project's first snapshot).
 */

const SNAPSHOT_CRON = '5 0 1 * *'; // 00:05 on the 1st of each month

let snapshotJob = null;

/**
 * Runs the snapshot generation for all eligible projects.
 * Exported so it can be triggered manually (e.g., from an admin endpoint).
 */
const runSnapshotGeneration = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const billingMonth = `${year}-${month}`;

  logger.info(`[UOM Snapshot Job] Generating snapshots for ${billingMonth}`);

  try {
    const results = await uomService.generateSnapshotsForAllProjects(billingMonth);

    logger.info(
      `[UOM Snapshot Job] Done — generated: ${results.generated.length}, ` +
      `skipped (already existed): ${results.skipped.length}, ` +
      `errors: ${results.errors.length}`
    );

    if (results.errors.length > 0) {
      results.errors.forEach(({ project, error }) => {
        logger.error(`[UOM Snapshot Job] Error for project ${project}: ${error}`);
      });
    }

    return results;
  } catch (error) {
    logger.error('[UOM Snapshot Job] Fatal error during snapshot generation', { error: error.message });
    throw error;
  }
};

/**
 * Initialize the monthly UOM snapshot scheduler.
 * Called from src/index.js at server startup.
 */
const initUomSnapshotJob = () => {
  if (snapshotJob) {
    snapshotJob.cancel();
  }

  snapshotJob = schedule.scheduleJob(SNAPSHOT_CRON, async () => {
    try {
      await runSnapshotGeneration();
    } catch (error) {
      logger.error('[UOM Snapshot Job] Unhandled error in scheduled job', { error: error.message });
    }
  });

  logger.info(`[UOM Snapshot Job] Scheduled — cron: "${SNAPSHOT_CRON}" (00:05 on the 1st of each month)`);
};

module.exports = {
  initUomSnapshotJob,
  runSnapshotGeneration,
};
