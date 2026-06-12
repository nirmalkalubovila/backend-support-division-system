const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const { settingValidation } = require('../../../validations');
const { settingController } = require('../../../controllers');
const activityLogger = require('../../../middlewares/activity-logger');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
  },
});

router.get('/branding', settingController.getBranding);

router.patch('/branding',
  auth('system.settings.update'),
  validate(settingValidation.updateBranding),
  activityLogger('Update system branding'),
  settingController.updateBranding
);

router.get('/priorities', settingController.getPriorities);

router.patch('/priorities',
  auth('system.settings.update'),
  validate(settingValidation.updatePriorities),
  activityLogger('Update system priorities / SLA rules'),
  settingController.updatePriorities
);

router.get('/categories', settingController.getCategories);

router.patch('/categories',
  auth('system.settings.update'),
  validate(settingValidation.updateCategories),
  activityLogger('Update system categories'),
  settingController.updateCategories
);

router.get('/notifications', settingController.getNotifications);

router.patch('/notifications',
  auth('system.settings.update'),
  validate(settingValidation.updateNotifications),
  activityLogger('Update system notification preferences'),
  settingController.updateNotifications
);

router.post('/logo',
  auth('system.settings.update'),
  upload.single('logo'),
  activityLogger('Upload system logo'),
  settingController.uploadLogo
);

router.get('/report-schedule',
  auth('system.settings.update'),
  settingController.getReportSchedule
);

router.patch('/report-schedule',
  auth('system.settings.update'),
  validate(settingValidation.updateReportSchedule),
  activityLogger('Update report schedules'),
  settingController.updateReportSchedule
);

module.exports = router;
