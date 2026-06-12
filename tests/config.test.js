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
    expect(config.dataDir).toMatch(/gitlumen-screen-sdk/);
  });

  test('overrides respect explicit values', () => {
    const config = createConfig({
      githubToken: 'test-token',
      maxFileBytes: 50000,
      githubApiBase: 'https://ghproxy.example.com',
      rawBase: 'https://raw.example.com',
      userAgent: 'my-agent/1.0'
    });
    expect(config.githubToken).toBe('test-token');
    expect(config.maxFileBytes).toBe(50000);
    expect(config.githubApiBase).toBe('https://ghproxy.example.com');
    expect(config.rawBase).toBe('https://raw.example.com');
    expect(config.userAgent).toBe('my-agent/1.0');
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
