import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { apply as redact } from '../redact/redact.js';
import { type FindingRecord, Store } from './store.js';

export interface GenerateReportOptions {
  inputDirs?: string[];
  outputDir?: string;
  generatedAt?: Date;
}

export interface GeneratedReport {
  reportPath: string;
  riskRegisterPath: string;
  totalFindings: number;
  verifiedFindings: number;
  reviewFindings: number;
  skippedFiles: string[];
}

interface ReportFinding {
  record: FindingRecord;
  source: string;
}

const fallbackRisk: Record<FindingRecord['severity'], number> = {
  critical: 9,
  high: 7,
  medium: 4,
  low: 1,
  info: 0,
};

/** Consolidate finding JSON sidecars into a review-safe Markdown report and CSV risk register. */
export async function generateReport(
  options: GenerateReportOptions = {},
): Promise<GeneratedReport> {
  const inputDirs = options.inputDirs?.length ? options.inputDirs : ['findings'];
  const resolvedDirs = [...new Set(inputDirs.map((dir) => resolve(dir)))];
  const outputDir = resolve(options.outputDir ?? 'reports');
  const generatedAt = options.generatedAt ?? new Date();
  const inputSets = await Promise.all(
    resolvedDirs.map(async (dir, index) => ({
      label: directoryLabel(dir, index, resolvedDirs),
      result: await new Store(dir).loadAll(),
    })),
  );
  const skippedFiles = inputSets.flatMap(({ result }) => result.skippedFiles);
  const findings = inputSets.flatMap(({ label, result }) =>
    result.findings.map(({ record, sourceFile }) => ({ record, source: `${label}/${sourceFile}` })),
  );
  findings.sort(compareRisk);

  const verifiedFindings = findings.filter(
    ({ record }) => record.verification_status === 'human_verified',
  ).length;
  const report = renderReport(findings, skippedFiles, resolvedDirs, generatedAt);
  const riskRegister = renderRiskRegister(findings);
  await mkdir(outputDir, { recursive: true });

  const timestamp = generatedAt.toISOString().replace(/[:.]/g, '-');
  for (let index = 1; ; index += 1) {
    const suffix = index === 1 ? '' : `-${index}`;
    const reportPath = join(outputDir, `pentest-report-${timestamp}${suffix}.md`);
    const riskRegisterPath = join(outputDir, `risk-register-${timestamp}${suffix}.csv`);
    let wroteReport = false;
    try {
      await writeFile(reportPath, report, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      wroteReport = true;
      await writeFile(riskRegisterPath, riskRegister, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
      return {
        reportPath,
        riskRegisterPath,
        totalFindings: findings.length,
        verifiedFindings,
        reviewFindings: findings.length - verifiedFindings,
        skippedFiles,
      };
    } catch (err) {
      if (wroteReport) await unlink(reportPath).catch(() => undefined);
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
  }
}

function renderReport(
  findings: ReportFinding[],
  skippedFiles: string[],
  inputDirs: string[],
  generatedAt: Date,
): string {
  const verified = findings.filter(({ record }) => record.verification_status === 'human_verified');
  const pending = findings.filter(
    ({ record }) => record.verification_status === 'needs_human_review',
  );
  const lines = [
    '# Web Application & API Security Assessment',
    '',
    '> Initial machine-generated draft. Review scope, evidence, severity, and authorization before sharing.',
    '',
    `- **Generated:** ${generatedAt.toISOString()}`,
    `- **Finding records:** ${findings.length}`,
    `- **Human-verified:** ${verified.length}`,
    `- **Needs human review:** ${pending.length}`,
    '- **Scope and assessment dates:** Not supplied in the finding records.',
    `- **Input folders:** ${inputDirs.map((dir) => inline(basename(dir) || dir)).join(', ') || 'none'}`,
    '',
    '## Executive Summary',
    '',
  ];

  if (verified.length === 0) {
    lines.push(
      'No `human_verified` findings were present in the imported records. This is not evidence that the application is secure.',
      '',
    );
  } else {
    lines.push(
      `The imported records contain ${verified.length} human-verified finding${verified.length === 1 ? '' : 's'}. Only these records are summarized here; unverified records appear separately below.`,
      '',
      ...verified.map(({ record }) => {
        const rating = record.cvss
          ? `CVSS 3.1 Base ${record.cvss.base_score.toFixed(1)} (${record.cvss.severity})`
          : `Manual severity ${record.severity}; CVSS not assessed`;
        return `- **${inline(record.title)}** — ${rating}. ${text(record.business_impact || 'Business impact not assessed.')}`;
      }),
      '',
    );
  }

  lines.push('## Confirmed Findings', '');
  if (verified.length === 0) lines.push('No human-verified findings.', '');
  for (const finding of verified) lines.push(...renderFinding(finding));

  lines.push('## Findings Needing Human Review', '');
  if (pending.length === 0) lines.push('No findings are awaiting review.', '');
  for (const finding of pending) lines.push(...renderFinding(finding));

  lines.push(
    '## Consolidated Risk Register',
    '',
    '| ID | Status | Finding | Manual severity | CVSS 3.1 Base | Business impact | Owner | Source |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  if (findings.length === 0) {
    lines.push('| — | — | No finding records imported | — | — | — | — | — |');
  } else {
    for (const { record, source } of findings) {
      const cvss = record.cvss
        ? `${record.cvss.base_score.toFixed(1)} (${record.cvss.severity})`
        : 'Not assessed';
      lines.push(
        `| ${cell(record.id)} | ${cell(record.verification_status)} | ${cell(record.title)} | ${cell(record.severity)} | ${cell(cvss)} | ${cell(record.business_impact || 'Not assessed')} | ${cell(record.owner || 'Not assigned')} | ${cell(source)} |`,
      );
    }
  }
  lines.push(
    '',
    '## Methodology and Limitations',
    '',
    '- CVSS 3.1 Base scores are calculated locally from assessor-supplied base vectors. Temporal and Environmental metrics are not included.',
    '- Manual severity and CVSS are shown separately. Any difference needs analyst review; a missing vector is reported as not assessed.',
    '- Business impact and ownership are included only when supplied in a finding record; no impact is inferred.',
    '- Only records explicitly marked `human_verified` appear as confirmed or in the executive summary. All other records remain in the review section.',
    '- Scope, exclusions, authorization, assessment dates, and overall security conclusions must be added by the assessment team.',
    '- Review all output for sensitive information before distributing it. Common credential patterns are redacted automatically.',
    '',
  );

  if (skippedFiles.length > 0) {
    lines.push('## Import Warnings', '');
    for (const skipped of skippedFiles) lines.push(`- ${text(skipped)}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderFinding({ record, source }: ReportFinding): string[] {
  const cvss = record.cvss
    ? `${record.cvss.base_score.toFixed(1)} (${record.cvss.severity}) — ${record.cvss.vector}`
    : 'Not assessed';
  const lines = [
    `### ${inline(record.title)}`,
    '',
    `- **ID:** ${inline(record.id)}`,
    `- **Status:** ${record.verification_status}`,
    `- **Manual severity:** ${record.severity}`,
    `- **CVSS 3.1 Base:** ${inline(cvss)}`,
    `- **Endpoint:** ${inline(`${record.method} ${record.url}`)}`,
    `- **Owner:** ${inline(record.owner || 'Not assigned')}`,
    `- **Source:** ${inline(source)}`,
    `- **Technical impact:** ${text(record.impact)}`,
    `- **Business impact:** ${text(record.business_impact || 'Not assessed')}`,
    `- **Evidence excerpt:** ${text(record.response_excerpt)}`,
    `- **Retest steps:** ${text(record.retest_steps)}`,
    `- **Remediation:** ${text(record.remediation || 'Not provided')}`,
    '',
  ];
  return lines;
}

function renderRiskRegister(findings: ReportFinding[]): string {
  const header = [
    'id',
    'title',
    'verification_status',
    'manual_severity',
    'cvss_vector',
    'cvss_base_score',
    'cvss_severity',
    'business_impact',
    'technical_impact',
    'owner',
    'url',
    'source_file',
  ];
  const rows = findings.map(({ record, source }) => [
    record.id,
    record.title,
    record.verification_status,
    record.severity,
    record.cvss?.vector ?? '',
    record.cvss ? record.cvss.base_score.toFixed(1) : '',
    record.cvss?.severity ?? '',
    record.business_impact ?? '',
    record.impact,
    record.owner ?? '',
    record.url,
    source,
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function compareRisk(a: ReportFinding, b: ReportFinding): number {
  const score = (finding: ReportFinding): number =>
    finding.record.cvss?.base_score ?? fallbackRisk[finding.record.severity];
  return score(b) - score(a) || a.record.title.localeCompare(b.record.title);
}

function directoryLabel(dir: string, index: number, dirs: string[]): string {
  const name = basename(dir) || 'findings';
  return dirs.filter((candidate) => (basename(candidate) || 'findings') === name).length > 1
    ? `${name}-${index + 1}`
    : name;
}

function text(value: string): string {
  return cleanText(value).replace(/[\\`*_{}\[\]()#+!|>]/g, '\\$&');
}

function inline(value: string): string {
  return text(value).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function cell(value: string): string {
  return inline(value);
}

function csvCell(value: string): string {
  let safe = cleanText(value).replace(/[\r\n]+/g, ' ');
  if (/^\s*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}

function cleanText(value: string): string {
  return [...redact(value)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
}
