const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Issue / Task Attachments Storage ───────────────────────────
const issueStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isTask = req.baseUrl && req.baseUrl.includes('/tasks');
    const subDir = isTask ? 'tasks' : 'issues';
    const dir = path.join(uploadsDir, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const issueFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(httpStatus.BAD_REQUEST, `File type "${file.mimetype}" is not allowed.`), false);
  }
};

const uploadIssueAttachments = multer({
  storage: issueStorage,
  fileFilter: issueFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// ── Project Photo Storage ──────────────────────────────────────
const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, 'projects');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const imageOnlyFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(httpStatus.BAD_REQUEST, 'Only image files are allowed (JPG, PNG, WEBP).'), false);
  }
};

const uploadProjectPhoto = multer({
  storage: projectStorage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Multer storage configuration for logo
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logoDir = path.join(uploadsDir, 'logo');
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB limit for logos
    files: 1, // Max 1 file per request
  },
});

module.exports = {
  uploadIssueAttachments,
  uploadProjectPhoto,
  uploadLogo,
};
