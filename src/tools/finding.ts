// confirm_finding tool. A human reviews the evidence before the tool writes
// markdown and JSON under ./findings/ and emits a TUI notification.

import { type Finding, type Severity, type Store, slugify } from '../findings/store.js';
import type { Prompter } from '../permission/permission.js';
import { type Tool, argString } from './types.js';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export type FindingNotifier = (f: Finding, path: string) => void;

export class ConfirmFindingTool implements Tool {
  private readonly store: Store;
  private readonly notifier: FindingNotifier;

  constructor(store: Store, notifier: FindingNotifier = () => undefined) {
    this.store = store;
    this.notifier = notifier;
  }

  name(): string {
    return 'confirm_finding';
  }

  description(): string {
    return [
      'Persist a vulnerability finding for human review. Call this ONLY after a human has reproduced the bug with a real request and observed a response that proves it.',
      '',
      'Requires human approval before writing ./findings/<slug>.md and its JSON sidecar. Do not call for theoretical findings, scanner hits, or suspected behavior.',
      'Optional CVSS v3.1 Base vectors must be selected by the assessor; the score is calculated locally. Leave the vector blank when not assessed.',
    ].join('\n');
  }

  schema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short descriptive title.' },
        severity: {
          type: 'string',
          enum: SEVERITIES,
          description: 'Severity (Bugcrowd VRT P1–P5 → critical/high/medium/low/info).',
        },
        url: { type: 'string', description: 'Exact affected endpoint URL.' },
        parameter: { type: 'string', description: 'Parameter injected/abused, if applicable.' },
        payload: { type: 'string', description: 'Exact payload that triggered the bug.' },
        method: { type: 'string', description: 'HTTP method (GET/POST/PUT/...).' },
        response_excerpt: {
          type: 'string',
          description: 'Short, redacted response snippet that supports the finding.',
        },
        impact: {
          type: 'string',
          description: 'One concrete sentence: what an attacker can do.',
        },
        retest_steps: {
          type: 'string',
          description: 'Repeatable steps a human used to reproduce the behavior in scope.',
        },
        curl: { type: 'string', description: 'Copy-pasteable curl one-liner to reproduce.' },
        remediation: { type: 'string', description: 'Brief remediation guidance (optional).' },
        business_impact: {
          type: 'string',
          description: 'Business impact supplied by the assessor; do not infer or invent it.',
        },
        owner: { type: 'string', description: 'Team member or remediation owner (optional).' },
        cvss_vector: {
          type: 'string',
          description:
            'Assessor-selected CVSS:3.1 Base vector with AV/AC/PR/UI/S/C/I/A. Leave blank if not assessed; score is calculated locally.',
        },
      },
      required: [
        'title',
        'severity',
        'url',
        'method',
        'response_excerpt',
        'impact',
        'retest_steps',
      ],
    };
  }

  requiresPermission(): boolean {
    return true;
  }

  summarize(args: Record<string, unknown>): { summary: string; detail: string } {
    const title = argString(args, 'title');
    const severity = argString(args, 'severity');
    return { summary: `finding (${severity}): ${title}`, detail: JSON.stringify(args, null, 2) };
  }

  async run(args: Record<string, unknown>, _signal: AbortSignal, _p: Prompter): Promise<string> {
    const title = argString(args, 'title');
    const severityRaw = argString(args, 'severity').toLowerCase();
    const url = argString(args, 'url');
    const method = argString(args, 'method').trim().toUpperCase();
    const responseExcerpt = argString(args, 'response_excerpt').trim();
    const impact = argString(args, 'impact');
    const retestSteps = argString(args, 'retest_steps').trim();

    if (!title) throw new Error('title is required');
    if (!url) throw new Error('url is required');
    if (!method) throw new Error('method is required');
    if (!responseExcerpt) throw new Error('response_excerpt is required');
    if (!impact) throw new Error('impact is required');
    if (!retestSteps) throw new Error('retest_steps is required');
    if (!isSeverity(severityRaw)) {
      throw new Error(`severity must be one of: ${SEVERITIES.join(', ')}`);
    }

    const finding: Finding = {
      title,
      severity: severityRaw,
      url,
      method,
      impact,
      parameter: argString(args, 'parameter') || undefined,
      payload: argString(args, 'payload') || undefined,
      responseExcerpt,
      retestSteps,
      businessImpact: argString(args, 'business_impact').trim() || undefined,
      owner: argString(args, 'owner').trim() || undefined,
      cvssVector: argString(args, 'cvss_vector').trim() || undefined,
      curl: argString(args, 'curl') || undefined,
      remediation: argString(args, 'remediation') || undefined,
      createdAt: new Date().toISOString(),
      slug: slugify(title) || `finding-${Date.now()}`,
    };

    const path = await this.store.save(finding);
    this.notifier(finding, path);

    return `Finding "${finding.title}" written to ${path} and ${path.replace(/\.md$/, '.json')}`;
  }
}

function isSeverity(s: string): s is Severity {
  return (SEVERITIES as string[]).includes(s);
}
