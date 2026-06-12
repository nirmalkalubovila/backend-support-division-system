const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const { initReportJobs } = require('./jobs/report.job');

let server;

const startServer = async () => {
  // 1. Connect to Database
  await connectDB();

  // 2. Start Express Server
  server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port} in ${config.env} mode`);
  });

  // 3. Initialize scheduled report jobs
  try {
    await initReportJobs();
  } catch (error) {
    logger.warn('Failed to initialize report jobs', { error: error.message });
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
