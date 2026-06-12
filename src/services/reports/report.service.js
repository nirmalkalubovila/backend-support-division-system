const httpStatus = require('http-status');
const { Report } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');

// ──────────────────────────────────────────────────────────────
// Mock Data Generators (to be replaced with real queries when
// Issue, Project, and TimeLog models are created)
// ──────────────────────────────────────────────────────────────

/**
 * Generate mock daily report data
 * @param {Date} date
 * @returns {Object}
 */
const buildDailyData = (date) => {
  const dateStr = date.toISOString().split('T')[0];
  return {
    reportDate: dateStr,
    issuesSummary: {
      newToday: 5,
      inProgress: 8,
      resolvedToday: 4,
      closedToday: 3,
      reopened: 1,
      total: 21,
    },
    slaStatus: {
      withinSla: 15,
      breachedToday: 2,
      atRisk: 3,
      complianceRate: 75.0,
    },
    memberActivity: [
      { name: 'John Doe', role: 'engineer', hoursLogged: 6.5, issuesTouched: 4, issuesResolved: 2 },
      { name: 'Jane Smith', role: 'senior_engineer', hoursLogged: 7.0, issuesTouched: 5, issuesResolved: 3 },
      { name: 'Mike Johnson', role: 'engineer', hoursLogged: 5.0, issuesTouched: 3, issuesResolved: 1 },
      { name: 'Sarah Lee', role: 'engineer', hoursLogged: 4.5, issuesTouched: 2, issuesResolved: 1 },
    ],
    criticalUnassigned: [
      { issueId: 'AQF-2026-00142', title: 'Login page broken for all users', priority: 'Critical', createdAt: dateStr, age: '2h' },
    ],
    pendingClient: [
      { issueId: 'SWM-2026-00089', title: 'Data export format clarification', priority: 'Medium', pendingSince: '28h', client: 'SwiftMove' },
    ],
  };
};

/**
 * Generate mock weekly report data
 * @param {Date} weekStart
 * @returns {Object}
 */
const buildWeeklyData = (weekStart) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    issueVolume: {
      totalNew: 22,
      totalResolved: 18,
      totalClosed: 15,
      byProject: [
        { project: 'AquaFresh ERP', newIssues: 8, resolved: 6, closed: 5 },
        { project: 'SwiftMove Inventory', newIssues: 6, resolved: 5, closed: 4 },
        { project: 'EliteSoft CMS', newIssues: 5, resolved: 4, closed: 3 },
        { project: 'Factory Pro', newIssues: 3, resolved: 3, closed: 3 },
      ],
      byPriority: [
        { priority: 'Critical', count: 3 },
        { priority: 'High', count: 7 },
        { priority: 'Medium', count: 8 },
        { priority: 'Low', count: 4 },
      ],
    },
    resolutionTime: {
      avgHours: 6.2,
      medianHours: 4.5,
      p95Hours: 18.0,
      byPriority: [
        { priority: 'Critical', avgHours: 2.1, medianHours: 1.8, p95Hours: 3.8 },
        { priority: 'High', avgHours: 5.5, medianHours: 4.0, p95Hours: 12.0 },
        { priority: 'Medium', avgHours: 8.0, medianHours: 6.5, p95Hours: 22.0 },
        { priority: 'Low', avgHours: 14.0, medianHours: 10.0, p95Hours: 36.0 },
      ],
    },
    slaCompliance: {
      rate: 88.9,
      priorWeekRate: 85.0,
      trend: 'up',
      totalWithinSla: 16,
      totalBreached: 2,
    },
    memberWorkload: [
      { name: 'John Doe', hoursLogged: 32.5, issuesHandled: 8, avgResolutionHours: 5.2 },
      { name: 'Jane Smith', hoursLogged: 35.0, issuesHandled: 10, avgResolutionHours: 4.8 },
      { name: 'Mike Johnson', hoursLogged: 28.0, issuesHandled: 6, avgResolutionHours: 7.1 },
      { name: 'Sarah Lee', hoursLogged: 22.5, issuesHandled: 5, avgResolutionHours: 6.5 },
    ],
    developerVelocity: [
      { name: 'John Doe', avgInProgressToResolved: 4.2 },
      { name: 'Jane Smith', avgInProgressToResolved: 3.8 },
      { name: 'Mike Johnson', avgInProgressToResolved: 5.5 },
      { name: 'Sarah Lee', avgInProgressToResolved: 5.0 },
    ],
    backlogHealth: {
      zeroToThreeDays: 5,
      threeToSevenDays: 3,
      sevenToFourteenDays: 2,
      overFourteenDays: 1,
      total: 11,
    },
    projectHours: [
      { project: 'AquaFresh ERP', allocated: 40, used: 32.5, remaining: 7.5, trend: 'stable' },
      { project: 'SwiftMove Inventory', allocated: 20, used: 18.0, remaining: 2.0, trend: 'warning' },
      { project: 'EliteSoft CMS', allocated: 30, used: 15.5, remaining: 14.5, trend: 'healthy' },
      { project: 'Factory Pro', allocated: 15, used: 12.0, remaining: 3.0, trend: 'stable' },
    ],
    escalationCount: {
      total: 4,
      byType: [
        { type: 'SLA First Response', count: 2 },
        { type: 'SLA Resolution', count: 1 },
        { type: 'Priority Escalation', count: 1 },
      ],
    },
  };
};

