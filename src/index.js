import { GitLumenService } from './services/gitlumen.js';
import { GitHubClient } from './services/github.js';
import { ReportStore } from './services/reportStore.js';
import { formatReportOutput, reportCompact } from './formatters.js';
import { createAnalysisProvider, SurplusProvider, VeniceProvider } from './providers/index.js';

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

    const providerOptions = {
      aiProvider: options.aiProvider,
      providerErrorMode: options.providerErrorMode,
      surplusApiKey: options.surplusApiKey,
      surplusBaseUrl: options.surplusBaseUrl,
      surplusChatCompletionsPath: options.surplusChatCompletionsPath,
      surplusModel: options.surplusModel,
      surplusTemperature: options.surplusTemperature,
      surplusMaxTokens: options.surplusMaxTokens,
      surplusTimeoutMs: options.surplusTimeoutMs,
      surplusMaxInputChars: options.surplusMaxInputChars,
      surplusMaxFileChars: options.surplusMaxFileChars,
      surplusHeaders: options.surplusHeaders,
      veniceApiKey: options.veniceApiKey,
      veniceBaseUrl: options.veniceBaseUrl,
      veniceChatCompletionsPath: options.veniceChatCompletionsPath,
      veniceModel: options.veniceModel,
      veniceTemperature: options.veniceTemperature,
      veniceMaxTokens: options.veniceMaxTokens,
      veniceTimeoutMs: options.veniceTimeoutMs,
      veniceMaxInputChars: options.veniceMaxInputChars,
      veniceMaxFileChars: options.veniceMaxFileChars,
      veniceHeaders: options.veniceHeaders,
      fetchImpl: options.fetchImpl
    };

    this.service = options.service || new GitLumenService({
      githubClient: options.githubClient,
      store: options.store,
      githubOptions,
      storeOptions,
      providerOptions,
      analysisProvider: options.analysisProvider
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
  SurplusProvider,
  VeniceProvider,
  createAnalysisProvider,
  reportCompact,
  formatReportOutput
};
