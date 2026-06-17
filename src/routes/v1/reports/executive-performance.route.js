const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const executivePerformanceValidation = require('../../../validations/reports/executive-performance.validation');
const executivePerformanceController = require('../../../controllers/reports/executive-performance.controller');

const router = express.Router();

router.get(
  '/',
  auth('reports.executive_performance.read'),
  validate(executivePerformanceValidation.getExecutivePerformanceData),
  executivePerformanceController.getExecutivePerformanceData
);

module.exports = router;
