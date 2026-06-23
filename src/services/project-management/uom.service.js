const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { UomBaseline, UomSnapshot, Project, Payment } = require('../../models');
const ApiError = require('../../utils/ApiError');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the "YYYY-MM" string for a given Date (defaults to today).
 */
const toYearMonth = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/**
 * Returns the "YYYY-MM" string for the month immediately before `yearMonth`.
 */
const previousMonth = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // month is 0-indexed
  return toYearMonth(d);
};

/**
 * Given a baseline and a billing month, returns the effective pricePerUnit for
 * a specific uomTypeId.  Walks the versioned pricing records to find the most
 * recent version whose `effectiveFrom` <= billingMonth.
 * Falls back to the type's `baselinePrice` if no pricing version is found.
 */
const resolvePrice = (baseline, uomTypeId, billingMonth) => {
  const typeIdStr = uomTypeId.toString();

  // Filter pricing versions for this type
  const versions = baseline.pricingVersions.filter(
    (v) => v.uomTypeId.toString() === typeIdStr && v.effectiveFrom <= billingMonth
  );

  if (versions.length === 0) {
    // Fall back to baseline price
    const uomType = baseline.uomTypes.id(uomTypeId);
    return uomType ? { price: uomType.baselinePrice, versionId: null } : { price: 0, versionId: null };
  }

  // Sort descending by effectiveFrom, fallback to createdAt descending to get the absolute newest version
  versions.sort((a, b) => {
    if (a.effectiveFrom !== b.effectiveFrom) {
      return a.effectiveFrom > b.effectiveFrom ? -1 : 1;
    }
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  return { price: versions[0].pricePerUnit, versionId: versions[0]._id };
};

// ─────────────────────────────────────────────────────────────────────────────
// UOM Baseline CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get or create the UOM baseline for a project.
 * Throws 404 if the project does not exist.
 */
const getOrCreateBaseline = async (projectId, userId = null) => {
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  let baseline = await UomBaseline.findOne({ project: projectId, deletedAt: null })
    .populate('project')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!baseline) {
    baseline = await UomBaseline.create({
      project: projectId,
      uomTypes: [],
      pricingVersions: [],
      auditLog: [{ action: 'created', changedBy: userId, notes: 'Baseline initialised' }],
      isConfigured: false,
      createdBy: userId,
      updatedBy: userId,
    });
    baseline = await UomBaseline.findById(baseline._id)
      .populate('project')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
  }

  return baseline;
};

/**
 * Replace the full set of UOM types on a baseline.
 * `uomTypes` is the complete desired array — the service performs the diff.
 * Existing types (matched by _id) are updated; new ones are appended;
 * types absent from the payload are soft-removed (isActive → false).
 *
 * Also creates a new pricing version record for any type whose price has
 * changed or that is brand new.
 */
const configureBaseline = async (projectId, { uomTypes }, userId = null, billingMonth = null) => {
  const baseline = await getOrCreateBaseline(projectId, userId);
  const effectiveMonth = billingMonth || toYearMonth();

  // Track changes for audit
  const changes = { added: [], updated: [], pricingUpdated: [] };

  // Track which new type names need a pricing version after save
  const newTypeNames = [];

  // ── Pass 1: build the updated uomTypes array ─────────────────────────────
  const updatedTypes = uomTypes.map((incoming, idx) => {
    if (incoming._id) {
      const existing = baseline.uomTypes.id(incoming._id);
      if (existing) {
        const priceChanged = existing.baselinePrice !== Number(incoming.baselinePrice);

        existing.name = incoming.name ?? existing.name;
        existing.description = incoming.description ?? existing.description;
        existing.defaultCount = incoming.defaultCount ?? existing.defaultCount;
        existing.baselinePrice = Number(incoming.baselinePrice) ?? existing.baselinePrice;
        existing.currency = 'LKR';
        existing.unit = incoming.unit ?? existing.unit;
        existing.isActive = incoming.isActive !== undefined ? incoming.isActive : existing.isActive;
        existing.order = incoming.order ?? idx;

        if (priceChanged) {
          // Close the currently open pricing version for this type
          baseline.pricingVersions
            .filter((v) => v.uomTypeId.toString() === existing._id.toString() && v.effectiveTo === null)
            .forEach((v) => { v.effectiveTo = previousMonth(effectiveMonth); });

          // Add new pricing version — _id is known for existing types
          baseline.pricingVersions.push({
            uomTypeId: existing._id,
            uomTypeName: existing.name,
            pricePerUnit: Number(incoming.baselinePrice),
            currency: 'LKR',
            effectiveFrom: effectiveMonth,
            effectiveTo: null,
            createdBy: userId,
          });

          changes.pricingUpdated.push({ id: existing._id, name: existing.name, newPrice: incoming.baselinePrice });
        }

        changes.updated.push(existing._id);
        return existing;
      }
    }

    // New UOM type — do NOT push a pricingVersion yet; we don't have its _id
    const newType = {
      name: incoming.name,
      description: incoming.description || null,
      defaultCount: incoming.defaultCount ?? 0,
      baselinePrice: Number(incoming.baselinePrice),
      currency: 'LKR',
      unit: incoming.unit || null,
      isActive: incoming.isActive !== undefined ? incoming.isActive : true,
      order: incoming.order ?? idx,
    };

    // Remember this name so we can create its pricing version after save
    newTypeNames.push(incoming.name);
    changes.added.push({ name: newType.name });
    return newType;
  });

  // Replace the uomTypes array
  baseline.uomTypes = updatedTypes;
  baseline.isConfigured = updatedTypes.some((t) => t.isActive !== false);
  baseline.updatedBy = userId;

  baseline.auditLog.push({
    action: 'updated',
    changedBy: userId,
    changes,
    notes: 'Baseline UOM types reconfigured',
  });

  // ── First save — Mongoose assigns stable _ids to all new subdocuments ────
  await baseline.save();

  // ── Pass 2: add pricing versions for newly-added types using real _ids ────
  if (newTypeNames.length > 0) {
    const savedBaseline = await UomBaseline.findById(baseline._id);

    for (const name of newTypeNames) {
      // Find the saved subdoc by name (names are unique within one save operation)
      const savedType = savedBaseline.uomTypes.find((t) => t.name === name);
      if (!savedType) continue;

      // Only add a pricing version if one doesn't already exist for this type + month
      const alreadyExists = savedBaseline.pricingVersions.some(
        (v) => v.uomTypeId.toString() === savedType._id.toString() && v.effectiveFrom === effectiveMonth
      );
      if (!alreadyExists) {
        savedBaseline.pricingVersions.push({
          uomTypeId: savedType._id,
          uomTypeName: savedType.name,
          pricePerUnit: savedType.baselinePrice,
          currency: 'LKR',
          effectiveFrom: effectiveMonth,
          effectiveTo: null,
          createdBy: userId,
        });
      }
    }

    savedBaseline.markModified('pricingVersions');
    await savedBaseline.save();
  }

  const draftSnapshots = await UomSnapshot.find({
    project: projectId,
    status: 'draft',
    deletedAt: null,
  });
  for (const snap of draftSnapshots) {
    await refreshSnapshotPrices(snap._id, userId);
  }

  return UomBaseline.findById(baseline._id)
    .populate('project')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
};

/**
 * Update the price for a single UOM type, creating a new pricing version.
 * Closes the currently active version for that type.
 */
const updateUomPrice = async (projectId, uomTypeId, { pricePerUnit, defaultCount, effectiveFrom, notes }, userId = null) => {
  const baseline = await UomBaseline.findOne({ project: projectId, deletedAt: null });
  if (!baseline) throw new ApiError(httpStatus.NOT_FOUND, 'UOM baseline not found for this project');

  const uomType = baseline.uomTypes.id(uomTypeId);
  if (!uomType) throw new ApiError(httpStatus.NOT_FOUND, 'UOM type not found');

  const month = effectiveFrom || toYearMonth();

  // Close any currently open pricing version for this UOM type
  const openVersions = baseline.pricingVersions.filter(
    (v) => v.uomTypeId.toString() === uomTypeId.toString() && v.effectiveTo === null
  );
  openVersions.forEach((v) => { v.effectiveTo = previousMonth(month); });

  // Create new pricing version
  baseline.pricingVersions.push({
    uomTypeId,
    uomTypeName: uomType.name,
    pricePerUnit,
    currency: uomType.currency,
    effectiveFrom: month,
    effectiveTo: null,
    notes: notes || null,
    createdBy: userId,
  });

  // Also update the baseline fields on the type itself
  uomType.baselinePrice = pricePerUnit;
  if (defaultCount !== undefined) {
    uomType.defaultCount = defaultCount;
  }
  baseline.updatedBy = userId;

  baseline.auditLog.push({
    action: 'price_updated',
    changedBy: userId,
    changes: { uomTypeId, uomTypeName: uomType.name, pricePerUnit, defaultCount, effectiveFrom: month },
    notes: notes || null,
  });

  await baseline.save();

  const draftSnapshots = await UomSnapshot.find({
    project: projectId,
    status: 'draft',
    deletedAt: null,
  });
  for (const snap of draftSnapshots) {
    await refreshSnapshotPrices(snap._id, userId);
  }

  return UomBaseline.findById(baseline._id)
    .populate('project')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
};

/**
 * Get the full pricing history for a specific UOM type.
 */
const getUomPricingHistory = async (projectId, uomTypeId) => {
  const baseline = await UomBaseline.findOne({ project: projectId, deletedAt: null });
  if (!baseline) throw new ApiError(httpStatus.NOT_FOUND, 'UOM baseline not found for this project');

  const uomType = baseline.uomTypes.id(uomTypeId);
  if (!uomType) throw new ApiError(httpStatus.NOT_FOUND, 'UOM type not found');

  const versions = baseline.pricingVersions
    .filter((v) => v.uomTypeId.toString() === uomTypeId.toString())
    .sort((a, b) => (a.effectiveFrom > b.effectiveFrom ? -1 : 1)); // newest first

  return { uomType, pricingVersions: versions };
};

// ─────────────────────────────────────────────────────────────────────────────
// UOM Snapshot CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build snapshot lines from a baseline for a given billing month.
 * Counts are sourced from either the previous snapshot (if available) or
 * from the baseline defaultCounts.
 */
const buildSnapshotLines = (baseline, billingMonth, previousSnapshot = null) => {
  // Key previous lines by BOTH uomTypeId AND name for resilient matching
  const prevLineById = previousSnapshot
    ? new Map(previousSnapshot.lines.map((l) => [l.uomTypeId.toString(), l]))
    : new Map();
  const prevLineByName = previousSnapshot
    ? new Map(previousSnapshot.lines.map((l) => [l.name.toLowerCase().trim(), l]))
    : new Map();

  // Build price lookup by name (authoritative fallback for ID-mismatch scenarios)
  const priceByName = new Map();
  for (const uomType of baseline.uomTypes) {
    priceByName.set(uomType.name.toLowerCase().trim(), Number(uomType.baselinePrice));
  }
  // Override with versioned pricing
  for (const uomType of baseline.uomTypes) {
    const typeIdStr = uomType._id.toString();
    const applicable = baseline.pricingVersions
      .filter((v) => v.uomTypeId.toString() === typeIdStr && v.effectiveFrom <= billingMonth)
      .sort((a, b) => {
        if (a.effectiveFrom !== b.effectiveFrom) {
          return a.effectiveFrom > b.effectiveFrom ? -1 : 1;
        }
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    if (applicable.length > 0) {
      priceByName.set(uomType.name.toLowerCase().trim(), Number(applicable[0].pricePerUnit));
    }
  }

  return baseline.uomTypes
    .filter((t) => t.isActive)
    .map((t) => {
      // Find previous line by ID first, then name
      const prevLine =
        prevLineById.get(t._id.toString()) ||
        prevLineByName.get(t.name.toLowerCase().trim()) ||
        null;

      // Resolve price by ID first, then name
      const { price: resolvedPrice, versionId } = resolvePrice(baseline, t._id, billingMonth);
      const price = resolvedPrice > 0
        ? resolvedPrice
        : (priceByName.get(t.name.toLowerCase().trim()) || Number(t.baselinePrice));

      return {
        uomTypeId: t._id,
        name: t.name,
        description: t.description,
        count: prevLine ? prevLine.count : t.defaultCount,
        previousCount: prevLine ? prevLine.count : null,
        pricePerUnit: price,
        currency: 'LKR',
        unit: t.unit,
        lineTotal: parseFloat(((prevLine ? prevLine.count : t.defaultCount) * price).toFixed(2)),
        isManuallyEdited: false,
        pricingVersionId: versionId,
        order: t.order,
      };
    });
};

/**
 * Generate (or return existing) a monthly UOM snapshot for a project.
 * Called by the scheduler at month start, or manually by a user.
 *
 * Logic:
 *  1. Ensure a configured baseline exists.
 *  2. If a snapshot already exists for this month, return it (idempotent).
 *  3. Look for last month's snapshot to seed counts from.
 *  4. Fall back to baseline defaultCounts if no previous snapshot.
 */
const generateMonthlySnapshot = async (projectId, billingMonth, userId = null) => {
  const month = billingMonth || toYearMonth();

  // Validate format
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'billingMonth must be in YYYY-MM format');
  }

  const baseline = await UomBaseline.findOne({ project: projectId, deletedAt: null });
  if (!baseline) throw new ApiError(httpStatus.NOT_FOUND, 'UOM baseline not found for this project');
  if (!baseline.isConfigured) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'UOM baseline is not configured yet — add at least one UOM type');
  }

  // Idempotency — return existing snapshot if already generated
  const existing = await UomSnapshot.findOne({ project: projectId, billingMonth: month, deletedAt: null })
    .populate('project')
    .populate('baseline')
    .populate('linkedPayment')
    .populate('finalizedBy', 'name email')
    .populate('createdBy', 'name email');

  if (existing) return existing;

  // Try to seed from previous month's snapshot
  const prevMonth = previousMonth(month);
  const previousSnapshot = await UomSnapshot.findOne({
    project: projectId,
    billingMonth: prevMonth,
    deletedAt: null,
  });

  const lines = buildSnapshotLines(baseline, month, previousSnapshot);

  const snapshot = await UomSnapshot.create({
    project: projectId,
    baseline: baseline._id,
    billingMonth: month,
    status: 'draft',
    lines,
    seededFromPrevious: !!previousSnapshot,
    auditLog: [
      {
        action: 'generated',
        changedBy: userId,
        notes: previousSnapshot
          ? `Seeded from ${prevMonth} snapshot`
          : 'Seeded from baseline defaults',
      },
    ],
    createdBy: userId,
  });

  return UomSnapshot.findById(snapshot._id)
    .populate('project')
    .populate('baseline')
    .populate('linkedPayment')
    .populate('finalizedBy', 'name email')
    .populate('createdBy', 'name email');
};

