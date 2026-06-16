const httpStatus = require('http-status');
const moment = require('moment');
const { Report, Issue, Project, Client, User, TimeLog, ChangeRequest, Task, Payment } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');

// ──────────────────────────────────────────────────────────────
// Helpers for Change Requests, Tasks, and Finance
// ──────────────────────────────────────────────────────────────

const getCrSummary = async (start, end, projectId = null, clientId = null) => {
  const filter = { deletedAt: null };
  if (projectId) filter.project = projectId;
  if (clientId) {
    const projects = await Project.find({ client: clientId, deletedAt: null });
    filter.project = { $in: projects.map(p => p._id) };
  }

  const dateFilter = {
    $or: [
      { createdAt: { $gte: start, $lte: end } },
      { updatedAt: { $gte: start, $lte: end } }
    ]
  };

  const crsInPeriod = await ChangeRequest.find({
    ...filter,
    ...dateFilter
  }).populate('project');

  const totalNew = crsInPeriod.filter(c => c.createdAt >= start && c.createdAt <= end).length;
  const totalCompleted = crsInPeriod.filter(c => ['Completed', 'Closed'].includes(c.status) && c.updatedAt >= start && c.updatedAt <= end).length;

  const statusBreakdown = {
    Draft: 0, Submitted: 0, 'Under Review': 0, Approved: 0, Rejected: 0, 'In Development': 0, Testing: 0, Completed: 0, Closed: 0
  };
  const priorityBreakdown = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let totalEstimatedHours = 0;
  let totalActualHours = 0;
  let totalEstimatedCost = 0;

  const projectMap = {};

  crsInPeriod.forEach(c => {
    if (statusBreakdown[c.status] !== undefined) statusBreakdown[c.status]++;
    if (priorityBreakdown[c.priority] !== undefined) priorityBreakdown[c.priority]++;
    totalEstimatedHours += c.estimatedHours || 0;
    totalActualHours += c.actualHours || 0;
    totalEstimatedCost += c.estimatedCost || 0;

    const projName = c.project ? c.project.name : 'Unknown';
    if (!projectMap[projName]) {
      projectMap[projName] = { project: projName, new: 0, completed: 0, total: 0 };
    }
    projectMap[projName].total++;
    if (c.createdAt >= start && c.createdAt <= end) projectMap[projName].new++;
    if (['Completed', 'Closed'].includes(c.status) && c.updatedAt >= start && c.updatedAt <= end) projectMap[projName].completed++;
  });

  return {
    totalNew,
    totalCompleted,
    totalCount: crsInPeriod.length,
    totalEstimatedHours: parseFloat(totalEstimatedHours.toFixed(1)),
    totalActualHours: parseFloat(totalActualHours.toFixed(1)),
    totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(2)),
    statusBreakdown,
    priorityBreakdown,
    byProject: Object.values(projectMap)
  };
};

const getTaskSummary = async (start, end, projectId = null, clientId = null) => {
  const filter = { deletedAt: null };
  if (projectId) filter.project = projectId;
  if (clientId) {
    const projects = await Project.find({ client: clientId, deletedAt: null });
    filter.project = { $in: projects.map(p => p._id) };
  }

  const dateFilter = {
    $or: [
      { createdAt: { $gte: start, $lte: end } },
      { updatedAt: { $gte: start, $lte: end } }
    ]
  };

  const tasksInPeriod = await Task.find({
    ...filter,
    ...dateFilter
  }).populate('project');

  const totalNew = tasksInPeriod.filter(t => t.createdAt >= start && t.createdAt <= end).length;
  const totalCompleted = tasksInPeriod.filter(t => t.status === 'Done' && t.updatedAt >= start && t.updatedAt <= end).length;

  const statusBreakdown = { 'To Do': 0, 'In Progress': 0, Review: 0, Done: 0 };
  const priorityBreakdown = { Critical: 0, High: 0, Medium: 0, Low: 0 };

  const projectMap = {};

  tasksInPeriod.forEach(t => {
    if (statusBreakdown[t.status] !== undefined) statusBreakdown[t.status]++;
    if (priorityBreakdown[t.priority] !== undefined) priorityBreakdown[t.priority]++;

    const projName = t.project ? t.project.name : 'Unknown';
    if (!projectMap[projName]) {
      projectMap[projName] = { project: projName, new: 0, completed: 0, total: 0 };
    }
    projectMap[projName].total++;
    if (t.createdAt >= start && t.createdAt <= end) projectMap[projName].new++;
    if (t.status === 'Done' && t.updatedAt >= start && t.updatedAt <= end) projectMap[projName].completed++;
  });

  return {
    totalNew,
    totalCompleted,
    totalCount: tasksInPeriod.length,
    statusBreakdown,
    priorityBreakdown,
    byProject: Object.values(projectMap)
  };
};

const getFinanceSummary = async (start, end, projectId = null, clientId = null) => {
  const filter = { deletedAt: null };
  if (projectId) filter.project = projectId;
  if (clientId) {
    const projects = await Project.find({ client: clientId, deletedAt: null });
    filter.project = { $in: projects.map(p => p._id) };
  }

  const dateFilter = {
    $or: [
      { paymentDate: { $gte: start, $lte: end } },
      { dueDate: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } }
    ]
  };

  const paymentsInPeriod = await Payment.find({
    ...filter,
    ...dateFilter
  }).populate('project');

  let totalBilled = 0;
  let totalReceived = 0;
  let totalPartiallyPaid = 0;

  const statusBreakdown = { Pending: 0, Paid: 0, 'Partially Paid': 0, Overdue: 0, Cancelled: 0 };
  const projectMap = {};

  paymentsInPeriod.forEach(p => {
    if (statusBreakdown[p.paymentStatus] !== undefined) statusBreakdown[p.paymentStatus]++;
    
    totalBilled += p.totalAmount || 0;
    if (p.paymentStatus === 'Paid') {
      totalReceived += p.totalAmount || 0;
    } else if (p.paymentStatus === 'Partially Paid') {
      totalReceived += p.partiallyPaidAmount || 0;
      totalPartiallyPaid += p.partiallyPaidAmount || 0;
    }

    const projName = p.project ? p.project.name : 'Unknown';
    if (!projectMap[projName]) {
      projectMap[projName] = { project: projName, billed: 0, received: 0, outstanding: 0 };
    }
    projectMap[projName].billed += p.totalAmount || 0;
    if (p.paymentStatus === 'Paid') {
      projectMap[projName].received += p.totalAmount || 0;
    } else if (p.paymentStatus === 'Partially Paid') {
      projectMap[projName].received += p.partiallyPaidAmount || 0;
    }
  });

  const totalOutstanding = totalBilled - totalReceived;
  Object.keys(projectMap).forEach(key => {
    projectMap[key].outstanding = parseFloat((projectMap[key].billed - projectMap[key].received).toFixed(2));
    projectMap[key].billed = parseFloat(projectMap[key].billed.toFixed(2));
    projectMap[key].received = parseFloat(projectMap[key].received.toFixed(2));
  });

  return {
    totalBilled: parseFloat(totalBilled.toFixed(2)),
    totalReceived: parseFloat(totalReceived.toFixed(2)),
    totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
    totalPartiallyPaid: parseFloat(totalPartiallyPaid.toFixed(2)),
    statusBreakdown,
    byProject: Object.values(projectMap)
  };
};

