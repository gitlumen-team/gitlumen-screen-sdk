import { GitHubClient } from './github.js';
import { analyzeSnapshot } from './analyzer.js';
import { ReportStore } from './reportStore.js';

export class GitLumenService {
  constructor({ githubClient, store, githubOptions = {}, storeOptions = {} } = {}) {
    this.github = githubClient || new GitHubClient(githubOptions);
    this.store = store || new ReportStore(storeOptions);
  }

  async screenRepository(input) {
    const scope = input.scope || 'standard';
    const snapshot = await this.github.loadRepositorySnapshot({
      repoUrl: input.repoUrl,
      branch: input.branch || undefined,
      scope,
      maxFiles: input.maxFiles || undefined
    });
    const report = analyzeSnapshot(snapshot, { scope, maxFiles: input.maxFiles || null });
    await this.store.save(report);
    return report;
  }

  async getReport(reportId) {
    return this.store.get(reportId);
  }

  async listReports(limit) {
    return this.store.list(limit);
  }

  async getRepositoryStructure(input) {
    const snapshot = await this.github.loadRepositorySnapshot({
      repoUrl: input.repoUrl,
      branch: input.branch || undefined,
      scope: 'quick',
      maxFiles: 1
    });
    return {
      target: {
        mode: snapshot.mode,
        owner: snapshot.owner,
        repo: snapshot.repo,
        repoUrl: snapshot.repoUrl,
        ref: snapshot.ref,
        defaultBranch: snapshot.defaultBranch,
        pullRequest: snapshot.pullRequest || null
      },
      structure: snapshot.tree.slice(0, input.limit || 300),
      limits: snapshot.limits
    };
  }
}
