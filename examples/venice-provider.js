import { GitLumenScreenSDK } from '../src/index.js';

const sdk = new GitLumenScreenSDK({
  githubToken: process.env.GITHUB_TOKEN,
  dataDir: '.gitlumen-screen-sdk',
  aiProvider: 'venice',
  veniceApiKey: process.env.VENICE_API_KEY,
  veniceModel: process.env.VENICE_MODEL || 'zai-org-glm-5',
  // Optional overrides:
  // veniceBaseUrl: process.env.VENICE_BASE_URL,
  // veniceMaxInputChars: 60000,
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
