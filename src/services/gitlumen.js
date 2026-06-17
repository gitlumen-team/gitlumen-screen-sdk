import { GitHubClient } from './github.js';
import { analyzeSnapshot, buildMarkdownReport } from './analyzer.js';
import { ReportStore } from './reportStore.js';
import { createConfig } from '../config.js';
import { createAnalysisProvider } from '../providers/index.js';
import { attachProviderError, augmentReportWithProviderInsights } from './reportAugmenter.js';

export class GitLumenService {
  constructor({ githubClient, store, githubOptions = {}, storeOptions = {}, providerOptions = {}, analysisProvider } = {}) {
    this.config = createConfig(providerOptions || {});
    this.github = githubClient || new GitHubClient(githubOptions);
    this.store = store || new ReportStore(storeOptions);
    this.analysisProvider = analysisProvider || createAnalysisProvider({
      ...providerOptions,
      aiProvider: providerOptions.aiProvider ?? this.config.aiProvider
    });
    this.providerErrorMode = providerOptions.providerErrorMode ?? this.config.providerErrorMode;
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
    const provider = input.analysisProvider || this.analysisProvider;
    const inputProviderName = input.aiProvider || input.provider;
    const runtimeProvider = inputProviderName
      ? createAnalysisProvider({ ...this.config, aiProvider: inputProviderName, ...(input.providerOptions || {}) })
      : provider;

    if (runtimeProvider) {
      try {
        const insights = await runtimeProvider.enhanceReport({ snapshot, report, input });
        augmentReportWithProviderInsights(report, insights);
      } catch (error) {
        if (input.providerErrorMode === 'throw' || this.providerErrorMode === 'throw') throw error;
        attachProviderError(report, runtimeProvider.name || inputProviderName || 'unknown', error);
      }
      report.markdown = buildMarkdownReport(report);
    }

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
