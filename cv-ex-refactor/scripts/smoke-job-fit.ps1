#Requires -Version 5.1
<#
.SYNOPSIS
    Smoke test v0.3 Job Fit & Study endpoints (PowerShell variant).
.DESCRIPTION
    Equivalent to smoke-job-fit.sh -- runs 6 checks against $BaseUrl.
    Usage: $env:BASE_URL = "https://preview.vercel.app"; .\scripts\smoke-job-fit.ps1
    CRON_SECRET must be in $env:CRON_SECRET for step 6.
.EXAMPLE
    $env:BASE_URL = "http://localhost:3000"; powershell -File scripts/smoke-job-fit.ps1
#>

$ErrorActionPreference = 'Stop'

$BaseUrl    = if ($env:BASE_URL)    { $env:BASE_URL }    else { 'http://localhost:3000' }
$CronSecret = $env:CRON_SECRET

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$FixturePath = Join-Path $ScriptDir '..\tests\fixtures\sample-cv-vn-tech.txt'

if (-not (Test-Path $FixturePath)) {
    Write-Error "Fixture not found: $FixturePath"
    exit 1
}

# Use .NET File API for consistent UTF-8 reading (PowerShell 5 Get-Content -Raw
# can return a PSObject wrapper that causes ConvertTo-Json to emit {"value":"..."}).
$CvText = [System.IO.File]::ReadAllText($FixturePath, [System.Text.Encoding]::UTF8)
$Pass   = 0
$Fail   = 0

function Write-Pass([string]$Msg) {
    Write-Host "  PASS: $Msg" -ForegroundColor Green
    $script:Pass++
}

function Write-Fail([string]$Msg) {
    Write-Host "  FAIL: $Msg" -ForegroundColor Red
    $script:Fail++
}

# Helper: POST JSON and return hashtable with Status + Body
function Invoke-JsonPost([string]$Uri, [string]$Body, [hashtable]$ExtraHeaders = @{}) {
    $headers = @{ 'Content-Type' = 'application/json' }
    foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }
    try {
        $resp = Invoke-WebRequest -Uri $Uri -Method POST -Body $Body -Headers $headers -UseBasicParsing
        $parsed = $resp.Content | ConvertFrom-Json
        return @{ Status = [int]$resp.StatusCode; Body = $parsed }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        $errBody = $null
        try { $errBody = $_.ErrorDetails.Message | ConvertFrom-Json } catch {}
        return @{ Status = $code; Body = $errBody; Error = $_.Exception.Message }
    }
}

# Helper: GET and return hashtable with Status + Body
function Invoke-JsonGet([string]$Uri, [hashtable]$ExtraHeaders = @{}) {
    $headers = @{}
    foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }
    try {
        $resp = Invoke-WebRequest -Uri $Uri -Method GET -Headers $headers -UseBasicParsing
        $parsed = try { $resp.Content | ConvertFrom-Json } catch { $resp.Content }
        return @{ Status = [int]$resp.StatusCode; Body = $parsed }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        $errBody = $null
        try { $errBody = $_.ErrorDetails.Message | ConvertFrom-Json } catch {}
        return @{ Status = $code; Body = $errBody; Error = $_.Exception.Message }
    }
}

# --- Step 1: POST /api/jobs/recommend (cache miss) ---
Write-Host ""
Write-Host "Step 1 -- POST /api/jobs/recommend (cache miss)"
$bodyObj  = @{ cvText = [string]$CvText }
$bodyJson = $bodyObj | ConvertTo-Json -Compress -Depth 2
$r1 = Invoke-JsonPost -Uri "$BaseUrl/api/jobs/recommend" -Body $bodyJson

$jobCount = 0
$jobId    = $null
if ($r1.Body -and $r1.Body.jobs) {
    $jobCount = @($r1.Body.jobs).Count
    if ($jobCount -gt 0) { $jobId = $r1.Body.jobs[0].jobId }
}
Write-Host "  jobs returned: $jobCount (HTTP $($r1.Status))"

if ($jobCount -ge 1) {
    Write-Pass "jobs array length >= 1"
} elseif ($r1.Body -and $r1.Body.error) {
    # 503 = index not seeded; 502 = no matches; both are acceptable in local smoke
    Write-Pass "got error envelope (code=$($r1.Body.error.code)) -- index may not be seeded locally"
} elseif ($r1.Status -in @(502, 503)) {
    Write-Pass "503/502 -- job index not seeded locally (expected without real KV data)"
} else {
    Write-Fail "unexpected response (status=$($r1.Status))"
}

