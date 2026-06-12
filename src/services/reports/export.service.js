const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { settingService } = require('../../services');
const logger = require('../../config/logger');

// ──────────────────────────────────────────────────────────────
// PDF Export
// ──────────────────────────────────────────────────────────────

/**
 * Generate a PDF buffer for a report
 * @param {Object} report - Mongoose report document
 * @returns {Promise<Buffer>}
 */
const exportReportAsPdf = async (report) => {
  const branding = await settingService.getBranding();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header with branding ──
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(branding.companyName || 'Prologics (Pvt) Ltd', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(branding.slogan || 'Support Division System', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor(branding.primaryColor || '#2dae47')
      .lineWidth(2)
      .stroke();

    doc.moveDown(1);

    // ── Report title ──
    const typeLabel = report.type.charAt(0).toUpperCase() + report.type.slice(1);
    const periodStr = `${formatDate(report.periodStart)} — ${formatDate(report.periodEnd)}`;

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text(`${typeLabel} Report`, { align: 'left' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#888888')
      .text(`Period: ${periodStr}`, { align: 'left' });

    doc
      .text(
        `Generated: ${new Date().toLocaleString()} | Mode: ${report.generationMode}`,
        { align: 'left' }
      );

    doc.moveDown(1.5);

    // ── Report data sections ──
    const data = report.data;

    if (report.type === 'daily') {
      renderDailyPdf(doc, data);
    } else if (report.type === 'weekly') {
      renderWeeklyPdf(doc, data);
    } else if (report.type === 'monthly') {
      renderMonthlyPdf(doc, data);
    } else if (report.type === 'executive') {
      renderExecutivePdf(doc, data);
    }

    // ── Footer ──
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#aaaaaa')
        .text(
          `${branding.companyName || 'Prologics'} — Confidential | Page ${i + 1} of ${pages.count}`,
          50,
          doc.page.height - 40,
          { align: 'center', width: 495 }
        );
    }

    doc.end();
  });
};

// ── PDF Section Renderers ──────────────────────────────────────

function renderDailyPdf(doc, data) {
  addSectionTitle(doc, 'Issues Summary');
  const summary = data.issuesSummary;
  addKeyValue(doc, 'New Today', summary.newToday);
  addKeyValue(doc, 'In Progress', summary.inProgress);
  addKeyValue(doc, 'Resolved Today', summary.resolvedToday);
  addKeyValue(doc, 'Closed Today', summary.closedToday);
  addKeyValue(doc, 'Reopened', summary.reopened);
  doc.moveDown(1);

  addSectionTitle(doc, 'SLA Status');
  addKeyValue(doc, 'Within SLA', data.slaStatus.withinSla);
  addKeyValue(doc, 'Breached Today', data.slaStatus.breachedToday);
  addKeyValue(doc, 'At Risk', data.slaStatus.atRisk);
  addKeyValue(doc, 'Compliance Rate', `${data.slaStatus.complianceRate}%`);
  doc.moveDown(1);

  addSectionTitle(doc, 'Member Activity');
  if (data.memberActivity && data.memberActivity.length) {
    data.memberActivity.forEach((m) => {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`${m.name} — ${m.hoursLogged}h logged, ${m.issuesResolved} resolved`);
    });
  }
}

function renderWeeklyPdf(doc, data) {
  addSectionTitle(doc, 'Issue Volume');
  addKeyValue(doc, 'New Issues', data.issueVolume.totalNew);
  addKeyValue(doc, 'Resolved', data.issueVolume.totalResolved);
  addKeyValue(doc, 'Closed', data.issueVolume.totalClosed);
  doc.moveDown(1);

  addSectionTitle(doc, 'SLA Compliance');
  addKeyValue(doc, 'Compliance Rate', `${data.slaCompliance.rate}%`);
  addKeyValue(doc, 'Prior Week', `${data.slaCompliance.priorWeekRate}%`);
  addKeyValue(doc, 'Trend', data.slaCompliance.trend);
  doc.moveDown(1);

  addSectionTitle(doc, 'Resolution Time');
  addKeyValue(doc, 'Average', `${data.resolutionTime.avgHours}h`);
  addKeyValue(doc, 'Median', `${data.resolutionTime.medianHours}h`);
  addKeyValue(doc, 'P95', `${data.resolutionTime.p95Hours}h`);
}

