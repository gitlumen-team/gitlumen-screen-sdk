export function truncateText(text, max = 4000) {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max)}\n... [truncated ${text.length - max} chars]`;
}

export function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
