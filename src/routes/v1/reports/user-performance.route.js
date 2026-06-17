const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const userPerformanceValidation = require('../../../validations/reports/user-performance.validation');
const userPerformanceController = require('../../../controllers/reports/user-performance.controller');

const router = express.Router();

router.get(
  '/team-comparison',
  auth('reports.user_performance.read'),
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