/**
 * List all snapshots for a project, optionally filtered by status or month.
 */
const querySnapshots = async (projectId, filter = {}, options = {}) => {
  const query = { project: projectId, deletedAt: null };
  if (filter.status) query.status = filter.status;
  if (filter.billingMonth) query.billingMonth = filter.billingMonth;

  return UomSnapshot.paginate(query, {
    ...options,
    populate: 'project,linkedPayment',
    sortBy: options.sortBy || 'billingMonth:desc',
  });
};

/**
 * Get a single snapshot by its Mongo _id.
 */
const getSnapshotById = async (snapshotId) => {
  const snapshot = await UomSnapshot.findOne({ _id: snapshotId, deletedAt: null })
    .populate('project')
    .populate('baseline')
    .populate('linkedPayment')
    .populate('finalizedBy', 'name email')
    .populate('createdBy', 'name email');

  if (!snapshot) throw new ApiError(httpStatus.NOT_FOUND, 'UOM snapshot not found');
  return snapshot;
};

/**
 * Get the snapshot for a specific billing month.
 */
const getSnapshotByMonth = async (projectId, billingMonth) => {
  const snapshot = await UomSnapshot.findOne({ project: projectId, billingMonth, deletedAt: null })
    .populate('project')
    .populate('baseline')
    .populate('linkedPayment')
    .populate('finalizedBy', 'name email')
    .populate('createdBy', 'name email');

  if (!snapshot) throw new ApiError(httpStatus.NOT_FOUND, `No snapshot found for ${billingMonth}`);
  return snapshot;
};