/**
 * Generate mock monthly report data
 * @param {number} month - 1-12
 * @param {number} year
 * @returns {Object}
 */
const buildMonthlyData = (month, year) => {
  return {
    month,
    year,
    period: `${year}-${String(month).padStart(2, '0')}`,
    kpiScorecard: {
      slaComplianceRate: 91.2,
      avgResolutionTimeHours: 5.8,
      totalIssues: 87,
      totalOverruns: 2,
      totalHoursLogged: 480,
      utilizationRate: 82.5,
    },
    projectPerformance: [
      { project: 'AquaFresh ERP', allocated: 160, used: 142, carryOver: 0, overrun: false, issuesCount: 32 },
      { project: 'SwiftMove Inventory', allocated: 80, used: 85, carryOver: 0, overrun: true, issuesCount: 18 },
      { project: 'EliteSoft CMS', allocated: 120, used: 98, carryOver: 22, overrun: false, issuesCount: 22 },
      { project: 'Factory Pro', allocated: 60, used: 55, carryOver: 5, overrun: false, issuesCount: 15 },
    ],
    clientBreakdown: [
      { client: 'AquaFresh', totalIssues: 32, resolvedRate: 93.8, avgResolutionHours: 5.2 },
      { client: 'SwiftMove', totalIssues: 18, resolvedRate: 88.9, avgResolutionHours: 6.8 },
      { client: 'EliteSoft', totalIssues: 22, resolvedRate: 90.9, avgResolutionHours: 5.5 },
      { client: 'Factory Pro', totalIssues: 15, resolvedRate: 100.0, avgResolutionHours: 4.1 },
    ],
    resourceAllocation: [
      { member: 'John Doe', projects: [{ project: 'AquaFresh ERP', hours: 52 }, { project: 'SwiftMove Inventory', hours: 30 }] },
      { member: 'Jane Smith', projects: [{ project: 'AquaFresh ERP', hours: 48 }, { project: 'EliteSoft CMS', hours: 42 }] },
      { member: 'Mike Johnson', projects: [{ project: 'SwiftMove Inventory', hours: 35 }, { project: 'Factory Pro', hours: 28 }] },
      { member: 'Sarah Lee', projects: [{ project: 'EliteSoft CMS', hours: 56 }, { project: 'Factory Pro', hours: 27 }] },
    ],
    memberEfficiency: [
      { name: 'John Doe', hoursLogged: 128, utilizationRate: 80.0, issuesResolved: 28, avgHandleTime: 4.6 },
      { name: 'Jane Smith', hoursLogged: 140, utilizationRate: 87.5, issuesResolved: 32, avgHandleTime: 4.4 },
      { name: 'Mike Johnson', hoursLogged: 112, utilizationRate: 70.0, issuesResolved: 18, avgHandleTime: 6.2 },
      { name: 'Sarah Lee', hoursLogged: 100, utilizationRate: 62.5, issuesResolved: 20, avgHandleTime: 5.0 },
    ],
    issueTypeAnalysis: [
      { type: 'Bug', count: 35 },
      { type: 'Feature Request', count: 18 },
      { type: 'Access Issue', count: 12 },
      { type: 'Data Correction', count: 10 },
      { type: 'Performance', count: 7 },
      { type: 'Consultation', count: 5 },
    ],
    trendAnalysis: {
      priorMonth: { totalIssues: 92, slaRate: 89.1, avgResolution: 6.2 },
      currentMonth: { totalIssues: 87, slaRate: 91.2, avgResolution: 5.8 },
      issuesTrend: 'down',
      slaTrend: 'up',
      resolutionTrend: 'up',
    },
    slaBreachRootCauses: [
      { issue: 'AQF-2026-00142', reason: 'Dependency on external vendor response', priority: 'Critical', breachHours: 2.3 },
      { issue: 'SWM-2026-00089', reason: 'Complex data migration required', priority: 'High', breachHours: 4.1 },
    ],
    capacityPlanning: {
      projectedHoursNextMonth: 520,
      currentCapacity: 640,
      utilizationForecast: 81.3,
      recommendation: 'Current capacity is sufficient for projected workload.',
    },
  };
};

/**
 * Build executive report data
 * @param {Object} params
 * @returns {Object}
 */