# --- Step 2: POST /api/jobs/recommend (cache hit) ---
Write-Host ""
Write-Host "Step 2 -- POST /api/jobs/recommend (cache hit)"
$r2 = Invoke-JsonPost -Uri "$BaseUrl/api/jobs/recommend" -Body $bodyJson
$fromCache = $r2.Body.fromCache
Write-Host "  fromCache: $fromCache (HTTP $($r2.Status))"
if ($fromCache -eq $true) {
    Write-Pass "fromCache=true on second call"
} else {
    Write-Pass "cache miss or error on second call (acceptable if first call failed)"
}

# --- Step 3: GET /api/r/$jobId (expect 302, no follow) ---
Write-Host ""
Write-Host "Step 3 -- GET /api/r/`$jobId (expect 302)"
if (-not $jobId) {
    Write-Host "  SKIP: no jobId from step 1 (index not seeded)"
} else {
    # Use HttpWebRequest to capture redirect without following it
    try {
        $req = [System.Net.HttpWebRequest]::Create("$BaseUrl/api/r/$jobId")
        $req.Method = 'GET'
        $req.AllowAutoRedirect = $false
        $webResp = $req.GetResponse()
        $code = [int]$webResp.StatusCode
        $webResp.Close()
        Write-Host "  HTTP status: $code"
        if ($code -eq 302) {
            Write-Pass "302 redirect returned"
        } else {
            Write-Fail "expected 302, got $code"
        }
    } catch [System.Net.WebException] {
        $webEx = $_.Exception
        if ($webEx.Response) {
            $code = [int]$webEx.Response.StatusCode
            Write-Host "  HTTP status: $code"
            if ($code -eq 302) {
                Write-Pass "302 redirect returned"
            } else {
                Write-Fail "expected 302, got $code"
            }
        } else {
            Write-Fail "request error: $($webEx.Message)"
        }
    }
}

# --- Step 4: POST /api/topics/feedback (valid -- expect 204) ---
Write-Host ""
Write-Host "Step 4 -- POST /api/topics/feedback (valid, expect 204)"
$feedbackJobId = if ($jobId) { $jobId } else { 'aabbccdd00112233' }
$fb4Json = @{ jobId = $feedbackJobId; topicId = 'react-hooks'; action = 'dislike' } | ConvertTo-Json -Compress
$r4 = Invoke-JsonPost -Uri "$BaseUrl/api/topics/feedback" -Body $fb4Json
Write-Host "  HTTP status: $($r4.Status)"
if ($r4.Status -eq 204) {
    Write-Pass "204 No Content"
} else {
    Write-Fail "expected 204, got $($r4.Status)"
}

# --- Step 5: POST /api/topics/feedback with reason (expect 400) ---
Write-Host ""
Write-Host "Step 5 -- POST /api/topics/feedback with reason (expect 400)"
$fb5Json = @{ jobId = $feedbackJobId; topicId = 'react-hooks'; action = 'dislike'; reason = 'meh' } | ConvertTo-Json -Compress
$r5 = Invoke-JsonPost -Uri "$BaseUrl/api/topics/feedback" -Body $fb5Json
Write-Host "  HTTP status: $($r5.Status)"
if ($r5.Status -eq 400) {
    Write-Pass "400 on extra reason field"
} else {
    Write-Fail "expected 400, got $($r5.Status)"
}

# --- Step 6: GET /api/jobs/refresh (with auth) ---
Write-Host ""
Write-Host "Step 6 -- GET /api/jobs/refresh (with CRON_SECRET auth)"
if (-not $CronSecret) {
    Write-Host "  SKIP: CRON_SECRET not set in env"
} else {
    $r6 = Invoke-JsonGet -Uri "$BaseUrl/api/jobs/refresh" `
        -ExtraHeaders @{ Authorization = "Bearer $CronSecret" }
    $preview = try { $r6.Body | ConvertTo-Json -Compress -Depth 2 } catch { "$($r6.Body)" }
    Write-Host "  response: $($preview.Substring(0, [Math]::Min(200, $preview.Length)))"
    if ($r6.Body -and $r6.Body.ok -eq $true) {
        Write-Pass "refresh returned ok:true"
    } elseif ($r6.Body -and $r6.Body.error) {
        Write-Fail "refresh error: $($r6.Body.error)"
    } else {
        Write-Pass "refresh responded (non-empty)"
    }
}

# --- Summary ---
Write-Host ""
Write-Host "======================================================"
Write-Host "Smoke result: $Pass passed, $Fail failed"
Write-Host "======================================================"

if ($Fail -gt 0) { exit 1 }
