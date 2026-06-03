# Phase 1 — Taxonomy Codification

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocks:** phases 2, 3, 4, 5

## Goal

Convert the 6 sibling taxonomy md docs into a single typed TS module that scrape scripts + post-ingest classify both consume. One source of truth for slug whitelists, sub-domain regex pairs, and bilingual title patterns.

## Files to Create

- `src/lib/jobs/taxonomy.ts` — typed module; ≤ 200 lines (split into 3 colocated files if it exceeds budget: `taxonomy.types.ts`, `taxonomy-{vertical}.ts` × 6 imported by an `index.ts`)
- `src/lib/jobs/taxonomy.test.ts` — vitest unit suite asserting slug coverage + regex precision/recall

## Files to Modify

- `src/lib/jobs/types.ts` — add `subVertical?: string` to `Job` and `JobInput`. Format: `{vertical}.{subdomain-slug}` e.g. `tech.software.backend`, `sales.field-b2b`, `finance.accounting.tax`.

## Sub-Domain Inventory (from taxonomy docs)

Encode each as a `SubDomain { id, titlesPositive: RegExp, titlesNegative: RegExp, sourceSlugs: Record<Source, string[]> }`.

**tech** (8 sub-domains from `tech-role-taxonomy.md` §A):
- `software` (backend, frontend, fullstack, mobile, game, embedded — one regex covers all; positive: `/backend|frontend|full[ -]?stack|mobile|ios|android|game|embedded|kỹ sư phần mềm|lập trình viên|developer|engineer.*(software|node|react|python|java)/i`)
- `data` (engineer, analyst, scientist, DBA, BA-tech)
- `ml-ai` (ML, AI, CV, NLP)
- `infra` (DevOps, SRE, Cloud, Platform, Sysadmin)
- `security` (AppSec, InfoSec, SOC, PenTest)
- `architecture` (Solution Architect, Software Architect, Tech Lead, EM, CTO)
- `qa` (QA Auto, QA Manual, Performance, Security QA)
- `product-tech` (Product Manager Tech, Tech Writer, Scrum Master)
- Slugs: `it-phan-mem`, `it-phan-cung-mang`, `phan-tich-thong-ke-du-lieu`
- Negative shared: `/cơ khí|điện(\s|$)|xây dựng|kiến trúc(?! sư phần mềm)|tự động hóa cơ khí|kỹ sư cầu đường|sales engineer|kỹ sư bán hàng/i`

**marketing** (10 sub-domains from `marketing-role-taxonomy.md` §A):
- `brand-strategy`, `digital`, `content`, `social`, `creative`, `pr`, `trade-channel`, `growth-crm`, `research`, `analytics`
- Slugs: `marketing`, `thiet-ke-sang-tao-nghe-thuat`, `thong-tin-truyen-thong-quang-cao`, `truyen-hinh-bao-chi-bien-tap`
- Key negatives (§D): Sales Marketing Manager (sales target / quota), Brand Ambassador (commission), Marketing Engineer (sales eng), PR Officer (admin), HR

**finance** (10 sub-domains from `finance-role-taxonomy.md`):
- `accounting`, `audit`, `fp&a`, `banking`, `treasury`, `corporate-finance`, `securities`, `insurance-ops`, `risk-compliance`, `fintech-finance`
- Slugs: `ke-toan`, `tai-chinh-dau-tu-chung-khoan`, `kiem-toan`, `ngan-hang`, `bao-hiem`
- Critical negatives: Insurance Agent (commission), IT Auditor (penetration testing), Tư vấn tài chính with hoa hồng

**sales** (12 sub-domains from `sales-role-taxonomy.md` §A):
- `field-b2b`, `inside-telesales`, `sdr-bdr`, `channel-partner`, `retail`, `real-estate`, `sales-engineer`, `insurance-financial`, `presales`, `sales-ops`, `sales-leadership`, `csm-sales-aligned`
- Slugs: `ban-hang-kinh-doanh`, `ban-si-ban-le-quan-ly-cua-hang`, `bat-dong-san`
- Negatives (§D Negative Matching): Customer Service, Claims Processor, Recruitment, Finance / Accounting, Order Processing

**ops** (11 sub-domains from `ops-role-taxonomy.md`):
- `hr`, `admin`, `supply-chain`, `manufacturing`, `quality-compliance`, `project-mgmt`, `customer-service`, `legal-compliance`, `facilities`, `import-export`, `transportation`
- Slugs (10 confirmed): `nhan-su`, `hanh-chinh-thu-ky`, `thu-mua-kho-van-chuoi-cung-ung`, `san-xuat-lap-rap-che-bien`, `quan-ly-tieu-chuan-va-chat-luong`, `quan-ly-du-an`, `cham-soc-khach-hang`, `van-hanh-bao-tri-bao-duong`, `xuat-nhap-khau`, `van-tai-lai-xe-giao-nhan`
- Negatives: Marketing Ops, Sales Ops, DevOps, Data Ops, IT Operations Engineer