function renderMonthlyPdf(doc, data) {
  addSectionTitle(doc, 'KPI Scorecard');
  addKeyValue(doc, 'SLA Compliance', `${data.kpiScorecard.slaComplianceRate}%`);
  addKeyValue(doc, 'Avg Resolution Time', `${data.kpiScorecard.avgResolutionTimeHours}h`);
  addKeyValue(doc, 'Total Issues', data.kpiScorecard.totalIssues);
  addKeyValue(doc, 'Total Hours', data.kpiScorecard.totalHoursLogged);
  addKeyValue(doc, 'Utilization Rate', `${data.kpiScorecard.utilizationRate}%`);
  doc.moveDown(1);

  addSectionTitle(doc, 'Project Performance');
  if (data.projectPerformance && data.projectPerformance.length) {
    data.projectPerformance.forEach((p) => {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`${p.project}: ${p.used}/${p.allocated}h${p.overrun ? ' ⚠ OVERRUN' : ''}`);
    });
  }
}

function renderExecutivePdf(doc, data) {
  addSectionTitle(doc, 'Executive Summary');
  addKeyValue(doc, 'Total Issues', data.summary.totalIssues);
  addKeyValue(doc, 'Resolved', data.summary.resolvedIssues);
  addKeyValue(doc, 'SLA Compliance', `${data.summary.slaComplianceRate}%`);
  addKeyValue(doc, 'Avg Resolution', `${data.summary.avgResolutionHours}h`);
  addKeyValue(doc, 'Total Hours', data.summary.totalHoursLogged);
  addKeyValue(doc, 'Billable Hours', data.summary.totalBillableHours);
}

// ── PDF Helpers ─────────────────────────────────────────────────

function addSectionTitle(doc, title) {
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#222222')
    .text(title);
  doc.moveDown(0.3);
}

