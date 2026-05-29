export function parseGitHubUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== 'string') {
    throw new Error('repoUrl is required');
  }

  let normalized = repoUrl.trim();
  if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith('git@')) {
    normalized = `https://${normalized}`;
  }

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
      pullNumber: null,
      normalizedRepoUrl: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`
    };
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  if (!url.hostname.toLowerCase().includes('github.com')) {
    throw new Error('Only github.com repositories are supported in this SDK');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('GitHub URL must include owner and repository name');
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  const pullIndex = parts.findIndex((part) => part === 'pull');
  const pullNumber = pullIndex >= 0 && parts[pullIndex + 1] ? Number(parts[pullIndex + 1]) : null;

  return {
    owner,
    repo,
    pullNumber: Number.isFinite(pullNumber) ? pullNumber : null,
    normalizedRepoUrl: `https://github.com/${owner}/${repo}`
  };
}
