const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { uomService } = require('../../services');
const pick = require('../../utils/pick');

// ─────────────────────────────────────────────────────────────────────────────
// Baseline controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /projects/:projectId/uom/baseline
 * Returns the UOM baseline for a project (creating an empty one if none exists).
 */
const getBaseline = catchAsync(async (req, res) => {
  const baseline = await uomService.getOrCreateBaseline(req.params.projectId, req.user.id);
  res.send(baseline);
});

/**
 * PUT /projects/:projectId/uom/baseline
 * Replace the full list of UOM types on the baseline.
 * Handles adds, updates, and price versioning automatically.
 */
const configureBaseline = catchAsync(async (req, res) => {
  const { uomTypes, billingMonth } = req.body;
  const baseline = await uomService.configureBaseline(
    req.params.projectId,
    { uomTypes },
    req.user.id,
    billingMonth || null
  );
  res.send(baseline);
});

/**
 * PATCH /projects/:projectId/uom/baseline/types/:uomTypeId/price
 * Update the price for a single UOM type (creates a new versioned record).
 */
const updateUomPrice = catchAsync(async (req, res) => {
  const { pricePerUnit, effectiveFrom, notes } = req.body;
  const baseline = await uomService.updateUomPrice(
    req.params.projectId,
    req.params.uomTypeId,
    { pricePerUnit, effectiveFrom, notes },
    req.user.id
  );
  res.send(baseline);
});

/**
 * GET /projects/:projectId/uom/baseline/types/:uomTypeId/pricing-history
 * Return all versioned pricing records for a UOM type.
 */
const getUomPricingHistory = catchAsync(async (req, res) => {
  const result = await uomService.getUomPricingHistory(
    req.params.projectId,
    req.params.uomTypeId
  );
  res.send(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /projects/:projectId/uom/snapshots/generate
 * Manually trigger snapshot generation for a billing month.
 * Body: { billingMonth: "YYYY-MM" }  (defaults to current month)
 */
const generateSnapshot = catchAsync(async (req, res) => {
  const snapshot = await uomService.generateMonthlySnapshot(
    req.params.projectId,
    req.body.billingMonth || null,
    req.user.id
  );
  res.status(httpStatus.CREATED).send(snapshot);
});

/**
 * GET /projects/:projectId/uom/snapshots
 * List all snapshots for a project with optional filters.
 */
const getSnapshots = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['status', 'billingMonth']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await uomService.querySnapshots(req.params.projectId, filter, options);
  res.send(result);
});

/**
 * GET /projects/:projectId/uom/snapshots/:snapshotId
 * Get a single snapshot by its ID.
 */
const getSnapshot = catchAsync(async (req, res) => {
  const snapshot = await uomService.getSnapshotById(req.params.snapshotId);
  res.send(snapshot);
});

/**
 * GET /projects/:projectId/uom/snapshots/month/:billingMonth
 * Get the snapshot for a specific billing month (YYYY-MM).
 */
const getSnapshotByMonth = catchAsync(async (req, res) => {
  const snapshot = await uomService.getSnapshotByMonth(
    req.params.projectId,
    req.params.billingMonth
  );
  res.send(snapshot);
});

/**
 * PATCH /projects/:projectId/uom/snapshots/:snapshotId/counts
 * Update UOM counts in a draft snapshot.
 * Body: { lines: [{ uomTypeId, count }], notes? }
 */
const updateSnapshotCounts = catchAsync(async (req, res) => {
  const snapshot = await uomService.updateSnapshotCounts(
    req.params.snapshotId,
    { lines: req.body.lines, notes: req.body.notes },
    req.user.id
  );
  res.send(snapshot);
});

/**
 * POST /projects/:projectId/uom/snapshots/:snapshotId/refresh-prices
 * Re-apply current baseline prices to a draft snapshot.
 */
const refreshSnapshotPrices = catchAsync(async (req, res) => {
  const snapshot = await uomService.refreshSnapshotPrices(
    req.params.snapshotId,
    req.user.id
  );
  res.send(snapshot);
});

/**
 * POST /projects/:projectId/uom/snapshots/:snapshotId/finalize
 * Lock a snapshot for billing.
 */
const finalizeSnapshot = catchAsync(async (req, res) => {
  const snapshot = await uomService.finalizeSnapshot(
    req.params.snapshotId,
    { notes: req.body.notes },
    req.user.id
  );
  res.send(snapshot);
});

/**
 * POST /projects/:projectId/uom/snapshots/:snapshotId/unlock
 * Revert a finalised snapshot back to draft (manager-only).
 */
const unlockSnapshot = catchAsync(async (req, res) => {
  const snapshot = await uomService.unlockSnapshot(
    req.params.snapshotId,
    { reason: req.body.reason },
    req.user.id
  );
  res.send(snapshot);
});

/**
 * POST /projects/:projectId/uom/snapshots/:snapshotId/overrides
 * Add a post-lock correction entry to a finalised snapshot.
 */
const addSnapshotOverride = catchAsync(async (req, res) => {
  const snapshot = await uomService.addSnapshotOverride(
    req.params.snapshotId,
    req.body,
    req.user.id
  );
  res.status(httpStatus.CREATED).send(snapshot);
});

/**
 * POST /projects/:projectId/uom/snapshots/:snapshotId/link-payment
 * Associate an existing payment with this snapshot.
 * Body: { paymentId }
 */
const linkPaymentToSnapshot = catchAsync(async (req, res) => {
  const snapshot = await uomService.linkPaymentToSnapshot(
    req.params.snapshotId,
    req.body.paymentId,
    req.user.id
  );
  res.send(snapshot);
});

/**
 * DELETE /projects/:projectId/uom/snapshots/:snapshotId
 * Soft-delete a draft snapshot.
 */
const deleteSnapshot = catchAsync(async (req, res) => {
  await uomService.deleteSnapshot(req.params.snapshotId, req.user.id);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  // Baseline
  getBaseline,
  configureBaseline,
  updateUomPrice,
  getUomPricingHistory,
  // Snapshots
  generateSnapshot,
  getSnapshots,
  getSnapshot,
  getSnapshotByMonth,
  updateSnapshotCounts,
  refreshSnapshotPrices,
  finalizeSnapshot,
  unlockSnapshot,
  addSnapshotOverride,
  linkPaymentToSnapshot,
  deleteSnapshot,
};
