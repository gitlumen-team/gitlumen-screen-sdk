import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ReportStore } from '../../src/services/reportStore.js';

function makeReport(id = 'glr_0123456789abcdef') {
  return {
    reportId: id,
    generatedAt: new Date().toISOString(),
    target: { mode: 'repository', owner: 'a', repo: 'b', repoUrl: 'https://github.com/a/b', ref: 'main', defaultBranch: 'main', pullRequest: null },
    risk: { score: 10, level: 'low', mergeReadiness: 'ready_with_standard_review', categoryScores: {} },
    summary: 'Low risk.'
  };
}

describe('ReportStore', () => {
  let tmpDir;
  let store;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitlumen-test-'));
    store = new ReportStore({ dataDir: tmpDir });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('save() writes a JSON file in the reports directory', async () => {
    const report = makeReport();
    const filePath = await store.save(report);
    expect(filePath).toMatch(/glr_0123456789abcdef\.json$/);
    const content = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(content).reportId).toBe(report.reportId);
  });

  test('get() retrieves a saved report by ID', async () => {
    const report = makeReport();
    await store.save(report);
    const retrieved = await store.get(report.reportId);
    expect(retrieved.reportId).toBe(report.reportId);
    expect(retrieved.summary).toBe(report.summary);
  });

  test('get() throws for an invalid report ID format', async () => {
    await expect(store.get('invalid-id')).rejects.toThrow(/Invalid report id/);
  });

  test('get() throws when report file does not exist', async () => {
    await expect(store.get('glr_aaaaaaaaaaaaaaaa')).rejects.toThrow(/ENOENT|no such file/i);
  });

  test('pathFor() throws for IDs that do not match the expected format', () => {
    expect(() => store.pathFor('bad')).toThrow(/Invalid report id/);
    expect(() => store.pathFor('glr_short')).toThrow(/Invalid report id/);
    expect(() => store.pathFor('glr_GGGGGGGGGGGGGGGG')).toThrow(/Invalid report id/);
  });

  test('pathFor() accepts a valid 16-char hex report ID', () => {
    expect(store.pathFor('glr_abcdef0123456789')).toMatch(/glr_abcdef0123456789\.json$/);
  });

  test('list() returns saved reports sorted by generatedAt descending', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitlumen-list-'));
    try {
      const listStore = new ReportStore({ dataDir: dir });
      await listStore.save({ ...makeReport('glr_aaaaaaaaaaaaaaaa'), generatedAt: '2024-01-01T00:00:00.000Z' });
      await listStore.save({ ...makeReport('glr_bbbbbbbbbbbbbbbb'), generatedAt: '2024-06-01T00:00:00.000Z' });

      const list = await listStore.list();
      expect(list).toHaveLength(2);
      expect(list[0].reportId).toBe('glr_bbbbbbbbbbbbbbbb');
      expect(list[1].reportId).toBe('glr_aaaaaaaaaaaaaaaa');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test('list() respects the limit parameter', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitlumen-limit-'));
    try {
      const limitStore = new ReportStore({ dataDir: dir });
      for (const id of ['glr_cccccccccccccccc', 'glr_dddddddddddddddd', 'glr_eeeeeeeeeeeeeeee']) {
        await limitStore.save(makeReport(id));
      }
      const list = await limitStore.list(2);
      expect(list.length).toBeLessThanOrEqual(2);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test('list() returns an empty array when no reports exist', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitlumen-empty-'));
    try {
      const emptyStore = new ReportStore({ dataDir: dir });
      await expect(emptyStore.list()).resolves.toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test('list() includes required summary fields', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitlumen-fields-'));
    try {
      const fieldStore = new ReportStore({ dataDir: dir });
      await fieldStore.save(makeReport('glr_ffffffffffffffff'));
      const [item] = await fieldStore.list();
      expect(item).toHaveProperty('reportId');
      expect(item).toHaveProperty('generatedAt');
      expect(item).toHaveProperty('target');
      expect(item).toHaveProperty('risk');
      expect(item).toHaveProperty('summary');
      expect(item).toHaveProperty('filePath');
      expect(item).toHaveProperty('modifiedAt');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
