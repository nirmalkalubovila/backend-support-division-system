const connectDB = require('../config/db');
const seedPermissions = require('./seed-permissions');
const seedRoles = require('./seed-roles');
const seedSuperAdmin = require('./seed-super-admin');
const logger = require('../config/logger');

const runSeeders = async () => {
  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Run Seeders in order
    await seedPermissions();
    await seedRoles();
    await seedSuperAdmin();

    logger.info('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
};

runSeeders();
