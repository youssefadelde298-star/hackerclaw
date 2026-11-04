import { describe, expect, it } from 'vitest';
import { calculateCvss31 } from './cvss.js';

describe('calculateCvss31', () => {
  it('calculates the canonical 9.8 Critical vector', () => {
    expect(calculateCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toMatchObject({
      baseScore: 9.8,
      severity: 'critical',
      version: '3.1',
    });
  });

  it('uses the Scope Changed privilege weights and rounds to one decimal', () => {
    expect(calculateCvss31('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H')).toMatchObject({
      baseScore: 8.8,
      severity: 'high',
    });

    expect(calculateCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H')).toMatchObject({
      baseScore: 10,
      severity: 'critical',
    });
  });

  it('returns None for a vector with no impact', () => {
    expect(calculateCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N')).toMatchObject({
      baseScore: 0,
      severity: 'none',
    });
  });

  it('rejects unsupported versions, missing metrics, duplicates, and temporal vectors', () => {
    expect(() => calculateCvss31('CVSS:4.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toThrow(
      /CVSS:3.1/,
    );
    expect(() => calculateCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H')).toThrow(
      /missing CVSS metric: A/,
    );
    expect(() => calculateCvss31('CVSS:3.1/AV:N/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toThrow(
      /duplicate CVSS metric: AV/,
    );
    expect(() => calculateCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/E:X')).toThrow(
      /unsupported CVSS v3.1 base metric: E/,
    );
  });

  it('rejects invalid metric values', () => {
    expect(() => calculateCvss31('CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toThrow(
      /invalid base metric value/,
    );
  });
});
