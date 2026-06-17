# gitlumen-screen-sdk

JavaScript SDK for screening public GitHub repositories and pull requests with GitLumen heuristic analysis, with optional Surplus Intelligence provider-assisted review insights.

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


## Surplus Intelligence Provider

The SDK keeps the local heuristic analyzer as the default execution path. To add provider-assisted review intelligence through Surplus, enable `aiProvider: 'surplus'` and pass a Surplus API key/model through options or environment variables.

```bash
export SURPLUS_API_KEY=inf_your_key
export SURPLUS_MODEL=auto
# optional
export SURPLUS_BASE_URL=https://www.surplusintelligence.ai/x402/api/inference/v1
```

```js
import { GitLumenScreenSDK } from 'gitlumen-screen-sdk';

const sdk = new GitLumenScreenSDK({
  githubToken: process.env.GITHUB_TOKEN,
  aiProvider: 'surplus',
  surplusApiKey: process.env.SURPLUS_API_KEY,
  surplusModel: process.env.SURPLUS_MODEL || 'auto'
});

const report = await sdk.screenRepository(
  {
    repoUrl: 'https://github.com/owner/repo',
    scope: 'standard'
  },
  'json'
);

console.log(report.providerInsights);
```

Provider output is stored under `report.providerInsights`. The SDK does not let provider output directly overwrite heuristic risk scores. Instead, it adds provider risk signals, review chapters, decision questions, recommendations, and merge-readiness rationale so downstream products can decide how to display or gate the result.

### Surplus options

- `aiProvider`: use `'surplus'` to enable provider-assisted insights. Default is `'heuristic'`.
- `providerErrorMode`: `'attach'` or `'throw'`. Default is `'attach'`, which stores provider errors in the report instead of failing the whole screening run.
- `surplusApiKey`: defaults to `SURPLUS_API_KEY`.
- `surplusBaseUrl`: defaults to `SURPLUS_BASE_URL` or `https://www.surplusintelligence.ai/x402/api/inference/v1`.
- `surplusChatCompletionsPath`: defaults to `/chat/completions`.
- `surplusModel`: defaults to `SURPLUS_MODEL` or `auto`.
- `surplusTemperature`: defaults to `0.2`.
- `surplusMaxTokens`: defaults to `1800`.
- `surplusTimeoutMs`: defaults to `45000`.
- `surplusMaxInputChars`: defaults to `60000`.
- `surplusMaxFileChars`: defaults to `6000`.
- `surplusHeaders`: optional extra headers.
- `fetchImpl`: optional custom fetch implementation for tests or runtimes that do not expose global `fetch`.

Sensitive-looking tokens, private keys, bearer values, JWTs, and env secret assignments are redacted before snippets are sent to the provider.

## API

### new GitLumenScreenSDK(options)

Options:
- githubToken: optional GitHub token
- dataDir: local directory for report storage
- maxFileBytes: max file bytes fetched from raw GitHub file content
- githubApiBase: override GitHub API base URL
- rawBase: override raw content base URL
- userAgent: custom user agent string
- aiProvider: optional provider name, currently `surplus` or `heuristic`
- providerErrorMode: `attach` or `throw` for provider failures
- surplusApiKey, surplusBaseUrl, surplusModel, surplusHeaders: Surplus provider configuration

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
- SurplusProvider
- createAnalysisProvider
- reportCompact
- formatReportOutput

## Examples

```bash
npm run example
node ./examples/surplus-provider.js
```

## Tests

```bash
npm test
```

## Requirements

- Node.js 20+
