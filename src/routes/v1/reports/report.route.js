const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const { reportValidation } = require('../../../validations');
const { reportController } = require('../../../controllers');
const activityLogger = require('../../../middlewares/activity-logger');

const router = express.Router();

// ── Read endpoints (GET) ────────────────────────────────────────

router.get(
  '/daily',
  auth('reports.daily_report.read'),
  validate(reportValidation.getDailyReport),
  reportController.getDailyReport
);

router.get(
  '/weekly',
  auth('reports.weekly_report.read'),
  validate(reportValidation.getWeeklyReport),
  reportController.getWeeklyReport
);

router.get(
  '/monthly',
  auth('reports.monthly_report.read'),
  validate(reportValidation.getMonthlyReport),
  reportController.getMonthlyReport
);

router.get(
  '/kpi',
  auth('reports.kpi_analytics.read'),
  validate(reportValidation.getKpiAnalytics),
  reportController.getKpiAnalytics
);

router.get(
  '/utilization',
  auth('reports.daily_report.read'),
  validate(reportValidation.getUtilizationReport),
  reportController.getUtilizationReport
);

router.get(
  '/paginate',
  auth('reports.daily_report.read'),
  validate(reportValidation.paginateReports),
  reportController.paginateReports
);

router.get(
  '/:id',
  auth('reports.daily_report.read'),
  reportController.getReportById
);

router.get(
  '/:id/export',
  auth('reports.daily_report.read'),
  validate(reportValidation.exportReport),
  reportController.exportReport
);

// ── Manual generation endpoints (POST) ──────────────────────────

router.post(
  '/daily/generate',
  auth('reports.daily_report.create'),
  validate(reportValidation.generateReport),
  activityLogger('Generate daily report'),
  reportController.generateDailyReport
);

router.post(
  '/weekly/generate',
  auth('reports.weekly_report.create'),
  validate(reportValidation.generateReport),
  activityLogger('Generate weekly report'),
  reportController.generateWeeklyReport
);

router.post(
  '/monthly/generate',
  auth('reports.monthly_report.create'),
  validate(reportValidation.generateMonthlyReport),
  activityLogger('Generate monthly report'),
  reportController.generateMonthlyReport
);

router.post(
  '/executive/build',
  auth('reports.executive_report.create'),
  validate(reportValidation.buildExecutiveReport),
  activityLogger('Build executive report'),
  reportController.buildExecutiveReport
);

module.exports = router;