/**
 * Update UOM line counts within a draft snapshot.
 * `lines` is an array of { uomTypeId, count } objects.
 * Throws 400 if the snapshot is already finalised.
 */
const updateSnapshotCounts = async (snapshotId, { lines, notes }, userId = null) => {
  // Use a raw (non-populated) snapshot so subdoc mutations persist on save
  const rawSnapshot = await UomSnapshot.findOne({ _id: snapshotId, deletedAt: null });
  if (!rawSnapshot) throw new ApiError(httpStatus.NOT_FOUND, 'UOM snapshot not found');

  if (rawSnapshot.status === 'finalized') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Snapshot is finalised — use the override endpoint to record corrections'
    );
  }

  const changedLines = [];

  for (const update of lines) {
    const idx = rawSnapshot.lines.findIndex(
      (l) => l.uomTypeId.toString() === update.uomTypeId.toString()
    );
    if (idx === -1) continue;

    const prev = rawSnapshot.lines[idx].count;
    rawSnapshot.lines[idx].count = update.count;
    rawSnapshot.lines[idx].lineTotal = parseFloat(
      (update.count * rawSnapshot.lines[idx].pricePerUnit).toFixed(2)
    );
    rawSnapshot.lines[idx].isManuallyEdited = true;

    changedLines.push({
      uomTypeId: update.uomTypeId,
      name: rawSnapshot.lines[idx].name,
      from: prev,
      to: update.count,
    });
  }

  rawSnapshot.markModified('lines');

  rawSnapshot.auditLog.push({
    action: 'count_updated',
    changedBy: userId,
    changes: { updatedLines: changedLines },
    notes: notes || null,
  });

  await rawSnapshot.save();
  return getSnapshotById(rawSnapshot._id);
};

