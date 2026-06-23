const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { UomSnapshot } = require('../models');
const { refreshSnapshotPrices } = require('../services/project-management/uom.service');

const run = async () => {
  await connectDB();

  console.log('Refreshing all draft snapshots...');
  const drafts = await UomSnapshot.find({ status: 'draft', deletedAt: null });
  console.log(`Found ${drafts.length} draft snapshots.`);

  for (const draft of drafts) {
    console.log(`Refreshing snapshot ID: ${draft.snapshotId} (${draft.billingMonth})`);
    await refreshSnapshotPrices(draft._id);
  }

  console.log('Refresh completed.');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