function addKeyValue(doc, label, value) {
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#555555')
    .text(`${label}: `, { continued: true })
    .font('Helvetica-Bold')
    .fillColor('#333333')
    .text(String(value));
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ──────────────────────────────────────────────────────────────
// Excel Export
// ──────────────────────────────────────────────────────────────

/**
 * Generate an Excel buffer for a report
 * @param {Object} report - Mongoose report document
 * @returns {Promise<Buffer>}
 */
const exportReportAsExcel = async (report) => {
  const branding = await settingService.getBranding();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = branding.companyName || 'Prologics';
  workbook.created = new Date();

  const typeLabel = report.type.charAt(0).toUpperCase() + report.type.slice(1);
  const data = report.data;

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  // Style header
  summarySheet.getRow(1).font = { bold: true, size: 11 };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2DAE47' },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add report metadata
  summarySheet.addRow({ metric: 'Report Type', value: typeLabel });
  summarySheet.addRow({ metric: 'Period Start', value: formatDate(report.periodStart) });
  summarySheet.addRow({ metric: 'Period End', value: formatDate(report.periodEnd) });
  summarySheet.addRow({ metric: 'Generated', value: new Date().toLocaleString() });
  summarySheet.addRow({ metric: 'Mode', value: report.generationMode });
  summarySheet.addRow({ metric: '', value: '' });

  if (report.type === 'daily') {
    addDailyExcelData(workbook, summarySheet, data);
  } else if (report.type === 'weekly') {
    addWeeklyExcelData(workbook, summarySheet, data);
  } else if (report.type === 'monthly') {
    addMonthlyExcelData(workbook, summarySheet, data);
  } else if (report.type === 'executive') {
    addExecutiveExcelData(workbook, summarySheet, data);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// ── Excel Section Helpers ──────────────────────────────────────

function addDailyExcelData(workbook, summarySheet, data) {
  const s = data.issuesSummary;
  summarySheet.addRow({ metric: 'New Today', value: s.newToday });
  summarySheet.addRow({ metric: 'In Progress', value: s.inProgress });
  summarySheet.addRow({ metric: 'Resolved Today', value: s.resolvedToday });
  summarySheet.addRow({ metric: 'Closed Today', value: s.closedToday });
  summarySheet.addRow({ metric: 'Reopened', value: s.reopened });

  // Member activity sheet
  if (data.memberActivity && data.memberActivity.length) {
    const memberSheet = workbook.addWorksheet('Member Activity');
    memberSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Hours Logged', key: 'hoursLogged', width: 15 },
      { header: 'Issues Touched', key: 'issuesTouched', width: 15 },
      { header: 'Issues Resolved', key: 'issuesResolved', width: 15 },
    ];
    styleSheetHeader(memberSheet);
    data.memberActivity.forEach((m) => memberSheet.addRow(m));
  }
}

function addWeeklyExcelData(workbook, summarySheet, data) {
  summarySheet.addRow({ metric: 'Total New Issues', value: data.issueVolume.totalNew });
  summarySheet.addRow({ metric: 'Total Resolved', value: data.issueVolume.totalResolved });
  summarySheet.addRow({ metric: 'SLA Compliance Rate', value: `${data.slaCompliance.rate}%` });
  summarySheet.addRow({ metric: 'Avg Resolution Time', value: `${data.resolutionTime.avgHours}h` });

  // Member workload sheet
  if (data.memberWorkload && data.memberWorkload.length) {
    const memberSheet = workbook.addWorksheet('Member Workload');
    memberSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Hours Logged', key: 'hoursLogged', width: 15 },
      { header: 'Issues Handled', key: 'issuesHandled', width: 15 },
      { header: 'Avg Resolution (h)', key: 'avgResolutionHours', width: 18 },
    ];
    styleSheetHeader(memberSheet);
    data.memberWorkload.forEach((m) => memberSheet.addRow(m));
  }

  // Project hours sheet
  if (data.projectHours && data.projectHours.length) {
    const projectSheet = workbook.addWorksheet('Project Hours');
    projectSheet.columns = [
      { header: 'Project', key: 'project', width: 30 },
      { header: 'Allocated', key: 'allocated', width: 12 },
      { header: 'Used', key: 'used', width: 12 },
      { header: 'Remaining', key: 'remaining', width: 12 },
      { header: 'Trend', key: 'trend', width: 12 },
    ];
    styleSheetHeader(projectSheet);
    data.projectHours.forEach((p) => projectSheet.addRow(p));
  }
}

function addMonthlyExcelData(workbook, summarySheet, data) {
  const kpi = data.kpiScorecard;
  summarySheet.addRow({ metric: 'SLA Compliance Rate', value: `${kpi.slaComplianceRate}%` });
  summarySheet.addRow({ metric: 'Avg Resolution Time', value: `${kpi.avgResolutionTimeHours}h` });
  summarySheet.addRow({ metric: 'Total Issues', value: kpi.totalIssues });
  summarySheet.addRow({ metric: 'Total Hours Logged', value: kpi.totalHoursLogged });
  summarySheet.addRow({ metric: 'Utilization Rate', value: `${kpi.utilizationRate}%` });

  // Project performance
  if (data.projectPerformance && data.projectPerformance.length) {
    const projSheet = workbook.addWorksheet('Project Performance');
    projSheet.columns = [
      { header: 'Project', key: 'project', width: 30 },
      { header: 'Allocated', key: 'allocated', width: 12 },
      { header: 'Used', key: 'used', width: 12 },
      { header: 'Carry Over', key: 'carryOver', width: 12 },
      { header: 'Overrun', key: 'overrun', width: 10 },
      { header: 'Issues', key: 'issuesCount', width: 10 },
    ];
    styleSheetHeader(projSheet);
    data.projectPerformance.forEach((p) => projSheet.addRow({ ...p, overrun: p.overrun ? 'Yes' : 'No' }));
  }

  // Member efficiency
  if (data.memberEfficiency && data.memberEfficiency.length) {
    const effSheet = workbook.addWorksheet('Member Efficiency');
    effSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Hours Logged', key: 'hoursLogged', width: 15 },
      { header: 'Utilization %', key: 'utilizationRate', width: 14 },
      { header: 'Issues Resolved', key: 'issuesResolved', width: 15 },
      { header: 'Avg Handle Time', key: 'avgHandleTime', width: 16 },
    ];
    styleSheetHeader(effSheet);
    data.memberEfficiency.forEach((m) => effSheet.addRow(m));
  }
}

function addExecutiveExcelData(workbook, summarySheet, data) {
  const s = data.summary;
  summarySheet.addRow({ metric: 'Total Issues', value: s.totalIssues });
  summarySheet.addRow({ metric: 'Resolved', value: s.resolvedIssues });
  summarySheet.addRow({ metric: 'SLA Compliance', value: `${s.slaComplianceRate}%` });
  summarySheet.addRow({ metric: 'Total Hours', value: s.totalHoursLogged });
  summarySheet.addRow({ metric: 'Billable Hours', value: s.totalBillableHours });
}

function styleSheetHeader(sheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2DAE47' },
  };
}

module.exports = {
  exportReportAsPdf,
  exportReportAsExcel,
};
