// Skill discovery directories. Extracted from the CLI so the precedence
// order is unit-testable. We read the PROJECT-local ./.hackerclaw/skills
// (it's about the repo you're in, so sharing it is deliberate) and
// ~/.hackerclaw/skills for personal skills.

import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { projectStateDir, userStateDir } from '../config/paths.js';

export function builtinSkillsDir(): string {
  // The build bundles src/ into dist/ — skills/ sits next to dist at the
  // package root. Walking up from cwd works in dev and after install.
  return resolve(process.cwd(), 'skills');
}

/**
 * Ordered list of directories skills load from. Order = precedence: later
 * entries override earlier ones on a name collision (Registry.add is a map
 * set). `cwd`/`home` are injectable for testing; they default to the live
 * process values.
 */
export function skillSearchDirs(
  configured: string[],
  cwd: string = process.cwd(),
  home: string = homedir(),
): string[] {
  const projectDir = projectStateDir(cwd);
  const userDir = userStateDir(home);
  return [
    resolve(cwd, 'skills'), // built-in
    join(projectDir, 'skills'), // project-local (repo-scoped)
    join(userDir, 'builtin-skills'), // installer-managed shipped skills
    join(userDir, 'skills'), // personal skills
    ...configured.map((d) => resolve(d)), // explicit --skills / config (wins)
  ];
}
