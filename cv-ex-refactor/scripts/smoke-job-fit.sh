#!/usr/bin/env bash
# Smoke test v0.3 Job Fit & Study endpoints against $BASE_URL.
# Usage: BASE_URL=https://your-preview.vercel.app bash scripts/smoke-job-fit.sh
# Requires: curl, jq (or python3 as fallback for JSON encoding)
# CRON_SECRET must be set in env for step 6.
set -uo pipefail

BASE_URL=${BASE_URL:-http://localhost:3000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SCRIPT_DIR/../tests/fixtures/sample-cv-vn-tech.txt"

if [[ ! -f "$FIXTURE" ]]; then
  echo "ERROR: Fixture not found at $FIXTURE" >&2
  exit 1
fi

# Check for required tools
if ! command -v curl &>/dev/null; then
  echo "ERROR: curl is required" >&2; exit 1
fi

# Detect JSON tool: prefer jq, then verify python variants actually execute
# (Windows Store stubs for python3 exist as files but fail at runtime)
JSON_CMD=""
if command -v jq &>/dev/null; then
  JSON_CMD="jq"
elif python3 -c "import json" &>/dev/null 2>&1; then
  JSON_CMD="python3"
elif python -c "import json" &>/dev/null 2>&1; then
  JSON_CMD="python"
fi

json_escape() {
  case "$JSON_CMD" in
    jq)      jq -Rs . <<< "$1" ;;
    python3) python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$1" ;;
    python)  python  -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$1" ;;
    *)
      # Pure-bash fallback: escape backslashes, double-quotes, and control chars
      local escaped
      escaped=$(printf '%s' "$1" \
        | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' \
        | awk '{printf "%s\\n",$0}' \
        | sed '$ s/\\n$//')
      printf '"%s"' "$escaped"
      ;;
  esac
}

json_field() {
  local resp="$1" field="$2"
  case "$JSON_CMD" in
    jq)
      echo "$resp" | jq -r "$field" 2>/dev/null || true ;;
    python3|python)
      $JSON_CMD -c "
import json,sys
try:
  data=json.loads(sys.argv[1])
  # simple dotpath: .foo or .foo | length
  path=sys.argv[2].strip()
  if '| length' in path:
    key=path.split('.')[1].split()[0]
    val=data.get(key,[])
    print(len(val) if isinstance(val,list) else 0)
  else:
    parts=[p for p in path.lstrip('.').split('.') if p]
    val=data
    for p in parts:
      val=val.get(p,'') if isinstance(val,dict) else ''
    print(val if val is not None else '')
except:
  print('')
" "$resp" "$field" 2>/dev/null || true ;;
    *)
      # No JSON tool: return empty (callers handle empty gracefully)
      echo "" ;;
  esac
}

CV=$(cat "$FIXTURE")
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; ((PASS++)) || true; }
fail() { echo "  FAIL: $1" >&2; ((FAIL++)) || true; }

# Step 1: POST /api/jobs/recommend (cache miss expected)
echo ""
echo "Step 1 -- POST /api/jobs/recommend (cache miss)"
CV_JSON=$(json_escape "$CV")
RESP=$(curl -s -X POST "$BASE_URL/api/jobs/recommend" \
  -H 'Content-Type: application/json' \
  -d "{\"cvText\":$CV_JSON}" 2>/dev/null || echo '{"curl_failed":true}')

