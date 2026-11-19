import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
rmSync('dist', { recursive: true, force: true });

const resolveTypeScriptImports = {
  name: 'resolve-typescript-js-extensions',
  setup(buildContext) {
    buildContext.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.path.startsWith('.')) return;
      const stem = args.path.slice(0, -3);
      for (const extension of ['.ts', '.tsx']) {
        const candidate = resolve(args.resolveDir, `${stem}${extension}`);
        if (existsSync(candidate)) return { path: candidate };
      }
    });
  },
};

await build({
  entryPoints: {
    cli: 'src/cli/index.ts',
    'browser-mcp': 'src/browser/mcpServer.ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  outdir: 'dist',
  sourcemap: true,
  define: { __BUILD_VERSION__: JSON.stringify(version) },
  banner: { js: '#!/usr/bin/env node' },
  plugins: [resolveTypeScriptImports],
});
