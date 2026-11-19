import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSkill } from './registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(here, '..', '..', 'skills');

describe('Member 6 skill coverage', () => {
  it.each(['csrf', 'session-fixation', 'session-hijacking', 'xss'])(
    'ships the %s playbook',
    (name) => {
      const path = join(skillsDir, name, 'SKILL.md');
      expect(existsSync(path)).toBe(true);

      const skill = parseSkill(path);
      const body = readFileSync(path, 'utf8');
      expect(skill.name).toBe(name);
      expect(skill.tools).toContain('ask_user');
      expect(skill.tools).toContain('http');
      expect(skill.tools).toContain('confirm_finding');
      expect(body).toMatch(/tester-owned|tester-controlled|tester'?s own/i);
      expect(body).toMatch(/human/i);
    },
  );
});
