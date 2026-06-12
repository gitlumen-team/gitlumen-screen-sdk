import { createReportId, stableHash } from '../../src/utils/ids.js';

describe('stableHash', () => {
  test('returns a hex string of the requested length', () => {
    const hash = stableHash('hello', 10);
    expect(hash).toMatch(/^[a-f0-9]{10}$/);
  });

  test('defaults to 12 characters', () => {
    const hash = stableHash('hello');
    expect(hash).toHaveLength(12);
  });

  test('is deterministic for the same input', () => {
    expect(stableHash('test-input', 8)).toBe(stableHash('test-input', 8));
  });

  test('produces different hashes for different inputs', () => {
    expect(stableHash('input-a', 12)).not.toBe(stableHash('input-b', 12));
  });

  test('coerces non-string input via String()', () => {
    expect(() => stableHash(42, 8)).not.toThrow();
  });
});

describe('createReportId', () => {
  test('returns a string matching glr_ prefix and 16 hex chars', () => {
    const id = createReportId({ repoUrl: 'https://github.com/a/b', scope: 'standard' });
    expect(id).toMatch(/^glr_[a-f0-9]{16}$/);
  });

  test('generates unique ids for successive calls (due to Date.now + Math.random)', () => {
    const a = createReportId({ repoUrl: 'https://github.com/a/b', scope: 'standard' });
    const b = createReportId({ repoUrl: 'https://github.com/a/b', scope: 'standard' });
    expect(a).not.toBe(b);
  });

  test('works without a scope', () => {
    const id = createReportId({ repoUrl: 'https://github.com/a/b' });
    expect(id).toMatch(/^glr_[a-f0-9]{16}$/);
  });
});
