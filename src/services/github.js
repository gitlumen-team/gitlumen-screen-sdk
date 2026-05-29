import { createConfig, DEFAULT_LIMITS } from '../config.js';
import { parseGitHubUrl } from '../utils/githubUrl.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.jsonc', '.md', '.mdx', '.yml', '.yaml', '.toml', '.ini', '.env',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cs', '.php', '.sol', '.vy', '.sh', '.bash', '.zsh', '.sql', '.graphql',
  '.css', '.scss', '.html', '.vue', '.svelte', '.dockerfile', '.tf', '.tfvars', '.gradle', '.xml', '.properties', '.txt'
]);

const IMPORTANT_FILENAMES = new Set([
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
  'requirements.txt', 'pyproject.toml', 'poetry.lock', 'pipfile', 'pipfile.lock',
  'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock', 'pom.xml', 'build.gradle', 'gradle.properties',
  'dockerfile', 'docker-compose.yml', 'compose.yml', '.dockerignore',
  '.env.example', '.env.sample', '.env.template',
  'readme.md', 'license', 'security.md', 'codeowners',
  'tsconfig.json', 'vite.config.js', 'vite.config.ts', 'next.config.js', 'next.config.mjs',
  'hardhat.config.js', 'hardhat.config.ts', 'foundry.toml', 'truffle-config.js'
]);

function extnameLower(path) {
  const name = path.toLowerCase();
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx);
}

function basenameLower(path) {
  return path.split('/').pop().toLowerCase();
}

function isTextLike(path) {
  const base = basenameLower(path);
  if (IMPORTANT_FILENAMES.has(base)) return true;
  if (base.startsWith('.env')) return true;
  return TEXT_EXTENSIONS.has(extnameLower(path));
}

function shouldSkipPath(path) {
  const lower = path.toLowerCase();
  return [
    'node_modules/', 'vendor/', 'dist/', 'build/', '.next/', '.nuxt/', '.git/', 'coverage/', '.cache/', 'target/',
    'public/assets/', 'static/assets/', 'assets/', '.turbo/', '.vercel/', '__pycache__/', '.venv/', 'venv/',
    'package-lock.json' // metadata exists in tree; content usually too noisy for screening
  ].some((segment) => lower.includes(segment));
}

function scorePathPriority(path) {
  const lower = path.toLowerCase();
  const base = basenameLower(path);
  let score = 0;
  if (IMPORTANT_FILENAMES.has(base)) score += 100;
  if (lower.includes('/.github/workflows/') || lower.startsWith('.github/workflows/')) score += 90;
  if (lower.includes('src/') || lower.includes('app/') || lower.includes('server/') || lower.includes('api/')) score += 40;
  if (lower.includes('test') || lower.includes('spec')) score += 20;
  if (lower.includes('auth') || lower.includes('security') || lower.includes('wallet') || lower.includes('payment')) score += 35;
  if (['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.sol'].includes(extnameLower(path))) score += 25;
  return score;
}

export class GitHubClient {
  constructor(options = {}) {
    this.config = createConfig(options);
    this.token = options.token ?? this.config.githubToken;
  }