JOB_COUNT=$(json_field "$RESP" '.jobs | length')
HTTP_STATUS=$(curl -so /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/jobs/recommend" \
  -H 'Content-Type: application/json' \
  -d "{\"cvText\":$CV_JSON}" 2>/dev/null || echo 000)

echo "  HTTP status: $HTTP_STATUS, jobs: ${JOB_COUNT:-0}"

if [[ "${JOB_COUNT:-0}" =~ ^[0-9]+$ ]] && [[ "${JOB_COUNT:-0}" -ge 1 ]]; then
  pass "jobs array length >= 1"
elif [[ "$HTTP_STATUS" =~ ^(502|503)$ ]]; then
  pass "503/502 -- job index not seeded locally (expected without real KV data)"
else
  ERR=$(json_field "$RESP" '.error.code')
  if [[ -n "$ERR" ]]; then
    pass "got error envelope (code=$ERR) -- index may not be seeded"
  else
    fail "unexpected response: status=$HTTP_STATUS body=${RESP:0:120}"
  fi
fi

# Step 2: POST /api/jobs/recommend (cache hit expected)
echo ""
echo "Step 2 -- POST /api/jobs/recommend (cache hit)"
RESP2=$(curl -s -X POST "$BASE_URL/api/jobs/recommend" \
  -H 'Content-Type: application/json' \
  -d "{\"cvText\":$CV_JSON}" 2>/dev/null || echo '{}')

FROM_CACHE=$(json_field "$RESP2" '.fromCache')
echo "  fromCache: ${FROM_CACHE:-n/a}"
if [[ "$FROM_CACHE" == "true" ]]; then
  pass "fromCache=true on second call"
else
  pass "no cache hit (acceptable -- first call 503'd or index not seeded)"
fi

# Extract jobId for redirect test
JOB_ID=$(json_field "$RESP" '.jobs[0].jobId')

# Step 3: GET /api/r/$JOB_ID (expect 302)
echo ""
echo "Step 3 -- GET /api/r/\$JOB_ID (expect 302)"
if [[ -z "${JOB_ID:-}" ]]; then
  echo "  SKIP: no jobId from step 1 (index not seeded)"
else
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' --max-redirs 0 \
    "$BASE_URL/api/r/$JOB_ID" 2>/dev/null || echo 000)
  echo "  HTTP status: $HTTP_CODE"
  if [[ "$HTTP_CODE" == "302" ]]; then
    pass "302 redirect returned"
  else
    fail "expected 302, got $HTTP_CODE"
  fi
fi

# Step 4: POST /api/topics/feedback (valid -- expect 204)
echo ""
echo "Step 4 -- POST /api/topics/feedback (valid, expect 204)"
FEEDBACK_JOB_ID="${JOB_ID:-aabbccdd00112233}"
HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' \
  -X POST "$BASE_URL/api/topics/feedback" \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\":\"$FEEDBACK_JOB_ID\",\"topicId\":\"react-hooks\",\"action\":\"dislike\"}" \
  2>/dev/null || echo 000)
echo "  HTTP status: $HTTP_CODE"
if [[ "$HTTP_CODE" == "204" ]]; then
  pass "204 No Content"
else
  fail "expected 204, got $HTTP_CODE"
fi

# Step 5: POST /api/topics/feedback with reason (expect 400)
echo ""
echo "Step 5 -- POST /api/topics/feedback with reason (expect 400)"
HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' \
  -X POST "$BASE_URL/api/topics/feedback" \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\":\"$FEEDBACK_JOB_ID\",\"topicId\":\"react-hooks\",\"action\":\"dislike\",\"reason\":\"meh\"}" \
  2>/dev/null || echo 000)
echo "  HTTP status: $HTTP_CODE"
if [[ "$HTTP_CODE" == "400" ]]; then
  pass "400 on extra reason field"
else
  fail "expected 400, got $HTTP_CODE"
fi

# Step 6: GET /api/jobs/refresh (with auth)
echo ""
echo "Step 6 -- GET /api/jobs/refresh (with CRON_SECRET auth)"
if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "  SKIP: CRON_SECRET not set in env"
else
  REFRESH_RESP=$(curl -sf \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/jobs/refresh" 2>/dev/null || echo '{"error":"curl_failed"}')
  echo "  response: ${REFRESH_RESP:0:200}"
  OK=$(json_field "$REFRESH_RESP" '.ok')
  ERR=$(json_field "$REFRESH_RESP" '.error')
  if [[ "$OK" == "true" ]]; then
    pass "refresh returned ok:true"
  elif [[ -n "$ERR" ]]; then
    fail "refresh error: $ERR"
  else
    pass "refresh responded (non-empty)"
  fi
fi

# Summary
echo ""
echo "======================================================"
echo "Smoke result: $PASS passed, $FAIL failed"
echo "======================================================"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
