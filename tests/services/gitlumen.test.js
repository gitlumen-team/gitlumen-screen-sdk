import { GitLumenService } from '../../src/services/gitlumen.js';

function makeSnapshot(overrides = {}) {
  return {
    mode: 'repository',
    owner: 'owner',
    repo: 'repo',
    repoUrl: 'https://github.com/owner/repo',
    ref: 'main',
    defaultBranch: 'main',
    description: 'Test repo',
    stars: 0,
    forks: 0,
    language: 'JavaScript',
    isPrivate: false,
    tree: [
      { path: 'README.md', type: 'blob', size: 500 },
      { path: 'LICENSE', type: 'blob', size: 1000 },
      { path: '.github/workflows/ci.yml', type: 'blob', size: 300 },
      { path: 'src/index.test.js', type: 'blob', size: 200 }
    ],
    files: [],
    limits: { treeEntriesReturned: 4, treeTruncated: false, filesDownloaded: 0, scope: 'standard' },
    ...overrides
  };
}

function makeMockGithub(snapshot) {
  return { loadRepositorySnapshot: async () => snapshot };
}

function makeMockStore() {
  const saved = new Map();
  return {
    save: async (report) => { saved.set(report.reportId, report); },
    get: async (id) => {
      if (!saved.has(id)) throw new Error(`Not found: ${id}`);
      return saved.get(id);
    },
    list: async (limit = 20) => [...saved.values()].slice(0, limit),
    _saved: saved
  };
}

describe('GitLumenService.screenRepository', () => {
  test('returns a report with correct target fields', async () => {
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot()), store: makeMockStore() });
    const report = await service.screenRepository({ repoUrl: 'https://github.com/owner/repo', scope: 'standard' });
    expect(report.target.owner).toBe('owner');
    expect(report.target.repo).toBe('repo');
    expect(report.target.mode).toBe('repository');
    expect(report.target.ref).toBe('main');
  });

  test('persists the report to the store', async () => {
    const store = makeMockStore();
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot()), store });
    const report = await service.screenRepository({ repoUrl: 'https://github.com/owner/repo' });
    expect(store._saved.has(report.reportId)).toBe(true);
  });

  test('passes scope and maxFiles to github.loadRepositorySnapshot', async () => {
    let capturedArgs;
    const mockGithub = { loadRepositorySnapshot: async (args) => { capturedArgs = args; return makeSnapshot(); } };
    const service = new GitLumenService({ githubClient: mockGithub, store: makeMockStore() });
    await service.screenRepository({ repoUrl: 'https://github.com/owner/repo', scope: 'deep', maxFiles: 50 });
    expect(capturedArgs.scope).toBe('deep');
    expect(capturedArgs.maxFiles).toBe(50);
  });

  test('defaults scope to "standard" when not provided', async () => {
    let capturedArgs;
    const mockGithub = { loadRepositorySnapshot: async (args) => { capturedArgs = args; return makeSnapshot(); } };
    const service = new GitLumenService({ githubClient: mockGithub, store: makeMockStore() });
    await service.screenRepository({ repoUrl: 'https://github.com/owner/repo' });
    expect(capturedArgs.scope).toBe('standard');
  });

  test('passes branch to github.loadRepositorySnapshot', async () => {
    let capturedArgs;
    const mockGithub = { loadRepositorySnapshot: async (args) => { capturedArgs = args; return makeSnapshot(); } };
    const service = new GitLumenService({ githubClient: mockGithub, store: makeMockStore() });
    await service.screenRepository({ repoUrl: 'https://github.com/owner/repo', branch: 'develop' });
    expect(capturedArgs.branch).toBe('develop');
  });
});

describe('GitLumenService.getReport', () => {
  test('retrieves a previously saved report by ID', async () => {
    const store = makeMockStore();
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot()), store });
    const saved = await service.screenRepository({ repoUrl: 'https://github.com/owner/repo' });
    const retrieved = await service.getReport(saved.reportId);
    expect(retrieved.reportId).toBe(saved.reportId);
  });
});

describe('GitLumenService.listReports', () => {
  test('returns a list of reports from the store', async () => {
    const store = makeMockStore();
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot()), store });
    await service.screenRepository({ repoUrl: 'https://github.com/owner/repo' });
    const list = await service.listReports(20);
    expect(list).toHaveLength(1);
  });

  test('respects the limit parameter', async () => {
    const store = makeMockStore();
    const snapshots = [
      makeSnapshot({ owner: 'o1', repo: 'r1', repoUrl: 'https://github.com/o1/r1' }),
      makeSnapshot({ owner: 'o2', repo: 'r2', repoUrl: 'https://github.com/o2/r2' }),
      makeSnapshot({ owner: 'o3', repo: 'r3', repoUrl: 'https://github.com/o3/r3' })
    ];
    let idx = 0;
    const mockGithub = { loadRepositorySnapshot: async () => snapshots[idx++] };
    const service = new GitLumenService({ githubClient: mockGithub, store });
    for (const s of snapshots) {
      await service.screenRepository({ repoUrl: s.repoUrl });
    }
    const list = await service.listReports(2);
    expect(list.length).toBeLessThanOrEqual(2);
  });
});

describe('GitLumenService.getRepositoryStructure', () => {
  test('returns target and structure fields', async () => {
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot()), store: makeMockStore() });
    const result = await service.getRepositoryStructure({ repoUrl: 'https://github.com/owner/repo' });
    expect(result).toHaveProperty('target');
    expect(result).toHaveProperty('structure');
    expect(result).toHaveProperty('limits');
    expect(result.target.owner).toBe('owner');
    expect(result.target.repo).toBe('repo');
  });

  test('respects limit on structure entries', async () => {
    const bigTree = Array.from({ length: 400 }, (_, i) => ({ path: `file${i}.js`, type: 'blob', size: 100 }));
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot({ tree: bigTree })), store: makeMockStore() });
    const result = await service.getRepositoryStructure({ repoUrl: 'https://github.com/owner/repo', limit: 50 });
    expect(result.structure.length).toBeLessThanOrEqual(50);
  });

  test('defaults structure limit to 300', async () => {
    const bigTree = Array.from({ length: 400 }, (_, i) => ({ path: `file${i}.js`, type: 'blob', size: 100 }));
    const service = new GitLumenService({ githubClient: makeMockGithub(makeSnapshot({ tree: bigTree })), store: makeMockStore() });
    const result = await service.getRepositoryStructure({ repoUrl: 'https://github.com/owner/repo' });
    expect(result.structure.length).toBeLessThanOrEqual(300);
  });

  test('forces scope to "quick" with maxFiles 1 when fetching structure', async () => {
    let capturedArgs;
    const mockGithub = { loadRepositorySnapshot: async (args) => { capturedArgs = args; return makeSnapshot(); } };
    const service = new GitLumenService({ githubClient: mockGithub, store: makeMockStore() });
    await service.getRepositoryStructure({ repoUrl: 'https://github.com/owner/repo' });
    expect(capturedArgs.scope).toBe('quick');
    expect(capturedArgs.maxFiles).toBe(1);
  });
});