  headers(extra = {}) {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': this.config.userAgent,
      ...extra
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async api(path, options = {}) {
    const url = `${this.config.githubApiBase}${path}`;
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: this.headers(options.headers || {})
      });
    } catch (error) {
      throw new Error(`Unable to reach GitHub API: ${error.cause?.code || error.code || error.message}. Check internet/DNS or set proxy/VPN if needed.`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`GitHub API ${response.status} ${response.statusText}: ${path}${body ? ` - ${body.slice(0, 300)}` : ''}`);
    }
    return response.json();
  }

  async getRepository(owner, repo) {
    return this.api(`/repos/${owner}/${repo}`);
  }

  async getTree(owner, repo, ref) {
    const tree = await this.api(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    return tree.tree || [];
  }

  async getPull(owner, repo, pullNumber) {
    return this.api(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  async getPullFiles(owner, repo, pullNumber, maxFiles = DEFAULT_LIMITS.maxPrFiles) {
    const pages = [];
    let page = 1;
    while (pages.flat().length < maxFiles) {
      const files = await this.api(`/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`);
      pages.push(files);
      if (!files.length || files.length < 100) break;
      page += 1;
      if (page > 10) break;
    }
    return pages.flat().slice(0, maxFiles);
  }

  async getRawFile(owner, repo, ref, path, maxBytes = this.config.maxFileBytes) {
    const url = `${this.config.rawBase}/${owner}/${repo}/${encodeURIComponent(ref).replace(/%2F/g, '/')}/${path.split('/').map(encodeURIComponent).join('/')}`;
    let response;
    try {
      response = await fetch(url, { headers: this.headers({ Accept: 'text/plain,*/*' }) });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      const sliced = Buffer.from(buffer).subarray(0, maxBytes).toString('utf8');
      return { content: sliced, truncated: true, size: buffer.byteLength };
    }
    return { content: Buffer.from(buffer).toString('utf8'), truncated: false, size: buffer.byteLength };
  }

  selectFilesForContent(treeEntries, scope, requestedMaxFiles) {
    const maxFiles = requestedMaxFiles || {
      quick: DEFAULT_LIMITS.quickMaxFiles,
      standard: DEFAULT_LIMITS.standardMaxFiles,
      deep: DEFAULT_LIMITS.deepMaxFiles
    }[scope] || DEFAULT_LIMITS.standardMaxFiles;

    return treeEntries
      .filter((entry) => entry.type === 'blob')
      .filter((entry) => !shouldSkipPath(entry.path))
      .filter((entry) => isTextLike(entry.path))
      .sort((a, b) => scorePathPriority(b.path) - scorePathPriority(a.path))
      .slice(0, maxFiles);
  }

  async loadRepositorySnapshot({ repoUrl, branch, scope = 'standard', maxFiles }) {
    const parsed = parseGitHubUrl(repoUrl);
    const repoMeta = await this.getRepository(parsed.owner, parsed.repo);
    const ref = branch || repoMeta.default_branch;

    if (parsed.pullNumber) {
      return this.loadPullRequestSnapshot({ ...parsed, repoMeta, ref, scope, maxFiles });
    }

    const tree = await this.getTree(parsed.owner, parsed.repo, ref);
    const clippedTree = tree.slice(0, DEFAULT_LIMITS.maxTreeEntries);
    const selected = this.selectFilesForContent(clippedTree, scope, maxFiles);
    const files = [];

    for (const entry of selected) {
      const raw = await this.getRawFile(parsed.owner, parsed.repo, ref, entry.path);
      if (!raw) continue;
      files.push({
        path: entry.path,
        size: entry.size || raw.size || 0,
        content: raw.content,
        truncated: raw.truncated,
        status: 'unchanged'
      });
    }

    return {
      mode: 'repository',
      owner: parsed.owner,
      repo: parsed.repo,
      repoUrl: parsed.normalizedRepoUrl,
      ref,
      defaultBranch: repoMeta.default_branch,
      description: repoMeta.description || '',
      stars: repoMeta.stargazers_count || 0,
      forks: repoMeta.forks_count || 0,
      language: repoMeta.language || null,
      isPrivate: Boolean(repoMeta.private),
      tree: clippedTree.map((entry) => ({ path: entry.path, type: entry.type, size: entry.size || 0 })),
      files,
      limits: {
        treeEntriesReturned: clippedTree.length,
        treeTruncated: tree.length > clippedTree.length,
        filesDownloaded: files.length,
        scope
      }
    };
  }

  async loadPullRequestSnapshot({ owner, repo, pullNumber, repoMeta, scope = 'standard', maxFiles }) {
    const pull = await this.getPull(owner, repo, pullNumber);
    const prFiles = await this.getPullFiles(owner, repo, pullNumber, maxFiles || DEFAULT_LIMITS.maxPrFiles);
    const selected = prFiles
      .filter((file) => !shouldSkipPath(file.filename))
      .filter((file) => isTextLike(file.filename))
      .sort((a, b) => scorePathPriority(b.filename) - scorePathPriority(a.filename))
      .slice(0, maxFiles || ({ quick: 60, standard: 120, deep: 240 }[scope] || 120));

    const files = [];
    const ref = pull.head?.sha || pull.head?.ref || repoMeta.default_branch;
    for (const file of selected) {
      let content = '';
      let truncated = false;
      if (file.status !== 'removed') {
        const raw = await this.getRawFile(owner, repo, ref, file.filename);
        content = raw?.content || '';
        truncated = Boolean(raw?.truncated);
      }
      files.push({
        path: file.filename,
        size: file.changes || file.additions + file.deletions,
        content,
        truncated,
        patch: file.patch || '',
        status: file.status || 'modified',
        additions: file.additions || 0,
        deletions: file.deletions || 0
      });
    }

    return {
      mode: 'pull_request',
      owner,
      repo,
      repoUrl: `https://github.com/${owner}/${repo}`,
      ref,
      defaultBranch: repoMeta.default_branch,
      description: repoMeta.description || '',
      stars: repoMeta.stargazers_count || 0,
      forks: repoMeta.forks_count || 0,
      language: repoMeta.language || null,
      isPrivate: Boolean(repoMeta.private),
      pullRequest: {
        number: pullNumber,
        title: pull.title,
        state: pull.state,
        author: pull.user?.login || null,
        baseRef: pull.base?.ref || null,
        headRef: pull.head?.ref || null,
        changedFiles: pull.changed_files,
        additions: pull.additions,
        deletions: pull.deletions,
        htmlUrl: pull.html_url
      },
      tree: prFiles.map((file) => ({ path: file.filename, type: 'blob', size: file.changes || 0, status: file.status })),
      files,
      limits: {
        treeEntriesReturned: prFiles.length,
        treeTruncated: prFiles.length >= DEFAULT_LIMITS.maxPrFiles,
        filesDownloaded: files.length,
        scope
      }
    };
  }
}
