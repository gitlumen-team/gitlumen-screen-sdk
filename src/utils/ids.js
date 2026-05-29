import crypto from 'node:crypto';

export function createReportId(input) {
  const seed = `${input.repoUrl}|${input.scope || 'standard'}|${Date.now()}|${Math.random()}`;
  return `glr_${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

export function stableHash(input, length = 12) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, length);
}
