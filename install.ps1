<#
.SYNOPSIS
  HackerClaw online installer (Windows).

.DESCRIPTION
  Downloads the standalone Windows binary from the latest GitHub release,
  verifies its SHA-256, installs it under %LOCALAPPDATA%\Programs\HackerClaw,
  and adds that directory to your user PATH.

  Run:
    irm https://raw.githubusercontent.com/youssefadelde298-star/hackerclaw/main/install.ps1 | iex

.NOTES
  Environment overrides:
    $env:HACKERCLAW_VERSION        = 'v0.1.0'   # pin a release (default: latest)
    $env:HACKERCLAW_INSTALL_DIR    = 'C:\path'  # install location
    $env:HACKERCLAW_SKILLS_DIR     = 'C:\path'  # shipped skills location
    $env:HACKERCLAW_SKIP_SKILLS    = '1'        # install binary only
    $env:HACKERCLAW_SKIP_CHECKSUM  = '1'        # install without SHA-256 verification (unsafe)
    $env:HACKERCLAW_REPO           = 'owner/repo'
    Legacy PENTESTERFLOW_* variables are accepted as fallbacks.
#>

#Requires -Version 5
$ErrorActionPreference = 'Stop'

$Repo = if ($env:HACKERCLAW_REPO) {
  $env:HACKERCLAW_REPO
} elseif ($env:PENTESTERFLOW_REPO) {
  $env:PENTESTERFLOW_REPO
} else {
  'youssefadelde298-star/hackerclaw'
}
$Bin = 'hackerclaw'

# --- detect arch (only windows-x64 is published) -------------------------
if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'unsupported architecture: only 64-bit Windows (x64) is published.'
}
$asset = "$Bin-windows-x64.exe"

$ver = if ($env:HACKERCLAW_VERSION) {
  $env:HACKERCLAW_VERSION.Trim()
} elseif ($env:PENTESTERFLOW_VERSION) {
  $env:PENTESTERFLOW_VERSION.Trim()
} else {
  'latest'
}
if ($ver -ne 'latest' -and -not $ver.StartsWith('v')) {
  $ver = "v$ver"
}

$base = if ($ver -eq 'latest') {
  "https://github.com/$Repo/releases/latest/download"
} else {
  "https://github.com/$Repo/releases/download/$ver"
}

