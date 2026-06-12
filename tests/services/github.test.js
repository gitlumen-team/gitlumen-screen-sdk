import { GitHubClient } from '../../src/services/github.js';

function makeClient(options = {}) {
  return new GitHubClient({ githubToken: 'test-token', ...options });
}

function makeBlobEntry(path, size = 100) {
  return { type: 'blob', path, size };
}

function makeTreeEntry(path) {
  return { type: 'tree', path, size: 0 };
}

describe('GitHubClient constructor', () => {
  test('uses provided token', () => {
    const client = new GitHubClient({ token: 'my-token' });
    expect(client.token).toBe('my-token');
  });

  test('uses default config values when no options provided', () => {
    const client = new GitHubClient({});
    expect(client.config.githubApiBase).toBe('https://api.github.com');
    expect(client.config.rawBase).toBe('https://raw.githubusercontent.com');
    expect(client.config.userAgent).toBe('gitlumen-screen-sdk/0.1.0');
  });
});

describe('GitHubClient.headers()', () => {
  test('includes Accept and X-GitHub-Api-Version headers', () => {
    const headers = makeClient().headers();
    expect(headers['Accept']).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  test('includes Authorization header when token is set', () => {
    const headers = new GitHubClient({ token: 'tok123' }).headers();
    expect(headers['Authorization']).toBe('Bearer tok123');
  });

  test('omits Authorization header when no token is set', () => {
    const headers = new GitHubClient({ token: '' }).headers();
    expect(headers).not.toHaveProperty('Authorization');
  });

  test('merges extra headers', () => {
    const headers = makeClient().headers({ 'X-Custom': 'value' });
    expect(headers['X-Custom']).toBe('value');
    expect(headers['Accept']).toBe('application/vnd.github+json');
  });
});

describe('GitHubClient.selectFilesForContent()', () => {
  test('filters out tree-type entries (directories)', () => {
    const client = makeClient();
    const entries = [makeBlobEntry('src/index.js'), makeTreeEntry('src')];
    const selected = client.selectFilesForContent(entries, 'standard', null);
    expect(selected.every((e) => e.type === 'blob')).toBe(true);
  });

  test('filters out node_modules paths', () => {
    const client = makeClient();
    const entries = [makeBlobEntry('node_modules/lodash/index.js'), makeBlobEntry('src/index.js')];
    const selected = client.selectFilesForContent(entries, 'standard', null);
    expect(selected).toHaveLength(1);
    expect(selected[0].path).toBe('src/index.js');
  });

  test('filters out dist/ paths', () => {
    const client = makeClient();
    const entries = [makeBlobEntry('dist/bundle.js'), makeBlobEntry('src/index.js')];
    const selected = client.selectFilesForContent(entries, 'standard', null);
    expect(selected).toHaveLength(1);
    expect(selected[0].path).toBe('src/index.js');
  });

  test('filters out non-text files (binary extensions)', () => {
    const client = makeClient();
    const entries = [makeBlobEntry('assets/image.png'), makeBlobEntry('src/index.js')];
    const selected = client.selectFilesForContent(entries, 'standard', null);
    expect(selected).toHaveLength(1);
    expect(selected[0].path).toBe('src/index.js');
  });

  test('includes important filenames like package.json', () => {
    const client = makeClient();
    const selected = client.selectFilesForContent([makeBlobEntry('package.json')], 'standard', null);
    expect(selected).toHaveLength(1);
  });

  test('respects the quick scope file limit (40)', () => {
    const client = makeClient();
    const entries = Array.from({ length: 60 }, (_, i) => makeBlobEntry(`src/file${i}.js`));
    const selected = client.selectFilesForContent(entries, 'quick', null);
    expect(selected.length).toBeLessThanOrEqual(40);
  });

  test('respects a custom requestedMaxFiles override', () => {
    const client = makeClient();
    const entries = Array.from({ length: 100 }, (_, i) => makeBlobEntry(`src/file${i}.js`));
    expect(client.selectFilesForContent(entries, 'standard', 10)).toHaveLength(10);
  });

  test('sorts higher-priority files (e.g. package.json) before lower-priority ones', () => {
    const client = makeClient();
    const entries = [
      makeBlobEntry('src/random.js'),
      makeBlobEntry('package.json'),
      makeBlobEntry('src/auth/login.js')
    ];
    const selected = client.selectFilesForContent(entries, 'standard', null);
    expect(selected[0].path).toBe('package.json');
  });

  test('includes .env.example as a text-like file', () => {
    const client = makeClient();
    expect(client.selectFilesForContent([makeBlobEntry('.env.example')], 'standard', null)).toHaveLength(1);
  });

  test('returns empty array when all entries are filtered out', () => {
    const client = makeClient();
    const entries = [
      makeBlobEntry('node_modules/pkg/index.js'),
      makeBlobEntry('dist/app.js'),
      makeTreeEntry('src')
    ];
    expect(client.selectFilesForContent(entries, 'standard', null)).toHaveLength(0);
  });
});
