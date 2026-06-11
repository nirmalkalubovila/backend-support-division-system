const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'data/permission-schema.data.json');
const outputPath = path.join(__dirname, '../config/permissions.json');

try {
  console.log('Generating permissions...');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaContent);

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

  // Ensure config directory exists
  const configDir = path.dirname(outputPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(permissions, null, 2), 'utf8');
  console.log(`Successfully generated ${permissions.length} permissions in src/config/permissions.json`);
} catch (error) {
  console.error('Error generating permissions:', error);
  process.exit(1);
}
