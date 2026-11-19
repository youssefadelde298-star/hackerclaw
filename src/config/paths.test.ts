import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectStateDir, userStateDir } from './paths.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('state directories', () => {
  it('copies legacy files only when the HackerClaw destination is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'hackerclaw-paths-'));
    roots.push(root);
    const legacy = join(root, '.pentesterflow');
    const current = join(root, '.hackerclaw');
    mkdirSync(join(legacy, 'skills'), { recursive: true });
    mkdirSync(current, { recursive: true });
    writeFileSync(join(legacy, 'config.json'), '{"backend":"ollama"}');
    writeFileSync(join(legacy, 'skills', 'old.md'), 'legacy skill');
    writeFileSync(join(current, 'config.json'), '{"backend":"groq"}');

    expect(userStateDir(root)).toBe(current);
    expect(readFileSync(join(current, 'config.json'), 'utf8')).toBe('{"backend":"groq"}');
    expect(readFileSync(join(current, 'skills', 'old.md'), 'utf8')).toBe('legacy skill');
    expect(readFileSync(join(legacy, 'config.json'), 'utf8')).toBe('{"backend":"ollama"}');
    expect(existsSync(join(legacy, 'skills', 'old.md'))).toBe(true);
  });

  it('migrates project-local data without removing the legacy tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'hackerclaw-project-'));
    roots.push(root);
    const legacyFile = join(root, '.pentesterflow', 'memory', 'operator.md');
    mkdirSync(join(root, '.pentesterflow', 'memory'), { recursive: true });
    writeFileSync(legacyFile, 'operator note');

    expect(projectStateDir(root)).toBe(join(root, '.hackerclaw'));
    expect(readFileSync(join(root, '.hackerclaw', 'memory', 'operator.md'), 'utf8')).toBe(
      'operator note',
    );
    expect(existsSync(legacyFile)).toBe(true);
  });
});
