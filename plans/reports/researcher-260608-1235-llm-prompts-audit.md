# LLM Prompt Audit Report
**Generated:** 2026-06-08  
**Codebase:** cv-ex-refactor (v0.4 CV-solo pivot)  
**Scope:** 4 user-facing AI surfaces — prompt construction, schemas, LLM config, shared dependencies

---

## Executive Summary

The cv-matching platform has **4 distinct LLM-driven user features** in v0.4:

1. **CV Scoring (v3, CV-intrinsic)** — evaluates CV against role baseline (no JD)
2. **Career Roadmap** — generates 5–6-milestone career path + feasibility gate
3. **Job Fit (recommendation)** — scores CV against job pool (6–12 jobs)
4. **CV Refinement (regeneration)** — rewrites CV to match JD or findings

All 4 **do NOT share a single upstream candidate-analysis layer**. Each calls the LLM independently; CV scoring (v3) is intentionally separated from the legacy v2 (CV-vs-JD) flow. Temperature defaults to **0.3** (low variance); token caps vary by surface (16K–24K output). Gemini 2.5-flash is the default with thinking disabled for JSON tasks.

---

## A. CV Scoring — 9-Dimension Role-Intrinsic Analysis (v0.4 Phase 1)

**File:** `/src/lib/llm/prompt-analyze-v3.ts` (lines 1–133)  
**API Route:** `/src/app/api/analyze/route.ts` (lines 32–40 dispatcher; line 71 call site)  
**Caller:** Dispatched via `isV3Shape()` check; calls `buildAnalyzeV3Prompts(inputs)`

### Prompt Template (System + User, Verbatim)

**System Prompt:**
```
You are an expert technical recruiter and CV reviewer. Score CVs intrinsically against the candidate's claimed role using industry-standard role baselines — you are NOT comparing against any specific JD. Always return ONE valid JSON object matching the requested schema. Be concrete, honest, concise. Never invent candidate experience. Never fabricate quantitative outcomes the CV does not state.
```

**User Prompt (lines 94–130 of prompt-analyze-v3.ts):**
```
Evaluate the candidate's CV for the claimed role. Use industry-standard expectations for that role as the baseline — there is no JD. Score each dimension based on what THIS role typically requires and what the CV evidences.

=== TODAY'S DATE (server time) ===
${todayIso ?? '(unknown — treat all CV dates as historical unless clearly future)'}
Use this to judge whether CV dates are past / current / future. Do NOT assume today is your training-cutoff date — a "Mar 2026" end date may be in the past relative to TODAY.

=== CANDIDATE'S CLAIMED ROLE ===
${role}

=== CANDIDATE CV ===
${cvText}

=== REAL EXPERIENCE PROFILE (extra context — use to distinguish wording-gap vs real-experience-gap) ===
${profileText?.trim() || '(none provided)'}

=== ANALYSIS PARAMETERS ===
- ${langInstr}

=== 9-DIMENSION RUBRIC (each scored 0-100 against role baseline) ===
- coreSkill: Core competencies the role demands. Does the CV demonstrate these for the role baseline?
- tool: Concrete tools / platforms / frameworks expected for the role. Are they evidenced?
- scope: Scope owned (IC vs lead, team vs cross-org). Does the CV match the role's level?
- production: Real production environments — live systems, real users. Evidenced for the role?
- domain: Industry / domain context relevant to the role. Demonstrates depth or generic?
- evidence: Concrete proof: project, role, dates, ownership — not buzzwords. Strong for the role?
- seniority: Level, years, ownership, decision-making. Does CV demonstrate the claimed seniority?
- impact: Magnitude of outcomes: metrics, percentages, scale, business impact. Strong for the role?
- communication: Stakeholder collaboration, team/client communication. Evidenced for the role?

=== SCORING RULES ===
1. Score each of the 9 metrics 0-100 independently — "how well does the CV evidence this dimension for what the role typically requires".
2. Use ROLE BASELINE as the reference, not a specific JD. Example: for "Senior Backend Engineer" baseline ~ Node/Python + cloud + system design + 5+ yrs.
3. If a dimension is genuinely irrelevant for the role, score around 50 with reason explaining the irrelevance.
4. cv_wording_gap (type=wording): candidate likely has the experience per profile but CV doesn't show it clearly.
5. real_experience_gap (type=real): candidate truly lacks it relative to role baseline.
6. Severity: critical = blocking missing capability for the role; moderate = noticeable weakness; minor = wording polish.
7. Return 4-8 strengths, 4-10 gaps, 0-5 red flags, 4-8 recommendations.
8. atsKeyword: score the CV's coverage of industry-standard keywords for the role (not vs any single JD). keywordCoverage arrays list which role-baseline keywords are matched / partial / missing in the CV.
9. detectedRole: echo back the canonical role title you actually evaluated against (may differ slightly from input if the CV strongly suggests a refinement; explain refinement in summary).
10. Do NOT invent candidate experience. Score only on the provided CV + profile text.
11. Do NOT output overallScore or decision/decisionLabel — the client computes those from the 9 metric scores.
12. Do NOT include a 'coverage' array — there is no JD to cover. (The field is dropped in v3.)

Return ONLY one valid JSON object (no commentary, no markdown fences) matching this schema:
${SCHEMA}
```

