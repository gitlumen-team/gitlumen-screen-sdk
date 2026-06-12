import { reportCompact, formatReportOutput } from '../src/formatters.js';

function makeReport(overrides = {}) {
  return {
    reportId: 'glr_0123456789abcdef',
    generatedAt: '2024-01-01T00:00:00.000Z',
    target: { mode: 'repository', owner: 'a', repo: 'b', repoUrl: 'https://github.com/a/b', ref: 'main', defaultBranch: 'main', pullRequest: null },
    risk: { score: 10, level: 'low', mergeReadiness: 'ready_with_standard_review', categoryScores: {} },
    summary: 'Low risk summary.',
    findings: Array.from({ length: 25 }, (_, i) => ({ id: `glf_${i}`, severity: 'low', title: `Finding ${i}` })),
    decisionQuestions: ['Question 1?'],
    recommendations: ['Recommendation 1'],
    markdown: 'x'.repeat(15000),
    chapters: [],
    ...overrides
  };
}

describe('reportCompact', () => {
  test('caps findings at 20', () => {
    const compact = reportCompact(makeReport());
    expect(compact.findings).toHaveLength(20);
  });

  test('truncates markdown to 12000 chars', () => {
    const compact = reportCompact(makeReport());
    expect(compact.markdown.length).toBeLessThanOrEqual(12100);
    expect(compact.markdown).toMatch(/truncated/);
  });

  test('includes required fields', () => {
    const compact = reportCompact(makeReport());
    expect(compact).toHaveProperty('reportId');
    expect(compact).toHaveProperty('generatedAt');
    expect(compact).toHaveProperty('target');
    expect(compact).toHaveProperty('risk');
    expect(compact).toHaveProperty('summary');
    expect(compact).toHaveProperty('findings');
    expect(compact).toHaveProperty('decisionQuestions');
    expect(compact).toHaveProperty('recommendations');
    expect(compact).toHaveProperty('markdown');
  });

  test('does not include chapters field', () => {
    const compact = reportCompact(makeReport());
    expect(compact).not.toHaveProperty('chapters');
  });
});

describe('formatReportOutput', () => {
  test('returns markdown string when output is "markdown"', () => {
    const report = makeReport({ markdown: '# Report' });
    expect(formatReportOutput(report, 'markdown')).toBe('# Report');
  });

  test('returns raw report object when output is "json"', () => {
    const report = makeReport();
    expect(formatReportOutput(report, 'json')).toBe(report);
  });

  test('returns compact report when output is "compact"', () => {
    const report = makeReport();
    expect(formatReportOutput(report, 'compact').findings).toHaveLength(20);
  });

  test('defaults to compact when output is not specified', () => {
    const report = makeReport();
    expect(formatReportOutput(report).findings).toHaveLength(20);
  });

  test('defaults to compact for unknown output value', () => {
    const report = makeReport();
    expect(formatReportOutput(report, 'unknown-format').findings).toHaveLength(20);
  });
});
