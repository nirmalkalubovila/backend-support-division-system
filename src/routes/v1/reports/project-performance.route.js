const express = require('express');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const projectPerformanceValidation = require('../../../validations/reports/project-performance.validation');
const projectPerformanceController = require('../../../controllers/reports/project-performance.controller');

const router = express.Router();

router.get(
  '/',
  auth('reports.project_performance.read'),
  validate(projectPerformanceValidation.getPerformanceData),
  projectPerformanceController.getPerformanceData
);

module.exports = router;