### Output JSON Schema (Zod + Hardcoded)

**Input Schema** (`AnalyzeV3Inputs`, lines 73–78 of llm-request.ts):
```typescript
{
  cvText: z.string().min(100).max(50_000),
  profileText: z.string().max(10_000).optional(),
  language: z.enum(['en', 'vi', 'auto']).default('auto'),
  role: z.string().min(2).max(120).optional()
}
```

**Output Schema** (hardcoded JSON string, lines 42–67 of prompt-analyze-v3.ts):
```typescript
{
  detectedRole: string;
  summary: string;              // 2-3 sentence verdict
  cvVisibility: 0–100;
  realExperience: 0–100;
  risk: 0–100;
  screeningPass: 0–100;
  interviewReadiness: 0–100;
  atsKeyword: 0–100;
  metrics: [
    { name: string (9 options), score: 0–100, reason: string }
  ];
  strengths: [{ title: string, evidence: string }];
  gaps: [
    { title: string, severity: "critical"|"moderate"|"minor", type: "wording"|"real", 
      recommendation: string, fixAction: string }
  ];
  redFlags: [{ flag: string, concern: string }];
  recommendations: [{ title: string, action: string, priority: "high"|"medium"|"low" }];
  keywordCoverage: { matched: string[], partial: string[], missing: string[] };
  suggestedSummaryLine: string;
}
```

**Client-side Score Recomputation** (`recompute-overall.ts`, lines 28–40):
- Mean of 9 metric scores → `overallScore`
- Decision: ≥75='strong', ≥55='good', ≥35='stretch', <35='low'
- Slider override enabled (browser local state)

### LLM Configuration

- **Model:** `gemini-2.5-flash` (default; OpenAI fallback supported)
- **Temperature:** 0.3 (from `LlmConfig.temperature.default(0.3)`)
- **Max Output Tokens:** 16,384 (default in call-gemini.ts line 66)
- **Thinking Disabled:** `disableThinking: true` (line 71 of call-gemini.ts)
- **Pricing (2026-05-27):** $0.3 per 1M input / $2.5 per 1M output tokens

---

## B. Career Roadmap Generation

**File:** `/src/lib/llm/prompt-career-path.ts` (lines 1–133)  
**API Route:** `/src/app/api/career-path/route.ts` (line 51 call site)  
**Caller:** `buildCareerPathPrompts(body)` from POST /api/career-path

### Prompt Template (System + User, Verbatim)

**System Prompt:**
```
You are a senior career coach and former technical hiring manager. Always return ONE valid JSON object matching the requested schema. Be concrete, honest, concise. Never invent candidate experience. Tailor everything to the CV evidence + stated aspiration.
```

**User Prompt (lines 97–130):**
```
Build a personalised career-development roadmap.

=== CV ===
${cvText}

${analysisSummary ? `=== PRIOR ANALYSIS SUMMARY ===\n${analysisSummary}\n` : ''}${currentRole ? `=== CURRENT ROLE (detected) ===\n${currentRole}\n` : ''}=== ASPIRATION ===
Target role: ${aspiration.targetRole || 'auto — infer from CV + focus areas'}
Horizon: ${aspiration.horizonYears} year(s)
Focus areas:
${focusLabels}
${aspiration.industryShift ? `Industry shift: ${aspiration.industryShift}` : ''}
${aspiration.constraints ? `Constraints: ${aspiration.constraints}` : ''}
${aspiration.notes ? `Notes: ${aspiration.notes}` : ''}

=== INSTRUCTIONS ===
${modeInstr}

1. Read the CV carefully and extract real strengths + signature projects for currentSnapshot.
2. Judge feasibility FIRST... [scoring rules 2–9 fully as in lines 116–127]
...
Return JSON ONLY, matching this schema (no markdown, no commentary):
${SCHEMA}
```

### Output JSON Schema (lines 4–55 of prompt-career-path.ts)