/**
 * Refresh prices on a DRAFT snapshot to match the current baseline pricing.
 * Only updates price-related fields — counts are preserved.
 * Throws 400 if the snapshot is already finalised.
 */
async function refreshSnapshotPrices(snapshotId, userId = null) {
  const snapshotCheck = await UomSnapshot.findOne({ _id: snapshotId, deletedAt: null });
  if (!snapshotCheck) throw new ApiError(httpStatus.NOT_FOUND, 'UOM snapshot not found');

  if (snapshotCheck.status === 'finalized') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot refresh prices on a finalised snapshot');
  }

  const baseline = await UomBaseline.findById(snapshotCheck.baseline);
  if (!baseline) throw new ApiError(httpStatus.NOT_FOUND, 'Baseline not found');

  // Build TWO lookup maps:
  // 1. By uomTypeId (works for snapshots generated after the two-pass fix)
  // 2. By name (fallback for snapshots generated before the fix — ID mismatch era)
  const priceById = new Map();
  const priceByName = new Map();

  for (const uomType of baseline.uomTypes) {
    const price = Number(uomType.baselinePrice);
    priceById.set(uomType._id.toString(), price);
    priceByName.set(uomType.name.toLowerCase().trim(), price);
  }

  // Override with versioned pricing where valid
  const billingMonth = snapshotCheck.billingMonth;
  for (const uomType of baseline.uomTypes) {
    const typeIdStr = uomType._id.toString();
    const applicable = baseline.pricingVersions
      .filter((v) => v.uomTypeId.toString() === typeIdStr && v.effectiveFrom <= billingMonth)
      .sort((a, b) => {
        if (a.effectiveFrom !== b.effectiveFrom) {
          return a.effectiveFrom > b.effectiveFrom ? -1 : 1;
        }
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    if (applicable.length > 0) {
      const versionedPrice = Number(applicable[0].pricePerUnit);
      priceById.set(typeIdStr, versionedPrice);
      priceByName.set(uomType.name.toLowerCase().trim(), versionedPrice);
    }
  }

  // Resolve price for each snapshot line — ID first, name fallback
  const resolveLinePrice = (line) => {
    const byId = priceById.get(line.uomTypeId.toString());
    if (byId !== undefined) return byId;
    const byName = priceByName.get(line.name.toLowerCase().trim());
    if (byName !== undefined) return byName;
    return Number(line.pricePerUnit); // no match — keep existing
  };

  // Build updated lines array
  const lines = snapshotCheck.lines.map((line) => {
    const lineObj = line.toObject();
    const newPrice = resolveLinePrice(line);
    const uomType = baseline.uomTypes.id(line.uomTypeId);
    const newCount = (uomType && !line.isManuallyEdited) ? uomType.defaultCount : line.count;
    return {
      ...lineObj,
      count: newCount,
      pricePerUnit: newPrice,
      lineTotal: parseFloat((Number(newCount) * newPrice).toFixed(2)),
    };
  });

  const grandTotal = parseFloat(
    lines.reduce((sum, l) => sum + l.lineTotal, 0).toFixed(2)
  );

  const updatedLines = [];
  for (let i = 0; i < snapshotCheck.lines.length; i++) {
    const oldPrice = Number(snapshotCheck.lines[i].pricePerUnit);
    const newPrice = lines[i].pricePerUnit;
    if (Math.abs(oldPrice - newPrice) > 0.001) {
      updatedLines.push({ name: lines[i].name, oldPrice, newPrice });
    }
  }

  const auditEntry = {
    action: 'count_updated',
    changedBy: userId || null,
    changes: { pricesRefreshed: updatedLines },
    notes: updatedLines.length > 0
      ? `Prices refreshed: ${updatedLines.map((u) => `${u.name} ${u.oldPrice}→${u.newPrice}`).join(', ')}`
      : 'Prices synced from baseline (all prices already current)',
  };

  // findByIdAndUpdate bypasses Mongoose change tracking — guaranteed to write
  await UomSnapshot.findByIdAndUpdate(
    snapshotId,
    {
      $set: { lines, grandTotal },
      $push: { auditLog: auditEntry },
    },
    { new: false }
  );

  return getSnapshotById(snapshotId);
};

/**
 * Finalise a snapshot, locking it against direct edits.
 * Auto-creates a UOM Based Payment record for the snapshot's grand total.
 * Throws 400 if already finalised.
 */
const finalizeSnapshot = async (snapshotId, body = {}, userId = null) => {
  const snapshot = await getSnapshotById(snapshotId);

  if (snapshot.status === 'finalized') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Snapshot is already finalised');
  }

  // Re-fetch raw snapshot for mutation
  const rawSnapshot = await UomSnapshot.findById(snapshotId);

  rawSnapshot.status = 'finalized';
  rawSnapshot.finalizedAt = new Date();
  rawSnapshot.finalizedBy = userId || null;

  rawSnapshot.auditLog.push({
    action: 'finalized',
    changedBy: userId,
    notes: body.notes || null,
  });

  await rawSnapshot.save();

  // Auto-create a system-generated Payment if one doesn't already exist for this snapshot
  let autoPayment = await Payment.findOne({ uomSnapshot: rawSnapshot._id, deletedAt: null });

  if (!autoPayment) {
    // Build a human-readable description of the UOM lines
    const linesSummary = rawSnapshot.lines
      .map((l) => `${l.name}: ${l.count}`)
      .join(', ');

    const paymentService = require('./payment.service');
    autoPayment = await paymentService.createPayment(rawSnapshot.project, {
      paymentType: 'UOM Based',
      uom: `UOM Snapshot ${rawSnapshot.billingMonth}`,
      month: rawSnapshot.billingMonth,
      quantity: null,           // null — grandTotal is stored directly in pricePerUnit
      pricePerUnit: rawSnapshot.grandTotal,
      dueDate: body.dueDate || null,
      paymentStatus: body.paymentStatus || 'Pending',
      paymentMethod: body.paymentMethod || null,
      paymentDate: body.paymentDate || null,
      referenceNumber: body.referenceNumber || null,
      notes: body.notes || `Auto-generated from UOM snapshot ${rawSnapshot.snapshotId}. Lines: ${linesSummary}`,
      uomSnapshot: rawSnapshot._id,
      isSystemGenerated: true,
      partiallyPaidAmount: body.partiallyPaidAmount || null,
    });

    // Link the payment back to the snapshot
    rawSnapshot.linkedPayment = autoPayment._id;
    rawSnapshot.auditLog.push({
      action: 'payment_created',
      changedBy: userId,
      changes: { paymentId: autoPayment.paymentId, totalAmount: rawSnapshot.grandTotal },
      notes: `System payment ${autoPayment.paymentId} created for LKR ${rawSnapshot.grandTotal}`,
    });

    await rawSnapshot.save();
  } else if (!rawSnapshot.linkedPayment) {
    rawSnapshot.linkedPayment = autoPayment._id;
    await rawSnapshot.save();
  }

  return getSnapshotById(rawSnapshot._id);
};

