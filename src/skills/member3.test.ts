import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSkill } from './registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(here, '..', '..', 'skills');

describe('Member 3 skill coverage', () => {
  it.each(['sqli', 'ssrf', 'path-traversal', 'file-upload'])('ships the %s playbook', (name) => {
    expect(existsSync(join(skillsDir, name, 'SKILL.md'))).toBe(true);
  });

  it.each(['sqli', 'ssrf'])('ships readable lab guidance for %s', (name) => {
    const skill = parseSkill(join(skillsDir, name, 'SKILL.md'));
    const payloadsDir = join(skillsDir, name, 'payloads');
    const files = readdirSync(payloadsDir, { withFileTypes: true }).filter((entry) =>
      entry.isFile(),
    );

    expect(skill.tools).toContain('read_payloads');
    expect(files.length).toBeGreaterThan(0);
  });
});
