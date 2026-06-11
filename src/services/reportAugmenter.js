import { unique } from '../utils/text.js';

export function augmentReportWithProviderInsights(report, insights) {
  if (!insights) return report;

  report.providerInsights = insights;
  report.generator = {
    ...report.generator,
    mode: insights.provider ? `${report.generator.mode}+${insights.provider}` : report.generator.mode
  };

  if (insights.reviewChapters?.length) {
    report.chapters = [
      ...report.chapters,
      ...insights.reviewChapters.map((chapter) => ({
        title: `Provider: ${chapter.title}`,
        summary: chapter.summary,
        bullets: chapter.bullets || []
      }))
    ];
  }

  if (insights.decisionQuestions?.length) {
    report.decisionQuestions = unique([...report.decisionQuestions, ...insights.decisionQuestions]).slice(0, 12);
  }

  if (insights.recommendations?.length) {
    report.recommendations = unique([...report.recommendations, ...insights.recommendations]).slice(0, 16);
  }

  return report;
}

export function attachProviderError(report, provider, error) {
  report.providerInsights = {
    provider,
    generatedAt: new Date().toISOString(),
    status: 'error',
    error: error?.message || String(error)
  };
  return report;
}
