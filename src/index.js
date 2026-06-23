const http = require('http');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const { initReportJobs } = require('./jobs/report.job');
const { initNotificationJobs } = require('./jobs/notification.job');
const { initUomSnapshotJob } = require('./jobs/uom-snapshot.job');
const socketServer = require('./config/socket');

let server;

const startServer = async () => {
  // 1. Connect to Database
  await connectDB();

  // 2. Create HTTP server and attach Socket.IO
  server = http.createServer(app);
  socketServer.init(server);

  // 3. Start listening
  server.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port} in ${config.env} mode`);
  });

  // 4. Initialize scheduled report jobs
  try {
    await initReportJobs();
  } catch (error) {
    logger.warn('Failed to initialize report jobs', { error: error.message });
  }

  // 5. Initialize notification scheduled jobs (SLA, deadlines, etc.)
  try {
    initNotificationJobs();
  } catch (error) {
    logger.warn('Failed to initialize notification jobs', { error: error.message });
  }

  // 6. Initialize monthly UOM snapshot auto-generation job
  try {
    initUomSnapshotJob();
  } catch (error) {
    logger.warn('Failed to initialize UOM snapshot job', { error: error.message });
  }
};

startServer();

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error('Unexpected error occurred', { error });
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
