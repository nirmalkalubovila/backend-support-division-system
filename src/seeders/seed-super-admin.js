const { User } = require('../models');
const logger = require('../config/logger');

const seedSuperAdmin = async () => {
  logger.info('Seeding Super Admin...');

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@company.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const existingAdmin = await User.findOne({ email: superAdminEmail.toLowerCase(), deletedAt: null });

  if (existingAdmin) {
    logger.info('Super Admin already exists. Skipping...');
    return;
  }

  await User.create({
    name: superAdminName,
    email: superAdminEmail,
    password: superAdminPassword,
    role: 'super_admin',
    isActive: true,
  });

  logger.info(`Super Admin created successfully with email: ${superAdminEmail}`);
};

module.exports = seedSuperAdmin;