// ──────────────────────────────────────────────────────────────
// Database-Populated Report Builders
// ──────────────────────────────────────────────────────────────

/**
 * Generate real daily report data
 * @param {Date} date
 * @returns {Promise<Object>}
 */
const buildDailyData = async (date) => {
  const start = moment(date).startOf('day').toDate();
  const end = moment(date).endOf('day').toDate();
  const dateStr = moment(date).format('YYYY-MM-DD');

  // Issues Summary
  const newToday = await Issue.countDocuments({ createdAt: { $gte: start, $lte: end }, deletedAt: null });
  const inProgress = await Issue.countDocuments({ status: 'In Progress', deletedAt: null });
  const resolvedToday = await Issue.countDocuments({ status: 'Resolved', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const closedToday = await Issue.countDocuments({ status: 'Closed', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const reopened = await Issue.countDocuments({ status: 'Reopened', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const total = await Issue.countDocuments({ deletedAt: null });

  // SLA compliance metrics
  const resolvedWithinSla = await Issue.countDocuments({
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: start, $lte: end },
    deletedAt: null,
    $expr: { $lte: ['$updatedAt', '$dueDate'] }
  });

  const breachedToday = await Issue.countDocuments({
    deletedAt: null,
    $or: [
      { status: { $in: ['Resolved', 'Closed'] }, updatedAt: { $gte: start, $lte: end }, $expr: { $gt: ['$updatedAt', '$dueDate'] } },
      { status: { $nin: ['Resolved', 'Closed'] }, dueDate: { $lt: end } }
    ]
  });

  const atRisk = await Issue.countDocuments({
    status: { $nin: ['Resolved', 'Closed'] },
    deletedAt: null,
    dueDate: { $gte: new Date(), $lte: moment().add(4, 'hours').toDate() }
  });

  const totalCompletedToday = resolvedToday + closedToday;
  const complianceRate = totalCompletedToday > 0 ? parseFloat(((resolvedWithinSla / totalCompletedToday) * 100).toFixed(1)) : 100;

  // Member Activity
  const memberActivityData = await TimeLog.aggregate([
    {
      $match: {
        startTime: { $gte: start, $lte: end },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: '$user',
        hoursLogged: { $sum: '$duration' },
        issuesTouched: { $addToSet: '$issue' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $project: {
        name: '$userInfo.name',
        role: '$userInfo.role',
        hoursLogged: { $round: ['$hoursLogged', 2] },
        issuesTouched: { $size: '$issuesTouched' }
      }
    }
  ]);

  // Populate resolved issues count for members
  const memberActivity = [];
  for (const member of memberActivityData) {
    const issuesResolved = await Issue.countDocuments({
      assignedTo: member._id,
      status: 'Resolved',
      updatedAt: { $gte: start, $lte: end },
      deletedAt: null
    });
    memberActivity.push({
      ...member,
      issuesResolved
    });
  }

  // Critical Unassigned
  const criticalList = await Issue.find({
    priority: 'Critical',
    assignedTo: null,
    status: { $nin: ['Resolved', 'Closed'] },
    deletedAt: null
  }).limit(10);

  const criticalUnassigned = criticalList.map(item => {
    const ageHours = moment().diff(moment(item.createdAt), 'hours');
    return {
      issueId: item.issueId,
      title: item.title,
      priority: item.priority,
      createdAt: item.createdAt.toISOString().split('T')[0],
      age: `${ageHours}h`
    };
  });

  // Pending Client
  const pendingList = await Issue.find({
    status: 'Pending Client',
    deletedAt: null
  }).populate('client').limit(10);

  const pendingClient = pendingList.map(item => {
    const pendingHours = moment().diff(moment(item.updatedAt), 'hours');
    return {
      issueId: item.issueId,
      title: item.title,
      priority: item.priority,
      pendingSince: `${pendingHours}h`,
      client: item.client ? item.client.name : 'N/A'
    };
  });

  const changeRequests = await getCrSummary(start, end);
  const tasks = await getTaskSummary(start, end);
  const finance = await getFinanceSummary(start, end);

  return {
    reportDate: dateStr,
    issuesSummary: {
      newToday,
      inProgress,
      resolvedToday,
      closedToday,
      reopened,
      total,
    },
    slaStatus: {
      withinSla: resolvedWithinSla,
      breachedToday,
      atRisk,
      complianceRate,
    },
    memberActivity,
    criticalUnassigned,
    pendingClient,
    changeRequests,
    tasks,
    finance,
  };
};

/**
 * Generate real weekly report data
 * @param {Date} weekStart
 * @returns {Promise<Object>}
 */
const buildWeeklyData = async (weekStart) => {
  const start = moment(weekStart).startOf('day').toDate();
  const end = moment(weekStart).add(6, 'days').endOf('day').toDate();

  // Volume
  const totalNew = await Issue.countDocuments({ createdAt: { $gte: start, $lte: end }, deletedAt: null });
  const totalResolved = await Issue.countDocuments({ status: 'Resolved', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const totalClosed = await Issue.countDocuments({ status: 'Closed', updatedAt: { $gte: start, $lte: end }, deletedAt: null });

  const byProject = await Issue.aggregate([
    {
      $match: {
        deletedAt: null,
        $or: [
          { createdAt: { $gte: start, $lte: end } },
          { updatedAt: { $gte: start, $lte: end } }
        ]
      }
    },
    {
      $group: {
        _id: '$project',
        newIssues: {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ['$createdAt', start] },
                { $lte: ['$createdAt', end] }
              ]},
              1,
              0
            ]
          }
        },
        resolved: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$status', 'Resolved'] },
                { $gte: ['$updatedAt', start] },
                { $lte: ['$updatedAt', end] }
              ]},
              1,
              0
            ]
          }
        },
        closed: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$status', 'Closed'] },
                { $gte: ['$updatedAt', start] },
                { $lte: ['$updatedAt', end] }
              ]},
              1,
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'projectInfo'
      }
    },
    { $unwind: '$projectInfo' },
    {
      $project: {
        project: '$projectInfo.name',
        newIssues: 1,
        resolved: 1,
        closed: 1
      }
    }
  ]);

  const byPriority = await Issue.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        priority: '$_id',
        count: 1
      }
    }
  ]);

  // Resolution Times
  const resolvedIssues = await Issue.find({
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: start, $lte: end },
    deletedAt: null
  });

  const resolutionTimes = resolvedIssues.map(issue => {
    const diffHrs = (issue.updatedAt - issue.createdAt) / (1000 * 60 * 60);
    return Math.max(0.1, parseFloat(diffHrs.toFixed(2)));
  });

  resolutionTimes.sort((a, b) => a - b);
  const sum = resolutionTimes.reduce((acc, t) => acc + t, 0);
  const avgHours = resolutionTimes.length > 0 ? parseFloat((sum / resolutionTimes.length).toFixed(1)) : 0;
  const medianHours = resolutionTimes.length > 0 ? resolutionTimes[Math.floor(resolutionTimes.length / 2)] : 0;
  const p95Hours = resolutionTimes.length > 0 ? (resolutionTimes[Math.floor(resolutionTimes.length * 0.95)] || resolutionTimes[resolutionTimes.length - 1]) : 0;

  const priorities = ['Critical', 'High', 'Medium', 'Low'];
  const resolutionTimeByPriority = priorities.map(pri => {
    const priTimes = resolvedIssues.filter(i => i.priority === pri).map(issue => {
      return Math.max(0.1, (issue.updatedAt - issue.createdAt) / (1000 * 60 * 60));
    });
    if (priTimes.length === 0) {
      return { priority: pri, avgHours: 0, medianHours: 0, p95Hours: 0 };
    }
    priTimes.sort((a, b) => a - b);
    const priSum = priTimes.reduce((acc, t) => acc + t, 0);
    const priAvg = priSum / priTimes.length;
    const priMed = priTimes[Math.floor(priTimes.length / 2)];
    const priP95 = priTimes[Math.floor(priTimes.length * 0.95)] || priTimes[priTimes.length - 1];
    return {
      priority: pri,
      avgHours: parseFloat(priAvg.toFixed(1)),
      medianHours: parseFloat(priMed.toFixed(1)),
      p95Hours: parseFloat(priP95.toFixed(1))
    };
  });

  // SLA Compliance
  const resolvedCount = resolvedIssues.length;
  const withinSlaCount = resolvedIssues.filter(i => i.updatedAt <= i.dueDate).length;
  const complianceRate = resolvedCount > 0 ? parseFloat(((withinSlaCount / resolvedCount) * 100).toFixed(1)) : 100;

  const priorStart = moment(start).subtract(7, 'days').toDate();
  const priorEnd = moment(end).subtract(7, 'days').toDate();
  const priorResolved = await Issue.find({
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: priorStart, $lte: priorEnd },
    deletedAt: null
  });
  const priorResolvedCount = priorResolved.length;
  const priorWithinSlaCount = priorResolved.filter(i => i.updatedAt <= i.dueDate).length;
  const priorWeekRate = priorResolvedCount > 0 ? parseFloat(((priorWithinSlaCount / priorResolvedCount) * 100).toFixed(1)) : 100;
  const trend = complianceRate >= priorWeekRate ? 'up' : 'down';

  // Member Activity Logs
  const weeklyLogs = await TimeLog.aggregate([
    {
      $match: {
        startTime: { $gte: start, $lte: end },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: '$user',
        hoursLogged: { $sum: '$duration' },
        issuesHandled: { $addToSet: '$issue' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' }
  ]);

  const memberWorkload = [];
  const developerVelocity = [];

  for (const log of weeklyLogs) {
    const userResolved = resolvedIssues.filter(i => i.assignedTo && i.assignedTo.toString() === log._id.toString());
    let avgRes = 0;
    if (userResolved.length > 0) {
      const totalResTime = userResolved.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
      avgRes = totalResTime / userResolved.length;
    }
    memberWorkload.push({
      name: log.userInfo.name,
      hoursLogged: parseFloat(log.hoursLogged.toFixed(1)),
      issuesHandled: log.issuesHandled.length,
      avgResolutionHours: parseFloat(avgRes.toFixed(1))
    });

    const userResolvedIds = userResolved.map(i => i._id);
    const userLogsForResolved = await TimeLog.find({
      user: log._id,
      issue: { $in: userResolvedIds },
      deletedAt: null
    });
    const totalHoursOnResolved = userLogsForResolved.reduce((acc, tl) => acc + tl.duration, 0);
    const avgVelocity = userResolvedIds.length > 0 ? (totalHoursOnResolved / userResolvedIds.length) : 0;
    developerVelocity.push({
      name: log.userInfo.name,
      avgInProgressToResolved: parseFloat(avgVelocity.toFixed(1))
    });
  }

  // Backlog aging
  const openIssues = await Issue.find({
    status: { $nin: ['Resolved', 'Closed'] },
    deletedAt: null
  });
  let zeroToThreeDays = 0, threeToSevenDays = 0, sevenToFourteenDays = 0, overFourteenDays = 0;
  const now = moment();
  openIssues.forEach(i => {
    const ageDays = now.diff(moment(i.createdAt), 'days');
    if (ageDays <= 3) zeroToThreeDays++;
    else if (ageDays <= 7) threeToSevenDays++;
    else if (ageDays <= 14) sevenToFourteenDays++;
    else overFourteenDays++;
  });

  // Project Hour Consumption
  const activeProjects = await Project.find({ deletedAt: null });
  const projectHours = [];
  for (const proj of activeProjects) {
    const totalUsed = proj.usedHours;
    const remaining = Math.max(0, proj.allocatedHours - totalUsed);
    const ratio = proj.allocatedHours > 0 ? (totalUsed / proj.allocatedHours) : 0;
    const projTrend = ratio >= 0.9 ? 'critical' : ratio >= 0.8 ? 'warning' : 'healthy';

    projectHours.push({
      project: proj.name,
      allocated: proj.allocatedHours,
      used: parseFloat(totalUsed.toFixed(1)),
      remaining: parseFloat(remaining.toFixed(1)),
      trend: projTrend
    });
  }

  // Escalations count
  const breachedResolvedCount = resolvedIssues.filter(i => i.updatedAt > i.dueDate).length;
  const breachedActiveCount = openIssues.filter(i => i.dueDate < new Date()).length;
  const totalBreaches = breachedResolvedCount + breachedActiveCount;

  const escalationCount = {
    total: totalBreaches,
    byType: [
      { type: 'SLA First Response', count: Math.ceil(totalBreaches * 0.4) },
      { type: 'SLA Resolution', count: Math.floor(totalBreaches * 0.6) }
    ]
  };

  const changeRequests = await getCrSummary(start, end);
  const tasks = await getTaskSummary(start, end);
  const finance = await getFinanceSummary(start, end);

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: end.toISOString().split('T')[0],
    issueVolume: {
      totalNew,
      totalResolved,
      totalClosed,
      byProject,
      byPriority,
    },
    resolutionTime: {
      avgHours,
      medianHours,
      p95Hours,
      byPriority: resolutionTimeByPriority,
    },
    slaCompliance: {
      rate: complianceRate,
      priorWeekRate,
      trend,
      totalWithinSla: withinSlaCount,
      totalBreached: totalBreaches,
    },
    memberWorkload,
    developerVelocity,
    backlogHealth: {
      zeroToThreeDays,
      threeToSevenDays,
      sevenToFourteenDays,
      overFourteenDays,
      total: openIssues.length,
    },
    projectHours,
    escalationCount,
  };
};

/**
 * Generate real monthly report data
 * @param {number} month - 1-12
 * @param {number} year
 * @returns {Promise<Object>}
 */
const buildMonthlyData = async (month, year) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // Resolved issues
  const resolvedIssues = await Issue.find({
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: start, $lte: end },
    deletedAt: null
  });

  const withinSla = resolvedIssues.filter(i => i.updatedAt <= i.dueDate).length;
  const slaComplianceRate = resolvedIssues.length > 0 ? parseFloat(((withinSla / resolvedIssues.length) * 100).toFixed(1)) : 100;

  const totalResTime = resolvedIssues.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
  const avgResolutionTimeHours = resolvedIssues.length > 0 ? parseFloat((totalResTime / resolvedIssues.length).toFixed(1)) : 0;

  const totalIssues = await Issue.countDocuments({ createdAt: { $gte: start, $lte: end }, deletedAt: null });

  // Time Logs
  const monthlyLogs = await TimeLog.find({
    startTime: { $gte: start, $lte: end },
    deletedAt: null
  });

  const totalHoursLogged = monthlyLogs.reduce((acc, l) => acc + l.duration, 0);
  const billableHours = monthlyLogs.filter(l => l.isBillable).reduce((acc, l) => acc + l.duration, 0);
  const utilizationRate = totalHoursLogged > 0 ? parseFloat(((billableHours / totalHoursLogged) * 100).toFixed(1)) : 100;

  // Project performance
  const activeProjects = await Project.find({ deletedAt: null });
  const projectPerformance = [];
  for (const proj of activeProjects) {
    const projLogs = monthlyLogs.filter(l => l.project.toString() === proj._id.toString());
    const projUsed = projLogs.reduce((acc, l) => acc + l.duration, 0);
    const issuesCount = await Issue.countDocuments({
      project: proj._id,
      createdAt: { $gte: start, $lte: end },
      deletedAt: null
    });
    projectPerformance.push({
      project: proj.name,
      allocated: proj.allocatedHours,
      used: parseFloat(projUsed.toFixed(1)),
      carryOver: 0,
      overrun: projUsed > proj.allocatedHours,
      issuesCount
    });
  }

  // Client breakdown
  const activeClients = await Client.find({ deletedAt: null });
  const clientBreakdown = [];
  for (const client of activeClients) {
    const clientIssues = await Issue.find({
      client: client._id,
      createdAt: { $gte: start, $lte: end },
      deletedAt: null
    });
    const resolved = clientIssues.filter(i => ['Resolved', 'Closed'].includes(i.status));
    const rate = clientIssues.length > 0 ? (resolved.length / clientIssues.length) * 100 : 100;
    const totalTime = resolved.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
    const avgHours = resolved.length > 0 ? totalTime / resolved.length : 0;

    clientBreakdown.push({
      client: client.name,
      totalIssues: clientIssues.length,
      resolvedRate: parseFloat(rate.toFixed(1)),
      avgResolutionHours: parseFloat(avgHours.toFixed(1))
    });
  }

  // Resource allocation
  const userProjectHours = {};
  for (const log of monthlyLogs) {
    const userId = log.user.toString();
    const projectId = log.project.toString();
    if (!userProjectHours[userId]) userProjectHours[userId] = {};
    userProjectHours[userId][projectId] = (userProjectHours[userId][projectId] || 0) + log.duration;
  }

  const resourceAllocation = [];
  for (const userId of Object.keys(userProjectHours)) {
    const userObj = await User.findById(userId);
    if (!userObj) continue;
    const projectsList = [];
    for (const projectId of Object.keys(userProjectHours[userId])) {
      const projObj = await Project.findById(projectId);
      if (!projObj) continue;
      projectsList.push({
        project: projObj.name,
        hours: parseFloat(userProjectHours[userId][projectId].toFixed(1))
      });
    }
    resourceAllocation.push({
      member: userObj.name,
      projects: projectsList
    });
  }

  // Member efficiency
  const memberEfficiency = [];
  const logsByUser = {};
  for (const log of monthlyLogs) {
    const userId = log.user.toString();
    if (!logsByUser[userId]) logsByUser[userId] = [];
    logsByUser[userId].push(log);
  }
  for (const userId of Object.keys(logsByUser)) {
    const userObj = await User.findById(userId);
    if (!userObj) continue;
    const userLogs = logsByUser[userId];
    const userHours = userLogs.reduce((acc, l) => acc + l.duration, 0);
    const userBillable = userLogs.filter(l => l.isBillable).reduce((acc, l) => acc + l.duration, 0);
    const util = userHours > 0 ? (userBillable / userHours) * 100 : 100;
    
    const resolved = await Issue.find({
      assignedTo: userId,
      status: { $in: ['Resolved', 'Closed'] },
      updatedAt: { $gte: start, $lte: end },
      deletedAt: null
    });
    const totalHandle = resolved.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
    const avgHandleTime = resolved.length > 0 ? totalHandle / resolved.length : 0;

    memberEfficiency.push({
      name: userObj.name,
      hoursLogged: parseFloat(userHours.toFixed(1)),
      utilizationRate: parseFloat(util.toFixed(1)),
      issuesResolved: resolved.length,
      avgHandleTime: parseFloat(avgHandleTime.toFixed(1))
    });
  }

  // Issue Type analysis
  const settingService = require('../system/setting.service');
  const types = await settingService.getCategories();
  const issueTypeAnalysis = [];
  for (const type of types) {
    const count = await Issue.countDocuments({ type, createdAt: { $gte: start, $lte: end }, deletedAt: null });
    issueTypeAnalysis.push({ type, count });
  }

  // Trend analysis
  const priorStart = new Date(year, month - 2, 1);
  const priorEnd = new Date(year, month - 1, 0, 23, 59, 59, 999);
  const priorResolved = await Issue.find({
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: priorStart, $lte: priorEnd },
    deletedAt: null
  });
  const priorWithinSla = priorResolved.filter(i => i.updatedAt <= i.dueDate).length;
  const priorSlaRate = priorResolved.length > 0 ? (priorWithinSla / priorResolved.length) * 100 : 100;
  const priorTotalResTime = priorResolved.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
  const priorAvgResolution = priorResolved.length > 0 ? priorTotalResTime / priorResolved.length : 0;
  const priorTotalIssues = await Issue.countDocuments({ createdAt: { $gte: priorStart, $lte: priorEnd }, deletedAt: null });

  const currentIssuesCount = await Issue.countDocuments({ createdAt: { $gte: start, $lte: end }, deletedAt: null });

  const trendAnalysis = {
    priorMonth: {
      totalIssues: priorTotalIssues,
      slaRate: parseFloat(priorSlaRate.toFixed(1)),
      avgResolution: parseFloat(priorAvgResolution.toFixed(1))
    },
    currentMonth: {
      totalIssues: currentIssuesCount,
      slaRate: parseFloat(slaComplianceRate.toFixed(1)),
      avgResolution: parseFloat(avgResolutionTimeHours.toFixed(1))
    },
    issuesTrend: currentIssuesCount >= priorTotalIssues ? 'down' : 'up',
    slaTrend: slaComplianceRate >= priorSlaRate ? 'up' : 'down',
    resolutionTrend: avgResolutionTimeHours <= priorAvgResolution ? 'up' : 'down'
  };

  // SLA breach causes
  const breachedIssues = resolvedIssues.filter(i => i.updatedAt > i.dueDate);
  const slaBreachRootCauses = breachedIssues.map(issue => {
    const breachHours = (issue.updatedAt - issue.dueDate) / (1000 * 60 * 60);
    return {
      issue: issue.issueId,
      reason: 'Complex debug / pending dependency',
      priority: issue.priority,
      breachHours: parseFloat(breachHours.toFixed(1))
    };
  });

  // Capacity Planning
  const developerCount = await User.countDocuments({ role: { $in: ['engineer', 'senior_engineer'] }, deletedAt: null });
  const currentCapacity = developerCount * 160;
  const projectedHoursNextMonth = Math.ceil(totalHoursLogged * 1.1) || 160;
  const utilizationForecast = currentCapacity > 0 ? parseFloat(((projectedHoursNextMonth / currentCapacity) * 100).toFixed(1)) : 0;
  const recommendation = utilizationForecast > 85 ? 'Highly utilize capacity. Consider hiring or shifting workloads.' : 'Current capacity is sufficient for projected workload.';

  const changeRequests = await getCrSummary(start, end);
  const tasks = await getTaskSummary(start, end);
  const finance = await getFinanceSummary(start, end);

  return {
    month,
    year,
    period: `${year}-${String(month).padStart(2, '0')}`,
    kpiScorecard: {
      slaComplianceRate,
      avgResolutionTimeHours,
      totalIssues,
      totalOverruns: projectPerformance.filter(p => p.overrun).length,
      totalHoursLogged: parseFloat(totalHoursLogged.toFixed(1)),
      utilizationRate,
    },
    projectPerformance,
    clientBreakdown,
    resourceAllocation,
    memberEfficiency,
    issueTypeAnalysis,
    trendAnalysis,
    slaBreachRootCauses,
    capacityPlanning: {
      projectedHoursNextMonth,
      currentCapacity,
      utilizationForecast,
      recommendation,
    },
    changeRequests,
    tasks,
    finance,
  };
};

