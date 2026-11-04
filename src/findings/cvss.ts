export type CvssSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface CvssAssessment {
  version: '3.1';
  vector: string;
  baseScore: number;
  severity: CvssSeverity;
}

const BASE_METRICS = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'] as const;

const attackVector: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const attackComplexity: Record<string, number> = { L: 0.77, H: 0.44 };
const privilegesRequired: Record<'U' | 'C', Record<string, number>> = {
  U: { N: 0.85, L: 0.62, H: 0.27 },
  C: { N: 0.85, L: 0.68, H: 0.5 },
};
const userInteraction: Record<string, number> = { N: 0.85, R: 0.62 };
const impact: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

/** Calculate the CVSS v3.1 Base score from an assessor-supplied base vector. */
export function calculateCvss31(input: string): CvssAssessment {
  const vector = input.trim();
  const parts = vector.split('/');
  if (parts[0] !== 'CVSS:3.1') {
    throw new Error('CVSS vector must start with CVSS:3.1');
  }

  const metrics = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const separator = part.indexOf(':');
    if (separator < 1 || separator === part.length - 1 || part.indexOf(':', separator + 1) !== -1) {
      throw new Error(`invalid CVSS metric: ${part}`);
    }
    const key = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (!(BASE_METRICS as readonly string[]).includes(key)) {
      throw new Error(`unsupported CVSS v3.1 base metric: ${key}`);
    }
    if (metrics.has(key)) throw new Error(`duplicate CVSS metric: ${key}`);
    metrics.set(key, value);
  }

  for (const key of BASE_METRICS) {
    if (!metrics.has(key)) throw new Error(`missing CVSS metric: ${key}`);
  }
  if (metrics.size !== BASE_METRICS.length) {
    throw new Error('CVSS v3.1 Base vectors must contain only the eight base metrics');
  }

  const scope = metrics.get('S');
  if (scope !== 'U' && scope !== 'C') throw new Error('CVSS S must be U or C');

  const av = attackVector[metrics.get('AV') ?? ''];
  const ac = attackComplexity[metrics.get('AC') ?? ''];
  const pr = privilegesRequired[scope][metrics.get('PR') ?? ''];
  const ui = userInteraction[metrics.get('UI') ?? ''];
  const confidentiality = impact[metrics.get('C') ?? ''];
  const integrity = impact[metrics.get('I') ?? ''];
  const availability = impact[metrics.get('A') ?? ''];
  if (
    av === undefined ||
    ac === undefined ||
    pr === undefined ||
    ui === undefined ||
    confidentiality === undefined ||
    integrity === undefined ||
    availability === undefined
  ) {
    throw new Error('CVSS vector contains an invalid base metric value');
  }

  const impactSubScore = 1 - (1 - confidentiality) * (1 - integrity) * (1 - availability);
  const impactScore =
    scope === 'U'
      ? 6.42 * impactSubScore
      : 7.52 * (impactSubScore - 0.029) - 3.25 * (impactSubScore - 0.02) ** 15;
  const exploitabilityScore = 8.22 * av * ac * pr * ui;

  let baseScore = 0;
  if (impactScore > 0) {
    const total = impactScore + exploitabilityScore;
    baseScore = roundup(Math.min(scope === 'U' ? total : 1.08 * total, 10));
  }

  return {
    version: '3.1',
    vector,
    baseScore,
    severity: severityFor(baseScore),
  };
}

function roundup(value: number): number {
  const scaled = Math.round(value * 100_000);
  const remainder = scaled % 10_000;
  return remainder === 0 ? scaled / 100_000 : (Math.floor(scaled / 10_000) + 1) / 10;
}

function severityFor(score: number): CvssSeverity {
  if (score === 0) return 'none';
  if (score < 4) return 'low';
  if (score < 7) return 'medium';
  if (score < 9) return 'high';
  return 'critical';
}
