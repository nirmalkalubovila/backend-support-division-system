const Joi = require('joi');

const updateBranding = {
  body: Joi.object().keys({
    companyName: Joi.string().required().max(100),
    slogan: Joi.string().required().max(150),
    primaryColor: Joi.string().required().regex(/^#[0-9A-Fa-f]{6}$/),
    logoUrl: Joi.string().allow(null, '').max(500),
  }),
};

const updatePriorities = {
  body: Joi.object().keys({
    Critical: Joi.object().keys({
      firstResponse: Joi.number().integer().min(0).required(),
      resolution: Joi.number().integer().min(0).required(),
      escalation: Joi.number().integer().min(0).required(),
    }).required(),
    High: Joi.object().keys({
      firstResponse: Joi.number().integer().min(0).required(),
      resolution: Joi.number().integer().min(0).required(),
      escalation: Joi.number().integer().min(0).required(),
    }).required(),
    Medium: Joi.object().keys({
      firstResponse: Joi.number().integer().min(0).required(),
      resolution: Joi.number().integer().min(0).required(),
      escalation: Joi.number().integer().min(0).required(),
    }).required(),
    Low: Joi.object().keys({
      firstResponse: Joi.number().integer().min(0).required(),
      resolution: Joi.number().integer().min(0).required(),
      escalation: Joi.number().integer().min(0).required(),
    }).required(),
  }),
};

const updateCategories = {
  body: Joi.object().keys({
    categories: Joi.array().items(Joi.string().trim().min(1).max(50)).min(1).required(),
  }),
};

const modulePreferenceSchema = Joi.object().keys({
  email: Joi.boolean().required(),
  inApp: Joi.boolean().required(),
});

const updateNotifications = {
  body: Joi.object().keys({
    emailCritical: Joi.boolean().required(),
    inAppSlaBreach: Joi.boolean().required(),
    dailySummary: Joi.boolean().required(),
    projectHourWarning: Joi.boolean().required(),
    modulePreferences: Joi.object().keys({
      issues: modulePreferenceSchema.required(),
      projects: modulePreferenceSchema.required(),
      crs: modulePreferenceSchema.required(),
      tasks: modulePreferenceSchema.required(),
      'time-tracking': modulePreferenceSchema.required(),
      system: modulePreferenceSchema.required(),
      finance: modulePreferenceSchema.required(),
    }).required(),
  }),
};

const updateReportSchedule = {
  body: Joi.object().keys({
    dailyEnabled: Joi.boolean().required(),
    dailyCron: Joi.string().required(),
    weeklyEnabled: Joi.boolean().required(),
    weeklyCron: Joi.string().required(),
    monthlyEnabled: Joi.boolean().required(),
    monthlyCron: Joi.string().required(),
  }),
};

module.exports = {
  updateBranding,
  updatePriorities,
  updateCategories,
  updateNotifications,
  updateReportSchedule,
};

const updateFinanceSettings = {
  body: Joi.object().keys({
    defaultContractedHourlyRate: Joi.number().min(0).required(),
  }),
};

module.exports = {
  updateBranding,
  updatePriorities,
  updateCategories,
  updateNotifications,
  updateReportSchedule,
  updateFinanceSettings,
};

