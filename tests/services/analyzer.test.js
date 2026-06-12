import { analyzeSnapshot } from '../../src/services/analyzer.js';

function makeSnapshot(overrides = {}) {
  return {
    mode: 'repository',
    owner: 'testowner',
    repo: 'testrepo',
    repoUrl: 'https://github.com/testowner/testrepo',
    ref: 'main',
    defaultBranch: 'main',
    description: '',
    stars: 0,
    forks: 0,
    language: 'JavaScript',
    isPrivate: false,
    tree: [],
    files: [],
    limits: {
      treeEntriesReturned: 0,
      treeTruncated: false,
      filesDownloaded: 0,
      scope: 'standard'
    },
    ...overrides
  };
}

function findingsByTitle(report, title) {
  return report.findings.filter((f) => f.title.includes(title));
}

describe('analyzeSnapshot – report shape', () => {
  test('returns a report with expected top-level fields', () => {
    const report = analyzeSnapshot(makeSnapshot());
    expect(report.reportId).toMatch(/^glr_/);
    expect(typeof report.generatedAt).toBe('string');
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(Array.isArray(report.chapters)).toBe(true);
    expect(Array.isArray(report.decisionQuestions)).toBe(true);
    expect(typeof report.markdown).toBe('string');
    expect(typeof report.summary).toBe('string');
    expect(typeof report.risk.score).toBe('number');
    expect(['low', 'medium', 'high', 'critical']).toContain(report.risk.level);
  });

  test('risk score is capped at 100', () => {
    const manyFindings = makeSnapshot({
      files: Array.from({ length: 20 }, (_, i) => ({
        path: `src/file${i}.js`,
        content: `const password = 'hardcoded-super-secret-value-here-${i}'; eval('bad')`,
        size: 100,
        truncated: false
      }))
    });
    const report = analyzeSnapshot(manyFindings);
    expect(report.risk.score).toBeLessThanOrEqual(100);
  });

  test('findings are sorted by severity weight descending', () => {
    const report = analyzeSnapshot(makeSnapshot());
    const weights = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };
    for (let i = 0; i < report.findings.length - 1; i++) {
      expect(weights[report.findings[i].severity] || 0).toBeGreaterThanOrEqual(
        weights[report.findings[i + 1].severity] || 0
      );
    }
  });
});

describe('analyzeSnapshot – structure checks', () => {
  test('raises finding when README is missing', () => {
    const report = analyzeSnapshot(makeSnapshot());
    const found = findingsByTitle(report, 'README not detected');
    expect(found).toHaveLength(1);
    expect(found[0].category).toBe('maintainability');
  });

  test('does not raise README finding when readme.md is in the tree', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: 'README.md', type: 'blob', size: 100 }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'README not detected')).toHaveLength(0);
  });

  test('raises finding when LICENSE is missing', () => {
    expect(findingsByTitle(analyzeSnapshot(makeSnapshot()), 'License file not detected')).toHaveLength(1);
  });

  test('does not raise license finding when LICENSE is present', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: 'LICENSE', type: 'blob', size: 1000 }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'License file not detected')).toHaveLength(0);
  });

  test('raises CI finding when no workflows directory', () => {
    expect(findingsByTitle(analyzeSnapshot(makeSnapshot()), 'CI workflow not detected')).toHaveLength(1);
  });

  test('does not raise CI finding when .github/workflows exists', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: '.github/workflows/ci.yml', type: 'blob', size: 500 }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'CI workflow not detected')).toHaveLength(0);
  });

  test('raises test surface finding when no test files are present', () => {
    const report = analyzeSnapshot(makeSnapshot());
    const found = findingsByTitle(report, 'Test surface not detected');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('does not raise test finding when test files are present', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: 'src/foo.test.js', type: 'blob', size: 200 }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Test surface not detected')).toHaveLength(0);
  });

  test('raises env vars finding when env vars are used but no .env.example exists', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/index.js', content: 'const key = process.env.API_KEY;', size: 50, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Environment variables used').length).toBeGreaterThanOrEqual(1);
  });

  test('does not raise env vars finding when .env.example is present', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: '.env.example', type: 'blob', size: 50 }],
      files: [{ path: 'src/index.js', content: 'const key = process.env.API_KEY;', size: 50, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Environment variables used')).toHaveLength(0);
  });
});

