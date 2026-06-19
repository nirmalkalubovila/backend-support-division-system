const connectDB = require('../config/db');
const { Project } = require('../models');

const migrateProjectTypes = async () => {
  try {
    await connectDB();
    console.log('Connected to DB. Starting migration of project types...');

    // Find all projects that contain "New Development" or "CR" in projectType
    const projects = await Project.find({
      $or: [
        { projectType: "New Development" },
        { projectType: "CR" }
      ],
      deletedAt: null
    });

    console.log(`Found ${projects.length} projects to update.`);

    for (const project of projects) {
      console.log(`Updating project "${project.name}" (ID: ${project._id}). Current types:`, project.projectType);
      
      // Map projectType elements, replacing "New Development" and "CR" with "Development"
      const updatedTypes = project.projectType.map(t => {
        if (t === 'New Development' || t === 'CR') {
          return 'Development';
        }
        return t;
      });

      // Filter to unique elements
      const uniqueTypes = [...new Set(updatedTypes)];

      project.projectType = uniqueTypes;
      await project.save();
      console.log(`Updated project "${project.name}". New types:`, project.projectType);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateProjectTypes();
