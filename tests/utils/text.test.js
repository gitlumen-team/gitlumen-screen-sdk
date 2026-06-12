import { truncateText, safeJson, unique } from '../../src/utils/text.js';

describe('truncateText', () => {
  test('returns the text unchanged when it is within the limit', () => {
    expect(truncateText('hello', 100)).toBe('hello');
  });

  test('truncates text that exceeds the max and appends a truncation notice', () => {
    const long = 'a'.repeat(200);
    const result = truncateText(long, 100);
    expect(result.slice(0, 100)).toBe('a'.repeat(100));
    expect(result).toMatch(/truncated 100 chars/);
  });

  test('returns empty string for null/undefined input', () => {
    expect(truncateText(null)).toBe('');
    expect(truncateText(undefined)).toBe('');
  });

  test('uses default max of 4000 chars', () => {
    const exactly4000 = 'x'.repeat(4000);
    expect(truncateText(exactly4000)).toBe(exactly4000);

    const over = 'x'.repeat(4001);
    expect(truncateText(over)).toMatch(/truncated/);
  });
});

describe('safeJson', () => {
  test('serializes a plain object with 2-space indentation', () => {
    const result = safeJson({ a: 1 });
    expect(result).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  test('serializes an array', () => {
    const result = safeJson([1, 2, 3]);
    expect(result).toBe(JSON.stringify([1, 2, 3], null, 2));
  });
});

describe('unique', () => {
  test('removes duplicates', () => {
    expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  test('filters out falsy values', () => {
    expect(unique(['a', null, undefined, '', 'b'])).toEqual(['a', 'b']);
  });

  test('preserves insertion order', () => {
    expect(unique(['c', 'b', 'a'])).toEqual(['c', 'b', 'a']);
  });

  test('returns empty array for all-falsy input', () => {
    expect(unique([null, undefined, ''])).toEqual([]);
  });
});