/**
 * Unlock a finalised snapshot (manager-only).
 * Reverts status to draft so counts can be edited again.
 * If the linked payment was system-generated and has no allocations yet,
 * it is cancelled so a fresh one is created on re-finalisation.
 */
const unlockSnapshot = async (snapshotId, { reason }, userId = null) => {
  const snapshot = await getSnapshotById(snapshotId);

  if (snapshot.status !== 'finalized') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only finalised snapshots can be unlocked');
  }

  const rawSnapshot = await UomSnapshot.findById(snapshotId);
  rawSnapshot.status = 'draft';
  rawSnapshot.finalizedAt = null;
  rawSnapshot.finalizedBy = null;

  rawSnapshot.auditLog.push({
    action: 'unlocked',
    changedBy: userId,
    notes: reason || 'Unlocked for correction',
  });

  // If the linked payment is system-generated and has no allocations, cancel and unlink it
  if (rawSnapshot.linkedPayment) {
    const linkedPayment = await Payment.findById(rawSnapshot.linkedPayment);
    if (linkedPayment && linkedPayment.isSystemGenerated) {
      const hasAllocations = linkedPayment.transactions && linkedPayment.transactions.length > 0;
      if (!hasAllocations) {
        linkedPayment.paymentStatus = 'Cancelled';
        linkedPayment.notes = (linkedPayment.notes || '') + ` | Cancelled: snapshot unlocked (${reason || 'correction'})`;
        await linkedPayment.save();

        rawSnapshot.linkedPayment = null;
        rawSnapshot.auditLog.push({
          action: 'payment_voided',
          changedBy: userId,
          changes: { paymentId: linkedPayment.paymentId },
          notes: `System payment ${linkedPayment.paymentId} cancelled — will be recreated on re-finalisation`,
        });
      }
    }
  }

  await rawSnapshot.save();
  return getSnapshotById(rawSnapshot._id);
};

