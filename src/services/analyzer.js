import { CategoryNames, SeverityWeights } from '../types.js';
import { createReportId, stableHash } from '../utils/ids.js';
import { unique } from '../utils/text.js';

function normalizePath(path) {
  return path.toLowerCase().replace(/\\/g, '/');
}

function ext(path) {
  const lower = normalizePath(path);
  const idx = lower.lastIndexOf('.');
  return idx >= 0 ? lower.slice(idx) : '';
}

function base(path) {
  return normalizePath(path).split('/').pop();
}

function hasPath(paths, matcher) {
  return paths.some((p) => matcher(normalizePath(p)));
}

function countBy(paths, matcher) {
  return paths.filter((p) => matcher(normalizePath(p))).length;
}

function findPackageJson(snapshot) {
  return snapshot.files.find((file) => base(file.path) === 'package.json');
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function addFinding(findings, { category, severity = 'medium', title, evidence = [], recommendation, file, confidence = 'medium' }) {
  findings.push({
    id: `glf_${stableHash(`${category}|${severity}|${title}|${file || ''}`, 10)}`,
    category,
    severity,
    title,
    evidence: evidence.filter(Boolean).slice(0, 6),
    recommendation,
    file: file || null,
    confidence
  });
}

function detectLanguages(paths) {
  const counts = new Map();
  const map = {
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.kt': 'Kotlin',
    '.rb': 'Ruby', '.php': 'PHP', '.cs': 'C#', '.sol': 'Solidity', '.vy': 'Vyper',
    '.sh': 'Shell', '.tf': 'Terraform', '.yaml': 'YAML', '.yml': 'YAML'
  };
  for (const path of paths) {
    const lang = map[ext(path)];
    if (lang) counts.set(lang, (counts.get(lang) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([language, count]) => ({ language, count }));
}

function detectFrameworks(snapshot, packageJson) {
  const paths = snapshot.tree.map((entry) => normalizePath(entry.path));
  const deps = packageJson ? {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  } : {};
  const names = new Set(Object.keys(deps || {}));
  const frameworks = [];

  if (names.has('next') || hasPath(paths, (p) => p.includes('next.config'))) frameworks.push('Next.js');
  if (names.has('react')) frameworks.push('React');
  if (names.has('vite') || hasPath(paths, (p) => p.includes('vite.config'))) frameworks.push('Vite');
  if (names.has('express')) frameworks.push('Express');
  if (names.has('fastify')) frameworks.push('Fastify');
  if (names.has('hardhat') || hasPath(paths, (p) => p.includes('hardhat.config'))) frameworks.push('Hardhat');
  if (hasPath(paths, (p) => p === 'foundry.toml')) frameworks.push('Foundry');
  if (hasPath(paths, (p) => p === 'go.mod')) frameworks.push('Go modules');
  if (hasPath(paths, (p) => p === 'pyproject.toml')) frameworks.push('Python/pyproject');
  if (hasPath(paths, (p) => p === 'dockerfile' || p.endsWith('/dockerfile'))) frameworks.push('Docker');
  if (hasPath(paths, (p) => p.includes('.github/workflows/'))) frameworks.push('GitHub Actions');

  return unique(frameworks);
}

function analyzeStructure(snapshot, findings) {
  const paths = snapshot.tree.map((entry) => normalizePath(entry.path));
  const fileCount = snapshot.tree.filter((entry) => entry.type === 'blob').length;
  const dirCount = snapshot.tree.filter((entry) => entry.type === 'tree').length;

  const hasReadme = hasPath(paths, (p) => base(p) === 'readme.md' || base(p) === 'readme');
  const hasLicense = hasPath(paths, (p) => base(p) === 'license' || base(p).startsWith('license.'));
  const hasEnvExample = hasPath(paths, (p) => ['.env.example', '.env.sample', '.env.template'].includes(base(p)));
  const hasCI = hasPath(paths, (p) => p.startsWith('.github/workflows/') || p.includes('/.github/workflows/'));
  const hasDocker = hasPath(paths, (p) => base(p) === 'dockerfile' || base(p) === 'docker-compose.yml' || base(p) === 'compose.yml');
  const hasTests = hasPath(paths, (p) => p.includes('/test/') || p.includes('/tests/') || p.includes('/__tests__/') || p.endsWith('.test.js') || p.endsWith('.spec.js') || p.endsWith('.test.ts') || p.endsWith('.spec.ts') || p.endsWith('_test.go') || p.endsWith('_test.py'));

  if (!hasReadme) {
    addFinding(findings, {
      category: 'maintainability', severity: 'medium', title: 'README not detected',
      evidence: ['No README file found in the repository root tree.'],
      recommendation: 'Add a README that explains project purpose, setup, environment variables, run commands, and review surface.'
    });
  }

  if (!hasLicense) {
    addFinding(findings, {
      category: 'maintainability', severity: 'low', title: 'License file not detected',
      evidence: ['No LICENSE file found in the repository root tree.'],
      recommendation: 'Add a license file so repository usage and contribution terms are clear.'
    });
  }

  if (!hasEnvExample && snapshot.files.some((f) => /process\.env|import\.meta\.env|os\.environ|getenv\(/.test(f.content))) {
    addFinding(findings, {
      category: 'operations', severity: 'medium', title: 'Environment variables used without an env template',
      evidence: ['Code uses environment variables, but .env.example/.env.sample was not detected.'],
      recommendation: 'Add .env.example with variable names only and no real secrets.'
    });
  }

  if (!hasCI) {
    addFinding(findings, {
      category: 'operations', severity: 'medium', title: 'CI workflow not detected',
      evidence: ['No .github/workflows directory found in the analyzed tree.'],
      recommendation: 'Add a minimal CI pipeline for lint, test, build, and dependency/security checks.'
    });
  }

  if (!hasTests) {
    addFinding(findings, {
      category: 'tests', severity: 'high', title: 'Test surface not detected',
      evidence: ['No common test folders/files were found, such as tests/, __tests__, *.spec.ts, *.test.ts, or *_test.go.'],
      recommendation: 'Add unit tests for core logic and integration tests for key endpoints/tools.'
    });
  }

  if (fileCount > 1200 && snapshot.limits.treeTruncated) {
    addFinding(findings, {
      category: 'architecture', severity: 'medium', title: 'Large repository with truncated tree during screening',
      evidence: [`Tree returned ${snapshot.limits.treeEntriesReturned} entries; the original tree is likely larger.`],
      recommendation: 'Use deep scope or PR-based screening to focus review on changed files.'
    });
  }

  return { hasReadme, hasLicense, hasEnvExample, hasCI, hasDocker, hasTests, fileCount, dirCount };
}

function analyzePackageJson(snapshot, findings, packageJsonFile) {
  if (!packageJsonFile) return { packageManager: null, scripts: {}, dependencies: {} };
  const pkg = parseJsonSafe(packageJsonFile.content);
  if (!pkg) {
    addFinding(findings, {
      category: 'maintainability', severity: 'medium', title: 'package.json is not valid JSON',
      evidence: [`File: ${packageJsonFile.path}`],
      recommendation: 'Fix package.json so dependency/build tooling can process it safely.',
      file: packageJsonFile.path
    });
    return { packageManager: null, scripts: {}, dependencies: {} };
  }

  const paths = snapshot.tree.map((entry) => normalizePath(entry.path));
  const hasLock = hasPath(paths, (p) => ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'].includes(base(p)));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = pkg.scripts || {};

  if (!hasLock && Object.keys(deps).length > 0) {
    addFinding(findings, {
      category: 'dependencies', severity: 'medium', title: 'Dependency lockfile not detected',
      evidence: ['package.json declares dependencies, but no npm/pnpm/yarn/bun lockfile was found.'],
      recommendation: 'Commit a lockfile to make installs reproducible and reduce supply-chain risk.',
      file: packageJsonFile.path
    });
  }

  for (const [scriptName, command] of Object.entries(scripts)) {
    if (/preinstall|postinstall|prepare/.test(scriptName) && /(curl|wget|node|bash|sh|python|powershell)/i.test(command)) {
      addFinding(findings, {
        category: 'dependencies', severity: 'high', title: `Risky lifecycle script: ${scriptName}`,
        evidence: [`${scriptName}: ${String(command).slice(0, 180)}`],
        recommendation: 'Review lifecycle scripts. Avoid downloading/executing scripts at install time unless strictly necessary.',
        file: packageJsonFile.path
      });
    }
  }

  const riskyPackages = ['request', 'node-sass', 'event-stream', 'colors', 'faker'];
  const riskyFound = riskyPackages.filter((name) => deps[name]);
  if (riskyFound.length) {
    addFinding(findings, {
      category: 'dependencies', severity: 'medium', title: 'Dependencies requiring manual review detected',
      evidence: riskyFound.map((name) => `${name}@${deps[name]}`),
      recommendation: 'Verify dependency status, maintainer activity, and modern alternatives. Run npm audit/pnpm audit.',
      file: packageJsonFile.path
    });
  }

  const directSecrets = ['dotenv'].filter((name) => deps[name]);
  if (directSecrets.length && !snapshot.tree.some((entry) => ['.env.example', '.env.sample'].includes(base(entry.path)))) {
    addFinding(findings, {
      category: 'operations', severity: 'low', title: 'dotenv used without an env sample',
      evidence: [`Dependency: ${directSecrets.join(', ')}`],
      recommendation: 'Add .env.example and environment variable documentation.',
      file: packageJsonFile.path
    });
  }

  return {
    packageManager: hasPath(paths, (p) => base(p) === 'pnpm-lock.yaml') ? 'pnpm' : hasPath(paths, (p) => base(p) === 'yarn.lock') ? 'yarn' : hasPath(paths, (p) => base(p) === 'bun.lockb') ? 'bun' : 'npm',
    scripts,
    dependencies: deps,
    packageName: pkg.name || null,
    packageVersion: pkg.version || null
  };
}

function analyzeCodeContent(snapshot, findings) {
  const secretPatterns = [
    { name: 'Private key', regex: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i, severity: 'critical' },
    { name: 'GitHub token', regex: /gh[pousr]_[A-Za-z0-9_]{20,}/, severity: 'critical' },
    { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
    { name: 'Generic secret assignment', regex: /(api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*['"][^'"\n]{16,}['"]/i, severity: 'high' }
  ];

  for (const file of snapshot.files) {
    const content = file.content || '';
    const lowerPath = normalizePath(file.path);

    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content) && !lowerPath.includes('.env.example') && !lowerPath.includes('.env.sample')) {
        addFinding(findings, {
          category: 'security', severity: pattern.severity, title: `Potential hardcoded secret: ${pattern.name}`,
          evidence: [`Pattern detected in ${file.path}. Secret value is intentionally not shown.`],
          recommendation: 'Rotate the secret if valid, remove it from git history, and use a secret manager/environment variables.',
          file: file.path,
          confidence: pattern.name === 'Generic secret assignment' ? 'medium' : 'high'
        });
      }
    }

    if (/\beval\s*\(|new Function\s*\(/.test(content)) {
      addFinding(findings, {
        category: 'security', severity: 'high', title: 'Dynamic code execution detected',
        evidence: ['Contains eval() or new Function().'],
        recommendation: 'Avoid dynamic code execution. Use explicit parsers/validators.',
        file: file.path
      });
    }

    if (/child_process|exec\s*\(|execSync\s*\(|spawn\s*\(/.test(content) && /req\.|request|params|query|body|argv/.test(content)) {
      addFinding(findings, {
        category: 'security', severity: 'high', title: 'Command execution potentially influenced by user input',
        evidence: ['child_process/exec/spawn is present along with request/argv input references in the same file.'],
        recommendation: 'Validate argument allowlists, use execFile/spawn with argument arrays, and avoid shell interpolation.',
        file: file.path,
        confidence: 'medium'
      });
    }

    if (/(md5|sha1)\s*\(/i.test(content) && /(password|token|secret|hash)/i.test(content)) {
      addFinding(findings, {
        category: 'security', severity: 'medium', title: 'Weak hash algorithm near secret/password context',
        evidence: ['MD5/SHA1 found in a password/token/secret/hash context.'],
        recommendation: 'Use bcrypt/argon2 for passwords, and SHA-256/HMAC for integrity where appropriate.',
        file: file.path
      });
    }

    if (/(SELECT|INSERT|UPDATE|DELETE)\s+.*\$\{|`.*(SELECT|INSERT|UPDATE|DELETE)/is.test(content) && /(req\.|params|query|body)/.test(content)) {
      addFinding(findings, {
        category: 'security', severity: 'high', title: 'Possible SQL query string interpolation',
        evidence: ['SQL statements and template interpolation/request input appear in the same file.'],
        recommendation: 'Use parameterized queries/ORM query builders and validate inputs.',
        file: file.path,
        confidence: 'medium'
      });
    }

    if (/dangerouslySetInnerHTML/.test(content)) {
      addFinding(findings, {
        category: 'security', severity: 'medium', title: 'dangerouslySetInnerHTML detected',
        evidence: ['React dangerouslySetInnerHTML is used.'],
        recommendation: 'Ensure HTML is sanitized with a trusted library and does not come directly from untrusted user input.',
        file: file.path
      });
    }

    if (lowerPath.includes('.github/workflows/') && /pull_request_target/.test(content)) {
      addFinding(findings, {
        category: 'operations', severity: 'high', title: 'GitHub Actions uses pull_request_target',
        evidence: ['pull_request_target can be dangerous if checkout/head code is not properly isolated.'],
        recommendation: 'Audit permissions and token scopes, and avoid running untrusted PR code with privileged tokens.',
        file: file.path
      });
    }

    if (lowerPath.includes('.github/workflows/') && /uses:\s+[^@\s]+\/[^@\s]+@(main|master|latest|v\d+)/i.test(content)) {
      addFinding(findings, {
        category: 'dependencies', severity: 'medium', title: 'GitHub Action not pinned to a commit SHA',
        evidence: ['Workflow uses action tags/branches instead of immutable commit SHAs.'],
        recommendation: 'Pin third-party GitHub Actions to commit SHAs to reduce supply-chain risk.',
        file: file.path
      });
    }

    if (base(file.path) === 'dockerfile') {
      if (/curl .*\|\s*(sh|bash)|wget .*\|\s*(sh|bash)/i.test(content)) {
        addFinding(findings, {
          category: 'operations', severity: 'high', title: 'Dockerfile executes remote scripts directly',
          evidence: ['Detected curl/wget piped directly to a shell.'],
          recommendation: 'Download artifacts with verified checksum/signature and avoid piping directly to shell.',
          file: file.path
        });
      }
      if (!/\nUSER\s+[^\s#]+/.test(`\n${content}`)) {
        addFinding(findings, {
          category: 'operations', severity: 'medium', title: 'Dockerfile does not set a non-root USER',
          evidence: ['No USER instruction detected.'],
          recommendation: 'Add a non-root user for runtime containers.',
          file: file.path
        });
      }
    }
  }
}

function analyzePullRequest(snapshot, findings) {
  if (snapshot.mode !== 'pull_request' || !snapshot.pullRequest) return null;
  const pr = snapshot.pullRequest;
  if (pr.changedFiles > 40 || pr.additions + pr.deletions > 2500) {
    addFinding(findings, {
      category: 'architecture', severity: 'high', title: 'PR is too large for safe review',
      evidence: [`Changed files: ${pr.changedFiles}`, `Additions: ${pr.additions}`, `Deletions: ${pr.deletions}`],
      recommendation: 'Split the PR into reviewable chunks or require targeted reviewers per domain.'
    });
  }

  const removedTests = snapshot.files.some((file) => normalizePath(file.path).includes('test') && file.status === 'removed');
  if (removedTests) {
    addFinding(findings, {
      category: 'tests', severity: 'high', title: 'PR removes test files',
      evidence: ['A changed file under test/spec paths has status removed.'],
      recommendation: 'Ensure replacement tests exist or explain why test removal is safe.'
    });
  }

  return {
    changedFiles: pr.changedFiles,
    additions: pr.additions,
    deletions: pr.deletions,
    churn: pr.additions + pr.deletions
  };
}

function computeRisk(findings) {
  const categoryScores = Object.fromEntries(CategoryNames.map((category) => [category, 0]));
  let total = 0;

  for (const finding of findings) {
    const weight = SeverityWeights[finding.severity] || 0;
    total += weight;
    categoryScores[finding.category] = Math.min(100, (categoryScores[finding.category] || 0) + weight * 1.6);
  }

  const cappedTotal = Math.min(100, Math.round(total));
  let level = 'low';
  let mergeReadiness = 'ready_with_standard_review';
  if (cappedTotal >= 75) {
    level = 'critical';
    mergeReadiness = 'blocked_until_remediation';
  } else if (cappedTotal >= 50) {
    level = 'high';
    mergeReadiness = 'needs_senior_review';
  } else if (cappedTotal >= 25) {
    level = 'medium';
    mergeReadiness = 'review_required';
  }

  return {
    score: cappedTotal,
    level,
    mergeReadiness,
    categoryScores: Object.fromEntries(Object.entries(categoryScores).map(([k, v]) => [k, Math.round(Math.min(100, v))]))
  };
}

function buildChapters({ snapshot, findings, signals, packageInfo, frameworks, languages, risk }) {
  const topFindings = findings.slice().sort((a, b) => (SeverityWeights[b.severity] || 0) - (SeverityWeights[a.severity] || 0)).slice(0, 8);
  const chapterList = [
    {
      title: 'Repository / PR Context',
      summary: snapshot.mode === 'pull_request'
        ? `Screening PR #${snapshot.pullRequest.number}: ${snapshot.pullRequest.title}`
        : `Screening repository ${snapshot.owner}/${snapshot.repo} at ref ${snapshot.ref}`,
      bullets: [
        `Mode: ${snapshot.mode}`,
        `Primary language: ${snapshot.language || languages[0]?.language || 'unknown'}`,
        `Downloaded files: ${snapshot.limits.filesDownloaded}`,
        `Tree entries: ${snapshot.limits.treeEntriesReturned}${snapshot.limits.treeTruncated ? ' (truncated)' : ''}`
      ]
    },
    {
      title: 'Risk Map',
      summary: `Overall risk is ${risk.level.toUpperCase()} with score ${risk.score}/100. Merge readiness: ${risk.mergeReadiness}.`,
      bullets: Object.entries(risk.categoryScores).map(([category, score]) => `${category}: ${score}/100`)
    },
    {
      title: 'Architecture & Surface',
      summary: frameworks.length ? `Detected framework/surface: ${frameworks.join(', ')}` : 'Primary framework is not clear from the analyzed files.',
      bullets: [
        `Files: ${signals.fileCount}`,
        `Directories: ${signals.dirCount}`,
        `Package manager: ${packageInfo.packageManager || 'not detected'}`,
        `Languages: ${languages.slice(0, 6).map((l) => `${l.language}(${l.count})`).join(', ') || 'unknown'}`
      ]
    },
    {
      title: 'Top Findings',
      summary: topFindings.length ? 'Review these findings first.' : 'No significant findings were detected by the heuristic pass.',
      bullets: topFindings.length ? topFindings.map((f) => `[${f.severity}] ${f.title}${f.file ? ` — ${f.file}` : ''}`) : ['Continue with manual review for business logic and edge cases.']
    },
    {
      title: 'Suggested Reviewer Questions',
      summary: 'These questions help reviewers decide merge readiness.',
      bullets: buildDecisionQuestions({ snapshot, findings, risk })
    }
  ];

  return chapterList;
}

function buildDecisionQuestions({ snapshot, findings, risk }) {
  const questions = [];
  if (risk.level === 'critical' || risk.level === 'high') {
    questions.push('Which high/critical findings must be resolved before merge, and who owns each one?');
  }
  if (findings.some((f) => f.category === 'security')) {
    questions.push('Have all user inputs, secrets, tokens, and permission boundaries been validated?');
  }
  if (findings.some((f) => f.category === 'tests')) {
    questions.push('Which tests prove critical paths, error paths, and regression cases are covered?');
  }
  if (snapshot.mode === 'pull_request') {
    questions.push('Is this PR still reviewable as-is, or should it be split by change domain?');
  }
  if (findings.some((f) => f.category === 'dependencies')) {
    questions.push('Have new dependencies/lifecycle scripts/GitHub Actions been audited for supply-chain risk?');
  }
  questions.push('What is the rollback plan if this change causes an incident after deployment?');
  return unique(questions).slice(0, 8);
}

function buildRecommendations(findings, risk) {
  const sorted = findings.slice().sort((a, b) => (SeverityWeights[b.severity] || 0) - (SeverityWeights[a.severity] || 0));
  const recs = sorted.map((finding) => finding.recommendation).filter(Boolean);
  const base = [
    risk.score >= 50 ? 'Do not merge until high/critical findings have explicit owners and resolutions.' : 'Continue manual review for business logic, data flow, and edge cases.',
    'Run local lint/test/build and CI before declaring merge-ready.',
    'Use this MCP output as initial screening, not as a replacement for human security review.'
  ];
  return unique([...recs, ...base]).slice(0, 12);
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push(`# GitLumen MCP Screening Report`);
  lines.push('');
  lines.push(`**Report ID:** ${report.reportId}`);
  lines.push(`**Target:** ${report.target.repoUrl}`);
  lines.push(`**Mode:** ${report.target.mode}`);
  lines.push(`**Ref:** ${report.target.ref}`);
  lines.push(`**Risk:** ${report.risk.level.toUpperCase()} (${report.risk.score}/100)`);
  lines.push(`**Merge readiness:** ${report.risk.mergeReadiness}`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push(report.summary);
  lines.push('');
  lines.push(`## Category Scores`);
  for (const [category, score] of Object.entries(report.risk.categoryScores)) {
    lines.push(`- ${category}: ${score}/100`);
  }
  lines.push('');
  lines.push(`## Findings`);
  if (!report.findings.length) {
    lines.push('- No significant heuristic findings. Continue manual review.');
  } else {
    for (const finding of report.findings) {
      lines.push(`- **[${finding.severity}] ${finding.title}**${finding.file ? ` — \`${finding.file}\`` : ''}`);
      for (const evidence of finding.evidence || []) lines.push(`  - Evidence: ${evidence}`);
      lines.push(`  - Recommendation: ${finding.recommendation}`);
    }
  }
  lines.push('');
  lines.push(`## Review Chapters`);
  for (const chapter of report.chapters) {
    lines.push(`### ${chapter.title}`);
    lines.push(chapter.summary);
    for (const bullet of chapter.bullets) lines.push(`- ${bullet}`);
    lines.push('');
  }
  lines.push(`## Next Actions`);
  for (const item of report.recommendations) lines.push(`- ${item}`);
  lines.push('');
  lines.push('> Generated by GitLumen MCP Server prototype. This is a heuristic screening layer, not a replacement for human code/security review.');
  return lines.join('\n');
}

export function analyzeSnapshot(snapshot, input = {}) {
  const findings = [];
  const paths = snapshot.tree.map((entry) => entry.path);
  const languages = detectLanguages(paths);
  const packageJsonFile = findPackageJson(snapshot);
  const packageInfo = analyzePackageJson(snapshot, findings, packageJsonFile);
  const frameworks = detectFrameworks(snapshot, packageJsonFile ? parseJsonSafe(packageJsonFile.content) : null);
  const signals = analyzeStructure(snapshot, findings);
  analyzeCodeContent(snapshot, findings);
  const prSignals = analyzePullRequest(snapshot, findings);

  const risk = computeRisk(findings);
  const reportId = createReportId({ repoUrl: snapshot.repoUrl, scope: input.scope });
  const summary = risk.score >= 75
    ? 'The repository/PR shows critical risk signals. Remediation is required before it can be considered merge/deploy-ready.'
    : risk.score >= 50
      ? 'The repository/PR has high risk. Senior review and remediation of key findings are recommended before merge.'
      : risk.score >= 25
        ? 'The repository/PR has medium risk. Continue manual review with focus on the listed findings.'
        : 'The repository/PR appears relatively low risk based on initial heuristic screening. Continue manual review for business logic.';

  const report = {
    reportId,
    generatedAt: new Date().toISOString(),
    generator: {
      name: 'gitlumen-screen-sdk',
      version: '0.1.0',
      mode: 'local-heuristic-screening'
    },
    target: {
      mode: snapshot.mode,
      owner: snapshot.owner,
      repo: snapshot.repo,
      repoUrl: snapshot.repoUrl,
      ref: snapshot.ref,
      defaultBranch: snapshot.defaultBranch,
      pullRequest: snapshot.pullRequest || null
    },
    input: {
      scope: input.scope || 'standard',
      maxFiles: input.maxFiles || null
    },
    repositorySignals: {
      description: snapshot.description,
      stars: snapshot.stars,
      forks: snapshot.forks,
      primaryLanguage: snapshot.language,
      detectedLanguages: languages,
      frameworks,
      packageInfo: {
        packageManager: packageInfo.packageManager,
        packageName: packageInfo.packageName,
        packageVersion: packageInfo.packageVersion,
        scripts: packageInfo.scripts ? Object.keys(packageInfo.scripts) : [],
        dependencyCount: packageInfo.dependencies ? Object.keys(packageInfo.dependencies).length : 0
      },
      structure: signals,
      pullRequest: prSignals,
      limits: snapshot.limits
    },
    risk,
    summary,
    findings: findings.sort((a, b) => (SeverityWeights[b.severity] || 0) - (SeverityWeights[a.severity] || 0)),
    chapters: [],
    decisionQuestions: [],
    recommendations: []
  };

  report.decisionQuestions = buildDecisionQuestions({ snapshot, findings: report.findings, risk });
  report.recommendations = buildRecommendations(report.findings, risk);
  report.chapters = buildChapters({ snapshot, findings: report.findings, signals, packageInfo, frameworks, languages, risk });
  report.markdown = buildMarkdownReport(report);

  return report;
}
