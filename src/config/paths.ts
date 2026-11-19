import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const migrated = new Set<string>();

export function userStateDir(home = homedir()): string {
  return stateDir(home);
}

export function projectStateDir(cwd = process.cwd()): string {
  return stateDir(cwd);
}

function stateDir(base: string): string {
  const current = join(base, '.hackerclaw');
  const legacy = join(base, '.pentesterflow');
  const key = `${legacy}\0${current}`;
  if (migrated.has(key)) return current;

  copyMissingTree(legacy, current);
  migrated.add(key);
  return current;
}

function copyMissingTree(source: string, destination: string): void {
  let sourceStat: ReturnType<typeof lstatSync>;
  try {
    sourceStat = lstatSync(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  if (sourceStat.isSymbolicLink()) return;
  if (sourceStat.isDirectory()) {
    if (existsSync(destination)) {
      if (!lstatSync(destination).isDirectory()) return;
    } else {
      mkdirSync(destination, { recursive: true, mode: 0o700 });
    }
    for (const name of readdirSync(source)) {
      copyMissingTree(join(source, name), join(destination, name));
    }
    return;
  }

  if (!sourceStat.isFile() || existsSync(destination)) return;
  try {
    copyFileSync(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}
