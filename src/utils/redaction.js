const SECRET_PATTERNS = [
  {
    label: 'private-key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/gi
  },
  { label: 'github-token', regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { label: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/g },
  { label: 'jwt', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { label: 'bearer-token', regex: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi },
  {
    label: 'secret-assignment',
    regex: /\b(api[_-]?key|secret|password|passwd|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\b\s*[:=]\s*(["'`])[^"'`\n]{8,}\2/gi,
    replacement: (_match, key, quote) => `${key}=${quote}[REDACTED:secret-assignment]${quote}`
  },
  {
    label: 'env-secret-assignment',
    regex: /^([A-Z0-9_]*(?:KEY|SECRET|PASSWORD|TOKEN|PRIVATE)[A-Z0-9_]*\s*=).+$/gim,
    replacement: (_match, key) => `${key}[REDACTED:env-secret-assignment]`
  }
];

export function redactSensitiveText(input = '') {
  let output = String(input || '');
  let redactionCount = 0;

  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern.regex, (...args) => {
      redactionCount += 1;
      if (typeof pattern.replacement === 'function') return pattern.replacement(...args);
      return `[REDACTED:${pattern.label}]`;
    });
  }

  return { text: output, redactionCount };
}

export function redactSnapshotForProvider(snapshot, { maxInputChars = 60000, maxFileChars = 6000 } = {}) {
  let remaining = Math.max(0, maxInputChars);
  let totalRedactions = 0;
  const files = [];

  for (const file of snapshot.files || []) {
    if (remaining <= 0) break;
    const raw = String(file.content || file.patch || '');
    const sliced = raw.slice(0, Math.min(maxFileChars, remaining));
    const redacted = redactSensitiveText(sliced);
    totalRedactions += redacted.redactionCount;
    remaining -= redacted.text.length;
    files.push({
      path: file.path,
      status: file.status || null,
      size: file.size || 0,
      truncated: Boolean(file.truncated || raw.length > sliced.length),
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      content: redacted.text
    });
  }

  return {
    mode: snapshot.mode,
    owner: snapshot.owner,
    repo: snapshot.repo,
    repoUrl: snapshot.repoUrl,
    ref: snapshot.ref,
    defaultBranch: snapshot.defaultBranch,
    description: snapshot.description,
    pullRequest: snapshot.pullRequest || null,
    limits: snapshot.limits,
    tree: (snapshot.tree || []).slice(0, 500).map((entry) => ({
      path: entry.path,
      type: entry.type,
      size: entry.size || 0,
      status: entry.status || null
    })),
    files,
    redaction: {
      redactionsApplied: totalRedactions,
      maxInputChars,
      maxFileChars,
      filesIncluded: files.length
    }
  };
}
