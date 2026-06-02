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
  seniority: Seniority;
  tier?: Tier;
  description: string;
  sourceUrl: string;
  source: 'itviec' | 'topcv' | 'vnw' | 'other';
  location: string;
  postedAt: string;
  verifiedAt: string;
  // base64-encoded Float32Array(768) — Gemini gemini-embedding-001, L2-normalized
  embedding: string;
}

// Input shape from seed JSON / CLI paste — fields filled at ingest time are omitted.
export type JobInput = Omit<Job, 'id' | 'embedding' | 'verifiedAt' | 'vertical' | 'seniority'> & {
  vertical?: Vertical;
  seniority?: Seniority;
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