/**
 * Submit an override entry for a locked snapshot.
 * The snapshot lines are NOT modified; the override is appended for audit.
 */
const addSnapshotOverride = async (snapshotId, overrideData, userId = null) => {
  const snapshot = await getSnapshotById(snapshotId);

  if (snapshot.status !== 'finalized') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Overrides can only be added to finalised snapshots — finalise the snapshot first'
    );
  }

  const line = snapshot.lines.find(
    (l) => l.uomTypeId.toString() === overrideData.uomTypeId.toString()
  );
  if (!line) throw new ApiError(httpStatus.NOT_FOUND, 'UOM type not found in this snapshot');

  const override = {
    uomTypeId: overrideData.uomTypeId,
    uomTypeName: line.name,
    previousCount: line.count,
    newCount: overrideData.newCount,
    previousPricePerUnit: line.pricePerUnit,
    newPricePerUnit: overrideData.newPricePerUnit ?? line.pricePerUnit,
    reason: overrideData.reason,
    approvedBy: overrideData.approvedBy || null,
    createdBy: userId,
  };

  snapshot.overrides.push(override);

  snapshot.auditLog.push({
    action: 'override_added',
    changedBy: userId,
    changes: override,
    notes: overrideData.reason,
  });

  await snapshot.save();
  return getSnapshotById(snapshot._id);
};

