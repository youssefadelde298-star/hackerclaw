// Findings store. Confirmed vulnerabilities are written to
// ./findings/<slug>.md so different engagements stay separate (per cwd)
// without configuration. Mirrors internal/findings/findings.go shape.

import { type Dirent, existsSync, mkdirSync } from 'node:fs';
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { type CvssSeverity, calculateCvss31 } from './cvss.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type VerificationStatus = 'needs_human_review' | 'human_verified';

export interface StoredCvss {
  version: '3.1';
  vector: string;
  base_score: number;
  severity: CvssSeverity;
}

export interface FindingRecord {
  schema_version: '1.0';
  id: string;
  verification_status: VerificationStatus;
  title: string;
  severity: Severity;
  url: string;
  method: string;
  parameter?: string;
  payload?: string;
  response_excerpt: string;
  impact: string;
  business_impact?: string;
  owner?: string;
  retest_steps: string;
  curl?: string;
  remediation?: string;
  cvss?: StoredCvss;
  created_at: string;
}

export interface LoadedFinding {
  record: FindingRecord;
  sourceFile: string;
}

export interface FindingLoadResult {
  findings: LoadedFinding[];
  skippedFiles: string[];
}

export interface Finding {
  title: string;
  severity: Severity;
  url: string;
  method: string;
  parameter?: string;
  payload?: string;
  responseExcerpt: string;
  impact: string;
  businessImpact?: string;
  owner?: string;
  retestSteps: string;
  curl?: string;
  remediation?: string;
  cvssVector?: string;
  createdAt: string; // ISO timestamp
  slug: string;
}

export class Store {
  readonly dir: string;

  constructor(dir = 'findings') {
    this.dir = resolve(dir);
  }

  /** Persist markdown and a JSON sidecar. Returns the markdown path. */
  async save(finding: Finding): Promise<string> {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    const record = toJsonRecord(finding);
    const content = render(finding, record.cvss);
    for (let i = 1; ; i += 1) {
      const slug = i === 1 ? finding.slug : `${finding.slug}-${i}`;
      const path = join(this.dir, `${slug}.md`);
      const jsonPath = join(this.dir, `${slug}.json`);
      const json = `${JSON.stringify({ ...record, id: slug }, null, 2)}\n`;
      let wroteJson = false;
      try {
        await writeFile(jsonPath, json, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        wroteJson = true;
        await writeFile(path, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        return path;
      } catch (err) {
        if (wroteJson) await unlink(jsonPath).catch(() => undefined);
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
        throw err;
      }
    }
  }

  /** Load valid finding JSON sidecars from this directory for report generation. */
  async loadAll(): Promise<FindingLoadResult> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { findings: [], skippedFiles: [`${basename(this.dir)}: folder not found`] };
      }
      return {
        findings: [],
        skippedFiles: [`${basename(this.dir)}: ${(err as Error).message}`],
      };
    }

    const files = entries
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.json')
      .filter((entry) => !entry.name.startsWith('coverage-'))
      .map((entry) => entry.name)
      .sort();
    const findings: LoadedFinding[] = [];
    const skippedFiles: string[] = [];

    for (const file of files) {
      try {
        const raw = JSON.parse(await readFile(join(this.dir, file), 'utf8')) as unknown;
        findings.push({ record: parseFindingRecord(raw), sourceFile: file });
      } catch (err) {
        skippedFiles.push(`${file}: ${(err as Error).message}`);
      }
    }

    return { findings, skippedFiles };
  }
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 64);
}

function render(f: Finding, cvss?: StoredCvss): string {
  const lines: string[] = [];
  lines.push(`# ${f.title}`, '');
  lines.push(`- **Severity:** ${f.severity}`);
  if (cvss) {
    lines.push(`- **CVSS 3.1 Base:** ${cvss.base_score.toFixed(1)} (${cvss.severity})`);
    lines.push(`- **CVSS Vector:** ${cvss.vector}`);
  }
  lines.push(`- **URL:** ${f.url}`);
  if (f.method) lines.push(`- **Method:** ${f.method}`);
  if (f.parameter) lines.push(`- **Parameter:** ${f.parameter}`);
  if (f.owner) lines.push(`- **Owner:** ${f.owner}`);
  lines.push(`- **Reported at:** ${f.createdAt}`);
  lines.push('', '## Impact', '', f.impact, '');
  if (f.businessImpact) {
    lines.push('## Business impact', '', f.businessImpact, '');
  }
  if (f.payload) {
    lines.push('## Payload', '', '```', f.payload, '```', '');
  }
  if (f.responseExcerpt) {
    lines.push('## Response excerpt', '', '```', f.responseExcerpt, '```', '');
  }
  if (f.retestSteps) {
    lines.push('## Reproduction steps', '', f.retestSteps, '');
  }
  if (f.curl) {
    lines.push('## Reproduce', '', '```sh', f.curl, '```', '');
  }
  if (f.remediation) {
    lines.push('## Remediation', '', f.remediation, '');
  }
  return lines.join('\n');
}

