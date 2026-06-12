const { Client, Project, User } = require('../models');
const logger = require('../config/logger');

const seedClientsAndProjects = async () => {
  logger.info('Seeding Clients and Projects...');

  // 1. Seed Clients
  const clientCount = await Client.countDocuments({ deletedAt: null });
  if (clientCount > 0) {
    logger.info('Clients already seeded. Skipping...');
    return;
  }

  const client1 = await Client.create({ name: 'AquaFresh Ltd', code: 'AQF', contactEmail: 'info@aquafresh.lk' });
  const client2 = await Client.create({ name: 'SwiftMove Corp', code: 'SWM', contactEmail: 'contact@swiftmove.lk' });
  const client3 = await Client.create({ name: 'ElevateSoft', code: 'ELS', contactEmail: 'support@elevatesoft.lk' });

  logger.info('Clients seeded successfully.');

  // 2. Fetch seed users to assign as project members
  const users = await User.find({ deletedAt: null });
  const memberIds = users.map((u) => u._id);

  // 3. Seed Projects
  await Project.create({
    name: 'AquaFresh ERP Support',
    client: client1._id,
    contractType: 'Monthly Retainer',
    allocatedHours: 20,
    members: memberIds,
  });

  await Project.create({
    name: 'SwiftMove CMS Monthly',
    client: client2._id,
    contractType: 'Monthly Retainer',
    allocatedHours: 15,
    members: memberIds,
  });

  await Project.create({
    name: 'ElevateSoft Factory ERP',
    client: client3._id,
    contractType: 'Monthly Retainer',
    allocatedHours: 20,
    members: memberIds,
  });

  logger.info('Projects seeded successfully.');
};

module.exports = seedClientsAndProjects;
