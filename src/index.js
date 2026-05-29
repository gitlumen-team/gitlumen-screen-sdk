import { GitLumenService } from './services/gitlumen.js';
import { GitHubClient } from './services/github.js';
import { ReportStore } from './services/reportStore.js';
import { formatReportOutput, reportCompact } from './formatters.js';

export class GitLumenScreenSDK {
  constructor(options = {}) {
    const githubOptions = {
      token: options.githubToken,
      dataDir: options.dataDir,
      maxFileBytes: options.maxFileBytes,
      githubApiBase: options.githubApiBase,
      rawBase: options.rawBase,
      userAgent: options.userAgent
    };

    const storeOptions = {
      dataDir: options.dataDir,
      config: {
        dataDir: options.dataDir
      }
    };

    this.service = options.service || new GitLumenService({
      githubClient: options.githubClient,
      store: options.store,
      githubOptions,
      storeOptions
    });
  }

  async screenRepository(input, output = 'compact') {
    const report = await this.service.screenRepository(input);
    return formatReportOutput(report, output);
  }

  async getReviewReport(reportId, output = 'compact') {
    const report = await this.service.getReport(reportId);
    return formatReportOutput(report, output);
  }

  async listReviewReports(limit = 20) {
    return this.service.listReports(limit);
  }

  async getRepositoryStructure(input) {
    return this.service.getRepositoryStructure(input);
  }
}

export async function screenRepository(input, options = {}) {
  const sdk = new GitLumenScreenSDK(options);
  return sdk.screenRepository(input, options.output || 'compact');
}

export {
  GitLumenService,
  GitHubClient,
  ReportStore,
  reportCompact,
  formatReportOutput
};
