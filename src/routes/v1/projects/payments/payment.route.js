const express = require('express');
const auth = require('../../../../middlewares/auth');
const validate = require('../../../../middlewares/validate');
const { uploadPaymentAttachment } = require('../../../../middlewares/upload');
const paymentValidation = require('../../../../validations/project-management/payment.validation');
const paymentController = require('../../../../controllers/project-management/payment.controller');
const activityLogger = require('../../../../middlewares/activity-logger');

const router = express.Router({ mergeParams: true });

// Global finance endpoints (no projectId)
const globalRouter = express.Router();
globalRouter.get('/kpis', auth('finance.payment.read'), paymentController.getGlobalFinanceKPIs);
globalRouter.get('/projects', auth('finance.payment.read'), paymentController.getAllProjectsFinance);

// Per-project payment endpoints
router
  .route('/')
  .post(
    auth('finance.payment.create'),
    uploadPaymentAttachment.single('attachment'),
    validate(paymentValidation.createPayment),
    activityLogger('Create payment'),
    paymentController.createPayment
  )
  .get(auth('finance.payment.read'), validate(paymentValidation.getPayments), paymentController.getPayments);

router.get('/summary', auth('finance.payment.read'), paymentController.getProjectFinanceSummary);

router
  .route('/:paymentId')
  .get(auth('finance.payment.read'), validate(paymentValidation.getPayment), paymentController.getPayment)
  .patch(
    auth('finance.payment.update'),
    uploadPaymentAttachment.single('attachment'),
    validate(paymentValidation.updatePayment),
    activityLogger('Update payment'),
    paymentController.updatePayment
  )
  .delete(
    auth('finance.payment.delete'),
    validate(paymentValidation.deletePayment),
    activityLogger('Delete payment'),
    paymentController.deletePayment
  );

module.exports = { router, globalRouter };
