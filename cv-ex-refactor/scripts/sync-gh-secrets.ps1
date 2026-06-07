# Sync the 5 required secrets from .env.local to GitHub Actions in one go.
# Reads .env.local at the script's parent directory (cv-ex-refactor/).
#
# Each value is piped to `gh secret set` via stdin so:
#   - The secret never appears on the command line (no PowerShell history leak)
#   - The terminal does NOT echo the value back
#   - gh requires the value via stdin so no -Body flag with literal needed
#
# Usage (from cv-ex-refactor/):
#   pwsh scripts/sync-gh-secrets.ps1
#
# Prereqs:
#   - .env.local exists and contains the 5 keys
#   - `gh auth status` shows you're logged in to the cvmatching repo's owner

$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '..' '.env.local'
if (-not (Test-Path $envPath)) {
  Write-Host "ERROR: .env.local not found at $envPath" -ForegroundColor Red
  exit 1
}

# Required keys for the refresh-jobs.yml workflow
$required = @(
  'GEMINI_API_KEY',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN'
)

# Optional keys — set only if present in .env.local
$optional = @(
  'EMBED_CACHE_SECRET',
  'ALERT_WEBHOOK_URL'
)

# Parse .env.local into a hashtable (KEY → value, quotes stripped)
$envVars = @{}
Get-Content $envPath | Where-Object { $_ -match '^[A-Z_][A-Z0-9_]*=' } | ForEach-Object {
  $parts = $_ -split '=', 2
  $key = $parts[0].Trim()
  $val = $parts[1].Trim().Trim('"').Trim("'")
  $envVars[$key] = $val
}

Write-Host "Found $($envVars.Count) env vars in .env.local" -ForegroundColor Gray

# Sanity: check required keys are non-empty BEFORE touching GitHub
$missing = @()
foreach ($key in $required) {
  if (-not $envVars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envVars[$key])) {
    $missing += $key
  }
}
if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "ERROR: Missing or empty required keys in .env.local:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host ""
  Write-Host "Per feedback_vercel_sensitive_env_pull_masked: Sensitive vars" -ForegroundColor Yellow
  Write-Host "come down empty from 'vercel env pull'. Paste them into" -ForegroundColor Yellow
  Write-Host ".env.local manually from the provider console (Gemini/Neon/Upstash)." -ForegroundColor Yellow
  exit 1
}

# Sync each key via stdin (no value echoed)
function Set-GhSecret {
  param([string]$Name, [string]$Value)
  Write-Host "  $Name ... " -NoNewline
  # Pipe via stdin — gh reads when invoked without --body flag
  $Value | & gh secret set $Name 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "OK" -ForegroundColor Green
  } else {
    Write-Host "FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
Write-Host "Required secrets:" -ForegroundColor Cyan
foreach ($key in $required) {
  Set-GhSecret -Name $key -Value $envVars[$key]
}

Write-Host ""
Write-Host "Optional secrets:" -ForegroundColor Cyan
foreach ($key in $optional) {
  if ($envVars.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($envVars[$key])) {
    Set-GhSecret -Name $key -Value $envVars[$key]
  } else {
    Write-Host "  $key ... " -NoNewline
    Write-Host "skip (not in .env.local)" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Done. Verify with: gh secret list" -ForegroundColor Green