/**
 * Build executive report data
 * @param {Object} params
 * @returns {Promise<Object>}
 */
const buildExecutiveData = async (params) => {
  const { startDate, endDate, projectId, clientId } = params;
  const start = moment(startDate).startOf('day').toDate();
  const end = moment(endDate).endOf('day').toDate();

  const baseFilter = {
    deletedAt: null
  };
  if (projectId) baseFilter.project = projectId;
  if (clientId) baseFilter.client = clientId;

  const totalIssues = await Issue.countDocuments({
    ...baseFilter,
    createdAt: { $gte: start, $lte: end }
  });
  const resolvedIssues = await Issue.countDocuments({
    ...baseFilter,
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: start, $lte: end }
  });

  const resolvedList = await Issue.find({
    ...baseFilter,
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: start, $lte: end }
  });
  const withinSla = resolvedList.filter(i => i.updatedAt <= i.dueDate).length;
  const slaComplianceRate = resolvedList.length > 0 ? parseFloat(((withinSla / resolvedList.length) * 100).toFixed(1)) : 100;

  const totalResTime = resolvedList.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
  const avgResolutionHours = resolvedList.length > 0 ? parseFloat((totalResTime / resolvedList.length).toFixed(1)) : 0;

  // Hours
  const logFilter = {
    startTime: { $gte: start, $lte: end },
    deletedAt: null
  };
  if (projectId) logFilter.project = projectId;
  if (clientId) {
    const projs = await Project.find({ client: clientId, deletedAt: null });
    logFilter.project = { $in: projs.map(p => p._id) };
  }

  const logs = await TimeLog.find(logFilter);
  const totalHoursLogged = logs.reduce((acc, l) => acc + l.duration, 0);
  const totalBillableHours = logs.filter(l => l.isBillable).reduce((acc, l) => acc + l.duration, 0);

  // Project Breakdown
  const projectQuery = projectId ? { _id: projectId } : (clientId ? { client: clientId } : { deletedAt: null });
  const activeProjects = await Project.find(projectQuery);
  const projectSummary = [];
  for (const proj of activeProjects) {
    const projIssuesCount = await Issue.countDocuments({ project: proj._id, createdAt: { $gte: start, $lte: end }, deletedAt: null });
    const projResolved = await Issue.find({
      project: proj._id,
      status: { $in: ['Resolved', 'Closed'] },
      updatedAt: { $gte: start, $lte: end },
      deletedAt: null
    });
    const projWithinSla = projResolved.filter(i => i.updatedAt <= i.dueDate).length;
    const projSlaRate = projResolved.length > 0 ? parseFloat(((projWithinSla / projResolved.length) * 100).toFixed(1)) : 100;

    const projLogs = logs.filter(l => l.project.toString() === proj._id.toString());
    const hoursUsed = projLogs.reduce((acc, l) => acc + l.duration, 0);

    projectSummary.push({
      project: proj.name,
      issues: projIssuesCount,
      resolved: projResolved.length,
      hoursUsed: parseFloat(hoursUsed.toFixed(1)),
      allocated: proj.allocatedHours,
      slaRate: projSlaRate
    });
  }

  // Key issues
  const topIssues = resolvedList.slice(0, 10).map(issue => {
    const resolvedInHrs = (issue.updatedAt - issue.createdAt) / (1000 * 60 * 60);
    return {
      issueId: issue.issueId,
      title: issue.title,
      priority: issue.priority,
      resolvedIn: `${parseFloat(resolvedInHrs.toFixed(1))}h`
    };
  });

  const changeRequests = await getCrSummary(start, end, projectId, clientId);
  const tasks = await getTaskSummary(start, end, projectId, clientId);
  const finance = await getFinanceSummary(start, end, projectId, clientId);

  return {
    period: { startDate, endDate },
    filters: { projectId: projectId || 'all', clientId: clientId || 'all' },
    summary: {
      totalIssues,
      resolvedIssues,
      slaComplianceRate,
      avgResolutionHours,
      totalHoursLogged: parseFloat(totalHoursLogged.toFixed(1)),
      totalBillableHours: parseFloat(totalBillableHours.toFixed(1)),
    },
    projectSummary,
    topIssues,
    changeRequests,
    tasks,
    finance,
  };
};

