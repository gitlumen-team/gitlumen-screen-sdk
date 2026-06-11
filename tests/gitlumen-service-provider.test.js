import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { GitLumenService } from '../src/services/gitlumen.js';
import { ReportStore } from '../src/services/reportStore.js';

const snapshot = {
  mode: 'repository',
  owner: 'gitlumen-team',
  repo: 'demo',
  repoUrl: 'https://github.com/gitlumen-team/demo',
  ref: 'main',
  defaultBranch: 'main',
  description: 'demo repo',
  stars: 1,
  forks: 0,
  language: 'JavaScript',
  isPrivate: false,
  tree: [
    { path: 'README.md', type: 'blob', size: 20 },
    { path: 'src/index.js', type: 'blob', size: 50 }
  ],
  files: [
    { path: 'README.md', content: '# Demo', size: 6, status: 'unchanged' },
    { path: 'src/index.js', content: 'export const ok = true;', size: 23, status: 'unchanged' }
  ],
  limits: { treeEntriesReturned: 2, treeTruncated: false, filesDownloaded: 2, scope: 'quick' }
};

test('GitLumenService augments heuristic report with analysis provider insights', async () => {
  const dataDir = path.join(os.tmpdir(), `gitlumen-sdk-test-${Date.now()}`);
  const service = new GitLumenService({
    githubClient: {
      async loadRepositorySnapshot() {
        return snapshot;
      }
    },
    store: new ReportStore({ dataDir }),
    analysisProvider: {
      name: 'surplus',
      async enhanceReport() {
        return {
          provider: 'surplus',
          model: 'mock-model',
          generatedAt: new Date().toISOString(),
          summary: 'Provider-level summary.',
          riskAdjustments: [],
          reviewChapters: [{ title: 'Mock Chapter', summary: 'Provider chapter.', bullets: ['Provider bullet.'] }],
          decisionQuestions: ['What is the rollout plan?'],
          recommendations: ['Document rollout ownership.'],
          mergeReadinessRationale: 'Ready after human sign-off.',
          confidence: 0.8,
          usage: null
        };
      }
    }
  });

  const report = await service.screenRepository({ repoUrl: 'https://github.com/gitlumen-team/demo', scope: 'quick' });

  assert.equal(report.providerInsights.provider, 'surplus');
  assert.ok(report.decisionQuestions.includes('What is the rollout plan?'));
  assert.ok(report.recommendations.includes('Document rollout ownership.'));
  assert.match(report.markdown, /Provider Intelligence/);
  assert.match(report.markdown, /Mock Chapter/);
});
