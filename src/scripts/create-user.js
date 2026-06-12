const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { User } = require('../models');
const { roles } = require('../config/roles');
const logger = require('../config/logger');

// Parse command line arguments
const args = {};
process.argv.slice(2).forEach(val => {
  const parts = val.split('=');
  if (parts[0].startsWith('--')) {
    const key = parts[0].substring(2);
    args[key] = parts[1];
  }
});

const { name, email, password, role = 'engineer' } = args;

if (!name || !email || !password) {
  console.log(`
Usage:
  node src/scripts/create-user.js --name="[NAME]" --email="[EMAIL]" --password="[PASSWORD]" [--role="[ROLE]"]

Options:
  --role      One of: ${roles.join(', ')} (default: engineer)

Example:
  node src/scripts/create-user.js --name="Hasitha Fernando" --email="hasitha@prologics.lk" --password="Password@123" --role="engineer"
  `);
  process.exit(1);
}

if (!roles.includes(role)) {
  console.error(`Error: Invalid role "${role}". Must be one of: ${roles.join(', ')}`);
  process.exit(1);
}

const createUser = async () => {
  try {
    await connectDB();
    
    const existingUser = await User.findOne({ email: email.toLowerCase(), deletedAt: null });
    if (existingUser) {
      console.error(`Error: User with email "${email}" already exists.`);
      process.exit(1);
    }

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      isActive: true,
    });

    console.log(`\nSuccess! User created successfully:`);
    console.log(`Name:     ${newUser.name}`);
    console.log(`Email:    ${newUser.email}`);
    console.log(`Role:     ${newUser.role}`);
    console.log(`Password: (as specified)`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
};

createUser();
