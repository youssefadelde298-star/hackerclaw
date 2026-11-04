import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../findings/store.js';
import { AlwaysAllow, AlwaysDeny } from '../permission/permission.js';
import { ConfirmFindingTool } from './finding.js';
import { Registry } from './registry.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pf-finding-tool-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const args = {
  title: 'Authorized lab finding fixture',
  severity: 'medium',
  url: 'https://lab.example.invalid/item',
  method: 'GET',
  response_excerpt: 'Redacted test fixture response.',
  impact: 'Fixture only; no vulnerability claim.',
  retest_steps: 'Fixture only; no request was sent.',
};

describe('ConfirmFindingTool', () => {
  it('requires human approval before persisting a finding', async () => {
    const tool = new ConfirmFindingTool(new Store(dir));
    const registry = new Registry();
    registry.register(tool);

    await expect(
      registry.execute(tool.name(), args, new AbortController().signal, new AlwaysDeny()),
    ).rejects.toThrow(/permission denied/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('rejects missing reproduction evidence before writing either file', async () => {
    const tool = new ConfirmFindingTool(new Store(dir));

    await expect(
      tool.run({ ...args, response_excerpt: '' }, new AbortController().signal, new AlwaysAllow()),
    ).rejects.toThrow('response_excerpt is required');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('requires method, response excerpt, and human retest steps in its schema', () => {
    const tool = new ConfirmFindingTool(new Store(dir));
    const required = tool.schema().required as string[];

    expect(required).toEqual(
      expect.arrayContaining(['method', 'response_excerpt', 'retest_steps']),
    );
    expect(tool.requiresPermission()).toBe(true);
  });

  it('accepts assessor metadata and calculates CVSS from the supplied vector', async () => {
    const tool = new ConfirmFindingTool(new Store(dir));
    const optionalArgs = {
      ...args,
      business_impact: 'Synthetic fixture impact only.',
      owner: 'Member 2',
      cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    };

    await tool.run(optionalArgs, new AbortController().signal, new AlwaysAllow());
    const loaded = await new Store(dir).loadAll();

    expect(loaded.findings[0]?.record).toMatchObject({
      business_impact: 'Synthetic fixture impact only.',
      owner: 'Member 2',
      cvss: { base_score: 9.8, severity: 'critical' },
    });
  });
});
