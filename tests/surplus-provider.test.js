import test from 'node:test';
import assert from 'node:assert/strict';
import { SurplusProvider } from '../src/providers/surplus.js';
import { redactSensitiveText } from '../src/utils/redaction.js';

function sampleSnapshot() {
  return {
    mode: 'repository',
    owner: 'gitlumen-team',
    repo: 'demo',
    repoUrl: 'https://github.com/gitlumen-team/demo',
    ref: 'main',
    defaultBranch: 'main',
    description: 'demo repo',
    pullRequest: null,
    limits: { filesDownloaded: 1, scope: 'quick' },
    tree: [{ path: 'src/index.js', type: 'blob', size: 100 }],
    files: [{ path: 'src/index.js', content: 'const apiKey = "super-secret-token-value";\nexport const ok = true;', size: 100 }]
  };
}

function sampleReport() {
  return {
    reportId: 'glr_1234567890abcdef',
    target: { repoUrl: 'https://github.com/gitlumen-team/demo', mode: 'repository', ref: 'main' },
    risk: { level: 'medium', score: 30, mergeReadiness: 'review_required', categoryScores: {} },
    summary: 'medium risk',
    repositorySignals: {},
    findings: [],
    decisionQuestions: [],
    recommendations: []
  };
}

test('redactSensitiveText removes common secret values', () => {
  const result = redactSensitiveText('API_KEY="abcdefghijklmnopqrstuvwxyz"\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz123456');
  assert.match(result.text, /\[REDACTED/);
  assert.ok(result.redactionCount >= 1);
  assert.doesNotMatch(result.text, /abcdefghijklmnopqrstuvwxyz123456/);
});

test('SurplusProvider calls OpenAI-compatible chat completions endpoint and normalizes JSON output', async () => {
  let captured;
  const provider = new SurplusProvider({
    surplusApiKey: 'inf_test_key',
    surplusBaseUrl: 'https://surplus.local/v1',
    surplusChatCompletionsPath: '/chat/completions',
    surplusModel: 'router/test-model',
    fetchImpl: async (url, request) => {
      captured = { url, request };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return JSON.stringify({
            model: 'router/test-model',
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: 'Provider found one review concern.',
                  riskAdjustments: [{
                    category: 'security',
                    severity: 'medium',
                    title: 'Validate auth path',
                    evidence: ['auth-like secret assignment was redacted'],
                    recommendation: 'Review secret handling.',
                    file: 'src/index.js',
                    confidence: 'medium'
                  }],
                  reviewChapters: [{ title: 'Security Follow-up', summary: 'Check auth handling.', bullets: ['Audit token use.'] }],
                  decisionQuestions: ['Who owns secret rotation?'],
                  recommendations: ['Add an env example.'],
                  mergeReadinessRationale: 'Needs human review.',
                  confidence: 0.74
                })
              }
            }],
            usage: { input_tokens: 100, output_tokens: 60 }
          });
        }
      };
    }
  });

  const insights = await provider.enhanceReport({ snapshot: sampleSnapshot(), report: sampleReport() });
  const body = JSON.parse(captured.request.body);
  const userPayload = JSON.parse(body.messages[1].content);

  assert.equal(captured.url, 'https://surplus.local/v1/chat/completions');
  assert.equal(captured.request.headers.Authorization, 'Bearer inf_test_key');
  assert.equal(body.model, 'router/test-model');
  assert.equal(insights.provider, 'surplus');
  assert.equal(insights.summary, 'Provider found one review concern.');
  assert.equal(insights.riskAdjustments[0].title, 'Validate auth path');
  assert.match(userPayload.sanitizedSnapshot.files[0].content, /\[REDACTED/);
});
