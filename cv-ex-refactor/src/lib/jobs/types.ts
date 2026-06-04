// Job domain types for v0.3 Job Fit & Study feature.
// id = sha256(sourceUrl).slice(0,16); embedding = base64 Float32Array(768, Gemini gemini-embedding-001, L2-normalized).

export type Vertical = 'tech' | 'marketing' | 'finance' | 'sales' | 'ops' | 'other';
export type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'lead';
export type Tier = 'high' | 'mid' | 'startup';

export interface Job {
  id: string;
  title: string;
  company: string;
  vertical: Vertical;
  /**
   * Free-text sub-vertical id from taxonomy.ts, e.g. 'tech.software', 'tech.data',
   * 'finance.accounting', 'sales.field-b2b'. Optional — existing pre-taxonomy
   * jobs have undefined; new ingests carry it through from the filter step.
   */
  subVertical?: string;
  seniority: Seniority;
  tier?: Tier;
  description: string;
  sourceUrl: string;
  source: 'itviec' | 'topcv' | 'vnw' | 'vl24h' | 'other';
  location: string;
  postedAt: string;
  verifiedAt: string;
  // base64-encoded Float32Array(768) — Gemini gemini-embedding-001, L2-normalized
  embedding: string;
  /**
   * v0.4 placeholder for ingest-extracted hard requirements. Optional + may
   * be undefined on all live jobs until the ingest pipeline learns to
   * populate it. The Job Fit detail UI conditionally renders only when
   * non-empty (no fake empty-state clutter while ingest catches up).
   */
  mustHaves?: string[];
}

// Input shape from seed JSON / CLI paste — fields filled at ingest time are omitted.
export type JobInput = Omit<Job, 'id' | 'embedding' | 'verifiedAt' | 'vertical' | 'seniority'> & {
  vertical?: Vertical;
  seniority?: Seniority;
  subVertical?: string;
};

export interface StudyTopic {
  id: string;
  label: string;
  rationale: string;
}

export interface JobMatch {
  jobId: string;
  overallScore: number;
  scores: Record<string, number>;
  matchReasons: string[];
  studyTopics: StudyTopic[];
}
