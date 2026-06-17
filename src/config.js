import path from 'node:path';

export function createConfig(overrides = {}) {
  return {
    githubToken: overrides.githubToken ?? process.env.GITHUB_TOKEN ?? '',
    dataDir: overrides.dataDir ?? path.resolve(process.cwd(), process.env.GITLUMEN_SCREEN_DATA_DIR || '.gitlumen-screen-sdk'),
    maxFileBytes: overrides.maxFileBytes ?? Number.parseInt(process.env.GITLUMEN_MAX_FILE_BYTES || '120000', 10),
    githubApiBase: overrides.githubApiBase ?? 'https://api.github.com',
    rawBase: overrides.rawBase ?? 'https://raw.githubusercontent.com',
    userAgent: overrides.userAgent ?? 'gitlumen-screen-sdk/0.1.0',
    aiProvider: overrides.aiProvider ?? process.env.GITLUMEN_AI_PROVIDER ?? 'heuristic',
    providerErrorMode: overrides.providerErrorMode ?? process.env.GITLUMEN_PROVIDER_ERROR_MODE ?? 'attach',
    surplusApiKey: overrides.surplusApiKey ?? process.env.SURPLUS_API_KEY ?? '',
    surplusBaseUrl: overrides.surplusBaseUrl ?? process.env.SURPLUS_BASE_URL ?? 'https://www.surplusintelligence.ai/x402/api/inference/v1',
    surplusChatCompletionsPath: overrides.surplusChatCompletionsPath ?? process.env.SURPLUS_CHAT_COMPLETIONS_PATH ?? '/chat/completions',
    surplusModel: overrides.surplusModel ?? process.env.SURPLUS_MODEL ?? 'auto',
    surplusTemperature: overrides.surplusTemperature ?? Number.parseFloat(process.env.SURPLUS_TEMPERATURE || '0.2'),
    surplusMaxTokens: overrides.surplusMaxTokens ?? Number.parseInt(process.env.SURPLUS_MAX_TOKENS || '1800', 10),
    surplusTimeoutMs: overrides.surplusTimeoutMs ?? Number.parseInt(process.env.SURPLUS_TIMEOUT_MS || '45000', 10),
    surplusMaxInputChars: overrides.surplusMaxInputChars ?? Number.parseInt(process.env.SURPLUS_MAX_INPUT_CHARS || '60000', 10),
    surplusMaxFileChars: overrides.surplusMaxFileChars ?? Number.parseInt(process.env.SURPLUS_MAX_FILE_CHARS || '6000', 10)
  };
}

export const DEFAULT_LIMITS = {
  maxTreeEntries: 2500,
  quickMaxFiles: 40,
  standardMaxFiles: 90,
  deepMaxFiles: 180,
  maxPrFiles: 300
};
