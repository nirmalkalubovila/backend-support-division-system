const mongoose = require('mongoose');
const moment = require('moment');
const executivePerformanceService = require('./services/reports/executive-performance.service');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/support-division-system');
  console.log('Connected to MongoDB');

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');

  console.log(`Testing with date range: ${startDate} to ${endDate}`);
  const result = await executivePerformanceService.getExecutivePerformanceData(startDate, endDate);

  console.log('\n--- Business Health Scorecard ---');
  console.log(JSON.stringify(result.scorecard, null, 2));

  console.log('\n--- Project Hour Utilization Gauge Grid ---');
  console.log(JSON.stringify(result.charts.projectUtilization, null, 2));

  console.log('\n--- Client Health Matrix (First 3 items) ---');
  console.log(JSON.stringify(result.clientHealthMatrix.slice(0, 3), null, 2));

  console.log('\n--- Division Utilization Donut ---');
  console.log(JSON.stringify(result.charts.divisionUtilizationDonut, null, 2));

  await mongoose.disconnect();
  console.log('Disconnected');
}

test().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
