import { createConfig, DEFAULT_LIMITS } from '../src/config.js';

describe('createConfig', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('returns expected defaults when no overrides or env vars are set', () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITLUMEN_SCREEN_DATA_DIR;
    delete process.env.GITLUMEN_MAX_FILE_BYTES;

    const config = createConfig();
    expect(config.githubToken).toBe('');
    expect(config.maxFileBytes).toBe(120000);
    expect(config.githubApiBase).toBe('https://api.github.com');
    expect(config.rawBase).toBe('https://raw.githubusercontent.com');
    expect(config.userAgent).toBe('gitlumen-screen-sdk/0.1.0');
    expect(config.aiProvider).toBe('heuristic');
    expect(config.veniceBaseUrl).toBe('https://api.venice.ai/api/v1');
    expect(config.veniceChatCompletionsPath).toBe('/chat/completions');
    expect(config.veniceModel).toBe('zai-org-glm-5');
    expect(config.dataDir).toMatch(/gitlumen-screen-sdk/);
  });

  test('overrides respect explicit values', () => {
    const config = createConfig({
      githubToken: 'test-token',
      maxFileBytes: 50000,
      githubApiBase: 'https://ghproxy.example.com',
      rawBase: 'https://raw.example.com',
      userAgent: 'my-agent/1.0',
      aiProvider: 'venice',
      veniceApiKey: 'venice-key',
      veniceBaseUrl: 'https://venice.example.com/v1',
      veniceModel: 'venice/test'
    });
    expect(config.githubToken).toBe('test-token');
    expect(config.maxFileBytes).toBe(50000);
    expect(config.githubApiBase).toBe('https://ghproxy.example.com');
    expect(config.rawBase).toBe('https://raw.example.com');
    expect(config.userAgent).toBe('my-agent/1.0');
    expect(config.aiProvider).toBe('venice');
    expect(config.veniceApiKey).toBe('venice-key');
    expect(config.veniceBaseUrl).toBe('https://venice.example.com/v1');
    expect(config.veniceModel).toBe('venice/test');
  });

  test('GITHUB_TOKEN env var is used when no override is given', () => {
    process.env.GITHUB_TOKEN = 'env-token';
    const config = createConfig();
    expect(config.githubToken).toBe('env-token');
  });

  test('GITLUMEN_MAX_FILE_BYTES env var overrides default', () => {
    process.env.GITLUMEN_MAX_FILE_BYTES = '200000';
    const config = createConfig();
    expect(config.maxFileBytes).toBe(200000);
  });


  test('Venice env vars are used when no overrides are given', () => {
    process.env.GITLUMEN_AI_PROVIDER = 'venice';
    process.env.VENICE_API_KEY = 'env-venice-key';
    process.env.VENICE_BASE_URL = 'https://venice.env/v1';
    process.env.VENICE_MODEL = 'venice/env-model';
    process.env.VENICE_MAX_TOKENS = '900';

    const config = createConfig();
    expect(config.aiProvider).toBe('venice');
    expect(config.veniceApiKey).toBe('env-venice-key');
    expect(config.veniceBaseUrl).toBe('https://venice.env/v1');
    expect(config.veniceModel).toBe('venice/env-model');
    expect(config.veniceMaxTokens).toBe(900);
  });

  test('explicit override takes precedence over env var', () => {
    process.env.GITHUB_TOKEN = 'env-token';
    const config = createConfig({ githubToken: 'explicit-token' });
    expect(config.githubToken).toBe('explicit-token');
  });
});

describe('DEFAULT_LIMITS', () => {
  test('has expected shape and values', () => {
    expect(DEFAULT_LIMITS.maxTreeEntries).toBe(2500);
    expect(DEFAULT_LIMITS.quickMaxFiles).toBe(40);
    expect(DEFAULT_LIMITS.standardMaxFiles).toBe(90);
    expect(DEFAULT_LIMITS.deepMaxFiles).toBe(180);
    expect(DEFAULT_LIMITS.maxPrFiles).toBe(300);
  });

  test('quick < standard < deep', () => {
    expect(DEFAULT_LIMITS.quickMaxFiles).toBeLessThan(DEFAULT_LIMITS.standardMaxFiles);
    expect(DEFAULT_LIMITS.standardMaxFiles).toBeLessThan(DEFAULT_LIMITS.deepMaxFiles);
  });
});
