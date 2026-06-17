import { createConfig } from '../config.js';
import { redactSnapshotForProvider } from '../utils/redaction.js';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function joinUrl(baseUrl, path) {
  const cleanBase = trimTrailingSlash(baseUrl);
  const cleanPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${cleanBase}${cleanPath}`;
}

function extractJsonObject(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        // Continue to bracket extraction.
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeArray(value, max = 12) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, max) : [];
}

function normalizeProviderPayload(payload, rawText) {
  const parsed = payload && typeof payload === 'object' ? payload : {};
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    mergeReadinessRationale: typeof parsed.mergeReadinessRationale === 'string' ? parsed.mergeReadinessRationale : '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    riskAdjustments: normalizeArray(parsed.riskAdjustments || parsed.risks || parsed.findings, 16).map((item) => ({
      category: item?.category || 'maintainability',
      severity: item?.severity || 'medium',
      title: item?.title || 'Provider risk signal',
      evidence: normalizeArray(item?.evidence, 6).map(String),
      recommendation: item?.recommendation || '',
      file: item?.file || null,
      confidence: item?.confidence || 'medium'
    })),
    reviewChapters: normalizeArray(parsed.reviewChapters || parsed.chapters, 8).map((chapter) => ({
      title: chapter?.title || 'Provider review note',
      summary: chapter?.summary || '',
      bullets: normalizeArray(chapter?.bullets, 8).map(String)
    })),
    decisionQuestions: normalizeArray(parsed.decisionQuestions, 8).map(String),
    recommendations: normalizeArray(parsed.recommendations, 10).map(String),
    rawText: payload ? null : rawText
  };
}

export function buildVeniceMessages({ snapshot, report, config }) {
  const providerSnapshot = redactSnapshotForProvider(snapshot, {
    maxInputChars: config.veniceMaxInputChars,
    maxFileChars: config.veniceMaxFileChars
  });

  const compactReport = {
    reportId: report.reportId,
    target: report.target,
    risk: report.risk,
    summary: report.summary,
    repositorySignals: report.repositorySignals,
    findings: report.findings.slice(0, 20).map((finding) => ({
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      file: finding.file,
      evidence: finding.evidence,
      recommendation: finding.recommendation
    })),
    decisionQuestions: report.decisionQuestions,
    recommendations: report.recommendations
  };

  return [
    {
      role: 'system',
      content: [
        'You are GitLumen Review Intelligence running on Venice AI.',
        'Review sanitized repository or pull request context and improve the screening output for developer review.',
        'Focus on precise, auditable code review signals, not marketing copy.',
        'Do not claim certainty beyond the provided context.',
        'Never reveal or reconstruct secrets. Any redacted value must stay redacted.',
        'Return only valid JSON with this shape:',
        '{"summary":"string","riskAdjustments":[{"category":"security|dependencies|tests|architecture|operations|maintainability","severity":"critical|high|medium|low|info","title":"string","evidence":["string"],"recommendation":"string","file":"string|null","confidence":"high|medium|low"}],"reviewChapters":[{"title":"string","summary":"string","bullets":["string"]}],"decisionQuestions":["string"],"recommendations":["string"],"mergeReadinessRationale":"string","confidence":0.0}'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Enhance this GitLumen heuristic screening report with Venice AI provider-level review intelligence.',
        compactReport,
        sanitizedSnapshot: providerSnapshot
      })
    }
  ];
}

export class VeniceProvider {
  constructor(options = {}) {
    const config = createConfig(options);
    this.config = {
      veniceApiKey: options.apiKey ?? options.veniceApiKey ?? config.veniceApiKey,
      veniceBaseUrl: options.baseUrl ?? options.veniceBaseUrl ?? config.veniceBaseUrl,
      veniceChatCompletionsPath: options.chatCompletionsPath ?? options.veniceChatCompletionsPath ?? config.veniceChatCompletionsPath,
      veniceModel: options.model ?? options.veniceModel ?? config.veniceModel,
      veniceTemperature: options.temperature ?? options.veniceTemperature ?? config.veniceTemperature,
      veniceMaxTokens: options.maxTokens ?? options.veniceMaxTokens ?? config.veniceMaxTokens,
      veniceTimeoutMs: options.timeoutMs ?? options.veniceTimeoutMs ?? config.veniceTimeoutMs,
      veniceMaxInputChars: options.maxInputChars ?? options.veniceMaxInputChars ?? config.veniceMaxInputChars,
      veniceMaxFileChars: options.maxFileChars ?? options.veniceMaxFileChars ?? config.veniceMaxFileChars,
      headers: options.headers ?? options.veniceHeaders ?? {},
      fetchImpl: options.fetchImpl ?? options.fetch ?? globalThis.fetch
    };
  }

  get name() {
    return 'venice';
  }

  buildMessages(input) {
    return buildVeniceMessages({ ...input, config: this.config });
  }

  async enhanceReport({ snapshot, report }) {
    if (typeof this.config.fetchImpl !== 'function') {
      throw new Error('VeniceProvider requires fetch. Use Node.js 20+ or pass fetchImpl.');
    }

    const messages = this.buildMessages({ snapshot, report });
    const url = joinUrl(this.config.veniceBaseUrl, this.config.veniceChatCompletionsPath);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.veniceTimeoutMs);

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.config.headers
    };
    if (this.config.veniceApiKey && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.config.veniceApiKey}`;
    }

    const body = {
      model: this.config.veniceModel,
      messages,
      temperature: this.config.veniceTemperature,
      max_tokens: this.config.veniceMaxTokens,
      stream: false
    };

    let response;
    try {
      response = await this.config.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Venice API ${response.status} ${response.statusText}: ${responseText.slice(0, 500)}`);
    }

    let completion;
    try {
      completion = JSON.parse(responseText);
    } catch {
      throw new Error(`Venice API returned non-JSON response: ${responseText.slice(0, 500)}`);
    }

    const content = completion.choices?.[0]?.message?.content ?? completion.output_text ?? completion.content ?? '';
    const parsed = extractJsonObject(content);
    const normalized = normalizeProviderPayload(parsed, content);

    return {
      provider: this.name,
      model: completion.model || this.config.veniceModel,
      generatedAt: new Date().toISOString(),
      usage: completion.usage || null,
      request: {
        endpoint: url,
        redaction: JSON.parse(messages[1].content).sanitizedSnapshot.redaction
      },
      ...normalized
    };
  }
}
