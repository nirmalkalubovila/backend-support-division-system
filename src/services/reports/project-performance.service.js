const moment = require('moment');
const { Issue, ChangeRequest, Task, Payment, TimeLog, Project, Setting } = require('../../models');

/**
 * Fetch and compute Section 1 Project Performance data
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
const getPerformanceData = async (startDate, endDate) => {
  const start = moment(startDate).startOf('day').toDate();
  const end = moment(endDate).endOf('day').toDate();
  const now = new Date();
  const rangeDays = moment(end).diff(moment(start), 'days') + 1;

  // 1. Fetch Setting: default contracted hourly rate
  const financeSetting = await Setting.findOne({ key: 'financeSettings' });
  const defaultHourlyRate = financeSetting && financeSetting.value && financeSetting.value.defaultContractedHourlyRate
    ? Number(financeSetting.value.defaultContractedHourlyRate)
    : 5000;

  // Helper to calculate project-specific contracted rate
  const getProjectHourlyRate = async (projectId) => {
    const payment = await Payment.findOne({
      project: projectId,
      paymentType: 'UOM Based',
      uom: 'Hour',
      deletedAt: null,
    });
    return payment && payment.pricePerUnit ? payment.pricePerUnit : defaultHourlyRate;
  };

  // Helper for P95 and Median
  const getPercentiles = (arr) => {
    if (arr.length === 0) return { p95: 0, median: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Idx] || sorted[sorted.length - 1];
    return { p95: parseFloat(p95.toFixed(2)), median: parseFloat(median.toFixed(2)) };
  };

  // Pre-load projects
  const activeProjects = await Project.find({ deletedAt: null }).populate('client');

  // ──────────────────────────────────────────────────────────────
  // 1.1 ISSUES ANALYTICS
  // ──────────────────────────────────────────────────────────────
  const issuesOpened = await Issue.find({ createdAt: { $gte: start, $lte: end }, deletedAt: null });
  const issuesResolved = await Issue.find({ status: 'Resolved', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const issuesClosed = await Issue.find({ status: 'Closed', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const issuesReopened = await Issue.find({ status: 'Reopened', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const issuesInProgress = await Issue.find({ status: 'In Progress', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const issuesOnHold = await Issue.find({ status: 'On Hold', updatedAt: { $gte: start, $lte: end }, deletedAt: null });

  // Counts by priority and type
  const countsByPriority = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const countsByType = {};
  const countsByProject = {};

  issuesOpened.forEach((issue) => {
    if (countsByPriority[issue.priority] !== undefined) {
      countsByPriority[issue.priority]++;
    }
    const typeStr = issue.type || 'Bug';
    countsByType[typeStr] = (countsByType[typeStr] || 0) + 1;
    const projId = issue.project.toString();
    countsByProject[projId] = (countsByProject[projId] || 0) + 1;
  });

  // Project count detail list
  const projectBreakdown = activeProjects.map((p) => {
    const projIdStr = p._id.toString();
    return {
      projectId: projIdStr,
      projectName: p.name,
      count: countsByProject[projIdStr] || 0,
    };
  });

  // SLA calculations (Resolved + Closed in range)
  const resolvedAndClosed = [...issuesResolved, ...issuesClosed];
  let withinSlaCount = 0;
  const slaBreachesByPriority = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let totalBreachDurationMs = 0;
  let breachCount = 0;

  // Resolution time helper array (hours)
  const resolutionTimes = [];

  resolvedAndClosed.forEach((issue) => {
    const resolutionTimeHours = (issue.updatedAt - issue.createdAt) / (1000 * 60 * 60);
    resolutionTimes.push(Math.max(0.1, resolutionTimeHours));

    if (issue.updatedAt <= issue.dueDate) {
      withinSlaCount++;
    } else {
      if (slaBreachesByPriority[issue.priority] !== undefined) {
        slaBreachesByPriority[issue.priority]++;
      }
      totalBreachDurationMs += (issue.updatedAt - issue.dueDate);
      breachCount++;
    }
  });

  const slaComplianceRate = resolvedAndClosed.length > 0
    ? parseFloat(((withinSlaCount / resolvedAndClosed.length) * 100).toFixed(1))
    : 100;

  const avgBreachDurationHours = breachCount > 0
    ? parseFloat((totalBreachDurationMs / breachCount / (1000 * 60 * 60)).toFixed(1))
    : 0;

  // Live At-Risk count: open issues past 75% SLA window
  const liveOpenIssues = await Issue.find({ status: { $nin: ['Resolved', 'Closed'] }, deletedAt: null });
  let liveAtRiskCount = 0;
  liveOpenIssues.forEach((issue) => {
    const totalSlaMs = issue.dueDate - issue.createdAt;
    const elapsedMs = now - issue.createdAt;
    if (totalSlaMs > 0 && elapsedMs / totalSlaMs > 0.75) {
      liveAtRiskCount++;
    }
  });

  // Resolution metrics
  const avgResolutionTime = resolutionTimes.length > 0
    ? parseFloat((resolutionTimes.reduce((s, x) => s + x, 0) / resolutionTimes.length).toFixed(1))
    : 0;

  const priorityResolutionTimes = { Critical: [], High: [], Medium: [], Low: [] };
  resolvedAndClosed.forEach((issue) => {
    const duration = (issue.updatedAt - issue.createdAt) / (1000 * 60 * 60);
    if (priorityResolutionTimes[issue.priority]) {
      priorityResolutionTimes[issue.priority].push(Math.max(0.1, duration));
    }
  });

  const avgResolutionTimeByPriority = {};
  Object.keys(priorityResolutionTimes).forEach((prio) => {
    const times = priorityResolutionTimes[prio];
    avgResolutionTimeByPriority[prio] = times.length > 0
      ? parseFloat((times.reduce((s, x) => s + x, 0) / times.length).toFixed(1))
      : 0;
  });

  const { p95: p95ResolutionTime, median: medianResolutionTime } = getPercentiles(resolutionTimes);
  const reopenRate = issuesClosed.length > 0
    ? parseFloat(((issuesReopened.length / issuesClosed.length) * 100).toFixed(1))
    : 0;

  // Issues Trend (unlocked at 8+ days)
  let issuesTrend = null;
  if (rangeDays >= 8) {
    const days = [];
    const curr = moment(start).clone();
    const endMoment = moment(end);

    const issuesCreatedByDay = {};
    const issuesResolvedByDay = {};

    issuesOpened.forEach((issue) => {
      const dayStr = moment(issue.createdAt).format('YYYY-MM-DD');
      issuesCreatedByDay[dayStr] = (issuesCreatedByDay[dayStr] || 0) + 1;
    });

    resolvedAndClosed.forEach((issue) => {
      const dayStr = moment(issue.updatedAt).format('YYYY-MM-DD');
      issuesResolvedByDay[dayStr] = (issuesResolvedByDay[dayStr] || 0) + 1;
    });

    while (curr <= endMoment) {
      const dStr = curr.format('YYYY-MM-DD');
      const newCount = issuesCreatedByDay[dStr] || 0;
      const resolvedCount = issuesResolvedByDay[dStr] || 0;
      days.push({
        date: dStr,
        new: newCount,
        resolved: resolvedCount,
        delta: newCount - resolvedCount,
      });
      curr.add(1, 'day');
    }
    issuesTrend = days;
  }

  // Issues Predictions (unlocked at 91+ days)
  let issuesPredictions = null;
  if (rangeDays >= 91) {
    const projectedNextMonthVolume = Math.round(30 * (issuesOpened.length / rangeDays));
    const projectedSlaRate = slaComplianceRate;

    // Anomaly detection: last 90-day baseline comparisons
    const ninetyDaysAgo = moment(start).subtract(90, 'days').toDate();
    const baselineIssues = await Issue.find({ createdAt: { $gte: ninetyDaysAgo, $lt: start }, deletedAt: null });
    const baselineCounts = {};
    baselineIssues.forEach((issue) => {
      const typeStr = issue.type || 'Bug';
      baselineCounts[typeStr] = (baselineCounts[typeStr] || 0) + 1;
    });

    const anomalies = [];
    Object.keys(countsByType).forEach((typeStr) => {
      const currentRate = countsByType[typeStr] / rangeDays;
      const baselineRate = (baselineCounts[typeStr] || 0) / 90;
      if (baselineRate > 0 && currentRate > 1.4 * baselineRate) {
        const pctIncrease = Math.round(((currentRate - baselineRate) / baselineRate) * 100);
        anomalies.push({
          type: typeStr,
          percentageIncrease: pctIncrease,
          message: `${typeStr} issues up ${pctIncrease}% vs 90-day baseline`,
        });
      }
    });

    issuesPredictions = {
      projectedNextMonthVolume,
      projectedSlaRate,
      anomalies,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 1.2 CHANGE REQUESTS (CRs) ANALYTICS
  // ──────────────────────────────────────────────────────────────
  const crsOpened = await ChangeRequest.find({ createdAt: { $gte: start, $lte: end }, deletedAt: null });
  const crsCompleted = await ChangeRequest.find({ status: 'Completed', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const crsInDevelopment = await ChangeRequest.find({ status: 'In Development', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const crsCancelled = await ChangeRequest.find({ status: 'Rejected', updatedAt: { $gte: start, $lte: end }, deletedAt: null });

  // Group counts by project
  const crCountsByProject = {};
  const crsInSelectedRange = await ChangeRequest.find({
    deletedAt: null,
    $or: [
      { createdAt: { $gte: start, $lte: end } },
      { updatedAt: { $gte: start, $lte: end } },
    ],
  });

  crsInSelectedRange.forEach((cr) => {
    const projId = cr.project.toString();
    crCountsByProject[projId] = (crCountsByProject[projId] || 0) + 1;
  });

  const crProjectBreakdown = activeProjects.map((p) => {
    const projIdStr = p._id.toString();
    return {
      projectId: projIdStr,
      projectName: p.name,
      count: crCountsByProject[projIdStr] || 0,
    };
  });

  // Estimations accuracy
  let totalEstimationAccuracy = 0;
  let compCrCount = 0;
  let underestimatedCount = 0;
  let totalUnderestimateDiff = 0;
  let overestimatedCount = 0;
  const projectCrAccuracy = {};

  const completedCrsInRange = await ChangeRequest.find({
    status: 'Completed',
    updatedAt: { $gte: start, $lte: end },
    deletedAt: null,
  });

  completedCrsInRange.forEach((cr) => {
    const est = cr.estimatedHours || 0;
    const act = cr.actualHours || 0;
    const projId = cr.project.toString();

    let accuracy = 100;
    if (est > 0) {
      accuracy = ((est - act) / est) * 100;
    }

    totalEstimationAccuracy += accuracy;
    compCrCount++;

    if (act > est) {
      underestimatedCount++;
      totalUnderestimateDiff += (act - est);
    } else if (act < est) {
      overestimatedCount++;
    }

    if (!projectCrAccuracy[projId]) {
      projectCrAccuracy[projId] = { totalAccuracy: 0, count: 0 };
    }
    projectCrAccuracy[projId].totalAccuracy += accuracy;
    projectCrAccuracy[projId].count++;
  });

  const avgEstimationAccuracy = compCrCount > 0
    ? parseFloat((totalEstimationAccuracy / compCrCount).toFixed(1))
    : 100;

  const crProjectAccuracyList = activeProjects.map((p) => {
    const projIdStr = p._id.toString();
    const data = projectCrAccuracy[projIdStr];
    return {
      projectId: projIdStr,
      projectName: p.name,
      accuracy: data && data.count > 0 ? parseFloat((data.totalAccuracy / data.count).toFixed(1)) : 100,
    };
  });

  const avgUnderestimatedDuration = underestimatedCount > 0
    ? parseFloat((totalUnderestimateDiff / underestimatedCount).toFixed(1))
    : 0;

  // Delivery metrics
  let totalCrCompletionHours = 0;
  let completedOnTimeCount = 0;
  completedCrsInRange.forEach((cr) => {
    totalCrCompletionHours += (cr.updatedAt - cr.createdAt) / (1000 * 60 * 60);
    if (!cr.targetReleaseDate || cr.updatedAt <= cr.targetReleaseDate) {
      completedOnTimeCount++;
    }
  });

  const avgCrCompletionTimeDays = completedCrsInRange.length > 0
    ? parseFloat((totalCrCompletionHours / completedCrsInRange.length / 24).toFixed(1))
    : 0;

  const crOnTimeDeliveryRate = completedCrsInRange.length > 0
    ? parseFloat(((completedOnTimeCount / completedCrsInRange.length) * 100).toFixed(1))
    : 100;

  // Overdue CRs (live count)
  const liveOpenCrs = await ChangeRequest.find({ status: { $nin: ['Completed', 'Closed'] }, deletedAt: null });
  const overdueCrCount = liveOpenCrs.filter((cr) => cr.targetReleaseDate && cr.targetReleaseDate < now).length;

  // Financial link
  const totalBilledHoursOnCrs = completedCrsInRange.reduce((s, cr) => s + (cr.actualHours || 0), 0);
  const totalRevenueFromCrs = completedCrsInRange.reduce((s, cr) => s + (cr.estimatedCost || 0), 0);
  const avgEffectiveHourlyRateOnCrs = totalBilledHoursOnCrs > 0
    ? parseFloat((totalRevenueFromCrs / totalBilledHoursOnCrs).toFixed(1))
    : 0;

  // CR Trend (unlocked at 8+ days)
  let crTrend = null;
  if (rangeDays >= 8) {
    const weeks = [];
    const totalWeeks = Math.ceil(rangeDays / 7);
    for (let w = 0; w < totalWeeks; w++) {
      const wStart = moment(start).add(w * 7, 'days').startOf('day').toDate();
      const wEnd = moment(start).add((w * 7) + 6, 'days').endOf('day').toDate();

      const newCrs = await ChangeRequest.countDocuments({ createdAt: { $gte: wStart, $lte: wEnd }, deletedAt: null });
      const completedCrs = await ChangeRequest.find({ status: 'Completed', updatedAt: { $gte: wStart, $lte: wEnd }, deletedAt: null });

      let sumAcc = 0;
      completedCrs.forEach((c) => {
        const est = c.estimatedHours || 0;
        const act = c.actualHours || 0;
        sumAcc += est > 0 ? ((est - act) / est) * 100 : 100;
      });

      weeks.push({
        label: `W${w + 1}`,
        new: newCrs,
        completed: completedCrs.length,
        accuracy: completedCrs.length > 0 ? parseFloat((sumAcc / completedCrs.length).toFixed(1)) : 100,
      });
    }
    crTrend = weeks;
  }

  // CR Predictions (unlocked at 91+ days)
  let crPredictions = null;
  if (rangeDays >= 91) {
    const projectedCrVolume = Math.round(30 * (crsOpened.length / rangeDays));
    let isTrendNegative = false;

    if (crTrend && crTrend.length >= 3) {
      const lastAcc = crTrend[crTrend.length - 1].accuracy;
      const priorAcc = crTrend[crTrend.length - 2].accuracy;
      const firstAcc = crTrend[crTrend.length - 3].accuracy;
      if (lastAcc < priorAcc && priorAcc < firstAcc) {
        isTrendNegative = true;
      }
    }

    crPredictions = {
      projectedCrVolume,
      calibrationFlag: isTrendNegative ? 'CR scoping may need calibration' : null,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 1.3 TASKS ANALYTICS
  // ──────────────────────────────────────────────────────────────
  const tasksCreated = await Task.find({ createdAt: { $gte: start, $lte: end }, deletedAt: null });
  const tasksCompleted = await Task.find({ status: 'Done', updatedAt: { $gte: start, $lte: end }, deletedAt: null });
  const tasksInProgress = await Task.find({ status: 'In Progress', updatedAt: { $gte: start, $lte: end }, deletedAt: null });

  // Overdue tasks (live count)
  const liveOpenTasks = await Task.find({ status: { $ne: 'Done' }, deletedAt: null });
  const overdueTasks = liveOpenTasks.filter((t) => t.endDate && t.endDate < now);
  const overdueTaskCount = overdueTasks.length;

  let totalDaysOverdue = 0;
  overdueTasks.forEach((t) => {
    totalDaysOverdue += moment(now).diff(moment(t.endDate), 'days');
  });
  const avgDaysOverdue = overdueTaskCount > 0
    ? parseFloat((totalDaysOverdue / overdueTaskCount).toFixed(1))
    : 0;

  // Breakdown by priority & project
  const tasksByPriority = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const tasksByProject = {};
  tasksCreated.forEach((t) => {
    if (tasksByPriority[t.priority] !== undefined) {
      tasksByPriority[t.priority]++;
    }
    const projId = t.project.toString();
    tasksByProject[projId] = (tasksByProject[projId] || 0) + 1;
  });

  const taskProjectBreakdown = activeProjects.map((p) => {
    const projIdStr = p._id.toString();
    return {
      projectId: projIdStr,
      projectName: p.name,
      count: tasksByProject[projIdStr] || 0,
    };
  });

  // Delivery metrics
  const taskCompletionRate = tasksCreated.length > 0
    ? parseFloat(((tasksCompleted.length / tasksCreated.length) * 100).toFixed(1))
    : 100;

  let totalTaskCompletionHours = 0;
  tasksCompleted.forEach((t) => {
    totalTaskCompletionHours += (t.updatedAt - t.createdAt) / (1000 * 60 * 60);
  });
  const avgTaskCompletionTimeHours = tasksCompleted.length > 0
    ? parseFloat((totalTaskCompletionHours / tasksCompleted.length).toFixed(1))
    : 0;

  // Task Trend (unlocked at 8+ days)
  let taskTrend = null;
  if (rangeDays >= 8) {
    const daysList = [];
    const curr = moment(start).clone();
    const endMoment = moment(end);

    const tasksCreatedByDay = {};
    const tasksDoneByDay = {};

    tasksCreated.forEach((t) => {
      const dStr = moment(t.createdAt).format('YYYY-MM-DD');
      tasksCreatedByDay[dStr] = (tasksCreatedByDay[dStr] || 0) + 1;
    });

    tasksCompleted.forEach((t) => {
      const dStr = moment(t.updatedAt).format('YYYY-MM-DD');
      tasksDoneByDay[dStr] = (tasksDoneByDay[dStr] || 0) + 1;
    });

    while (curr <= endMoment) {
      const dStr = curr.format('YYYY-MM-DD');
      const created = tasksCreatedByDay[dStr] || 0;
      const completed = tasksDoneByDay[dStr] || 0;
      const rate = created > 0 ? parseFloat(((completed / created) * 100).toFixed(1)) : 100;
      daysList.push({
        date: dStr,
        created,
        completed,
        rate,
      });
      curr.add(1, 'day');
    }
    taskTrend = daysList;
  }

  // ──────────────────────────────────────────────────────────────
  // 1.4 FINANCE ANALYTICS
  // ──────────────────────────────────────────────────────────────
  const paymentsInRange = await Payment.find({ createdAt: { $gte: start, $lte: end }, deletedAt: null });
  const totalBilled = paymentsInRange.reduce((s, p) => s + (p.totalAmount || 0), 0);

  // Billed, collected, outstanding
  const paymentsCollectedInRange = await Payment.find({
    paymentStatus: 'Paid',
    paymentDate: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const totalCollected = paymentsCollectedInRange.reduce((s, p) => s + (p.totalAmount || 0), 0);

  // Partially paid sum
  const partiallyPaidInRange = await Payment.find({
    paymentStatus: 'Partially Paid',
    paymentDate: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const totalPartiallyPaid = partiallyPaidInRange.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);

  const collected = totalCollected + totalPartiallyPaid;
  const outstanding = totalBilled - collected;
  const collectionRate = totalBilled > 0 ? parseFloat(((collected / totalBilled) * 100).toFixed(1)) : 100;

  // Project Hour details
  const timeLogsInRange = await TimeLog.find({ startTime: { $gte: start, $lte: end }, deletedAt: null });
  const projectFinanceDetails = [];

  for (const p of activeProjects) {
    const projIdStr = p._id.toString();
    const rate = await getProjectHourlyRate(projIdStr);

    const projLogs = timeLogsInRange.filter((log) => log.project.toString() === projIdStr);
    const loggedHours = projLogs.reduce((s, l) => s + l.duration, 0);

    const remainingHours = p.allocatedHours - loggedHours;
    const overrunHours = loggedHours > p.allocatedHours ? loggedHours - p.allocatedHours : 0;
    const overrunCost = overrunHours * rate;

    // Billed and collected for this specific project
    const projPayments = paymentsInRange.filter((pay) => pay.project.toString() === projIdStr);
    const projBilled = projPayments.reduce((s, pay) => s + (pay.totalAmount || 0), 0);

    const effectiveHourlyRate = loggedHours > 0
      ? parseFloat((projBilled / loggedHours).toFixed(1))
      : 0;

    projectFinanceDetails.push({
      projectId: projIdStr,
      projectName: p.name,
      allocatedHours: p.allocatedHours,
      usedHours: parseFloat(loggedHours.toFixed(1)),
      remainingHours: parseFloat(remainingHours.toFixed(1)),
      overrunHours: parseFloat(overrunHours.toFixed(1)),
      overrunCost: parseFloat(overrunCost.toFixed(1)),
      overrunFlag: overrunHours > 0,
      effectiveHourlyRate,
    });
  }

  // Finance Trend (8+ days)
  let financeTrend = null;
  let projectBurnRate = null;
  if (rangeDays >= 8) {
    // Weekly billed vs collected
    const fWeeks = [];
    const totalWeeks = Math.ceil(rangeDays / 7);
    for (let w = 0; w < totalWeeks; w++) {
      const wStart = moment(start).add(w * 7, 'days').startOf('day').toDate();
      const wEnd = moment(start).add((w * 7) + 6, 'days').endOf('day').toDate();

      const bills = await Payment.find({ createdAt: { $gte: wStart, $lte: wEnd }, deletedAt: null });
      const collections = await Payment.find({ paymentStatus: 'Paid', paymentDate: { $gte: wStart, $lte: wEnd }, deletedAt: null });
      const parts = await Payment.find({ paymentStatus: 'Partially Paid', paymentDate: { $gte: wStart, $lte: wEnd }, deletedAt: null });

      const wBilled = bills.reduce((s, p) => s + (p.totalAmount || 0), 0);
      const wCollected = collections.reduce((s, p) => s + (p.totalAmount || 0), 0) + parts.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);

      fWeeks.push({
        label: `W${w + 1}`,
        billed: wBilled,
        collected: wCollected,
      });
    }
    financeTrend = fWeeks;

    // Burn rate chart: weekly hours consumed vs weekly average needed
    const projBurn = [];
    activeProjects.forEach((p) => {
      const projIdStr = p._id.toString();
      const projLogs = timeLogsInRange.filter((log) => log.project.toString() === projIdStr);
      const loggedHours = projLogs.reduce((s, l) => s + l.duration, 0);

      const weeklyBurn = loggedHours / totalWeeks;
      const weeklyAllocatedNeeded = p.allocatedHours > 0 ? p.allocatedHours / totalWeeks : 0;
      projBurn.push({
        projectName: p.name,
        weeklyBurn: parseFloat(weeklyBurn.toFixed(1)),
        weeklyNeeded: parseFloat(weeklyAllocatedNeeded.toFixed(1)),
      });
    });
    projectBurnRate = projBurn;
  }

  // Finance Predictions (91+ days)
  let financePredictions = null;
  if (rangeDays >= 91) {
    const projectedOverrunProjectsNextMonth = [];

    projectFinanceDetails.forEach((d) => {
      const currentBurnRatePerDay = d.usedHours / rangeDays;
      const projectedMonthHours = d.usedHours + (currentBurnRatePerDay * 30);
      if (projectedMonthHours > d.allocatedHours && !d.overrunFlag) {
        projectedOverrunProjectsNextMonth.push(d.projectName);
      }
    });

    const projectedRevenue = totalBilled > 0
      ? Math.round((totalBilled / rangeDays) * 30)
      : 0;

    const projectedOutstanding = outstanding > 0
      ? Math.round((outstanding / rangeDays) * 30)
      : 0;

    financePredictions = {
      projectedOverruns: projectedOverrunProjectsNextMonth,
      projectedRevenue,
      projectedOutstanding,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 1.5 PROJECT HEALTH SUMMARY (COMPOSITE VIEW)
  // ──────────────────────────────────────────────────────────────
  const projectHealthSummary = [];

  for (const p of activeProjects) {
    const projIdStr = p._id.toString();
    const financeDetails = projectFinanceDetails.find((d) => d.projectId === projIdStr) || {
      allocatedHours: p.allocatedHours,
      usedHours: 0,
      remainingHours: p.allocatedHours,
      overrunHours: 0,
      overrunCost: 0,
      overrunFlag: false,
    };

    // Open issues count
    const openIssuesCount = await Issue.countDocuments({
      project: p._id,
      status: { $nin: ['Resolved', 'Closed'] },
      deletedAt: null,
    });

    // Project SLA hit rate
    const projResolved = await Issue.find({
      project: p._id,
      status: { $in: ['Resolved', 'Closed'] },
      updatedAt: { $gte: start, $lte: end },
      deletedAt: null,
    });
    const projWithinSla = projResolved.filter((i) => i.updatedAt <= i.dueDate).length;
    const projSlaRate = projResolved.length > 0
      ? parseFloat(((projWithinSla / projResolved.length) * 100).toFixed(1))
      : 100;

    // CR Estimation accuracy
    const projCrs = completedCrsInRange.filter((c) => c.project.toString() === projIdStr);
    let crTotalAcc = 0;
    projCrs.forEach((c) => {
      const est = c.estimatedHours || 0;
      const act = c.actualHours || 0;
      crTotalAcc += est > 0 ? ((est - act) / est) * 100 : 100;
    });
    const projCrAccuracy = projCrs.length > 0
      ? parseFloat((crTotalAcc / projCrs.length).toFixed(1))
      : 100;

    // Project payments billed, collected, outstanding
    const projPaymentsAll = await Payment.find({ project: p._id, deletedAt: null });
    const projBilled = projPaymentsAll.reduce((s, pay) => s + (pay.totalAmount || 0), 0);
    const projCollected = projPaymentsAll
      .filter((pay) => pay.paymentStatus === 'Paid')
      .reduce((s, pay) => s + (pay.totalAmount || 0), 0) +
      projPaymentsAll
      .filter((pay) => pay.paymentStatus === 'Partially Paid')
      .reduce((s, pay) => s + (pay.partiallyPaidAmount || 0), 0);
    const projOutstanding = projBilled - projCollected;

    // Live overdue invoices check for health
    const overdueInvoices30Days = await Payment.findOne({
      project: p._id,
      paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] },
      dueDate: { $lt: moment().subtract(30, 'days').toDate() },
      deletedAt: null,
    });
    const overdueInvoices60Days = await Payment.findOne({
      project: p._id,
      paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] },
      dueDate: { $lt: moment().subtract(60, 'days').toDate() },
      deletedAt: null,
    });

    // Health logic
    // Green (Healthy): SLA >= 95%, hours <= 85% of allocation, no overdue invoices >30 days
    // Amber (At Risk): any one metric outside target
    // Red (Critical): SLA < 85%, or hours overrun, or invoice outstanding >60 days, or 2+ metrics amber
    const hourUsageRatio = p.allocatedHours > 0 ? (financeDetails.usedHours / p.allocatedHours) : 0;
    const isSlaAmber = projSlaRate < 95 && projSlaRate >= 85;
    const isSlaRed = projSlaRate < 85;
    const isHoursAmber = hourUsageRatio > 0.85 && hourUsageRatio <= 1.0;
    const isHoursRed = hourUsageRatio > 1.0;
    const isInvoiceAmber = !!overdueInvoices30Days;
    const isInvoiceRed = !!overdueInvoices60Days;

    let healthStatus = 'Green';
    let amberCount = 0;

    if (isSlaRed || isHoursRed || isInvoiceRed) {
      healthStatus = 'Red';
    } else {
      if (isSlaAmber) amberCount++;
      if (isHoursAmber) amberCount++;
      if (isInvoiceAmber) amberCount++;

      if (amberCount >= 2) {
        healthStatus = 'Red';
      } else if (amberCount === 1) {
        healthStatus = 'Amber';
      }
    }

    projectHealthSummary.push({
      projectName: p.name,
      contractType: p.contractType || 'Fixed',
      openIssues: openIssuesCount,
      slaRate: projSlaRate,
      hoursUsed: financeDetails.usedHours,
      hoursAllocated: p.allocatedHours,
      crAccuracy: projCrAccuracy,
      billed: parseFloat(projBilled.toFixed(1)),
      collected: parseFloat(projCollected.toFixed(1)),
      outstanding: parseFloat(projOutstanding.toFixed(1)),
      healthStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────
  // OUTPUT JSON
  // ──────────────────────────────────────────────────────────────
  return {
    period: { startDate, endDate },
    rangeDays,
    issues: {
      summary: {
        opened: issuesOpened.length,
        resolved: issuesResolved.length,
        closed: issuesClosed.length,
        reopened: issuesReopened.length,
        inProgress: issuesInProgress.length,
        onHold: issuesOnHold.length,
      },
      priorityBreakdown: countsByPriority,
      typeBreakdown: countsByType,
      projectBreakdown,
      slaMetrics: {
        complianceRate: slaComplianceRate,
        breachCountByPriority: slaBreachesByPriority,
        averageBreachDurationHours: avgBreachDurationHours,
        liveAtRiskCount,
      },
      resolutionMetrics: {
        averageResolutionTimeHours: avgResolutionTime,
        averageResolutionTimeByPriority: avgResolutionTimeByPriority,
        p95ResolutionTimeHours: p95ResolutionTime,
        medianResolutionTimeHours: medianResolutionTime,
        reopenRate,
      },
      trend: issuesTrend,
      predictions: issuesPredictions,
    },
    crs: {
      summary: {
        new: crsOpened.length,
        completed: crsCompleted.length,
        inProgress: crsInDevelopment.length,
        cancelled: crsCancelled.length,
      },
      projectBreakdown: crProjectBreakdown,
      accuracyMetrics: {
        averageAccuracy: avgEstimationAccuracy,
        projectAccuracy: crProjectAccuracyList,
        underestimatedCount,
        averageUnderestimatedHours: avgUnderestimatedDuration,
        overestimatedCount,
      },
      deliveryMetrics: {
        averageCompletionTimeDays: avgCrCompletionTimeDays,
        onTimeDeliveryRate: crOnTimeDeliveryRate,
        liveOverdueCount: overdueCrCount,
      },
      financials: {
        totalBilledHours: totalBilledHoursOnCrs,
        totalRevenue: totalRevenueFromCrs,
        effectiveHourlyRate: avgEffectiveHourlyRateOnCrs,
      },
      trend: crTrend,
      predictions: crPredictions,
    },
    tasks: {
      summary: {
        created: tasksCreated.length,
        completed: tasksCompleted.length,
        inProgress: tasksInProgress.length,
        liveOverdueCount: overdueTaskCount,
      },
      projectBreakdown: taskProjectBreakdown,
      priorityBreakdown: tasksByPriority,
      deliveryMetrics: {
        completionRate: taskCompletionRate,
        averageCompletionTimeHours: avgTaskCompletionTimeHours,
        liveAverageDaysOverdue: avgDaysOverdue,
      },
      trend: taskTrend,
    },
    finance: {
      summary: {
        billed: parseFloat(totalBilled.toFixed(1)),
        collected: parseFloat(collected.toFixed(1)),
        outstanding: parseFloat(outstanding.toFixed(1)),
        collectionRate,
      },
      projectDetails: projectFinanceDetails,
      trend: financeTrend,
      projectBurnRate,
      predictions: financePredictions,
    },
    projectHealthSummary,
  };
};

module.exports = {
  getPerformanceData,
};
