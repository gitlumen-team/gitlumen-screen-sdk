import fs from 'node:fs/promises';
import path from 'node:path';
import { createConfig } from '../config.js';

export class ReportStore {
  constructor({ dataDir, config } = {}) {
    const runtimeConfig = createConfig(config || {});
    this.dataDir = dataDir || runtimeConfig.dataDir;
    this.reportsDir = path.join(this.dataDir, 'reports');
  }

  async ensure() {
    await fs.mkdir(this.reportsDir, { recursive: true });
  }

  pathFor(reportId) {
    if (!/^glr_[a-f0-9]{16}$/.test(reportId)) {
      throw new Error(`Invalid report id: ${reportId}`);
    }
    return path.join(this.reportsDir, `${reportId}.json`);
  }

  async save(report) {
    await this.ensure();
    const file = this.pathFor(report.reportId);
    await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
    return file;
  }

  async get(reportId) {
    await this.ensure();
    const file = this.pathFor(reportId);
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  }

  async list(limit = 20) {
    await this.ensure();
    const entries = await fs.readdir(this.reportsDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    const reports = [];
    for (const file of files) {
      try {
        const fullPath = path.join(this.reportsDir, file.name);
        const stat = await fs.stat(fullPath);
        const parsed = JSON.parse(await fs.readFile(fullPath, 'utf8'));
        reports.push({
          reportId: parsed.reportId,
          generatedAt: parsed.generatedAt,
          target: parsed.target,
          risk: parsed.risk,
          summary: parsed.summary,
          filePath: fullPath,
          modifiedAt: stat.mtime.toISOString()
        });
      } catch {
        // Skip corrupt report file.
      }
    }
    return reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)).slice(0, limit);
  }
}