function toJsonRecord(f: Finding): FindingRecord {
  const cvss = f.cvssVector ? calculateCvss31(f.cvssVector) : undefined;
  return {
    schema_version: '1.0',
    id: f.slug,
    verification_status: 'needs_human_review',
    title: f.title,
    severity: f.severity,
    url: f.url,
    method: f.method,
    ...(f.parameter ? { parameter: f.parameter } : {}),
    ...(f.payload ? { payload: f.payload } : {}),
    response_excerpt: f.responseExcerpt,
    impact: f.impact,
    ...(f.businessImpact ? { business_impact: f.businessImpact } : {}),
    ...(f.owner ? { owner: f.owner } : {}),
    retest_steps: f.retestSteps,
    ...(f.curl ? { curl: f.curl } : {}),
    ...(f.remediation ? { remediation: f.remediation } : {}),
    ...(cvss
      ? {
          cvss: {
            version: cvss.version,
            vector: cvss.vector,
            base_score: cvss.baseScore,
            severity: cvss.severity,
          },
        }
      : {}),
    created_at: f.createdAt,
  };
}

function parseFindingRecord(value: unknown): FindingRecord {
  if (!isRecord(value)) throw new Error('expected a JSON object');
  const allowed = new Set([
    'schema_version',
    'id',
    'verification_status',
    'title',
    'severity',
    'url',
    'method',
    'parameter',
    'payload',
    'response_excerpt',
    'impact',
    'business_impact',
    'owner',
    'retest_steps',
    'curl',
    'remediation',
    'cvss',
    'created_at',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error('unknown finding field');
  }

  const severity = value.severity;
  if (value.schema_version !== '1.0') throw new Error('unsupported schema_version');
  if (
    value.verification_status !== 'needs_human_review' &&
    value.verification_status !== 'human_verified'
  ) {
    throw new Error('invalid verification_status');
  }
  if (!isSeverity(severity)) throw new Error('invalid severity');
  for (const field of [
    'id',
    'title',
    'url',
    'method',
    'response_excerpt',
    'impact',
    'retest_steps',
    'created_at',
  ]) {
    if (typeof value[field] !== 'string' || !value[field]) {
      throw new Error(`missing or invalid ${field}`);
    }
  }
  if (!/^[A-Z]+$/.test(value.method as string)) throw new Error('invalid method');
  if (Number.isNaN(Date.parse(value.created_at as string))) throw new Error('invalid created_at');

  const optionalFields = [
    'parameter',
    'payload',
    'business_impact',
    'owner',
    'curl',
    'remediation',
  ] as const;
  for (const field of optionalFields) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      throw new Error(`invalid ${field}`);
    }
  }

  let cvss: StoredCvss | undefined;
  if (value.cvss !== undefined) {
    if (
      !isRecord(value.cvss) ||
      value.cvss.version !== '3.1' ||
      typeof value.cvss.vector !== 'string' ||
      typeof value.cvss.base_score !== 'number' ||
      !isCvssSeverity(value.cvss.severity)
    ) {
      throw new Error('invalid cvss assessment');
    }
    const assessment = calculateCvss31(value.cvss.vector);
    cvss = {
      version: assessment.version,
      vector: assessment.vector,
      base_score: assessment.baseScore,
      severity: assessment.severity,
    };
  }

  return {
    schema_version: '1.0',
    id: value.id as string,
    verification_status: value.verification_status,
    title: value.title as string,
    severity,
    url: value.url as string,
    method: value.method as string,
    ...(value.parameter ? { parameter: value.parameter as string } : {}),
    ...(value.payload ? { payload: value.payload as string } : {}),
    response_excerpt: value.response_excerpt as string,
    impact: value.impact as string,
    ...(value.business_impact ? { business_impact: value.business_impact as string } : {}),
    ...(value.owner ? { owner: value.owner as string } : {}),
    retest_steps: value.retest_steps as string,
    ...(value.curl ? { curl: value.curl as string } : {}),
    ...(value.remediation ? { remediation: value.remediation as string } : {}),
    ...(cvss ? { cvss } : {}),
    created_at: value.created_at as string,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSeverity(value: unknown): value is Severity {
  return (
    value === 'critical' ||
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'info'
  );
}

function isCvssSeverity(value: unknown): value is CvssSeverity {
  return (
    value === 'critical' ||
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'none'
  );
}