**other** (14 sub-domains from `other-role-taxonomy.md`):
- `education`, `healthcare`, `engineering-nontech` (mech, electrical, civil, chem, environmental), `construction`, `architecture-design`, `hospitality`, `legal`, `agriculture`, `food-science-pharma`, `security-services`, `trades`, `arts-entertainment`, `translation`, `government`
- Slugs (13): `giao-duc-dao-tao`, `y-te-cham-soc-suc-khoe`, `co-khi-o-to-tu-dong-hoa`, `dien-dien-tu-dien-lanh`, `khoa-hoc-ky-thuat`, `buu-chinh-vien-thong`, `xay-dung`, `kien-truc-thiet-ke-noi-ngoai-that`, `khach-san-nha-hang-du-lich`, `luat-phap-ly-tuan-thu`, `nong-lam-ngu-nghiep`, `cong-nghe-thuc-pham-dinh-duong`, `duoc-pham`, `hoa-hoc-hoa-sinh`, `thuc-pham-do-uong`, `an-ninh-bao-ve`, `lao-dong-pho-thong`, `nghe-nghiep-khac`

## Implementation Steps

1. Create `src/lib/jobs/taxonomy.ts` with TypeScript types:
   ```ts
   export type Source = 'vl24h' | 'topcv' | 'vnw' | 'itviec';
   export interface SubDomain {
     id: string;            // e.g. 'tech.software', 'sales.field-b2b'
     vertical: Vertical;
     titlesPositive: RegExp;
     titlesNegative?: RegExp;  // shared at vertical level usually
     sourceSlugs: Partial<Record<Source, string[]>>;
   }
   export interface VerticalTaxonomy {
     vertical: Vertical;
     subDomains: SubDomain[];
     verticalNegative?: RegExp; // applies to all sub-domains
   }
   export const TAXONOMY: Record<Vertical, VerticalTaxonomy>;
   ```
2. Fill `TAXONOMY` constant per the inventory above. Pull positive keywords from each taxonomy md's "Confirming Keywords" sections, negative from the §D / Negative Filter sections. Bilingual: every regex includes both VN and EN forms with `|` alternation, `i` flag.
3. Add `subVertical?: string` to `Job` and `JobInput` in `types.ts`. Optional to avoid breaking the 150 existing prod records (they get `undefined`).
4. Export 3 helper functions consumed by scrape + classify:
   - `slugToVerticalAndSub(source: Source, slug: string): { vertical: Vertical; subVertical: string } | null` (null = reject)
   - `classifyTitle(vertical: Vertical, title: string): { subVertical: string; reason: 'positive-match' | 'fallback' } | { reject: true; reason: 'negative-match' | 'no-match' }`
   - `pickSubVertical(vertical: Vertical, title: string, slug?: string): string | undefined` (used post-ingest by classify.ts)
5. Write `taxonomy.test.ts`:
   - Coverage assertion: every slug from each taxonomy md's slug table is present in `sourceSlugs.vl24h`. Use a JSON snapshot to fail loudly on drift.
   - Per-sub-domain precision: 5 positive titles (from taxonomy §E "Test Cases / Expected Positive") MUST match `titlesPositive`.
   - Per-sub-domain rejection: 5 negative titles (from §E "Expected Negative") MUST be rejected by either `verticalNegative` or fail `titlesPositive`.
   - Cross-vertical: 5 titles that pollute (e.g. "Kỹ sư cơ khí" must NOT match tech; "Insurance Agent" must NOT match finance) — assert correct routing.
6. Run `pnpm tsc --noEmit` + `pnpm vitest run taxonomy.test.ts` until green.

## Acceptance Criteria

- [ ] `src/lib/jobs/taxonomy.ts` exists, < 200 lines OR split into colocated files each < 200 lines
- [ ] Every slug from 6 taxonomy md tables represented in taxonomy.ts (test asserts)
- [ ] 30+ positive title fixtures pass (5 per major vertical at minimum)
- [ ] 30+ negative title fixtures correctly rejected
- [ ] `Job.subVertical` field added as optional, no breaking change to KV reads of existing 150 jobs
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest taxonomy suite green

## Risks

- Regex maintenance burden: a single VN+EN regex per sub-domain can grow unwieldy. Mitigation: split each sub-domain into `titlesPositiveEn` + `titlesPositiveVn` if any one regex exceeds 200 chars.
- Conflicting negatives across verticals (e.g. "Sales Engineer" should be sales, not tech). Mitigation: vertical-level negative regex evaluated AFTER positive match; the classifier function in step 4 enforces priority sales > tech > other when title matches both.

## Next Phase

→ [phase-02-vl24h-prefilter-rewrite.md](./phase-02-vl24h-prefilter-rewrite.md)