```typescript
{
  feasibility: { realistic: boolean, reasons: string[], gentleAdvice: string, pragmaticAlternative?: string },
  currentSnapshot: { detectedRole: string, yearsExperience?: number, coreStrengths: string[], signatureProjects: string[] },
  targetRole: { title: string, rationale: string, fitScore: 0–100 },
  milestones: [
    { yearOffset: number, title: string, role: string, responsibilities: string[], 
      skillsToBuild: string[], evidenceToShow: string[], certifications: string[] }
  ],
  skillGaps: [
    { skill: string, importance: "high"|"medium"|"low", 
      currentLevel: "none"|"basic"|"intermediate"|"advanced"|"expert",
      targetLevel: "...", howToLearn: string }
  ],
  alternativePaths: [{ title: string, rationale: string, pivotSteps: string[] }],
  quickWins: { days30: string[], days60: string[], days90: string[] },
  caveats?: string
}
```

### LLM Configuration

- **Model:** `gemini-2.5-flash`
- **Temperature:** 0.3
- **Max Output Tokens:** 24,576 (bumped from 16K to accommodate multiple nested arrays; set in route.ts line 64)
- **Thinking Disabled:** `disableThinking: true`
- **Cost:** $0.3 input / $2.5 output per 1M tokens

---

## C. Job Fit & Recommendation

**File:** `/src/lib/llm/prompt-job-recommend.ts` (lines 1–73)  
**API Route:** `/src/app/api/jobs/recommend/route.ts` (line 280 call site)  
**Caller:** `buildRecommendPrompts()` from route.ts; LLM call via `callRecommendLlm()` with retry

### Prompt Template (System + User, Verbatim)

**System Prompt (lines 15–54, originally Vietnamese targeting VN job market):**
```
Bạn là chuyên gia tuyển dụng thị trường lao động Việt Nam. Cho một CV và danh sách job ứng viên, hãy xuất STRICT JSON theo schema sau:

{
  "jobs": [
    {
      "jobId": string,
      "overallScore": number (0-100),
      "dimensionScores": {
        "skills": number (0-100),
        "experience": number (0-100),
        "education": number (0-100),
        "industry": number (0-100),
        "seniority": number (0-100),
        "location": number (0-100),
        "tools": number (0-100),
        "soft": number (0-100),
        "domain": number (0-100)
      },
      "matchReasons": string[] (3-5 lý do bằng tiếng Việt),
      "studyTopics": [
        {
          "name": string,
          "category": "frontend" | "backend" | "db" | "devops" | "soft" | "domain",
          "tier": "basic" | "intermediate" | "advanced",
          "whyForThisJob": string (TỐI ĐA 2 câu tiếng Việt, trích dẫn cụ thể từ JD),
          "estimatedHours": string (ví dụ: "4-8h")
        }
      ] (TỐI ĐA 3 topic mỗi job — chọn topic ưu tiên cao nhất)
    }
  ]
}

Quy tắc bắt buộc:
- Chấm điểm TẤT CẢ candidates được cấp trên thang 0-100, KHÔNG lọc theo ngưỡng. Xuất nguyên số candidates (thường 6 jobs), phủ đầy đủ dải điểm (cao, trung bình, thấp).
- overallScore PHẢI phản ánh fit thực tế: rất phù hợp 85-100, khá phù hợp 70-85, có thể stretch 55-70, gap lớn dưới 55. KHÔNG dồn cụm 80-85 cho mọi job.
- Mỗi job 1 điểm số riêng (tránh tie). Nếu pool tốt (đa số match) → vẫn phải có ít nhất 1-2 job dưới 70 để chứng minh đánh giá khắt khe. Nếu pool yếu → ĐỪNG "tô đẹp" lên ≥90.
- studyTopics phải cụ thể với JD, KHÔNG chung chung.
- whyForThisJob PHẢI trích dẫn thuật ngữ cụ thể từ JD.
- matchReasons và whyForThisJob viết bằng tiếng Việt.
- KHÔNG xuất markdown, KHÔNG prose, KHÔNG giải thích ngoài JSON.
```

**User Prompt (line 70):**
```
${JSON.stringify({ cv: cvText, candidates })}
```
where candidates = array of 6–12 jobs, each with: `{ id, title, company, vertical, seniority, description (truncated ≤800 chars) }`

### Output JSON Schema