/**
 * Link an existing Payment to a snapshot.
 * If a system-generated payment already exists and is Pending/not allocated,
 * it is cancelled first so the manual one takes over.
 */
const linkPaymentToSnapshot = async (snapshotId, paymentId, userId = null) => {
  const snapshot = await getSnapshotById(snapshotId);
  const payment = await Payment.findOne({ _id: paymentId, deletedAt: null });

  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  if (payment.project.toString() !== snapshot.project._id.toString()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Payment does not belong to the same project as this snapshot');
  }

  const rawSnapshot = await UomSnapshot.findById(snapshotId);

  // If there's an existing system-generated payment with no allocations, cancel it
  if (rawSnapshot.linkedPayment && rawSnapshot.linkedPayment.toString() !== paymentId) {
    const existing = await Payment.findById(rawSnapshot.linkedPayment);
    if (existing && existing.isSystemGenerated && (!existing.transactions || existing.transactions.length === 0)) {
      existing.paymentStatus = 'Cancelled';
      existing.notes = (existing.notes || '') + ' | Superseded by manual payment link';
      await existing.save();
    }
  }

  rawSnapshot.linkedPayment = paymentId;

  // Auto-finalise if still draft
  if (rawSnapshot.status === 'draft') {
    rawSnapshot.status = 'finalized';
    rawSnapshot.finalizedAt = new Date();
    rawSnapshot.finalizedBy = userId;

    rawSnapshot.auditLog.push({
      action: 'finalized',
      changedBy: userId,
      notes: 'Auto-finalised when payment was linked',
    });
  }

  rawSnapshot.auditLog.push({
    action: 'payment_linked',
    changedBy: userId,
    changes: { paymentId },
    notes: `Linked payment ${payment.paymentId || paymentId}`,
  });

  await rawSnapshot.save();
  return getSnapshotById(rawSnapshot._id);
};

