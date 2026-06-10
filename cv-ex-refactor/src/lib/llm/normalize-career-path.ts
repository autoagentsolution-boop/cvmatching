import type {
  CareerPathResult,
  CurrentSnapshot,
  Feasibility,
  Milestone,
  SkillGap,
  AlternativePath,
  QuickWin,
  QuickWins,
  TargetRoleSummary,
  SkillImportance,
  SkillLevel,
} from '@/features/career-path/types';

type RawAny = Record<string, unknown>;

const IMPORTANCE_VALUES: SkillImportance[] = ['high', 'medium', 'low'];
const LEVEL_VALUES: SkillLevel[] = ['none', 'basic', 'intermediate', 'advanced', 'expert'];

function asObj(v: unknown): RawAny {
  return v && typeof v === 'object' ? (v as RawAny) : {};
}

function asArr(v: unknown): RawAny[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is RawAny => x !== null && typeof x === 'object');
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim())).filter(Boolean);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp0_100(v: unknown): number {
  const n = num(v, 0);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pickEnum<T extends string>(values: readonly T[], v: unknown, fallback: T): T {
  return (typeof v === 'string' && (values as readonly string[]).includes(v)) ? (v as T) : fallback;
}

function normalizeFeasibility(raw: unknown): Feasibility {
  const r = asObj(raw);
  // Default optimistic — if the LLM omits the block, assume realistic so we
  // don't scare users with a warning banner when there is no real concern.
  const realisticRaw = r.realistic;
  const realistic =
    typeof realisticRaw === 'boolean'
      ? realisticRaw
      : typeof realisticRaw === 'string'
        ? realisticRaw.toLowerCase() !== 'false'
        : true;

  // Phase 2: structured ambitionGap + requiredSteps replace gentleAdvice
  // softness. Legacy roadmaps without the new fields fall back: copy
  // gentleAdvice into ambitionGap so the banner still renders something.
  const ambitionGap = str(r.ambitionGap);
  const requiredSteps = asStrArr(r.requiredSteps).slice(0, 6);
  const gentleAdvice = str(r.gentleAdvice);

  const f: Feasibility = {
    realistic,
    reasons: asStrArr(r.reasons).slice(0, 4),
    gentleAdvice,
  };
  if (ambitionGap) {
    f.ambitionGap = ambitionGap;
  } else if (gentleAdvice && !realistic) {
    // Legacy fallback: gentleAdvice becomes the ambitionGap text so the new
    // banner UI has something to render. Softeners aren't stripped here —
    // accepted tone mismatch on cached data.
    f.ambitionGap = gentleAdvice;
  }
  if (requiredSteps.length) f.requiredSteps = requiredSteps;
  const alt = str(r.pragmaticAlternative);
  if (alt) f.pragmaticAlternative = alt;
  return f;
}

function normalizeSnapshot(raw: unknown): CurrentSnapshot {
  const r = asObj(raw);
  const snapshot: CurrentSnapshot = {
    detectedRole: str(r.detectedRole) || 'Current role',
    coreStrengths: asStrArr(r.coreStrengths).slice(0, 6),
    signatureProjects: asStrArr(r.signatureProjects).slice(0, 4),
  };
  const yrs = num(r.yearsExperience, NaN);
  if (Number.isFinite(yrs) && yrs >= 0 && yrs <= 60) {
    snapshot.yearsExperience = Math.round(yrs);
  }
  return snapshot;
}

function normalizeTarget(raw: unknown): TargetRoleSummary {
  const r = asObj(raw);
  return {
    title: str(r.title) || 'Next role',
    rationale: str(r.rationale),
    fitScore: clamp0_100(r.fitScore),
  };
}

function normalizeMilestones(raw: unknown): Milestone[] {
  return asArr(raw)
    .map((m): Milestone => {
      const ms: Milestone = {
        yearOffset: Math.max(0, num(m.yearOffset, 0)),
        title: str(m.title) || 'Milestone',
        role: str(m.role),
        responsibilities: asStrArr(m.responsibilities).slice(0, 6),
        skillsToBuild: asStrArr(m.skillsToBuild).slice(0, 6),
        evidenceToShow: asStrArr(m.evidenceToShow).slice(0, 6),
      };
      const certs = asStrArr(m.certifications).slice(0, 3);
      if (certs.length) ms.certifications = certs;
      return ms;
    })
    .filter((m) => m.title)
    .sort((a, b) => a.yearOffset - b.yearOffset)
    .slice(0, 8);
}

function normalizeSkillGaps(raw: unknown): SkillGap[] {
  return asArr(raw)
    .map((g): SkillGap => ({
      skill: str(g.skill),
      importance: pickEnum(IMPORTANCE_VALUES, g.importance, 'medium'),
      currentLevel: pickEnum(LEVEL_VALUES, g.currentLevel, 'none'),
      targetLevel: pickEnum(LEVEL_VALUES, g.targetLevel, 'intermediate'),
      howToLearn: str(g.howToLearn),
    }))
    .filter((g) => g.skill)
    .slice(0, 10);
}

function normalizeAlternatives(raw: unknown): AlternativePath[] {
  const items = asArr(raw)
    .map((a): AlternativePath => ({
      title: str(a.title),
      rationale: str(a.rationale),
      pivotSteps: asStrArr(a.pivotSteps).slice(0, 6),
    }))
    .filter((a) => a.title)
    .slice(0, 3);
  // Phase 2: enforce min 1 — when LLM drops the field, surface a transparent
  // stub so the UI doesn't render an empty section.
  if (items.length === 0) {
    items.push({
      title: 'No alternative path identified',
      rationale: 'Candidate is well-positioned for the primary target; no meaningful pivot suggested.',
      pivotSteps: [],
    });
  }
  return items;
}

/**
 * Phase 2: quickWins entries are now {action, effortHours, outcome}.
 * Legacy string-shape items (cached responses) normalize into the new
 * shape with effortHours=0 + outcome=''. After 2 weeks of new-shape
 * responses drop the string branch.
 */
function normalizeQuickWinList(raw: unknown): QuickWin[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): QuickWin | null => {
      if (typeof item === 'string') {
        const action = item.trim();
        return action ? { action, effortHours: 0, outcome: '' } : null;
      }
      if (item && typeof item === 'object') {
        const o = item as RawAny;
        const action = str(o.action);
        if (!action) return null;
        const effortHours = Math.max(0, Math.min(80, Math.round(num(o.effortHours, 0))));
        return { action, effortHours, outcome: str(o.outcome) };
      }
      return null;
    })
    .filter((x): x is QuickWin => x !== null)
    .slice(0, 6);
}

function normalizeQuickWins(raw: unknown): QuickWins {
  const r = asObj(raw);
  return {
    days30: normalizeQuickWinList(r.days30),
    days60: normalizeQuickWinList(r.days60),
    days90: normalizeQuickWinList(r.days90),
  };
}

export function normalizeCareerPath(rawInput: unknown): CareerPathResult {
  const raw = asObj(rawInput);
  const result: CareerPathResult = {
    feasibility: normalizeFeasibility(raw.feasibility),
    currentSnapshot: normalizeSnapshot(raw.currentSnapshot),
    targetRole: normalizeTarget(raw.targetRole),
    milestones: normalizeMilestones(raw.milestones),
    skillGaps: normalizeSkillGaps(raw.skillGaps),
    alternativePaths: normalizeAlternatives(raw.alternativePaths),
    quickWins: normalizeQuickWins(raw.quickWins),
  };
  const caveats = str(raw.caveats);
  if (caveats) result.caveats = caveats;
  return result;
}
