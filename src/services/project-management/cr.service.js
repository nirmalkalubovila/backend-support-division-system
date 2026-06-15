const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { ChangeRequest, Project } = require('../../models');
const ApiError = require('../../utils/ApiError');

const generateCrNumber = async (projectId) => {
  const project = await Project.findById(projectId);
  const code = project?.name ? project.name.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase() : 'CR';
  const year = moment().year();
  const count = await ChangeRequest.countDocuments({ project: projectId, createdAt: { $gte: moment().startOf('year').toDate() } });
  return `${code}-CR-${year}-${String(count + 1).padStart(4, '0')}`;
};

const createCR = async (body, userId) => {
  const project = await Project.findOne({ _id: body.project, deletedAt: null });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  const crNumber = await generateCrNumber(body.project);
  const cr = await ChangeRequest.create({
    ...body,
    crNumber,
    createdBy: userId,
    status: 'Draft',
    timeline: [{ fromStatus: null, toStatus: 'Draft', changedBy: userId, note: 'CR created' }],
  });
  return cr.populate('assignedProjectManager assignedDevelopers createdBy', 'name email role avatar');
};

const getProjectCRs = async (projectId, filter = {}, options = {}) => {
  const result = await ChangeRequest.paginate(
    { project: projectId, deletedAt: null, ...filter },
    { ...options, populate: 'assignedProjectManager assignedDevelopers createdBy', sort: { order: 1, createdAt: -1 } }
  );
  return result;
};

const getCRById = async (crId) => {
  const cr = await ChangeRequest.findOne({ _id: crId, deletedAt: null })
    .populate('assignedProjectManager', 'name email role avatar')
    .populate('assignedDevelopers', 'name email role avatar')
    .populate('createdBy', 'name email role avatar')
    .populate('timeline.changedBy', 'name email role avatar');
  if (!cr) throw new ApiError(httpStatus.NOT_FOUND, 'Change request not found');
  return cr;
};

const updateCRById = async (crId, updateBody, userId) => {
  const cr = await getCRById(crId);
  const prevStatus = cr.status;
  if (updateBody.status && updateBody.status !== prevStatus) {
    cr.timeline.push({ fromStatus: prevStatus, toStatus: updateBody.status, changedBy: userId, note: updateBody.statusNote || null });
    delete updateBody.statusNote;
  }
  Object.assign(cr, updateBody);
  await cr.save();
  return cr.populate('assignedProjectManager assignedDevelopers createdBy', 'name email role avatar');
};

const deleteCRById = async (crId) => {
  const cr = await getCRById(crId);
  cr.deletedAt = new Date();
  await cr.save();
  return cr;
};

const addAttachments = async (crId, files, userId) => {
  const cr = await getCRById(crId);
  files.forEach((file) => {
    cr.attachments.push({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/crs/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      uploadedBy: userId,
    });
  });
  await cr.save();
  return cr;
};

const removeAttachment = async (crId, attachmentId) => {
  const cr = await getCRById(crId);
  const att = cr.attachments.id(attachmentId);
  if (!att) throw new ApiError(httpStatus.NOT_FOUND, 'Attachment not found');
  const filePath = path.join(__dirname, '../../../uploads/crs', att.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  cr.attachments.pull(attachmentId);
  await cr.save();
  return cr;
};

const getCRStats = async (projectId) => {
  const crs = await ChangeRequest.find({ project: projectId, deletedAt: null });
  const stats = {
    total: crs.length,
    open: crs.filter((c) => ['Draft', 'Submitted', 'Under Review'].includes(c.status)).length,
    approved: crs.filter((c) => c.status === 'Approved').length,
    inDevelopment: crs.filter((c) => c.status === 'In Development').length,
    completed: crs.filter((c) => c.status === 'Completed').length,
    rejected: crs.filter((c) => c.status === 'Rejected').length,
    totalEstimatedHours: crs.reduce((s, c) => s + (c.estimatedHours || 0), 0),
    totalActualHours: crs.reduce((s, c) => s + (c.actualHours || 0), 0),
  };
  return stats;
};

module.exports = { createCR, getProjectCRs, getCRById, updateCRById, deleteCRById, addAttachments, removeAttachment, getCRStats };
