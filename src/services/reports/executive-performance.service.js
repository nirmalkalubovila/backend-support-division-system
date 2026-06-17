const moment = require('moment');
const { User, TimeLog, Issue, ChangeRequest, Task, Setting, Payment, Project, Client } = require('../../models');

/**
 * Helper to calculate project contracted hourly rate
 */
const getProjectHourlyRate = async (projectId, defaultRate) => {
  const payment = await Payment.findOne({
    project: projectId,
    paymentType: 'UOM Based',
    uom: 'Hour',
    deletedAt: null,
  });
  return payment && payment.pricePerUnit ? payment.pricePerUnit : defaultRate;
};

/**
 * Fetch and compute Section 3 Executive View data
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<Object>}
 */
const getExecutivePerformanceData = async (startDate, endDate) => {
  const start = moment(startDate).startOf('day').toDate();
  const end = moment(endDate).endOf('day').toDate();
  const rangeDays = moment(end).diff(moment(start), 'days') + 1;
  const now = new Date();

  // Prior period range
  const priorStart = moment(start).subtract(rangeDays, 'days').toDate();
  const priorEnd = moment(start).subtract(1, 'days').endOf('day').toDate();

  // Fetch Settings: default contracted hourly rate
  const financeSetting = await Setting.findOne({ key: 'financeSettings' });
  const defaultHourlyRate = financeSetting && financeSetting.value && financeSetting.value.defaultContractedHourlyRate
    ? Number(financeSetting.value.defaultContractedHourlyRate)
    : 5000;

  // Pre-load active projects and clients
  const activeProjects = await Project.find({ deletedAt: null }).populate('client');
  const activeClients = await Client.find({ deletedAt: null });

  // Get active headcount
  const headcount = await User.countDocuments({
    role: { $in: ['engineer', 'senior_engineer'] },
    isActive: true,
    deletedAt: null,
  });

  // Standard monthly capacity (160h per engineer)
  const monthlyCapacity = headcount * 160;

  // Capacity scaled to the selected range (160 hours per 30 days)
  const rangeCapacity = headcount * (160 * (rangeDays / 30));

  // Pre-load time logs in range
  const timeLogs = await TimeLog.find({
    startTime: { $gte: start, $lte: end },
    deletedAt: null,
  });

  // Calculate dynamic used hours per project inside the range
  const projectUsedHoursMap = {};
  for (const p of activeProjects) {
    const projLogs = timeLogs.filter(l => l.project && l.project.toString() === p._id.toString());
    projectUsedHoursMap[p._id.toString()] = projLogs.reduce((s, l) => s + (l.duration || 0), 0);
  }

  // Pre-load time logs in prior range for trend comparison
  const priorTimeLogs = await TimeLog.find({
    startTime: { $gte: priorStart, $lte: priorEnd },
    deletedAt: null,
  });

  // Calculate dynamic prior used hours per project inside the prior range
  const projectPriorUsedHoursMap = {};
  for (const p of activeProjects) {
    const projLogs = priorTimeLogs.filter(l => l.project && l.project.toString() === p._id.toString());
    projectPriorUsedHoursMap[p._id.toString()] = projLogs.reduce((s, l) => s + (l.duration || 0), 0);
  }

  // ──────────────────────────────────────────────────────────────
  // 3.1 — BUSINESS HEALTH SCORECARD
  // ──────────────────────────────────────────────────────────────
  
  // 1. SLA Hit Rate
  const resolvedIssues = await Issue.find({
    status: { $in: ['Resolved', 'Closed'] },
    updatedAt: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const resolvedWithinSla = resolvedIssues.filter(i => !i.dueDate || i.updatedAt <= i.dueDate).length;
  const overallSlaRate = resolvedIssues.length > 0
    ? parseFloat(((resolvedWithinSla / resolvedIssues.length) * 100).toFixed(1))
    : 100;

  // 2. Active Projects & prior delta
  const activeProjectsCount = activeProjects.length;
  const priorProjectsCount = await Project.countDocuments({
    createdAt: { $lte: priorEnd },
    deletedAt: null,
  });
  const activeProjectsDelta = activeProjectsCount - priorProjectsCount;

  // 3. Revenue Billed
  const paymentsBilled = await Payment.find({
    createdAt: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const revenueBilled = paymentsBilled.reduce((s, p) => s + (p.totalAmount || 0), 0);

  // 4. Revenue Collected
  const paymentsCollected = await Payment.find({
    paymentStatus: 'Paid',
    paymentDate: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const paymentsPartiallyPaid = await Payment.find({
    paymentStatus: 'Partially Paid',
    paymentDate: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const revenueCollected = paymentsCollected.reduce((s, p) => s + (p.totalAmount || 0), 0) +
                           paymentsPartiallyPaid.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);
  const outstandingBalance = revenueBilled - revenueCollected;

  // 5. Projects Overrun
  const projectsOverrunCount = activeProjects.filter(p => {
    const usedHours = projectUsedHoursMap[p._id.toString()] || 0;
    return usedHours > p.allocatedHours;
  }).length;
  const projectsOverrunStr = `${projectsOverrunCount} of ${activeProjectsCount} projects`;

  // 6. Team Utilization
  const totalHoursLogged = timeLogs.reduce((s, l) => s + (l.duration || 0), 0);
  const totalBillableHours = timeLogs.filter(l => l.isBillable).reduce((s, l) => s + (l.duration || 0), 0);
  const teamUtilization = totalHoursLogged > 0
    ? parseFloat(((totalBillableHours / totalHoursLogged) * 100).toFixed(1))
    : 100;

  // 7. Total Issues
  const totalIssuesCount = await Issue.countDocuments({
    createdAt: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const issuesResolvedCount = resolvedIssues.length;
  const issuesResolvedPct = totalIssuesCount > 0
    ? parseFloat(((issuesResolvedCount / totalIssuesCount) * 100).toFixed(1))
    : 0;

  // 8. Collection Rate
  const collectionRate = revenueBilled > 0
    ? parseFloat(((revenueCollected / revenueBilled) * 100).toFixed(1))
    : 100;

  const scorecard = {
    overallSlaRate,
    activeProjectsCount,
    activeProjectsDelta,
    revenueBilled,
    revenueCollected,
    outstandingBalance,
    projectsOverrunStr,
    teamUtilization,
    totalIssuesCount,
    issuesResolvedPct,
    collectionRate,
  };

  // ──────────────────────────────────────────────────────────────
  // 3.2 — CLIENT HEALTH MATRIX
  // ──────────────────────────────────────────────────────────────
  const clientHealthMatrix = [];

  for (const client of activeClients) {
    const clientProjects = activeProjects.filter(p => p.client && p.client._id.toString() === client._id.toString());
    const projIds = clientProjects.map(p => p._id);

    // SLA Hit Rate
    const clientResolved = await Issue.find({
      client: client._id,
      status: { $in: ['Resolved', 'Closed'] },
      updatedAt: { $gte: start, $lte: end },
      deletedAt: null,
    });
    const clientWithinSla = clientResolved.filter(i => !i.dueDate || i.updatedAt <= i.dueDate).length;
    const clientSlaRate = clientResolved.length > 0
      ? parseFloat(((clientWithinSla / clientResolved.length) * 100).toFixed(1))
      : 100;

    // SLA prior hit rate for trend
    const clientResolvedPrior = await Issue.find({
      client: client._id,
      status: { $in: ['Resolved', 'Closed'] },
      updatedAt: { $gte: priorStart, $lte: priorEnd },
      deletedAt: null,
    });
    const clientWithinSlaPrior = clientResolvedPrior.filter(i => !i.dueDate || i.updatedAt <= i.dueDate).length;
    const clientSlaRatePrior = clientResolvedPrior.length > 0
      ? parseFloat(((clientWithinSlaPrior / clientResolvedPrior.length) * 100).toFixed(1))
      : 100;


    // Issues handled count
    const issuesHandled = await Issue.countDocuments({
      client: client._id,
      createdAt: { $gte: start, $lte: end },
      deletedAt: null,
    });

    // Hours
    const allocated = clientProjects.reduce((s, p) => s + (p.allocatedHours || 0), 0);
    const used = clientProjects.reduce((s, p) => s + (projectUsedHoursMap[p._id.toString()] || 0), 0);
    const usedPrior = clientProjects.reduce((s, p) => s + (projectPriorUsedHoursMap[p._id.toString()] || 0), 0);

    // Financials
    const clientPayments = await Payment.find({ project: { $in: projIds }, createdAt: { $gte: start, $lte: end }, deletedAt: null });
    const clientBilled = clientPayments.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const clientPaymentsPaid = await Payment.find({ project: { $in: projIds }, paymentStatus: 'Paid', paymentDate: { $gte: start, $lte: end }, deletedAt: null });
    const clientPaymentsPartial = await Payment.find({ project: { $in: projIds }, paymentStatus: 'Partially Paid', paymentDate: { $gte: start, $lte: end }, deletedAt: null });
    const clientCollected = clientPaymentsPaid.reduce((s, p) => s + (p.totalAmount || 0), 0) +
                              clientPaymentsPartial.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);
    const clientOutstanding = clientBilled - clientCollected;

    // Overdue check
    const overdue30 = await Payment.findOne({
      project: { $in: projIds },
      paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] },
      dueDate: { $lt: moment().subtract(30, 'days').toDate() },
      deletedAt: null,
    });
    const overdue60 = await Payment.findOne({
      project: { $in: projIds },
      paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] },
      dueDate: { $lt: moment().subtract(60, 'days').toDate() },
      deletedAt: null,
    });

    // Health logic
    const ratio = allocated > 0 ? (used / allocated) : 0;
    const ratioPrior = allocated > 0 ? (usedPrior / allocated) : 0;
    const isSlaAmber = clientSlaRate < 95 && clientSlaRate >= 85;
    const isSlaRed = clientSlaRate < 85;
    const isHoursAmber = ratio > 0.85 && ratio <= 1.0;
    const isHoursRed = ratio > 1.0;
    const isInvoiceAmber = !!overdue30;
    const isInvoiceRed = !!overdue60;

    let health = 'Green';
    if (isSlaRed || isHoursRed || isInvoiceRed) {
      health = 'Red';
    } else if (isSlaAmber || isHoursAmber || isInvoiceAmber) {
      health = 'Amber';
    }

    // Determine representative contract type
    let contractType = 'Fixed';
    if (clientProjects.length > 0) {
      contractType = clientProjects[0].contractType || 'Fixed';
    }

    let trend = 'flat';
    if (clientSlaRate > clientSlaRatePrior) {
      trend = 'up';
    } else if (clientSlaRate < clientSlaRatePrior) {
      trend = 'down';
    } else {
      // SLA rate is equal, compare hours burn ratio (lower ratio is better)
      if (ratio < ratioPrior) {
        trend = 'up';
      } else if (ratio > ratioPrior) {
        trend = 'down';
      }
    }

    clientHealthMatrix.push({
      clientName: client.name,
      contractType,
      slaRate: clientSlaRate,
      issuesHandled,
      hoursUsed: parseFloat(used.toFixed(1)),
      hoursAllocated: parseFloat(allocated.toFixed(1)),
      billed: parseFloat(clientBilled.toFixed(1)),
      outstanding: parseFloat(clientOutstanding.toFixed(1)),
      trend,
      health,
    });
  }

  // ──────────────────────────────────────────────────────────────
  // 3.3 — FINANCIAL SUMMARY
  // ──────────────────────────────────────────────────────────────

  // YTD Billed & Collected
  const ytdStart = moment(end).startOf('year').toDate();
  const ytdBilledPayments = await Payment.find({ createdAt: { $gte: ytdStart, $lte: end }, deletedAt: null });
  const ytdPaidPayments = await Payment.find({ paymentStatus: 'Paid', paymentDate: { $gte: ytdStart, $lte: end }, deletedAt: null });
  const ytdPartialPayments = await Payment.find({ paymentStatus: 'Partially Paid', paymentDate: { $gte: ytdStart, $lte: end }, deletedAt: null });
  const ytdBilled = ytdBilledPayments.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const ytdCollected = ytdPaidPayments.reduce((s, p) => s + (p.totalAmount || 0), 0) +
                       ytdPartialPayments.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);

  // Outstanding per-client breakdown
  const outstandingPerClient = [];
  for (const client of activeClients) {
    const clientProjects = activeProjects.filter(p => p.client && p.client._id.toString() === client._id.toString());
    const projIds = clientProjects.map(p => p._id);
    const clientPaymentsAll = await Payment.find({ project: { $in: projIds }, deletedAt: null });
    const billedAll = clientPaymentsAll.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const collectedAll = clientPaymentsAll.filter(p => p.paymentStatus === 'Paid').reduce((s, p) => s + (p.totalAmount || 0), 0) +
                         clientPaymentsAll.filter(p => p.paymentStatus === 'Partially Paid').reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);
    const outstanding = billedAll - collectedAll;
    if (outstanding > 0) {
      outstandingPerClient.push({
        clientName: client.name,
        outstanding: parseFloat(outstanding.toFixed(1)),
      });
    }
  }
  outstandingPerClient.sort((a, b) => b.outstanding - a.outstanding);

  // Collection rate trend (last 6 months)
  const collectionRateTrend = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = moment(end).subtract(i, 'months').startOf('month').toDate();
    const mEnd = moment(end).subtract(i, 'months').endOf('month').toDate();
    const mLabel = moment(mStart).format('MMM YY');

    const mBilledLogs = await Payment.find({ createdAt: { $gte: mStart, $lte: mEnd }, deletedAt: null });
    const mPaidLogs = await Payment.find({ paymentStatus: 'Paid', paymentDate: { $gte: mStart, $lte: mEnd }, deletedAt: null });
    const mPartialLogs = await Payment.find({ paymentStatus: 'Partially Paid', paymentDate: { $gte: mStart, $lte: mEnd }, deletedAt: null });

    const mBilled = mBilledLogs.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const mCollected = mPaidLogs.reduce((s, p) => s + (p.totalAmount || 0), 0) +
                       mPartialLogs.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);

    const mRate = mBilled > 0 ? parseFloat(((mCollected / mBilled) * 100).toFixed(1)) : 100;
    collectionRateTrend.push({
      monthLabel: mLabel,
      collectionRate: mRate,
    });
  }

  // Revenue by Contract type breakdown
  const revenueByContractType = {
    'Monthly Retainer': 0,
    'Per-Incident': 0,
    'Time & Material': 0,
    'Fixed': 0,
  };
  for (const p of activeProjects) {
    const projPayments = paymentsBilled.filter(pay => pay.project.toString() === p._id.toString());
    const billedVal = projPayments.reduce((s, pay) => s + (pay.totalAmount || 0), 0);
    const typeKey = p.contractType || 'Fixed';
    if (revenueByContractType[typeKey] !== undefined) {
      revenueByContractType[typeKey] += billedVal;
    } else {
      revenueByContractType['Fixed'] += billedVal;
    }
  }
  const revenueByContractTypeData = Object.keys(revenueByContractType).map(key => ({
    name: key,
    value: parseFloat(revenueByContractType[key].toFixed(1)),
  }));

  // Top 3 revenue generating clients
  const revenuePerClient = [];
  for (const client of activeClients) {
    const clientProjects = activeProjects.filter(p => p.client && p.client._id.toString() === client._id.toString());
    const projIds = clientProjects.map(p => p._id);
    const clientPayments = paymentsBilled.filter(p => projIds.map(id => id.toString()).includes(p.project.toString()));
    const totalRev = clientPayments.reduce((s, p) => s + (p.totalAmount || 0), 0);
    revenuePerClient.push({
      clientName: client.name,
      revenue: parseFloat(totalRev.toFixed(1)),
    });
  }
  revenuePerClient.sort((a, b) => b.revenue - a.revenue);
  const topClients = revenuePerClient.slice(0, 3);

  // Overrun cost
  let overrunCostTotal = 0;
  for (const p of activeProjects) {
    const usedHours = projectUsedHoursMap[p._id.toString()] || 0;
    if (usedHours > p.allocatedHours) {
      const rate = await getProjectHourlyRate(p._id, defaultHourlyRate);
      overrunCostTotal += (usedHours - p.allocatedHours) * rate;
    }
  }

  // Effective hourly rate
  const divisionEffectiveRate = totalHoursLogged > 0
    ? parseFloat((revenueBilled / totalHoursLogged).toFixed(1))
    : 0;

  const financials = {
    revenueBilled,
    revenueCollected,
    outstandingBalance,
    ytdBilled,
    ytdCollected,
    overrunCostTotal,
    divisionEffectiveRate,
    outstandingPerClient,
    collectionRateTrend,
    revenueByContractType: revenueByContractTypeData,
    topClients,
  };

  // ──────────────────────────────────────────────────────────────
  // 3.4 — OPERATIONAL EFFICIENCY SIGNALS
  // ──────────────────────────────────────────────────────────────
  
  // Historical trends for the last 4 periods (months)
  const slaTrendData = [];
  const resTimeTrendData = [];
  const utilTrendData = [];

  for (let i = 3; i >= 0; i--) {
    const mStart = moment(end).subtract(i, 'months').startOf('month').toDate();
    const mEnd = moment(end).subtract(i, 'months').endOf('month').toDate();
    const mLabel = moment(mStart).format('MMM YY');

    const mResolved = await Issue.find({
      status: { $in: ['Resolved', 'Closed'] },
      updatedAt: { $gte: mStart, $lte: mEnd },
      deletedAt: null,
    });
    const mWithinSla = mResolved.filter(issue => !issue.dueDate || issue.updatedAt <= issue.dueDate).length;
    const mSlaRate = mResolved.length > 0 ? parseFloat(((mWithinSla / mResolved.length) * 100).toFixed(1)) : 100;
    slaTrendData.push({ monthLabel: mLabel, slaRate: mSlaRate });

    const mTimes = mResolved.map(issue => Math.max(0.1, (issue.updatedAt - issue.createdAt) / (1000 * 60 * 60)));
    const mAvgRes = mTimes.length > 0
      ? parseFloat((mTimes.reduce((s, x) => s + x, 0) / mTimes.length).toFixed(1))
      : 0;
    resTimeTrendData.push({ monthLabel: mLabel, avgResHours: mAvgRes });

    const mLogs = await TimeLog.find({ startTime: { $gte: mStart, $lte: mEnd }, deletedAt: null });
    const mLogged = mLogs.reduce((s, l) => s + (l.duration || 0), 0);
    const mBillable = mLogs.filter(l => l.isBillable).reduce((s, l) => s + (l.duration || 0), 0);
    const mUtil = mLogged > 0 ? parseFloat(((mBillable / mLogged) * 100).toFixed(1)) : 100;
    utilTrendData.push({ monthLabel: mLabel, utilizationRate: mUtil });
  }

  // Backlog age breakdown
  const openIssues = await Issue.find({
    status: { $nin: ['Resolved', 'Closed'] },
    deletedAt: null,
  });
  let backlog0to3 = 0, backlog3to7 = 0, backlog7to14 = 0, backlogOver14 = 0;
  openIssues.forEach(i => {
    const ageDays = moment(now).diff(moment(i.createdAt), 'days');
    if (ageDays <= 3) backlog0to3++;
    else if (ageDays <= 7) backlog3to7++;
    else if (ageDays <= 14) backlog7to14++;
    else backlogOver14++;
  });

  // Issue demand 12-month trend
  const issueDemandTrend = [];
  for (let i = 11; i >= 0; i--) {
    const mStart = moment(end).subtract(i, 'months').startOf('month').toDate();
    const mEnd = moment(end).subtract(i, 'months').endOf('month').toDate();
    const mLabel = moment(mStart).format('MMM');

    const created = await Issue.countDocuments({ createdAt: { $gte: mStart, $lte: mEnd }, deletedAt: null });
    const resolved = await Issue.countDocuments({ status: { $in: ['Resolved', 'Closed'] }, updatedAt: { $gte: mStart, $lte: mEnd }, deletedAt: null });

    issueDemandTrend.push({
      monthLabel: mLabel,
      created,
      resolved,
    });
  }

  // CR Delivery rate
  const completedCrs = await ChangeRequest.find({
    status: 'Completed',
    updatedAt: { $gte: start, $lte: end },
    deletedAt: null,
  });
  const onTimeAndEstCrs = completedCrs.filter(cr => {
    const onTime = !cr.targetReleaseDate || cr.updatedAt <= cr.targetReleaseDate;
    const withinEst = (cr.actualHours || 0) <= (cr.estimatedHours || 0);
    return onTime && withinEst;
  }).length;
  const crDeliveryRate = completedCrs.length > 0
    ? parseFloat(((onTimeAndEstCrs / completedCrs.length) * 100).toFixed(1))
    : 100;

  const operationalSignals = {
    slaComplianceTrend: slaTrendData,
    avgResolutionTimeTrend: resTimeTrendData,
    utilizationRateTrend: utilTrendData,
    backlogAgeBreakdown: {
      zeroToThree: backlog0to3,
      threeToSeven: backlog3to7,
      sevenToFourteen: backlog7to14,
      overFourteen: backlogOver14,
    },
    issueDemandTrend,
    crDeliveryRate,
  };

  // ──────────────────────────────────────────────────────────────
  // 3.5 — PREDICTIONS & STRATEGIC SIGNALS (Unlocked >= 91 days)
  // ──────────────────────────────────────────────────────────────
  let predictions = null;

  if (rangeDays >= 91) {
    // 1. Capacity Forecast
    // Avg logs over past 3 months
    const last3MStart = moment(end).subtract(3, 'months').startOf('month').toDate();
    const last3MLogs = await TimeLog.find({ startTime: { $gte: last3MStart, $lte: end }, deletedAt: null });
    const total3MHours = last3MLogs.reduce((s, l) => s + (l.duration || 0), 0);
    const avgMonthlyLoggedHours = parseFloat((total3MHours / 3).toFixed(1));
    const projectedDemandHours = Math.round(avgMonthlyLoggedHours * 1.05); // project 5% growth

    let capacityFlag = null;
    if (projectedDemandHours > monthlyCapacity * 1.1) {
      capacityFlag = 'Team approaching capacity limit — assess hiring or contractor need.';
    }

    // 2. Revenue Projection
    let monthlyRetainerValue = 0;
    for (const p of activeProjects) {
      if (p.contractType === 'Monthly Retainer') {
        const rate = await getProjectHourlyRate(p._id, defaultHourlyRate);
        monthlyRetainerValue += (p.allocatedHours || 0) * rate;
      }
    }
    // Pipeline CRs (Open but estimated)
    const openCrs = await ChangeRequest.find({
      status: { $in: ['In Development', 'Closed'] }, // Open in development
      deletedAt: null,
    });
    const pipelineCrRevenue = openCrs.reduce((s, cr) => s + (cr.estimatedCost || 0), 0);
    const projectedNextMonthRevenue = monthlyRetainerValue + pipelineCrRevenue;

    // 3. At-Risk Contracts
    const currentMonthStart = moment(end).startOf('month').toDate();
    const totalDaysInMonth = moment(end).daysInMonth();
    const daysElapsed = moment(end).diff(moment(currentMonthStart), 'days') + 1;

    const atRiskContracts = [];
    for (const p of activeProjects) {
      if (!p.allocatedHours || p.allocatedHours === 0) continue;
      const projLogsThisMonth = await TimeLog.find({
        project: p._id,
        startTime: { $gte: currentMonthStart, $lte: end },
        deletedAt: null,
      });
      const usedThisMonth = projLogsThisMonth.reduce((s, l) => s + l.duration, 0);
      const projectedMonthEndHours = daysElapsed > 0 ? (usedThisMonth / daysElapsed) * totalDaysInMonth : 0;
      if (projectedMonthEndHours > p.allocatedHours && usedThisMonth <= p.allocatedHours) {
        const overrun = projectedMonthEndHours - p.allocatedHours;
        const rate = await getProjectHourlyRate(p._id, defaultHourlyRate);
        atRiskContracts.push({
          projectName: p.name,
          overrunHours: parseFloat(overrun.toFixed(1)),
          overrunCost: parseFloat((overrun * rate).toFixed(1)),
        });
      }
    }

    // 4. Declining SLA Clients
    const decliningClients = [];
    for (const client of activeClients) {
      // Rates over 3 30-day buckets
      const rates = [];
      for (let j = 2; j >= 0; j--) {
        const bStart = moment(end).subtract((j + 1) * 30, 'days').toDate();
        const bEnd = moment(end).subtract(j * 30, 'days').toDate();

        const bResolved = await Issue.find({
          client: client._id,
          status: { $in: ['Resolved', 'Closed'] },
          updatedAt: { $gte: bStart, $lte: bEnd },
          deletedAt: null,
        });
        const bWithinSla = bResolved.filter(issue => !issue.dueDate || issue.updatedAt <= issue.dueDate).length;
        const bRate = bResolved.length > 0 ? (bWithinSla / bResolved.length) * 100 : 100;
        rates.push(bRate);
      }
      if (rates[0] > rates[1] && rates[1] > rates[2]) {
        decliningClients.push(client.name);
      }
    }

    // 5. Demand Growth Rate
    const currentMonthIssues = await Issue.countDocuments({ createdAt: { $gte: currentMonthStart, $lte: end }, deletedAt: null });
    const priorMonthStart = moment(currentMonthStart).subtract(1, 'month').toDate();
    const priorMonthEnd = moment(currentMonthStart).subtract(1, 'day').endOf('day').toDate();
    const priorMonthIssues = await Issue.countDocuments({ createdAt: { $gte: priorMonthStart, $lte: priorMonthEnd }, deletedAt: null });
    const momGrowth = priorMonthIssues > 0 ? ((currentMonthIssues - priorMonthIssues) / priorMonthIssues) * 100 : 0;

    const yoyMonthStart = moment(currentMonthStart).subtract(1, 'year').toDate();
    const yoyMonthEnd = moment(currentMonthStart).subtract(1, 'year').endOf('month').toDate();
    const yoyIssues = await Issue.countDocuments({ createdAt: { $gte: yoyMonthStart, $lte: yoyMonthEnd }, deletedAt: null });
    const yoyGrowth = yoyIssues > 0 ? ((currentMonthIssues - yoyIssues) / yoyIssues) * 100 : 0;

    // 6. Team Efficiency Trend (MoM)
    const currentMonthResolved = await Issue.find({ status: { $in: ['Resolved', 'Closed'] }, updatedAt: { $gte: currentMonthStart, $lte: end }, deletedAt: null });
    const currentMonthLogs = await TimeLog.find({ startTime: { $gte: currentMonthStart, $lte: end }, deletedAt: null });
    const currentMonthLoggedHours = currentMonthLogs.reduce((s, l) => s + (l.duration || 0), 0);
    const currentEfficiency = currentMonthLoggedHours > 0 ? (currentMonthResolved.length / currentMonthLoggedHours) : 0;

    const priorMonthResolved = await Issue.find({ status: { $in: ['Resolved', 'Closed'] }, updatedAt: { $gte: priorMonthStart, $lte: priorMonthEnd }, deletedAt: null });
    const priorMonthLogs = await TimeLog.find({ startTime: { $gte: priorMonthStart, $lte: priorMonthEnd }, deletedAt: null });
    const priorMonthLoggedHours = priorMonthLogs.reduce((s, l) => s + (l.duration || 0), 0);
    const priorEfficiency = priorMonthLoggedHours > 0 ? (priorMonthResolved.length / priorMonthLoggedHours) : 0;

    let efficiencyTrend = 'stable';
    if (currentEfficiency > priorEfficiency * 1.05) efficiencyTrend = 'improving';
    else if (currentEfficiency < priorEfficiency * 0.95) efficiencyTrend = 'declining';

    predictions = {
      projectedDemandHours,
      monthlyCapacity,
      capacityFlag,
      projectedNextMonthRevenue,
      atRiskContracts,
      decliningClients,
      momGrowth: parseFloat(momGrowth.toFixed(1)),
      yoyGrowth: parseFloat(yoyGrowth.toFixed(1)),
      efficiencyTrend,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 3.6 — CHARTS PRE-COMPILED DATA
  // ──────────────────────────────────────────────────────────────
  
  // Revenue trend (6 months)
  const revenueTrendChart = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = moment(end).subtract(i, 'months').startOf('month').toDate();
    const mEnd = moment(end).subtract(i, 'months').endOf('month').toDate();
    const mLabel = moment(mStart).format('MMM YY');

    const bills = await Payment.find({ createdAt: { $gte: mStart, $lte: mEnd }, deletedAt: null });
    const collections = await Payment.find({ paymentStatus: 'Paid', paymentDate: { $gte: mStart, $lte: mEnd }, deletedAt: null });
    const parts = await Payment.find({ paymentStatus: 'Partially Paid', paymentDate: { $gte: mStart, $lte: mEnd }, deletedAt: null });

    const wBilled = bills.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const wCollected = collections.reduce((s, p) => s + (p.totalAmount || 0), 0) +
                       parts.reduce((s, p) => s + (p.partiallyPaidAmount || 0), 0);

    revenueTrendChart.push({
      label: mLabel,
      billed: wBilled,
      collected: wCollected,
    });
  }

  // SLA rate by client (horizontal bar)
  const clientSlaChart = clientHealthMatrix.map(item => ({
    name: item.clientName,
    slaRate: item.slaRate,
    health: item.health,
  })).sort((a, b) => b.slaRate - a.slaRate);

  // Project hours utilization (gauge grid)
  const projectUtilizationGauge = activeProjects.map(p => {
    const usedHours = projectUsedHoursMap[p._id.toString()] || 0;
    const ratio = p.allocatedHours > 0 ? (usedHours / p.allocatedHours) * 100 : 0;
    return {
      projectName: p.name,
      percentage: parseFloat(Math.min(100, ratio).toFixed(1)),
      actualPercentage: parseFloat(ratio.toFixed(1)),
      used: parseFloat(usedHours.toFixed(1)),
      allocated: p.allocatedHours,
      status: ratio > 100 ? 'overrun' : ratio > 80 ? 'warning' : 'healthy',
    };
  });

  // Sparkline donut
  const unusedCapacity = Math.max(0, rangeCapacity - totalHoursLogged);
  const divisionUtilizationDonut = [
    { name: 'Billable Hours', value: parseFloat(totalBillableHours.toFixed(1)) },
    { name: 'Non-Billable Hours', value: parseFloat((totalHoursLogged - totalBillableHours).toFixed(1)) },
    { name: 'Unused Capacity', value: parseFloat(unusedCapacity.toFixed(1)) },
  ];

  return {
    period: { startDate, endDate },
    rangeDays,
    scorecard,
    clientHealthMatrix,
    financials,
    operationalSignals,
    predictions,
    charts: {
      revenueTrend: revenueTrendChart,
      clientSla: clientSlaChart,
      projectUtilization: projectUtilizationGauge,
      divisionUtilizationDonut,
    },
  };
};

module.exports = {
  getExecutivePerformanceData,
};
