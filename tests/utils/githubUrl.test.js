import { parseGitHubUrl } from '../../src/utils/githubUrl.js';

describe('parseGitHubUrl', () => {
  test('parses a plain HTTPS repo URL', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.pullNumber).toBeNull();
    expect(result.normalizedRepoUrl).toBe('https://github.com/owner/repo');
  });

  test('strips .git suffix from HTTPS URL', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git');
    expect(result.repo).toBe('repo');
    expect(result.normalizedRepoUrl).toBe('https://github.com/owner/repo');
  });

  test('parses a PR URL and extracts pullNumber', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/pull/42');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.pullNumber).toBe(42);
  });

  test('parses SSH URL git@github.com:owner/repo.git', () => {
    const result = parseGitHubUrl('git@github.com:owner/my-repo.git');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('my-repo');
    expect(result.pullNumber).toBeNull();
    expect(result.normalizedRepoUrl).toBe('https://github.com/owner/my-repo');
  });

  test('prepends https:// when scheme is missing', () => {
    const result = parseGitHubUrl('github.com/owner/repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
  });

  test('throws when repoUrl is empty', () => {
    expect(() => parseGitHubUrl('')).toThrow('repoUrl is required');
  });

  test('throws when repoUrl is not a string', () => {
    expect(() => parseGitHubUrl(null)).toThrow('repoUrl is required');
  });

  test('throws for non-github.com domains', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
      /Only github\.com repositories are supported/
    );
  });

  test('throws when path has only one segment (no repo name)', () => {
    expect(() => parseGitHubUrl('https://github.com/owner')).toThrow(
      /GitHub URL must include owner and repository name/
    );
  });

  test('returns null pullNumber for a non-pull URL with extra path segments', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/tree/main');
    expect(result.pullNumber).toBeNull();
  });
});
