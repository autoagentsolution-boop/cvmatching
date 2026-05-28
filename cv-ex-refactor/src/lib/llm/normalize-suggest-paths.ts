import type { PathSuggestion, PathTrajectory } from '@/features/career-path/types';

type RawAny = Record<string, unknown>;

const TRAJECTORY_VALUES: PathTrajectory[] = ['specialist', 'leadership', 'pivot', 'breadth'];

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

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp0_100(v: unknown): number {
  return Math.max(0, Math.min(100, Math.round(num(v))));
}

function pickEnum<T extends string>(values: readonly T[], v: unknown, fallback: T): T {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function normalizeSuggestPaths(rawInput: unknown): PathSuggestion[] {
  const raw = asObj(rawInput);
  const list = asArr(raw.suggestions ?? raw.paths ?? raw.options);
  return list
    .map((s): PathSuggestion => ({
      title: str(s.title),
      trajectory: pickEnum(TRAJECTORY_VALUES, s.trajectory, 'specialist'),
      rationale: str(s.rationale),
      growthAreas: asStrArr(s.growthAreas).slice(0, 4),
      fitScore: clamp0_100(s.fitScore),
    }))
    .filter((s) => s.title)
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 6);
}
