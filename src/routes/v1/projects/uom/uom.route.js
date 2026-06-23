const express = require('express');
const auth = require('../../../../middlewares/auth');
const validate = require('../../../../middlewares/validate');
const uomValidation = require('../../../../validations/project-management/uom.validation');
const uomController = require('../../../../controllers/project-management/uom.controller');
const activityLogger = require('../../../../middlewares/activity-logger');

const router = express.Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// Baseline routes
// Base: /projects/:projectId/uom
// ─────────────────────────────────────────────────────────────────────────────

router
  .route('/baseline')
  .get(
    auth('finance.uom.read'),
    validate(uomValidation.getBaseline),
    uomController.getBaseline
  )
  .put(
    auth('finance.uom.configure'),
    validate(uomValidation.configureBaseline),
    activityLogger('Configure UOM baseline'),
    uomController.configureBaseline
  );

router
  .route('/baseline/types/:uomTypeId/price')
  .patch(
    auth('finance.uom.configure'),
    validate(uomValidation.updateUomPrice),
    activityLogger('Update UOM price'),
    uomController.updateUomPrice
  );

router
  .route('/baseline/types/:uomTypeId/pricing-history')
  .get(
    auth('finance.uom.read'),
    validate(uomValidation.getUomPricingHistory),
    uomController.getUomPricingHistory
  );

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot routes
// Base: /projects/:projectId/uom/snapshots
// ─────────────────────────────────────────────────────────────────────────────

// Generate snapshot (POST before generic list route)
router.post(
  '/snapshots/generate',
  auth('finance.uom.snapshot.create'),
  validate(uomValidation.generateSnapshot),
  activityLogger('Generate UOM snapshot'),
  uomController.generateSnapshot
);

// Get snapshot by billing month — must come before /:snapshotId
router.get(
  '/snapshots/month/:billingMonth',
  auth('finance.uom.read'),
  validate(uomValidation.getSnapshotByMonth),
  uomController.getSnapshotByMonth
);

router
  .route('/snapshots')
  .get(
    auth('finance.uom.read'),
    validate(uomValidation.getSnapshots),
    uomController.getSnapshots
  );

router
  .route('/snapshots/:snapshotId')
  .get(
    auth('finance.uom.read'),
    validate(uomValidation.getSnapshot),
    uomController.getSnapshot
  )
  .delete(
    auth('finance.uom.snapshot.delete'),
    validate(uomValidation.deleteSnapshot),
    activityLogger('Delete UOM snapshot'),
    uomController.deleteSnapshot
  );

router.patch(
  '/snapshots/:snapshotId/counts',
  auth('finance.uom.snapshot.update'),
  validate(uomValidation.updateSnapshotCounts),
  activityLogger('Update UOM snapshot counts'),
  uomController.updateSnapshotCounts
);

router.post(
  '/snapshots/:snapshotId/refresh-prices',
  auth('finance.uom.snapshot.update'),
  validate(uomValidation.getSnapshot),
  activityLogger('Refresh UOM snapshot prices'),
  uomController.refreshSnapshotPrices
);

router.post(
  '/snapshots/:snapshotId/finalize',
  auth('finance.uom.snapshot.finalize'),
  validate(uomValidation.finalizeSnapshot),
  activityLogger('Finalize UOM snapshot'),
  uomController.finalizeSnapshot
);

router.post(
  '/snapshots/:snapshotId/unlock',
  auth('finance.uom.snapshot.unlock'),
  validate(uomValidation.unlockSnapshot),
  activityLogger('Unlock UOM snapshot'),
  uomController.unlockSnapshot
);

router.post(
  '/snapshots/:snapshotId/overrides',
  auth('finance.uom.snapshot.override'),
  validate(uomValidation.addSnapshotOverride),
  activityLogger('Add UOM snapshot override'),
  uomController.addSnapshotOverride
);

router.post(
  '/snapshots/:snapshotId/link-payment',
  auth('finance.uom.snapshot.update'),
  validate(uomValidation.linkPaymentToSnapshot),
  activityLogger('Link payment to UOM snapshot'),
  uomController.linkPaymentToSnapshot
);

module.exports = router;
