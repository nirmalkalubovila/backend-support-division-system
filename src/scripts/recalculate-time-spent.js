const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { Task, Issue, ChangeRequest, TimeLog } = require('../models');
const logger = require('../config/logger');

const recalculate = async () => {
  await connectDB();

  console.log('Recalculating totalTimeSpent for all tasks, issues, and change requests...');

  // 1. Recalculate Tasks
  const tasks = await Task.find({ deletedAt: null });
  console.log(`Found ${tasks.length} tasks to recalculate.`);
  for (const task of tasks) {
    const aggregate = await TimeLog.aggregate([
      {
        $match: {
          task: task._id,
          endTime: { $ne: null },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$task',
          totalHours: { $sum: '$duration' },
        },
      },
    ]);
    const totalHours = aggregate.length > 0 ? aggregate[0].totalHours : 0;
    await Task.updateOne(
      { _id: task._id },
      { totalTimeSpent: parseFloat(totalHours.toFixed(2)) }
    );
  }
  console.log('Finished tasks.');

  // 2. Recalculate Issues
  const issues = await Issue.find({ deletedAt: null });
  console.log(`Found ${issues.length} issues to recalculate.`);
  for (const issue of issues) {
    const aggregate = await TimeLog.aggregate([
      {
        $match: {
          issue: issue._id,
          endTime: { $ne: null },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$issue',
          totalHours: { $sum: '$duration' },
        },
      },
    ]);
    const totalHours = aggregate.length > 0 ? aggregate[0].totalHours : 0;
    await Issue.updateOne(
      { _id: issue._id },
      { totalTimeSpent: parseFloat(totalHours.toFixed(2)) }
    );
  }
  console.log('Finished issues.');

  // 3. Recalculate Change Requests
  const crs = await ChangeRequest.find({ deletedAt: null });
  console.log(`Found ${crs.length} change requests to recalculate.`);
  for (const cr of crs) {
    const aggregate = await TimeLog.aggregate([
      {
        $match: {
          cr: cr._id,
          endTime: { $ne: null },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$cr',
          totalHours: { $sum: '$duration' },
        },
      },
    ]);
    const totalHours = aggregate.length > 0 ? aggregate[0].totalHours : 0;
    await ChangeRequest.updateOne(
      { _id: cr._id },
      { totalTimeSpent: parseFloat(totalHours.toFixed(2)) }
    );
  }
  console.log('Finished change requests.');

  console.log('Recalculation migration completed successfully.');
  process.exit(0);
};

recalculate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