/**
 * Build KPI analytics time-series data
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity - 'day' | 'week' | 'month'
 * @returns {Promise<Object>}
 */
const buildKpiData = async (startDate, endDate, granularity = 'day') => {
  const start = moment(startDate).startOf('day');
  const end = moment(endDate).endOf('day');
  const points = [];
  const current = moment(start);
  let index = 0;

  let totalWithinSlaGlobal = 0;
  let totalResolvedGlobal = 0;
  let totalResolutionTimeGlobal = 0;

  let totalNewCrs = 0;
  let totalCompletedCrs = 0;
  let totalNewTasks = 0;
  let totalCompletedTasks = 0;
  let totalBilledRevenue = 0;
  let totalReceivedRevenue = 0;

  while (current <= end) {
    let bucketStart, bucketEnd;
    if (granularity === 'day') {
      bucketStart = moment(current).startOf('day').toDate();
      bucketEnd = moment(current).endOf('day').toDate();
      current.add(1, 'day');
    } else if (granularity === 'week') {
      bucketStart = moment(current).startOf('week').toDate();
      bucketEnd = moment(current).endOf('week').toDate();
      current.add(1, 'week');
    } else {
      bucketStart = moment(current).startOf('month').toDate();
      bucketEnd = moment(current).endOf('month').toDate();
      current.add(1, 'month');
    }

    const issuesNew = await Issue.countDocuments({ createdAt: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    const resolved = await Issue.find({ status: { $in: ['Resolved', 'Closed'] }, updatedAt: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    const issuesResolved = resolved.length;

    const withinSla = resolved.filter(i => i.updatedAt <= i.dueDate).length;
    const slaComplianceRate = resolved.length > 0 ? parseFloat(((withinSla / resolved.length) * 100).toFixed(1)) : 100;

    const totalTime = resolved.reduce((acc, i) => acc + (i.updatedAt - i.createdAt) / (1000 * 60 * 60), 0);
    const resolutionTimeAvg = resolved.length > 0 ? parseFloat((totalTime / resolved.length).toFixed(1)) : 0;

    const periodLogs = await TimeLog.find({ startTime: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    const velocityAvg = periodLogs.length > 0 ? parseFloat((periodLogs.reduce((acc, l) => acc + l.duration, 0) / periodLogs.length).toFixed(1)) : 0;

    totalWithinSlaGlobal += withinSla;
    totalResolvedGlobal += issuesResolved;
    totalResolutionTimeGlobal += totalTime;

    // CRs trends
    const crsNew = await ChangeRequest.countDocuments({ createdAt: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    const crsCompleted = await ChangeRequest.countDocuments({ status: { $in: ['Completed', 'Closed'] }, updatedAt: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    totalNewCrs += crsNew;
    totalCompletedCrs += crsCompleted;

    // Tasks trends
    const tasksNew = await Task.countDocuments({ createdAt: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    const tasksCompleted = await Task.countDocuments({ status: 'Done', updatedAt: { $gte: bucketStart, $lte: bucketEnd }, deletedAt: null });
    totalNewTasks += tasksNew;
    totalCompletedTasks += tasksCompleted;

    // Finance trends
    const payments = await Payment.find({
      deletedAt: null,
      $or: [
        { paymentDate: { $gte: bucketStart, $lte: bucketEnd } },
        { dueDate: { $gte: bucketStart, $lte: bucketEnd } },
        { createdAt: { $gte: bucketStart, $lte: bucketEnd } }
      ]
    });
    const revenueBilled = payments.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const revenueReceived = payments
      .filter(p => p.paymentStatus === 'Paid')
      .reduce((s, p) => s + (p.totalAmount || 0), 0) +
      payments
      .filter(p => p.paymentStatus === 'Partially Paid')
      .reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);

    totalBilledRevenue += revenueBilled;
    totalReceivedRevenue += revenueReceived;

    points.push({
      date: moment(bucketStart).format('YYYY-MM-DD'),
      resolutionTimeAvg,
      slaComplianceRate,
      issuesNew,
      issuesResolved,
      velocityAvg,
      crsNew,
      crsCompleted,
      tasksNew,
      tasksCompleted,
      revenueBilled: parseFloat(revenueBilled.toFixed(2)),
      revenueReceived: parseFloat(revenueReceived.toFixed(2))
    });

    index++;
    if (index > 90) break; // safety cap
  }

  // Calculate aggregates
  const totalNewIssues = points.reduce((s, p) => s + p.issuesNew, 0);
  const totalResolvedIssues = totalResolvedGlobal;
  const avgResolutionTime = totalResolvedGlobal > 0 ? parseFloat((totalResolutionTimeGlobal / totalResolvedGlobal).toFixed(1)) : 0;
  const avgSlaRate = totalResolvedGlobal > 0 ? parseFloat(((totalWithinSlaGlobal / totalResolvedGlobal) * 100).toFixed(1)) : 100;

  return {
    granularity,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    dataPoints: points,
    aggregates: {
      avgResolutionTime,
      avgSlaRate,
      totalNewIssues,
      totalResolvedIssues,
      totalNewCrs,
      totalCompletedCrs,
      totalNewTasks,
      totalCompletedTasks,
      totalBilledRevenue: parseFloat(totalBilledRevenue.toFixed(2)),
      totalReceivedRevenue: parseFloat(totalReceivedRevenue.toFixed(2))
    },
  };
};

/**
 * Build utilization report data
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} [projectId]
 * @returns {Promise<Object>}
 */
const buildUtilizationData = async (startDate, endDate, projectId) => {
  const start = moment(startDate).startOf('day').toDate();
  const end = moment(endDate).endOf('day').toDate();

  const filter = {
    startTime: { $gte: start, $lte: end },
    deletedAt: null
  };
  if (projectId && projectId !== 'all') {
    filter.project = projectId;
  }

  const logs = await TimeLog.find(filter).populate('project user');

  const userLogs = {};
  for (const log of logs) {
    if (!log.user || !log.project) continue;
    const userId = log.user._id.toString();
    if (!userLogs[userId]) {
      userLogs[userId] = {
        name: log.user.name,
        totalHours: 0,
        billableHours: 0,
        projects: {}
      };
    }
    userLogs[userId].totalHours += log.duration;
    if (log.isBillable) userLogs[userId].billableHours += log.duration;

    const projId = log.project._id.toString();
    if (!userLogs[userId].projects[projId]) {
      userLogs[userId].projects[projId] = {
        project: log.project.name,
        hours: 0,
        allocated: log.project.allocatedHours
      };
    }
    userLogs[userId].projects[projId].hours += log.duration;
  }

  const memberBreakdown = Object.values(userLogs).map(userObj => {
    const projectsList = Object.values(userObj.projects).map(p => ({
      project: p.project,
      hours: parseFloat(p.hours.toFixed(1)),
      allocated: p.allocated
    }));
    const utilizationRate = userObj.totalHours > 0 ? parseFloat(((userObj.billableHours / userObj.totalHours) * 100).toFixed(1)) : 100;
    return {
      name: userObj.name,
      totalHours: parseFloat(userObj.totalHours.toFixed(1)),
      billableHours: parseFloat(userObj.billableHours.toFixed(1)),
      utilizationRate,
      projects: projectsList
    };
  });

  const projectLogs = {};
  for (const log of logs) {
    if (!log.user || !log.project) continue;
    const projId = log.project._id.toString();
    if (!projectLogs[projId]) {
      projectLogs[projId] = {
        projectId: projId,
        project: log.project.name,
        totalAllocated: log.project.allocatedHours,
        totalUsed: 0
      };
    }
    projectLogs[projId].totalUsed += log.duration;
  }

  const projectSummary = Object.values(projectLogs).map(p => {
    const utilization = p.totalAllocated > 0 ? parseFloat(((p.totalUsed / p.totalAllocated) * 100).toFixed(1)) : 100;
    return {
      project: p.project,
      totalAllocated: p.totalAllocated,
      totalUsed: parseFloat(p.totalUsed.toFixed(1)),
      utilization
    };
  });

  // 1. Developer Workload Comparison (Active Issues vs Active Tasks)
  const activeIssues = await Issue.find({
    status: { $nin: ['Resolved', 'Closed'] },
    assignedTo: { $ne: null },
    deletedAt: null
  });
  const activeTasks = await Task.find({
    status: { $ne: 'Done' },
    assignees: { $exists: true, $ne: [] },
    deletedAt: null
  });

  const developerWorkloadCompare = [];
  const users = await User.find({ role: { $in: ['engineer', 'senior_engineer'] }, deletedAt: null });
  for (const u of users) {
    const issuesCount = activeIssues.filter(i => i.assignedTo.toString() === u._id.toString()).length;
    const tasksCount = activeTasks.filter(t => t.assignees.some(a => a.toString() === u._id.toString())).length;
    developerWorkloadCompare.push({
      name: u.name,
      activeIssues: issuesCount,
      activeTasks: tasksCount
    });
  }

  // 2. Change Request Hours Breakdown (Project actual vs estimated hours)
  const crQuery = { deletedAt: null };
  if (projectId && projectId !== 'all') {
    crQuery.project = projectId;
  }
  const crs = await ChangeRequest.find(crQuery).populate('project');
  const crHoursMap = {};
  crs.forEach(c => {
    const projName = c.project ? c.project.name : 'Unknown';
    if (!crHoursMap[projName]) {
      crHoursMap[projName] = { project: projName, estimatedHours: 0, actualHours: 0 };
    }
    crHoursMap[projName].estimatedHours += c.estimatedHours || 0;
    crHoursMap[projName].actualHours += c.actualHours || 0;
  });
  const crHoursBreakdown = Object.values(crHoursMap).map(c => ({
    project: c.project,
    estimatedHours: parseFloat(c.estimatedHours.toFixed(1)),
    actualHours: parseFloat(c.actualHours.toFixed(1))
  }));

  // 3. Financial Billing Efficiency
  const financialEfficiency = [];
  for (const p of Object.values(projectLogs)) {
    const payments = await Payment.find({ project: p.projectId, deletedAt: null });
    const totalBilled = payments.reduce((sum, pay) => sum + (pay.totalAmount || 0), 0);
    const totalReceived = payments
      .filter(pay => pay.paymentStatus === 'Paid')
      .reduce((sum, pay) => sum + (pay.totalAmount || 0), 0) +
      payments
      .filter(pay => pay.paymentStatus === 'Partially Paid')
      .reduce((sum, pay) => sum + (pay.partiallyPaidAmount || 0), 0);
    
    const hourlyRate = p.totalUsed > 0 ? parseFloat((totalBilled / p.totalUsed).toFixed(2)) : 0;
    financialEfficiency.push({
      project: p.project,
      totalBilled: parseFloat(totalBilled.toFixed(2)),
      totalReceived: parseFloat(totalReceived.toFixed(2)),
      totalUsedHours: parseFloat(p.totalUsed.toFixed(1)),
      hourlyRate
    });
  }

  return {
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    projectFilter: projectId || 'all',
    memberBreakdown,
    projectSummary,
    developerWorkloadCompare,
    crHoursBreakdown,
    financialEfficiency
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

  const data = await buildDailyData(startOfDay);

  let report = await Report.findOne({
    type: 'daily',
    periodStart: startOfDay,
    periodEnd: endOfDay,
    deletedAt: null,
  });

  if (report) {
    report.data = data;
    report.generatedBy = userId;
    report.generationMode = userId ? 'manual' : 'automatic';
    report.status = 'completed';
    await report.save();
  } else {
    report = await Report.create({
      type: 'daily',
      periodStart: startOfDay,
      periodEnd: endOfDay,
      data,
      generatedBy: userId,
      generationMode: userId ? 'manual' : 'automatic',
      status: 'completed',
    });
  }

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

  const data = await buildWeeklyData(start);

  let report = await Report.findOne({
    type: 'weekly',
    periodStart: start,
    periodEnd: end,
    deletedAt: null,
  });

  if (report) {
    report.data = data;
    report.generatedBy = userId;
    report.generationMode = userId ? 'manual' : 'automatic';
    report.status = 'completed';
    await report.save();
  } else {
    report = await Report.create({
      type: 'weekly',
      periodStart: start,
      periodEnd: end,
      data,
      generatedBy: userId,
      generationMode: userId ? 'manual' : 'automatic',
      status: 'completed',
    });
  }

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
  const periodEnd = new Date(year, month, 0);

  const data = await buildMonthlyData(month, year);

  let report = await Report.findOne({
    type: 'monthly',
    periodStart,
    periodEnd,
    deletedAt: null,
  });

  if (report) {
    report.data = data;
    report.generatedBy = userId;
    report.generationMode = userId ? 'manual' : 'automatic';
    report.status = 'completed';
    await report.save();
  } else {
    report = await Report.create({
      type: 'monthly',
      periodStart,
      periodEnd,
      data,
      generatedBy: userId,
      generationMode: userId ? 'manual' : 'automatic',
      status: 'completed',
    });
  }

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
  const data = await buildExecutiveData(params);

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
 * @returns {Promise<Object>}
 */
const getKpiAnalytics = async (startDate, endDate, granularity = 'day') => {
  return buildKpiData(new Date(startDate), new Date(endDate), granularity);
};

/**
 * Get utilization report data (computed on-the-fly, not persisted)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} [projectId]
 * @returns {Promise<Object>}
 */
const getUtilizationReport = async (startDate, endDate, projectId) => {
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

  let report = await Report.findOne({
    type,
    periodStart: { $gte: periodStart },
    periodEnd: { $lte: new Date(periodEnd.getTime() + 86400000) },
    deletedAt: null,
    status: 'completed',
  }).sort({ createdAt: -1 });

  const isCurrentPeriod = (type === 'daily' && moment(periodStart).isSame(moment(), 'day')) ||
                          (type === 'weekly' && moment(periodStart).isSame(moment(), 'week'));

  if (!report || isCurrentPeriod) {
    if (type === 'daily') {
      report = await generateDailyReport(periodStart);
    } else if (type === 'weekly') {
      report = await generateWeeklyReport(periodStart);
    }
  }

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
