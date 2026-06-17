import { VeniceProvider } from '../src/providers/venice.js';
import { createAnalysisProvider } from '../src/providers/index.js';

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
    files: [{ path: 'src/index.js', content: 'const apiKey = "very-secret-venice-token";\nexport const ok = true;', size: 100 }]
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

test('createAnalysisProvider creates a VeniceProvider for aiProvider=venice', () => {
  const provider = createAnalysisProvider({ aiProvider: 'venice', veniceApiKey: 'test-key' });
  expect(provider).toBeInstanceOf(VeniceProvider);
  expect(provider.name).toBe('venice');
});

test('VeniceProvider calls OpenAI-compatible chat completions endpoint and normalizes JSON output', async () => {
  let captured;
  const provider = new VeniceProvider({
    veniceApiKey: 'venice_test_key',
    veniceBaseUrl: 'https://venice.local/api/v1',
    veniceChatCompletionsPath: '/chat/completions',
    veniceModel: 'venice/test-model',
    fetchImpl: async (url, request) => {
      captured = { url, request };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return JSON.stringify({
            model: 'venice/test-model',
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: 'Venice found one review concern.',
                  riskAdjustments: [{
                    category: 'security',
                    severity: 'medium',
                    title: 'Validate provider credentials handling',
                    evidence: ['credential assignment was redacted'],
                    recommendation: 'Move provider keys to server-side environment variables.',
                    file: 'src/index.js',
                    confidence: 'medium'
                  }],
                  reviewChapters: [{ title: 'Provider Safety', summary: 'Check provider key flow.', bullets: ['Keep API keys out of clients.'] }],
                  decisionQuestions: ['Where is Venice API key stored?'],
                  recommendations: ['Document Venice provider configuration.'],
                  mergeReadinessRationale: 'Ready after config review.',
                  confidence: 0.79
                })
              }
            }],
            usage: { prompt_tokens: 100, completion_tokens: 60 }
          });
        }
      };
    }
  });

  const insights = await provider.enhanceReport({ snapshot: sampleSnapshot(), report: sampleReport() });
  const body = JSON.parse(captured.request.body);
  const userPayload = JSON.parse(body.messages[1].content);

  expect(captured.url).toBe('https://venice.local/api/v1/chat/completions');
  expect(captured.request.headers.Authorization).toBe('Bearer venice_test_key');
  expect(body.model).toBe('venice/test-model');
  expect(body.stream).toBe(false);
  expect(insights.provider).toBe('venice');
  expect(insights.summary).toBe('Venice found one review concern.');
  expect(insights.riskAdjustments[0].title).toBe('Validate provider credentials handling');
  expect(userPayload.sanitizedSnapshot.files[0].content).toMatch(/\[REDACTED/);
});