**Zod Validation** (normalize-job-recommend.ts, lines 5–38):
```typescript
{
  jobs: [
    {
      jobId: string,
      overallScore: z.number().min(0).max(100),
      dimensionScores: {
        skills: number, experience: number, education: number,
        industry: number, seniority: number, location: number,
        tools: number, soft: number, domain: number
      },
      matchReasons: z.array(z.string()).min(1).max(8),
      studyTopics: z.array({
        name: string, category: enum, tier: enum,
        whyForThisJob: string, estimatedHours: string
      }).min(1).max(5)
    }
  ]
}
```

**Client Output** (JobMatchOut, lines 50–75 of normalize-job-recommend.ts):
```typescript
{
  jobId: string, title: string, company: string, location: string,
  sourceUrl: string, description: string,  // Full JD for /refined-cv step
  overallScore: number,
  tier: TierLetter,  // Derived from score: ≥80='S', ≥70='A', ≥60='B', ≥50='C', ≥40='D', <40='E'
  dimensionScores: {...},
  matchReasons: string[],
  studyTopics: StudyTopicOut[],
  mustHaves?: string[],    // v0.4 ingest-time parsed
  companyId?: string       // v0.4 KV enrichment
}
```

### LLM Configuration

- **Model:** `gemini-2.5-flash` (default; overridable via body.llm; defaults on line 123 of route.ts)
- **Temperature:** 0.3
- **Max Output Tokens:** 16,384
- **Thinking:** Unspecified (uses Gemini default, not explicitly disabled)
- **Retry:** 1 automatic retry on JSON parse failure (llm-call-with-retry.ts)
- **Request Timeout:** 55s (60s maxDuration − 5s safety buffer; line 38–39 of route.ts)
- **Pre-LLM Step:** CV embedding (768-dim, cached in KV); vector search via pgvector or KV memo

---

## D. CV Refinement / Regeneration

**File:** `/src/lib/llm/prompt-generate-cv.ts` (lines 1–99)  
**API Route:** `/src/app/api/generate-cv/route.ts`  
**Caller:** `buildGenerateCvPrompts(body)` dispatched by v2/v3 body shape

### Prompt Template (System + User, Verbatim)

**System Prompt:**
```
You are an expert CV writer. You NEVER invent skills, tools, or experience. You may only rephrase or surface what is already in the candidate's text. Output clean Markdown only.
```

**User Prompt (lines 47–96):**
```
Rewrite the candidate's CV to better match the Job Description, while staying 100% truthful.

=== JOB DESCRIPTION ===
${inputs.jdText}

=== ORIGINAL CV ===
${inputs.cvText}

=== REAL EXPERIENCE PROFILE (true experience that may not be in the CV — you MAY surface this) ===
${inputs.profileText?.trim() || '(none provided)'}

=== PRIOR ANALYSIS CONTEXT ===
${analysisSummary}

=== STYLE ===
- Tone: ${TONE_INSTR[inputs.tone]}
- Length: ${LENGTH_INSTR[inputs.length]}
- ${langInstr}
${inputs.extraInstructions ? `- Extra instructions: ${inputs.extraInstructions}` : ''}

=== HARD RULES ===
1. DO NOT invent skills, tools, certifications, employers, or experience the candidate does not have.
2. You MAY rephrase existing bullets using JD keywords IF the underlying experience is true.
3. You MAY surface real experience from the profile that wasn't in the CV.
4. Use action + tool + scope + outcome bullets. Quantify where the original text gives numbers.
5. CV STRUCTURE: # Name & headline, ## Summary (3-4 lines), ## Key Skills (grouped), ## Experience (top 3-5 roles with bullets), ## Education / Certifications (if present), ## Tools.

=== OUTPUT FORMAT (CRITICAL) ===
Output is split into TWO blocks separated by a line containing exactly: <!--REFINE-NOTES-->

Block 1 — THE CV (sendable to recruiters as-is):
Pure CV content following the structure above. Nothing else. NO meta commentary, NO "Changes Made", NO gap analysis inside this block. The candidate will copy/download this block verbatim and submit it.

After the CV body, on its own line, output the separator:
<!--REFINE-NOTES-->

Block 2 — REFINE NOTES (for the candidate's eyes only, never sent to recruiter):
A short report with these sections, each as h3 (###):
### Changes Made
- bullets: what you emphasized or rephrased to match the JD (cite the JD signal)
- bullets: what you intentionally did NOT add (gaps that remain real risks for interview)

### Gaps To Address Before Interview
- one bullet per remaining gap with a concrete prep suggestion
- omit this section entirely if there are no remaining gaps

=== MODE ===
${MODE_INSTR[mode]}

Output ONLY Markdown. No preamble, no code fences. The <!--REFINE-NOTES--> separator MUST appear exactly once.
```

