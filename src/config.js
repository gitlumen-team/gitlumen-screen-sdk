import path from 'node:path';

export function createConfig(overrides = {}) {
  return {
    githubToken: overrides.githubToken ?? process.env.GITHUB_TOKEN ?? '',
    dataDir: overrides.dataDir ?? path.resolve(process.cwd(), process.env.GITLUMEN_SCREEN_DATA_DIR || '.gitlumen-screen-sdk'),
    maxFileBytes: overrides.maxFileBytes ?? Number.parseInt(process.env.GITLUMEN_MAX_FILE_BYTES || '120000', 10),
    githubApiBase: overrides.githubApiBase ?? 'https://api.github.com',
    rawBase: overrides.rawBase ?? 'https://raw.githubusercontent.com',
    userAgent: overrides.userAgent ?? 'gitlumen-screen-sdk/0.1.0'
  };
}

export const DEFAULT_LIMITS = {
  maxTreeEntries: 2500,
  quickMaxFiles: 40,
  standardMaxFiles: 90,
  deepMaxFiles: 180,
  maxPrFiles: 300
};
