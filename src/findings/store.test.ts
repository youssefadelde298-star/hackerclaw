import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Finding, Store } from './store.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pf-findings-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('Findings Store', () => {
  it('does not overwrite existing findings with the same slug', async () => {
    const store = new Store(dir);
    const finding: Finding = {
      title: 'IDOR',
      severity: 'high',
      url: 'https://app.example.com/api/orders/1',
      method: 'GET',
      responseExcerpt: 'HTTP/1.1 200 OK; redacted fixture',
      impact: 'Cross-account read.',
      businessImpact: 'Unauthorized order disclosure in the fixture scenario.',
      owner: 'Member 2',
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      retestSteps: 'Fixture only: repeat the documented request in the authorized lab.',
      createdAt: '2026-06-06T00:00:00.000Z',
      slug: 'idor',
    };

    const first = await store.save(finding);
    const second = await store.save({ ...finding, url: 'https://app.example.com/api/orders/2' });

    expect(first).toBe(join(dir, 'idor.md'));
    expect(second).toBe(join(dir, 'idor-2.md'));
    expect(readFileSync(first, 'utf8')).toContain('## Reproduction steps');
    expect(readFileSync(second, 'utf8')).toContain('## Reproduction steps');

    const firstJson = JSON.parse(readFileSync(join(dir, 'idor.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    const secondJson = JSON.parse(readFileSync(join(dir, 'idor-2.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(firstJson).toMatchObject({
      schema_version: '1.0',
      id: 'idor',
      verification_status: 'needs_human_review',
      response_excerpt: finding.responseExcerpt,
      retest_steps: finding.retestSteps,
      business_impact: finding.businessImpact,
      owner: finding.owner,
      cvss: {
        version: '3.1',
        vector: finding.cvssVector,
        base_score: 9.8,
        severity: 'critical',
      },
    });
    expect(secondJson.id).toBe('idor-2');
  });

  it('loads finding sidecars, recalculates CVSS, and skips non-finding JSON', async () => {
    const store = new Store(dir);
    await store.save({
      title: 'CVSS import fixture',
      severity: 'high',
      url: 'https://lab.example.invalid/item',
      method: 'GET',
      responseExcerpt: 'Redacted fixture response.',
      impact: 'Fixture only.',
      retestSteps: 'No request was sent.',
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      createdAt: '2026-06-06T00:00:00.000Z',
      slug: 'cvss-import-fixture',
    });

    const jsonPath = join(dir, 'cvss-import-fixture.json');
    const saved = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
    const savedCvss = saved.cvss as Record<string, unknown>;
    savedCvss.base_score = 1;
    savedCvss.severity = 'low';
    writeFileSync(jsonPath, JSON.stringify(saved));
    writeFileSync(join(dir, 'invalid.json'), '{bad json');
    writeFileSync(join(dir, 'coverage-session.json'), '{"version":1}');

    const result = await store.loadAll();

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.record.cvss).toMatchObject({
      base_score: 9.8,
      severity: 'critical',
    });
    expect(result.skippedFiles).toHaveLength(1);
    expect(result.skippedFiles[0]).toContain('invalid.json');
  });
});
