import { GitLumenScreenSDK } from '../src/index.js';

const sdk = new GitLumenScreenSDK({
  // githubToken: process.env.GITHUB_TOKEN,
  dataDir: '.gitlumen-screen-sdk'
});

const result = await sdk.screenRepository(
  {
    repoUrl: 'https://github.com/modelcontextprotocol/typescript-sdk',
    scope: 'quick'
  },
  'compact'
);

console.log(result);
