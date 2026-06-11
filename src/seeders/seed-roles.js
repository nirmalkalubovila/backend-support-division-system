const { Role } = require('../models');
const { roleRights } = require('../config/roles');
const logger = require('../config/logger');

const seedRoles = async () => {
  logger.info('Seeding default roles...');

  for (const [roleName, permissions] of roleRights.entries()) {
    await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName, permissions },
      { upsert: true, new: true }
    );
  }

  logger.info('Seeded default roles successfully.');
};

module.exports = seedRoles;
