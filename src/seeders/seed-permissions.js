const fs = require('fs');
const path = require('path');
const { Permission } = require('../models');
const logger = require('../config/logger');

const seedPermissions = async () => {
  logger.info('Seeding permissions...');
  const permissionsJsonPath = path.join(__dirname, '../config/permissions.json');

  if (!fs.existsSync(permissionsJsonPath)) {
    logger.warn('src/config/permissions.json not found. Generating first...');
    // Run generation logic inline
    const schemaPath = path.join(__dirname, '../scripts/data/permission-schema.data.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const permissions = [];
    const actions = ['create', 'read', 'update', 'delete'];

    Object.entries(schema).forEach(([moduleKey, features]) => {
      const moduleName = moduleKey.toLowerCase();
      features.forEach((feature) => {
        const featureName = feature.toLowerCase();
        actions.forEach((action) => {
          permissions.push(`${moduleName}.${featureName}.${action}`);
        });
      });
    });

    const configDir = path.dirname(permissionsJsonPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(permissionsJsonPath, JSON.stringify(permissions, null, 2), 'utf8');
  }

  const permissionsList = JSON.parse(fs.readFileSync(permissionsJsonPath, 'utf8'));

  for (const permissionKey of permissionsList) {
    const parts = permissionKey.split('.');
    if (parts.length === 3) {
      const [module, feature, action] = parts;
      await Permission.findOneAndUpdate(
        { key: permissionKey },
        { key: permissionKey, module, feature, action },
        { upsert: true, new: true }
      );
    }
  }

  logger.info(`Seeded ${permissionsList.length} permissions successfully.`);
};

module.exports = seedPermissions;
