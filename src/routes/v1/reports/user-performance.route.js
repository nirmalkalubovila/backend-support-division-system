const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const userPerformanceValidation = require('../../../validations/reports/user-performance.validation');
const userPerformanceController = require('../../../controllers/reports/user-performance.controller');

const router = express.Router();

router.get(
  '/team-comparison',
  auth('reports.daily_report.read'),
  validate(userPerformanceValidation.getTeamComparison),
  userPerformanceController.getTeamComparison
);

router.get(
  '/scorecard',
  auth(),
  validate(userPerformanceValidation.getScorecard),
  userPerformanceController.getScorecard
);

module.exports = router;