describe('analyzeSnapshot – code security checks', () => {
  test('detects hardcoded private key', () => {
    const snapshot = makeSnapshot({
      files: [{
        path: 'src/auth.js',
        content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        size: 100,
        truncated: false
      }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'Potential hardcoded secret: Private key');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('critical');
    expect(found[0].category).toBe('security');
  });

  test('detects AWS access key pattern', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/aws.js', content: 'const key = "AKIAIOSFODNN7EXAMPLE";', size: 50, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'Potential hardcoded secret: AWS access key');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('critical');
  });

  test('detects GitHub token pattern', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/github.js', content: 'const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";', size: 60, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Potential hardcoded secret: GitHub token')).toHaveLength(1);
  });

  test('does not flag secrets in .env.example files', () => {
    const snapshot = makeSnapshot({
      files: [{
        path: '.env.example',
        content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        size: 100,
        truncated: false
      }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Potential hardcoded secret')).toHaveLength(0);
  });

  test('detects eval() usage', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/eval-file.js', content: 'const result = eval(userInput);', size: 40, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'Dynamic code execution detected');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('detects new Function() usage', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/func.js', content: 'const fn = new Function("return 1");', size: 40, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Dynamic code execution detected')).toHaveLength(1);
  });

  test('detects dangerouslySetInnerHTML', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/Component.jsx', content: '<div dangerouslySetInnerHTML={{ __html: userInput }} />', size: 60, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'dangerouslySetInnerHTML detected');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('medium');
  });

  test('detects command injection pattern with user input', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/cmd.js', content: 'const { exec } = require("child_process"); exec(req.query.cmd);', size: 80, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'Command execution potentially influenced by user input');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('detects weak hash near password context', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/hash.js', content: 'const hash = md5(password);', size: 30, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Weak hash algorithm').length).toBeGreaterThanOrEqual(1);
  });

  test('detects SQL interpolation with request input', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'src/db.js', content: 'const sql = `SELECT * FROM users WHERE id = ${req.query.id}`;', size: 70, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Possible SQL query string interpolation').length).toBeGreaterThanOrEqual(1);
  });
});

