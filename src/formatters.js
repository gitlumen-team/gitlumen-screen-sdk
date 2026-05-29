import { truncateText } from './utils/text.js';

export function reportCompact(report) {
  return {
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    target: report.target,
    risk: report.risk,
    summary: report.summary,
    findings: report.findings.slice(0, 20),
    decisionQuestions: report.decisionQuestions,
    recommendations: report.recommendations,
    markdown: truncateText(report.markdown, 12000)
  };
}

export function formatReportOutput(report, output = 'compact') {
  if (output === 'markdown') return report.markdown;
  if (output === 'json') return report;
  return reportCompact(report);
}