**Tone & Length Instructions** (lines 3–14):
- Tone: concise, impact, recruiter, executive
- Length: short (1 page), medium (1.5 pages), long (2 pages)

**Modes** (lines 20–27):
- `apply`: Strong fit; lead with JD-aligned wins
- `fill-gaps`: Core fit; surface real experience from profile; list remaining gaps in refine notes
- `stretch`: Below bar; highlight transferable skills; frame gaps honestly in refine notes

### Output Format (Markdown, Not JSON)

Two-block split by `<!--REFINE-NOTES-->`:
1. **Block 1:** Refined CV (Markdown, sendable verbatim)
2. **Block 2:** Refine Notes (###Changes Made, ###Gaps To Address — candidate only)

### LLM Configuration

- **Model:** `gemini-2.5-flash`
- **Temperature:** 0.3
- **Max Output Tokens:** 16,384
- **Thinking Disabled:** `disableThinking: true`
- **Cost:** $0.3 input / $2.5 output per 1M tokens

---

## Shared Upstream Candidate-Analysis Layer?

**Answer: NO.**

Each surface is **independent**, though v3 analyze output (AnalysisResult) can be optionally consumed downstream as summarized text:

- **v3 Analyze** (`prompt-analyze-v3.ts`): Scores CV vs role baseline (9 metrics)
- **Career Roadmap** (`prompt-career-path.ts`): Takes CV + aspiration; **optionally** uses prior-analyze summary as context (text, not structured JSON)
- **Job Recommend** (`prompt-job-recommend.ts`): Takes CV + job pool; no dependency on analyze
- **CV Refine** (`prompt-generate-cv.ts`): Takes CV + JD (v2) OR CV + analyze findings (v3); independent LLM call

No shared upstream struct. No candidate-profile cache. Each has its own LLM call.

---

## Test Fixtures & Sample Outputs

- **None committed** for the 4 LLM prompts themselves
- `/tests/api-analyze-v3.test.ts`: Tests dispatcher logic only (mocks LLM)
- `/tests/integration/recommend-endpoint-smoke.test.ts`: Optional live integration test
- `/data/scraped-test-12.json`: Sample job listings (for embedding cache tests, not LLM outputs)
- Manual testing via Vercel preview instances

---

## Token Budget & Performance Summary

| Surface | Max Input | Max Output | Default Model | Temp | Thinking | Retry |
|---------|-----------|-----------|---------------|------|----------|-------|
| **Analyze v3** | 50K chars | 16K tokens | gemini-2.5-flash | 0.3 | Disabled | None |
| **Career Roadmap** | 50K chars | 24K tokens | gemini-2.5-flash | 0.3 | Disabled | None |
| **Job Recommend** | 20K CV + 6–12×800 jobs | 16K tokens | gemini-2.5-flash | 0.3 | Default | 1× on parse |
| **CV Refine** | 50K JD + CV | 16K tokens | gemini-2.5-flash | 0.3 | Disabled | None |

---

## v0.4 Notable Changes from v0.3

1. **CV-Solo Analyze (Phase 1)**: v3 replaces v2; scores against *role baseline*, not explicit JD
2. **Role Inference**: Optional pre-step (`role-infer-prompt.ts`, few-shot with 3 examples) infers canonical role before v3 analyze
3. **Client-Side Score Override**: v3 returns 9 metrics; UI sliders allow override, client recalculates overall via `recomputeOverall()`
4. **Gemini Thinking Disabled**: All structured-JSON outputs disable Gemini 2.5's thinking phase to save 30–50s latency
5. **Job Fit Tier-Gating (Phase 4)**: Postgres routing; free/anon users see 1–2 matches, paid users see 6–12

---

## Call Flow Summary

### Analyze (v3)
1. POST /api/analyze with AnalyzeV3Body
2. Dispatch: isV3Shape() → handleAnalyzeV3()
3. Optional: Infer role if absent
4. Build prompts → Gemini (max 16K, thinking disabled)
5. Normalize → AnalysisResult; client renders sliders

### Career Roadmap
1. POST /api/career-path with CareerPathBody
2. Build prompts → Gemini (max 24K)
3. Normalize → return milestones + feasibility

### Job Recommend
1. POST /api/jobs/recommend with cvText
2. Embed CV (cached) → vector search (top 6–12)
3. Build prompts → Gemini (max 16K, 1 retry)
4. Normalize → tier-gate → return JobMatchOut[]

### CV Refine
1. POST /api/generate-cv with JD or findings
2. Dispatch: check body shape (jdText or findings)
3. Build prompts → Gemini (Markdown)
4. Split by <!--REFINE-NOTES--> → return blocks
