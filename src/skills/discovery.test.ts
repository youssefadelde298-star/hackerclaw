// Skill discovery precedence. Injectable cwd/home keep it deterministic.

import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillSearchDirs } from './discovery.js';

describe('skillSearchDirs', () => {
  it('orders builtin → project → managed → personal → configured (lowest to highest precedence)', () => {
    const dirs = skillSearchDirs(['/cfg/skills'], '/proj', '/home');
    expect(dirs).toEqual([
      resolve('/proj', 'skills'),
      resolve('/proj', '.hackerclaw', 'skills'),
      join('/home', '.hackerclaw', 'builtin-skills'),
      join('/home', '.hackerclaw', 'skills'),
      resolve('/cfg/skills'),
    ]);
  });

  it('includes project-local, managed, and personal skill dirs', () => {
    const dirs = skillSearchDirs([], '/proj', '/home');
    expect(dirs).toContain(resolve('/proj', '.hackerclaw', 'skills'));
    expect(dirs).toContain(join('/home', '.hackerclaw', 'builtin-skills'));
    expect(dirs).toContain(join('/home', '.hackerclaw', 'skills'));
  });

  it('appends configured dirs last so they win on collision', () => {
    const dirs = skillSearchDirs(['/a', '/b'], '/proj', '/home');
    expect(dirs.slice(-2)).toEqual([resolve('/a'), resolve('/b')]);
  });
});
