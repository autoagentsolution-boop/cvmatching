// Prompt builder for the v0.4 role-inference step.
//
// Extracts a canonical target role + confidence + alternates from a raw CV.
// Runs BEFORE the v3 scoring prompt so the scorer has a stable role anchor.
// Few-shot the LLM with 3 mixed examples (clear / ambiguous / generalist)
// so confidence calibration is consistent across CV shapes.
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-02-api-analyze-refactor.md

import type { Language } from '@/features/analyze/types';

export interface RoleInferPromptInputs {
  cvText: string;
  language?: Language;
}

export interface BuiltRoleInferPrompts {
  system: string;
  user: string;
}

const SCHEMA = `{
  "canonical": "string — single canonical role title (e.g. 'Senior Backend Engineer', 'Marketing Manager')",
  "confidence": "0.0-1.0 — how confident the CV evidences this role unambiguously (header + recent titles + skills)",
  "alternates": ["up to 3 other plausible role labels for the CV, ordered by likelihood"]
}`;

const FEW_SHOT = `Example A — clear, senior, single track:
CV: "Senior Backend Engineer @ FinCorp (3y). Node/Postgres/K8s. Owned payments service…"
→ { "canonical": "Senior Backend Engineer", "confidence": 0.92, "alternates": ["Backend Tech Lead", "Platform Engineer"] }

Example B — ambiguous generalist:
CV: "Software engineer, full-stack. React + Node. Some DevOps. 2 yrs at startup."
→ { "canonical": "Full-Stack Engineer", "confidence": 0.58, "alternates": ["Frontend Engineer", "Backend Engineer"] }

Example C — career switcher / weak header:
CV: "Recently learned Python. 5 yrs as accountant. Built scripts for finance team."
→ { "canonical": "Data Analyst", "confidence": 0.42, "alternates": ["Finance Analyst", "Junior Data Engineer"] }`;

export function buildRoleInferPrompts(inputs: RoleInferPromptInputs): BuiltRoleInferPrompts {
  const { cvText } = inputs;

  const system =
    "You are an expert technical recruiter. Read a CV and infer the candidate's most likely current target role. Return ONE valid JSON object. Be concrete and conservative with confidence — high confidence (>=0.75) requires the CV to evidence the role unambiguously via title, recent experience, and skill stack alignment.";

  const user = `Infer the candidate's target role from this CV. Return canonical title, confidence (0-1), and up to 3 alternates ordered by likelihood.

${FEW_SHOT}

=== CANDIDATE CV ===
${cvText}

=== CONFIDENCE RUBRIC ===
- 0.85-1.00: CV unambiguously evidences the role (title + skills + recent experience all align)
- 0.65-0.84: Strong signal but minor noise (career shift, multi-track CV)
- 0.45-0.64: Ambiguous — multiple plausible roles
- 0.00-0.44: Weak signal — generic CV, missing header, career switcher with little evidence

Return ONLY one valid JSON object (no commentary, no markdown fences) matching this schema:
${SCHEMA}`;

  return { system, user };
}
