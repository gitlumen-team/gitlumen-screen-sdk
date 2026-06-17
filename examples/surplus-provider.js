import { GitLumenScreenSDK } from '../src/index.js';

const sdk = new GitLumenScreenSDK({
  githubToken: process.env.GITHUB_TOKEN,
  dataDir: '.gitlumen-screen-sdk',
  aiProvider: 'surplus',
  surplusApiKey: process.env.SURPLUS_API_KEY,
  surplusModel: process.env.SURPLUS_MODEL || 'auto',
  // Optional overrides:
  // surplusBaseUrl: process.env.SURPLUS_BASE_URL,
  // surplusMaxInputChars: 60000,
  // providerErrorMode: 'throw'
});

const result = await sdk.screenRepository(
  {
    repoUrl: 'https://github.com/modelcontextprotocol/typescript-sdk',
    scope: 'quick'
  },
  'json'
);

console.log(JSON.stringify({
  reportId: result.reportId,
  risk: result.risk,
  providerInsights: result.providerInsights
}, null, 2));
