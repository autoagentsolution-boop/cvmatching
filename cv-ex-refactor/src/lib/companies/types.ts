// Company domain types for v0.4 Company Profile + Reviews feature.
// See plans/260604-1218-company-profile-reviews/ for full design + Phase
// breakdown. Three-tier shape:
//   Tier 1 — scrape-derived facts (source = job-detail company section)
//   Tier 2 — LLM grounded enrichment (lazy, 30d cache)
//   Tier 3 — external ratings (Glassdoor/Google scrape, 7d cache)
//
// `slug` is the stable identifier: kebab-case, ≤60 chars, derived from
// canonical company name. `companyId` on Job points to this slug.

/**
 * Five size buckets — coarse enough to span all VN job-board phrasings,
 * fine enough to differentiate startup / SME / corp / mega-corp for UX
 * filtering and trust signals.
 */
export type CompanySizeBucket = '1-50' | '51-200' | '201-1000' | '1001-5000' | '5000+';

export interface CompanyTier1 {
  /** Source page URL the scrape pulled from (job detail or company section page). */
  sourceUrl: string;
  /** Display name as rendered on source page — preserves capitalization/punctuation. */
  displayName: string;
  /** Optional fields populated when scrape extracts them. All optional — partial render OK. */
  website?: string;
  hq?: string;
  size?: CompanySizeBucket;
  industry?: string;
  about?: string;
  logoUrl?: string;
  /** Scraper marks `true` when company-section fetch failed and we minted a stub. Retry on next ingest. */
  pending?: boolean;
}

export interface CitationChip {
  url: string;
  /** Display label, usually domain (e.g. 'glassdoor.com'). */
  label: string;
}

export interface EnrichmentClaim {
  text: string;
  citations: CitationChip[];
}

export interface CompanyEnrichment {
  summary: string;
  pros: EnrichmentClaim[];
  cons: EnrichmentClaim[];
  /** True when LLM grounded search returned <2 sources for a `cons` claim — UI hides cons block. */
  insufficientSources?: boolean;
  /** ISO timestamp of last LLM call. Used to compute 30d expiry. */
  enrichedAt: string;
}

export interface ExternalRatings {
  glassdoor?: { score: number; reviewCount: number; url: string };
  google?: { score: number; reviewCount: number; url: string };
  /** Vietnam-local rating sources (anphabe, etc.) — added in Phase B if needed. */
  anphabe?: { score: number; reviewCount: number; url: string };
  /** ISO timestamp of last scrape. Used to compute 7d expiry. */
  fetchedAt: string;
  /** True when all rating scrapes failed (rate-limit, captcha) — UI falls back to link-out only. */
  scrapeFailed?: boolean;
}

export interface Company {
  slug: string;
  /** Canonical normalized name (lowercase, legal-suffix-stripped) — basis for alias lookup. */
  canonicalName: string;
  tier1: CompanyTier1;
  /**
   * Optional Tier 2 enrichment. Absent until first lazy fetch (user opens detail page). 30d cache.
   * Phase 5 endpoint populates this.
   */
  enrichment?: CompanyEnrichment;
  /** ISO timestamp marking when tier1 was last scraped. UI shows "Updated Nd ago" stamp when >90d. */
  tier1FetchedAt: string;
  /** ISO timestamp tier1 expiry trigger. App-level enforcement (no native KV TTL on `co:{slug}`). */
  tier1ExpiresAt: string;
  /** ISO timestamp the slug was minted. Stable, never updated. */
  createdAt: string;
}

export interface DedupCandidate {
  slug: string;
  /** LLM-rated similarity 0-1. ≥0.95 = auto-merge; 0.7-0.95 = admin queue; <0.7 = mint-new. */
  score: number;
  /** Short LLM rationale; rendered in admin dedup queue. */
  reason: string;
}

export interface DedupQueueEntry {
  /** Raw name from the new job's `company` field, before normalization. */
  rawName: string;
  /** Normalized form used for alias indexing. */
  normalizedName: string;
  /** Slug of the existing company that LLM judged a likely match. */
  candidateSlug: string;
  /** LLM similarity score 0.7-0.95. */
  score: number;
  /** Free-text LLM rationale for the candidate match. */
  reason: string;
  /** ISO timestamp enqueued. Admin queue UI sorts by this. */
  enqueuedAt: string;
}

export interface ResolveCompanyResult {
  slug: string;
  /** True when this call minted a new company record; false on alias-hit or LLM auto-merge. */
  created: boolean;
  /**
   * True when slug was assigned via LLM 0.7-0.95 match — admin must approve in dedup queue
   * (or split via Phase 7 tooling). UI may render provisional banner on Company card.
   */
  provisional: boolean;
}
