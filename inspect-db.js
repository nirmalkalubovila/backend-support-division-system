const mongoose = require('mongoose');
const config = require('./src/config/config');
const connectDB = require('./src/config/db');
const { Project, TimeLog } = require('./src/models');
const { updateProjectUsedHours } = require('./src/services/time-tracking/time-log.service');

const inspect = async () => {
  await connectDB();
  
  const projects = await Project.find({ deletedAt: null });
  
  console.log('Recalculating used hours for all projects in DB...');
  for (const p of projects) {
    await updateProjectUsedHours(p._id.toString());
  }
  
  const updatedProjects = await Project.find({ deletedAt: null });
  const timeLogs = await TimeLog.find({ deletedAt: null });
  
  console.log(`=== UPDATED PROJECTS IN DB (${updatedProjects.length}) ===`);
  for (const p of updatedProjects) {
    const projId = p._id.toString();
    const approvedLogs = timeLogs.filter(log => log.project.toString() === projId && log.approved === true);
    const totalLogs = timeLogs.filter(log => log.project.toString() === projId);
    
    const approvedHrs = approvedLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const totalHrs = totalLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    
    console.log(`Project: ${p.name}`);
    console.log(`  Allocated Hours: ${p.allocatedHours}`);
    console.log(`  Used Hours (in DB field): ${p.usedHours}`);
    console.log(`  Approved Hours (computed): ${approvedHrs}`);
    console.log(`  Total Hours (computed, incl unapproved): ${totalHrs}`);
    console.log(`  Approved logs count: ${approvedLogs.length}`);
    console.log(`  Total logs count: ${totalLogs.length}`);
    console.log('---');
  }
  
  await mongoose.disconnect();
};

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
