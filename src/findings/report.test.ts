import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateReport } from './report.js';
import { Store } from './store.js';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hackerclaw-report-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('generateReport', () => {
  it('integrates team folders and separates verified findings from review items', async () => {
    const memberOne = join(root, 'member-one-findings');
    const memberTwo = join(root, 'member-two-findings');
    const outputDir = join(root, 'reports');
    const firstStore = new Store(memberOne);
    const secondStore = new Store(memberTwo);

    await firstStore.save({
      title: 'Verified fixture issue',
      severity: 'high',
      url: 'https://lab.example.invalid/orders',
      method: 'GET',
      responseExcerpt: 'Redacted fixture response.',
      impact: 'Authorization: Bearer abcdefghijklmnop can read another fixture account.',
      businessImpact: 'Possible unauthorized order disclosure in this synthetic scenario.',
      owner: 'Member 2',
      retestSteps: 'Fixture only; no network request was sent.',
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      createdAt: '2026-11-04T00:00:00.000Z',
      slug: 'verified-fixture-issue',
    });
    const verifiedPath = join(memberOne, 'verified-fixture-issue.json');
    const verified = JSON.parse(readFileSync(verifiedPath, 'utf8')) as Record<string, unknown>;
    verified.verification_status = 'human_verified';
    const cvss = verified.cvss as Record<string, unknown>;
    cvss.base_score = 1;
    cvss.severity = 'low';
    writeFileSync(verifiedPath, JSON.stringify(verified));

    await secondStore.save({
      title: '=SUM(1,1) pending fixture',
      severity: 'medium',
      url: 'https://lab.example.invalid/profile',
      method: 'POST',
      responseExcerpt: 'Unverified fixture excerpt.',
      impact: 'Impact not manually established.',
      retestSteps: 'Pending human reproduction.',
      createdAt: '2026-11-04T00:00:00.000Z',
      slug: 'pending-fixture',
    });
    writeFileSync(join(memberTwo, 'invalid.json'), '{invalid');
    writeFileSync(join(memberTwo, 'coverage-session.json'), '{"version":1}');

    const result = await generateReport({
      inputDirs: [memberOne, memberTwo],
      outputDir,
      generatedAt: new Date('2026-11-04T12:00:00.000Z'),
    });
    const markdown = readFileSync(result.reportPath, 'utf8');
    const csv = readFileSync(result.riskRegisterPath, 'utf8');
    const executiveSummary = markdown
      .split('## Executive Summary')[1]
      ?.split('## Confirmed Findings')[0];

    expect(result).toMatchObject({ totalFindings: 2, verifiedFindings: 1, reviewFindings: 1 });
    expect(result.skippedFiles).toHaveLength(1);
    expect(markdown).toContain('Verified fixture issue');
    expect(markdown).toContain('pending fixture');
    expect(executiveSummary).toContain('Verified fixture issue');
    expect(executiveSummary).not.toContain('pending fixture');
    expect(markdown).toContain('9.8 (critical)');
    expect(markdown).toContain('Business impact:** Not assessed');
    expect(markdown).toContain('Scope and assessment dates:** Not supplied');
    expect(markdown).not.toContain('abcdefghijklmnop');
    expect(csv).toContain('"9.8"');
    expect(csv).toContain("'=SUM(1,1) pending fixture");
    expect(csv).toContain('member-one-findings/verified-fixture-issue.json');
  });

  it('creates a clearly empty draft when there are no findings', async () => {
    const result = await generateReport({
      inputDirs: [join(root, 'empty-findings')],
      outputDir: join(root, 'reports'),
      generatedAt: new Date('2026-11-04T12:00:00.000Z'),
    });
    const markdown = readFileSync(result.reportPath, 'utf8');

    expect(result.totalFindings).toBe(0);
    expect(result.skippedFiles).toEqual(['empty-findings: folder not found']);
    expect(markdown).toContain('No `human_verified` findings were present');
    expect(markdown).toContain('This is not evidence that the application is secure.');
  });
});