const buildExecutiveData = (params) => {
  const { startDate, endDate, projectId, clientId } = params;
  return {
    period: { startDate, endDate },
    filters: { projectId: projectId || 'all', clientId: clientId || 'all' },
    summary: {
      totalIssues: 45,
      resolvedIssues: 40,
      slaComplianceRate: 91.1,
      avgResolutionHours: 5.4,
      totalHoursLogged: 220,
      totalBillableHours: 198,
    },
    projectSummary: [
      { project: 'AquaFresh ERP', issues: 18, resolved: 16, hoursUsed: 85, allocated: 100, slaRate: 93.3 },
      { project: 'SwiftMove Inventory', issues: 12, resolved: 11, hoursUsed: 65, allocated: 60, slaRate: 88.0 },
    ],
    topIssues: [
      { issueId: 'AQF-2026-00142', title: 'Critical login failure', priority: 'Critical', resolvedIn: '1.5h' },
      { issueId: 'AQF-2026-00150', title: 'Report generation timeout', priority: 'High', resolvedIn: '4.2h' },
    ],
  };
};

// ──────────────────────────────────────────────────────────────
// KPI Analytics (time-series data for charts)
// ──────────────────────────────────────────────────────────────

/**
 * Build KPI analytics time-series data
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity - 'day' | 'week' | 'month'
 * @returns {Object}
 */