describe('analyzeSnapshot – GitHub Actions checks', () => {
  test('detects pull_request_target in workflow file', () => {
    const snapshot = makeSnapshot({
      files: [{ path: '.github/workflows/ci.yml', content: 'on:\n  pull_request_target:\n    branches: [main]\n', size: 60, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'GitHub Actions uses pull_request_target');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('detects unpinned GitHub Action using tag/branch', () => {
    const snapshot = makeSnapshot({
      files: [{ path: '.github/workflows/ci.yml', content: 'steps:\n  - uses: actions/checkout@v3\n', size: 60, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'GitHub Action not pinned to a commit SHA').length).toBeGreaterThanOrEqual(1);
  });
});

describe('analyzeSnapshot – Dockerfile checks', () => {
  test('detects curl piped to shell in Dockerfile', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'dockerfile', content: 'RUN curl https://example.com/install.sh | bash\n', size: 60, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'Dockerfile executes remote scripts directly');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('detects missing USER instruction in Dockerfile', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'dockerfile', content: 'FROM node:20-alpine\nRUN npm install\nCMD ["node", "index.js"]\n', size: 80, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Dockerfile does not set a non-root USER').length).toBeGreaterThanOrEqual(1);
  });

  test('does not flag Dockerfile with a USER instruction', () => {
    const snapshot = makeSnapshot({
      files: [{ path: 'dockerfile', content: 'FROM node:20-alpine\nUSER node\nCMD ["node", "index.js"]\n', size: 80, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Dockerfile does not set a non-root USER')).toHaveLength(0);
  });
});

describe('analyzeSnapshot – package.json checks', () => {
  test('detects risky lifecycle scripts', () => {
    const pkgContent = JSON.stringify({
      name: 'test',
      scripts: { postinstall: 'curl https://example.com/setup.sh | bash' },
      dependencies: {}
    });
    const snapshot = makeSnapshot({
      tree: [{ path: 'package.json', type: 'blob', size: pkgContent.length }],
      files: [{ path: 'package.json', content: pkgContent, size: pkgContent.length, truncated: false }]
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'Risky lifecycle script: postinstall');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('detects missing lockfile when dependencies are declared', () => {
    const pkgContent = JSON.stringify({ name: 'test', dependencies: { express: '^4.0.0' } });
    const snapshot = makeSnapshot({
      tree: [{ path: 'package.json', type: 'blob', size: pkgContent.length }],
      files: [{ path: 'package.json', content: pkgContent, size: pkgContent.length, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Dependency lockfile not detected')).toHaveLength(1);
  });

  test('does not raise lockfile finding when package-lock.json exists', () => {
    const pkgContent = JSON.stringify({ name: 'test', dependencies: { express: '^4.0.0' } });
    const snapshot = makeSnapshot({
      tree: [
        { path: 'package.json', type: 'blob', size: pkgContent.length },
        { path: 'package-lock.json', type: 'blob', size: 5000 }
      ],
      files: [{ path: 'package.json', content: pkgContent, size: pkgContent.length, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Dependency lockfile not detected')).toHaveLength(0);
  });

  test('detects risky packages (e.g. request)', () => {
    const pkgContent = JSON.stringify({ name: 'test', dependencies: { request: '^2.88.0' } });
    const snapshot = makeSnapshot({
      tree: [{ path: 'package.json', type: 'blob', size: pkgContent.length }],
      files: [{ path: 'package.json', content: pkgContent, size: pkgContent.length, truncated: false }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'Dependencies requiring manual review')).toHaveLength(1);
  });

  test('handles invalid JSON in package.json gracefully', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: 'package.json', type: 'blob', size: 10 }],
      files: [{ path: 'package.json', content: 'NOT_JSON', size: 10, truncated: false }]
    });
    expect(() => analyzeSnapshot(snapshot)).not.toThrow();
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'package.json is not valid JSON')).toHaveLength(1);
  });
});

describe('analyzeSnapshot – pull request mode', () => {
  test('detects oversized PR', () => {
    const snapshot = makeSnapshot({
      mode: 'pull_request',
      pullRequest: {
        number: 1, title: 'Big PR', state: 'open', author: 'dev',
        baseRef: 'main', headRef: 'feature', changedFiles: 50,
        additions: 2000, deletions: 600, htmlUrl: 'https://github.com/a/b/pull/1'
      },
      files: []
    });
    const found = findingsByTitle(analyzeSnapshot(snapshot), 'PR is too large for safe review');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  test('detects PR that removes test files', () => {
    const snapshot = makeSnapshot({
      mode: 'pull_request',
      pullRequest: {
        number: 2, title: 'Remove tests', state: 'open', author: 'dev',
        baseRef: 'main', headRef: 'feature', changedFiles: 1,
        additions: 0, deletions: 100, htmlUrl: 'https://github.com/a/b/pull/2'
      },
      files: [{ path: 'src/auth.test.js', content: '', size: 0, truncated: false, status: 'removed' }]
    });
    expect(findingsByTitle(analyzeSnapshot(snapshot), 'PR removes test files')).toHaveLength(1);
  });
});

describe('analyzeSnapshot – language and framework detection', () => {
  test('detects JavaScript from .js files', () => {
    const snapshot = makeSnapshot({
      tree: [
        { path: 'src/index.js', type: 'blob', size: 100 },
        { path: 'src/utils.js', type: 'blob', size: 100 }
      ]
    });
    const langs = analyzeSnapshot(snapshot).repositorySignals.detectedLanguages.map((l) => l.language);
    expect(langs).toContain('JavaScript');
  });

  test('detects Next.js framework from package.json', () => {
    const pkgContent = JSON.stringify({ name: 'test', dependencies: { next: '13.0.0' } });
    const snapshot = makeSnapshot({
      tree: [{ path: 'package.json', type: 'blob', size: pkgContent.length }],
      files: [{ path: 'package.json', content: pkgContent, size: pkgContent.length, truncated: false }]
    });
    expect(analyzeSnapshot(snapshot).repositorySignals.frameworks).toContain('Next.js');
  });

  test('detects Docker from Dockerfile presence', () => {
    const snapshot = makeSnapshot({
      tree: [{ path: 'dockerfile', type: 'blob', size: 200 }],
      files: [{ path: 'dockerfile', content: 'FROM node:20\nUSER node\n', size: 20, truncated: false }]
    });
    expect(analyzeSnapshot(snapshot).repositorySignals.frameworks).toContain('Docker');
  });
});

describe('analyzeSnapshot – risk scoring', () => {
  test('clean repo with README, LICENSE, CI has low risk', () => {
    const snapshot = makeSnapshot({
      tree: [
        { path: 'README.md', type: 'blob', size: 500 },
        { path: 'LICENSE', type: 'blob', size: 1000 },
        { path: '.github/workflows/ci.yml', type: 'blob', size: 300 },
        { path: 'src/index.test.js', type: 'blob', size: 200 }
      ],
      files: []
    });
    const report = analyzeSnapshot(snapshot);
    expect(report.risk.level).toBe('low');
    expect(report.risk.score).toBeLessThan(25);
  });

  test('multiple security findings push score above 50', () => {
    const manySecrets = makeSnapshot({
      files: [{
        path: 'src/keys.js',
        content: [
          '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...',
          'const ghp_token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";',
          'const aws = "AKIAIOSFODNN7EXAMPLE";',
          'const secret = eval("bad"); new Function("return 1")();'
        ].join('\n'),
        size: 500,
        truncated: false
      }]
    });
    const report = analyzeSnapshot(manySecrets);
    expect(report.risk.score).toBeGreaterThanOrEqual(50);
  });
});