/**
 * Soft-delete a snapshot (only allowed when status is draft).
 */
const deleteSnapshot = async (snapshotId, userId = null) => {
  const snapshot = await getSnapshotById(snapshotId);

  if (snapshot.status === 'finalized') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Finalised snapshots cannot be deleted');
  }

  snapshot.deletedAt = new Date();
  await snapshot.save();
};

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler helper — called by the monthly job
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-generate snapshots for ALL projects that have a configured baseline
 * but no snapshot yet for the given billing month.
 * Designed to be called by the monthly scheduler job on the 1st of each month.
 */
const generateSnapshotsForAllProjects = async (billingMonth) => {
  const month = billingMonth || toYearMonth();
  const baselines = await UomBaseline.find({ isConfigured: true, deletedAt: null });

  const results = { generated: [], skipped: [], errors: [] };

  for (const baseline of baselines) {
    try {
      const existing = await UomSnapshot.findOne({
        project: baseline.project,
        billingMonth: month,
        deletedAt: null,
      });

      if (existing) {
        results.skipped.push(baseline.project.toString());
        continue;
      }

      await generateMonthlySnapshot(baseline.project.toString(), month, null);
      results.generated.push(baseline.project.toString());
    } catch (err) {
      results.errors.push({ project: baseline.project.toString(), error: err.message });
    }
  }

  return results;
};

module.exports = {
  // Baseline
  getOrCreateBaseline,
  configureBaseline,
  updateUomPrice,
  getUomPricingHistory,
  // Snapshots
  generateMonthlySnapshot,
  querySnapshots,
  getSnapshotById,
  getSnapshotByMonth,
  updateSnapshotCounts,
  refreshSnapshotPrices,
  finalizeSnapshot,
  unlockSnapshot,
  addSnapshotOverride,
  linkPaymentToSnapshot,
  deleteSnapshot,
  // Scheduler
  generateSnapshotsForAllProjects,
  // Utils (exported for testing)
  toYearMonth,
  previousMonth,
};