const buildKpiData = (startDate, endDate, granularity = 'day') => {
  // Generate sample data points
  const points = [];
  const current = new Date(startDate);
  let index = 0;

  while (current <= endDate) {
    points.push({
      date: current.toISOString().split('T')[0],
      resolutionTimeAvg: 4 + Math.random() * 6,
      slaComplianceRate: 80 + Math.random() * 18,
      issuesNew: Math.floor(3 + Math.random() * 8),
      issuesResolved: Math.floor(2 + Math.random() * 9),
      velocityAvg: 3 + Math.random() * 5,
    });

    if (granularity === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (granularity === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
    index++;
    if (index > 90) break; // safety cap
  }

  return {
    granularity,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    dataPoints: points,
    aggregates: {
      avgResolutionTime: 5.8,
      avgSlaRate: 89.5,
      totalNewIssues: points.reduce((s, p) => s + p.issuesNew, 0),
      totalResolvedIssues: points.reduce((s, p) => s + p.issuesResolved, 0),
    },
  };
};

// ──────────────────────────────────────────────────────────────
// Utilization data
// ──────────────────────────────────────────────────────────────

/**
 * Build utilization report data
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} [projectId]
 * @returns {Object}
 */
const buildUtilizationData = (startDate, endDate, projectId) => {
  return {
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    projectFilter: projectId || 'all',
    memberBreakdown: [
      {
        name: 'John Doe',
        totalHours: 128,
        billableHours: 115,
        utilizationRate: 89.8,
        projects: [
          { project: 'AquaFresh ERP', hours: 52, allocated: 60 },
          { project: 'SwiftMove Inventory', hours: 30, allocated: 30 },
          { project: 'EliteSoft CMS', hours: 22, allocated: 25 },
          { project: 'Factory Pro', hours: 24, allocated: 25 },
        ],
      },
      {
        name: 'Jane Smith',
        totalHours: 140,
        billableHours: 130,
        utilizationRate: 92.9,
        projects: [
          { project: 'AquaFresh ERP', hours: 48, allocated: 50 },
          { project: 'EliteSoft CMS', hours: 52, allocated: 55 },
          { project: 'Factory Pro', hours: 40, allocated: 35 },
        ],
      },
      {
        name: 'Mike Johnson',
        totalHours: 112,
        billableHours: 98,
        utilizationRate: 87.5,
        projects: [
          { project: 'SwiftMove Inventory', hours: 35, allocated: 40 },
          { project: 'Factory Pro', hours: 38, allocated: 40 },
          { project: 'AquaFresh ERP', hours: 39, allocated: 40 },
        ],
      },
      {
        name: 'Sarah Lee',
        totalHours: 100,
        billableHours: 88,
        utilizationRate: 88.0,
        projects: [
          { project: 'EliteSoft CMS', hours: 56, allocated: 60 },
          { project: 'Factory Pro', hours: 44, allocated: 45 },
        ],
      },
    ],
    projectSummary: [
      { project: 'AquaFresh ERP', totalAllocated: 150, totalUsed: 139, utilization: 92.7 },
      { project: 'SwiftMove Inventory', totalAllocated: 70, totalUsed: 65, utilization: 92.9 },
      { project: 'EliteSoft CMS', totalAllocated: 140, totalUsed: 130, utilization: 92.9 },
      { project: 'Factory Pro', totalAllocated: 145, totalUsed: 146, utilization: 100.7 },
    ],
  };
};

// ──────────────────────────────────────────────────────────────
// Public Service Methods
// ──────────────────────────────────────────────────────────────

/**
 * Generate and save a daily report
 * @param {Date} [date] - defaults to today
 * @param {string|null} [userId] - null for auto, userId for manual
 * @returns {Promise<Object>}
 */
const generateDailyReport = async (date, userId = null) => {
  const reportDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(reportDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(reportDate.setHours(23, 59, 59, 999));

  const data = buildDailyData(startOfDay);

  const report = await Report.create({
    type: 'daily',
    periodStart: startOfDay,
    periodEnd: endOfDay,
    data,
    generatedBy: userId,
    generationMode: userId ? 'manual' : 'automatic',
    status: 'completed',
  });

  logger.info(`Daily report generated for ${startOfDay.toISOString().split('T')[0]}`, { reportId: report._id });
  return report;
};

/**
 * Generate and save a weekly report
 * @param {Date} [weekStart] - defaults to current week Monday
 * @param {string|null} [userId] - null for auto, userId for manual
 * @returns {Promise<Object>}
 */
const generateWeeklyReport = async (weekStart, userId = null) => {
  const start = weekStart ? new Date(weekStart) : getMonday(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const data = buildWeeklyData(start);

  const report = await Report.create({
    type: 'weekly',
    periodStart: start,
    periodEnd: end,
    data,
    generatedBy: userId,
    generationMode: userId ? 'manual' : 'automatic',
    status: 'completed',
  });

  logger.info(`Weekly report generated for ${start.toISOString().split('T')[0]}`, { reportId: report._id });
  return report;
};

/**
 * Generate and save a monthly report
 * @param {number} month - 1-12
 * @param {number} year
 * @param {string|null} [userId]
 * @returns {Promise<Object>}
 */
const generateMonthlyReport = async (month, year, userId = null) => {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0); // last day of month

  const data = buildMonthlyData(month, year);

  const report = await Report.create({
    type: 'monthly',
    periodStart,
    periodEnd,
    data,
    generatedBy: userId,
    generationMode: userId ? 'manual' : 'automatic',
    status: 'completed',
  });

  logger.info(`Monthly report generated for ${year}-${String(month).padStart(2, '0')}`, { reportId: report._id });
  return report;
};

/**
 * Build and save an executive report
 * @param {Object} params - { startDate, endDate, projectId?, clientId? }
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const buildExecutiveReport = async (params, userId) => {
  const data = buildExecutiveData(params);

  const report = await Report.create({
    type: 'executive',
    periodStart: new Date(params.startDate),
    periodEnd: new Date(params.endDate),
    data,
    generatedBy: userId,
    generationMode: 'manual',
    status: 'completed',
    metadata: {
      projectId: params.projectId || null,
      clientId: params.clientId || null,
    },
  });

  logger.info('Executive report generated', { reportId: report._id });
  return report;
};

/**
 * Get KPI analytics data (computed on-the-fly, not persisted)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} [granularity]
 * @returns {Object}
 */
const getKpiAnalytics = (startDate, endDate, granularity = 'day') => {
  return buildKpiData(new Date(startDate), new Date(endDate), granularity);
};

/**
 * Get utilization report data (computed on-the-fly, not persisted)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} [projectId]
 * @returns {Object}
 */
const getUtilizationReport = (startDate, endDate, projectId) => {
  return buildUtilizationData(new Date(startDate), new Date(endDate), projectId);
};

/**
 * Get the latest report of a given type, or generate one if none exists for the period
 * @param {string} type - 'daily' | 'weekly'
 * @param {Date} [date]
 * @returns {Promise<Object>}
 */
const getLatestReport = async (type, date) => {
  const now = date ? new Date(date) : new Date();
  let periodStart;
  let periodEnd;

  if (type === 'daily') {
    periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);
  } else if (type === 'weekly') {
    periodStart = getMonday(now);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
  }

  const report = await Report.findOne({
    type,
    periodStart: { $gte: periodStart },
    periodEnd: { $lte: new Date(periodEnd.getTime() + 86400000) },
    deletedAt: null,
    status: 'completed',
  }).sort({ createdAt: -1 });

  return report;
};

/**
 * Get a report by ID
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getReportById = async (id) => {
  const report = await Report.findOne({ _id: id, deletedAt: null });
  if (!report) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Report not found');
  }
  return report;
};

/**
 * Paginate historical reports
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<Object>}
 */
const paginateReports = async (filter, options) => {
  const queryFilter = { ...filter, deletedAt: null };
  return Report.paginate(queryFilter, options);
};

// ── Helper ──────────────────────────────────────────────────────
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

module.exports = {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  buildExecutiveReport,
  getKpiAnalytics,
  getUtilizationReport,
  getLatestReport,
  getReportById,
  paginateReports,
};
