# gitlumen-screen-sdk

JavaScript SDK for screening public GitHub repositories and pull requests with GitLumen heuristic analysis.

## Install

```bash
npm install gitlumen-screen-sdk
```

For local development from sibling folder:

```bash
npm install ../gitlumen-screen-sdk
```

## Quick Start

```js
import { GitLumenScreenSDK } from 'gitlumen-screen-sdk';

const sdk = new GitLumenScreenSDK({
  githubToken: process.env.GITHUB_TOKEN,
  dataDir: '.gitlumen-screen-sdk'
});

const report = await sdk.screenRepository(
  {
    repoUrl: 'https://github.com/owner/repo',
    scope: 'standard'
  },
  'compact'
);

console.log(report);
```

## API

### new GitLumenScreenSDK(options)

Options:
- githubToken: optional GitHub token
- dataDir: local directory for report storage
- maxFileBytes: max file bytes fetched from raw GitHub file content
- githubApiBase: override GitHub API base URL
- rawBase: override raw content base URL
- userAgent: custom user agent string

### screenRepository(input, output)

- input.repoUrl: required, repository or PR URL
- input.scope: quick | standard | deep
- input.branch: optional branch/ref
- input.maxFiles: optional cap for downloaded files
- output: compact | markdown | json

Returns:
- compact: reduced JSON object
- markdown: markdown string
- json: full report object

### getReviewReport(reportId, output)

Read previously generated report by id.

### listReviewReports(limit)

List stored reports from local data directory.

### getRepositoryStructure(input)

Get tree structure summary without generating a full report.

## Low-level exports

The package also exports:
- GitLumenService
- GitHubClient
- ReportStore
- reportCompact
- formatReportOutput

## Requirements

- Node.js 20+
