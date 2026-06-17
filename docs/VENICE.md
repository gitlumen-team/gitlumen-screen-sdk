# Venice AI Provider

GitLumen Screen SDK can keep local heuristic screening as the default path while using Venice AI as an optional provider-assisted review layer.

The Venice provider does not overwrite heuristic risk scores. It attaches provider output under `report.providerInsights` and appends provider review chapters, decision questions, recommendations, and merge-readiness rationale.

## Environment variables

```bash
export VENICE_API_KEY=your_venice_api_key
export VENICE_MODEL=zai-org-glm-5
# optional
export VENICE_BASE_URL=https://api.venice.ai/api/v1
export VENICE_CHAT_COMPLETIONS_PATH=/chat/completions
export VENICE_TEMPERATURE=0.2
export VENICE_MAX_TOKENS=1800
export VENICE_TIMEOUT_MS=45000
export VENICE_MAX_INPUT_CHARS=60000
export VENICE_MAX_FILE_CHARS=6000
```

## Usage

```js
import { GitLumenScreenSDK } from 'gitlumen-screen-sdk';

const sdk = new GitLumenScreenSDK({
  githubToken: process.env.GITHUB_TOKEN,
  aiProvider: 'venice',
  veniceApiKey: process.env.VENICE_API_KEY,
  veniceModel: process.env.VENICE_MODEL || 'zai-org-glm-5'
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

## Options

- `aiProvider`: use `'venice'` to enable Venice AI provider-assisted insights.
- `providerErrorMode`: `'attach'` or `'throw'`. Default is `'attach'`.
- `veniceApiKey`: defaults to `VENICE_API_KEY`.
- `veniceBaseUrl`: defaults to `VENICE_BASE_URL` or `https://api.venice.ai/api/v1`.
- `veniceChatCompletionsPath`: defaults to `/chat/completions`.
- `veniceModel`: defaults to `VENICE_MODEL` or `zai-org-glm-5`.
- `veniceTemperature`: defaults to `0.2`.
- `veniceMaxTokens`: defaults to `1800`.
- `veniceTimeoutMs`: defaults to `45000`.
- `veniceMaxInputChars`: defaults to `60000`.
- `veniceMaxFileChars`: defaults to `6000`.
- `veniceHeaders`: optional extra headers.
- `fetchImpl`: optional custom fetch implementation for tests or runtimes that do not expose global `fetch`.

Sensitive-looking tokens, private keys, bearer values, JWTs, and env secret assignments are redacted before snippets are sent to the provider.

## Example

```bash
node ./examples/venice-provider.js
```