$installDir = if ($env:HACKERCLAW_INSTALL_DIR) { $env:HACKERCLAW_INSTALL_DIR } else { $env:PENTESTERFLOW_INSTALL_DIR }
$dir = if ($installDir) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($installDir)
} else {
  if (-not $env:LOCALAPPDATA) {
    throw 'LOCALAPPDATA is not set; set HACKERCLAW_INSTALL_DIR explicitly.'
  }
  Join-Path $env:LOCALAPPDATA 'Programs\HackerClaw'
}
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  if ([Net.ServicePointManager]::SecurityProtocol -notmatch 'Tls12') {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  }
  $download = Join-Path $tmp $asset

  Write-Host "downloading $asset ($ver)..."
  Invoke-WebRequest -Uri "$base/$asset" -OutFile $download -UseBasicParsing -ErrorAction Stop
  if (-not (Test-Path -LiteralPath $download) -or (Get-Item -LiteralPath $download).Length -eq 0) {
    throw "downloaded asset is empty: $base/$asset"
  }

  # --- verify checksum (required; fail-closed) ----------------------------
  # A self-updating binary must not install an unverified download. Any
  # failure to verify is fatal. Set $env:HACKERCLAW_SKIP_CHECKSUM='1' to
  # override (e.g. a mirror you trust by other means).
  $skipChecksum = if ($null -ne $env:HACKERCLAW_SKIP_CHECKSUM) {
    $env:HACKERCLAW_SKIP_CHECKSUM
  } else {
    $env:PENTESTERFLOW_SKIP_CHECKSUM
  }
  if ($skipChecksum -eq '1') {
    Write-Warning 'HACKERCLAW_SKIP_CHECKSUM=1 set - installing WITHOUT checksum verification'
  } else {
    try {
      $sums = (Invoke-WebRequest -Uri "$base/SHA256SUMS" -UseBasicParsing -ErrorAction Stop).Content
    } catch {
      throw "could not download SHA256SUMS from $base - refusing to install an unverified binary (set `$env:HACKERCLAW_SKIP_CHECKSUM='1' to override): $($_.Exception.Message)"
    }
    # Parse SHA256SUMS by exact filename. Each line is "<hex>  <name>"
    # (coreutils text mode) or "<hex> *<name>" (binary mode). Match the
    # filename field exactly rather than with a trailing-anchored regex:
    # the old `\s$asset\s*$` pattern was fragile against CRLF line endings
    # and the binary-mode '*' marker, which could reject a valid SHA256SUMS
    # and abort the install (#14).
    $want = $null
    foreach ($raw in ($sums -split "`r?`n")) {
      if ($raw.Trim() -notmatch '^([0-9A-Fa-f]{64})\s+\*?(.+)$') { continue }
      if ($matches[2].Trim() -eq $asset) {
        $want = $matches[1].ToLower()
        break
      }
    }
    if (-not $want) {
      $listed = (($sums -split "`r?`n") |
        ForEach-Object { if ($_ -match '^[0-9A-Fa-f]{64}\s+\*?(.+)$') { $matches[1].Trim() } } |
        Where-Object { $_ }) -join ', '
      throw "SHA256SUMS does not list $asset - refusing to install an unverified binary (listed: $listed). Set `$env:HACKERCLAW_SKIP_CHECKSUM='1' to override."
    }
    $got  = (Get-FileHash -Algorithm SHA256 -Path $download).Hash.ToLower()
    if ($got -ne $want) {
      throw "checksum mismatch for $asset (expected $want, got $got)"
    }
    Write-Host 'checksum ok'
  }

  $dest = Join-Path $dir "$Bin.exe"
  $staged = Join-Path $dir ".$Bin.tmp.$PID.exe"
  Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $staged
  Copy-Item -Force -Path $download -Destination $staged
  Move-Item -Force -LiteralPath $staged -Destination $dest
  Write-Host "installed $Bin -> $dest"

  # --- install shipped skills --------------------------------------------
  $skipSkills = if ($null -ne $env:HACKERCLAW_SKIP_SKILLS) {
    $env:HACKERCLAW_SKIP_SKILLS
  } else {
    $env:PENTESTERFLOW_SKIP_SKILLS
  }
  if ($skipSkills -ne '1') {
    $skillsPath = if ($env:HACKERCLAW_SKILLS_DIR) { $env:HACKERCLAW_SKILLS_DIR } else { $env:PENTESTERFLOW_SKILLS_DIR }
    $skillsDir = if ($skillsPath) {
      $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($skillsPath)
    } else {
      Join-Path $env:USERPROFILE '.hackerclaw\builtin-skills'
    }

    $archiveRef = $ver
    $archiveUrl = "https://github.com/$Repo/archive/refs/tags/$archiveRef.zip"
    $archive = Join-Path $tmp 'source.zip'
    try {
      Write-Host "installing shipped skills -> $skillsDir..."
      try {
        Invoke-WebRequest -Uri $archiveUrl -OutFile $archive -UseBasicParsing -ErrorAction Stop
      } catch {
        $archiveUrl = "https://github.com/$Repo/archive/refs/heads/main.zip"
        Invoke-WebRequest -Uri $archiveUrl -OutFile $archive -UseBasicParsing -ErrorAction Stop
      }

      $sourceRoot = Join-Path $tmp 'source'
      Expand-Archive -Path $archive -DestinationPath $sourceRoot -Force
      $skillsSrc = Get-ChildItem -Path $sourceRoot -Directory -Recurse |
        Where-Object { $_.Name -eq 'skills' } |
        Select-Object -First 1

      if ($skillsSrc) {
        New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
        Get-ChildItem -LiteralPath $skillsSrc.FullName -File -Recurse | ForEach-Object {
          $relative = $_.FullName.Substring($skillsSrc.FullName.Length).TrimStart([char[]]@('\', '/'))
          $destination = Join-Path $skillsDir $relative
          if (-not (Test-Path -LiteralPath $destination)) {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $destination
          }
        }
        Write-Host "installed shipped skills -> $skillsDir"
      } else {
        Write-Warning 'skills directory not found in source archive; skipping skills install'
      }
    } catch {
      Write-Warning "skills install skipped: $($_.Exception.Message)"
    }
  }

  # --- add to user PATH --------------------------------------------------
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $pathEntries = @()
  if (-not [string]::IsNullOrWhiteSpace($userPath)) {
    $pathEntries = $userPath -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  if (-not ($pathEntries | Where-Object { [string]::Equals($_, $dir, [StringComparison]::OrdinalIgnoreCase) })) {
    $newPath = if ([string]::IsNullOrEmpty($userPath)) { $dir } else { "$userPath;$dir" }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    $env:Path = "$env:Path;$dir"
    Write-Host "added $dir to your user PATH (open a new terminal for it to take effect)"
  }

  & $dest --version
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp
}
