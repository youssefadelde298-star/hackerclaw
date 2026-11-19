import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertInstallerURL } from './selfUpdate.js';

describe('assertInstallerURL (L10)', () => {
  it('accepts the canonical https githubusercontent installer URL', () => {
    expect(() =>
      assertInstallerURL(
        'https://raw.githubusercontent.com/youssefadelde298-star/hackerclaw/main/install.sh',
      ),
    ).not.toThrow();
    expect(() =>
      assertInstallerURL(
        'https://raw.githubusercontent.com/youssefadelde298-star/hackerclaw/v0.2.0/install.sh',
      ),
    ).not.toThrow();
  });

  it('rejects a non-https scheme', () => {
    expect(() =>
      assertInstallerURL(
        'http://raw.githubusercontent.com/youssefadelde298-star/hackerclaw/main/install.sh',
      ),
    ).toThrow(/non-https/);
    expect(() => assertInstallerURL('file:///etc/passwd')).toThrow(/non-https/);
  });

  it('rejects an unexpected host (tampered HACKERCLAW_REPO)', () => {
    expect(() => assertInstallerURL('https://evil.example.com/x/main/install.sh')).toThrow(
      /unexpected host/,
    );
  });

  it('rejects a malformed URL', () => {
    expect(() => assertInstallerURL('not a url')).toThrow(/invalid installer URL/);
  });

  it('keeps release assets aligned with the installers', () => {
    const root = process.cwd();
    const unixInstaller = readFileSync(join(root, 'install.sh'), 'utf8');
    const windowsInstaller = readFileSync(join(root, 'install.ps1'), 'utf8');
    const binaryBuild = readFileSync(join(root, 'scripts', 'build-binaries.sh'), 'utf8');
    const release = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8');
    const assets = [
      'hackerclaw-darwin-arm64',
      'hackerclaw-darwin-x64',
      'hackerclaw-linux-x64',
      'hackerclaw-linux-arm64',
      'hackerclaw-windows-x64.exe',
    ];

    expect(unixInstaller).toContain('BIN="hackerclaw"');
    expect(windowsInstaller).toContain("$Bin = 'hackerclaw'");
    expect(windowsInstaller).toContain('$asset = "$Bin-windows-x64.exe"');
    for (const asset of assets) expect(release).toContain(asset);
    for (const asset of assets.slice(0, 4)) expect(binaryBuild).toContain(asset);
  });
});
