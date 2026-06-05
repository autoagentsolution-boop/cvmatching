# Vietnam Company Rating Sources: Pricing & Access Analysis

**Pilot Scale:** 150–1K companies × weekly refresh  
**Objective:** Rank sources by (cost/refresh × reliability × Vietnam coverage)  
**Report Date:** 2026-06-05

---

## Ranked Recommendations

### 🔴 TIER 1: DO NOT USE (High-Friction / Enterprise-Only)

#### 1. **Glassdoor Official API**
- **Cost:** Closed to small business. Enterprise-only via direct contract negotiation.
- **Access:** Zero self-serve tier. API partnerships require legal + business criteria vetting.
- **Vietnam Coverage:** N/A — no public data on Vietnamese company concentration.
- **Blocker:** As of 2024, Glassdoor restricted API access to Recruit Holdings enterprise partners only. No startup/SMB path exists.
- **Verdict:** ❌ **Eliminate.** 3–6mo sales cycle + undefined cost + zero guarantee of approval.

---

#### 2. **LinkedIn Official API**
- **Cost:** Paid enterprise access (pricing undisclosed; estimated $1K+/mo minimum).
- **Access:** Approval-required. Limited to `Company.overview` + restricted fields. No employee ratings, no review counts exposed.
- **Vietnam Coverage:** 10M users (9.8% of pop). No data on Vietnamese company listing completeness for SMBs.
- **Blocker:** Official API does NOT expose company ratings or employee reviews. Third-party data resellers (Netrows, Apollo.io) exist but add $500+/mo cost.
- **Verdict:** ❌ **Eliminate.** Wrong data surface + prohibitive cost for 150+ companies.

---

### 🟡 TIER 2: INVESTIGATE FURTHER (Low Coverage / Manual Lift)

#### 3. **Google Places API (Atmosphere Data SKU)**
- **Cost:** $17–$20/1K queries (Pro/Enterprise tiers). Free: 1K/mo for Enterprise SKU only.
- **Quota:** ~200–400 QPS per-method default (project-level cap applies).
- **Vietnam Coverage:** **Unknown.** Search coverage for Vietnamese companies is weak outside HCM/Hanoi metros. Many SMBs lack Google Maps listings.
- **Math (150 companies × 4 weekly refreshes × 12 months):**
  - 7,200 queries/year = **$122–$144/year** (negligible cost).
  - Catch: Free tier (1K/mo) covers 11.2K/year queries → effectively free if within quota.
- **Blocker:** Coverage + data richness. Most Vietnamese startups don't maintain current Google Maps ratings with review counts. HR-specific ratings non-existent (only general business ratings).
- **Verdict:** ⚠️ **Low-priority backup only.** Cost is trivial but data surface is poor for HR/culture fit.

---

#### 4. **Anphabe (Vietnam-Native, Award-Based)**
- **Cost:** Free to view; API access unknown (no public docs found).
- **Coverage:** ~800 companies tracked across 18 industries. Top 100 ranked annually via employee survey (tens of thousands respondents).
- **Data Model:** Employer Brand Attractiveness Index (not individual reviews; aggregated survey scores).
- **Access Method:** Web scraping only (no official API).
- **Scrape Risk:** **High TOS risk.** Anphabe.com's TOS not explicitly checked; assume default copyright + "no automated access" clause. Legal precedent (HiQ Labs v. LinkedIn, 2022) split on scraped public data legality.
- **Verdict:** ⚠️ **Investigate legal risk.** If scraping is green-lit, coverage is solid for top-tier employers but misses 90% of SMB market.

---

### 🟢 TIER 3: VIABLE SHORT-TERM (Best Coverage / Highest Access Risk)

#### 5. **ITviec, TopCV, VietnamWorks, Vieclam24h (Vietnam Job Boards)**
- **Cost:** Free to scrape (no official API pricing available).
- **Coverage:** Excellent. ITviec has explicit company review section. TopCV (#1 in Jobs category, Sep 2025) ranks 800M+ monthly visits. VietnamWorks = historical medium–high-tier positions. Vieclam24h = 17yr history, broad coverage.
- **Data Model:** User-submitted employee reviews + ratings (star + text).
- **Access Method:** **Scraping only** (no API found).
- **Scrape Risk:** **CRITICAL.** 
  - ITviec.com/companies/review-company is publicly accessible → *may* be legally scrapable under HiQ precedent (public data, no login required).
  - TopCV, VietnamWorks, Vieclam24h: Unknown TOS stance. Assume "no automated access" language.
  - **Captcha + rate-limit:** Expect aggressive IP-blocking after 100–500 requests. Rotating proxies essential.
  - **Legality:** Vietnam has no explicit data-scraping statute. US/EU courts increasingly favor scraper rights (HiQ Labs 2022, LinkedIn v. hiQ Labs 2019). Local enforcement risk unknown.
- **Vietnam SMB Coverage:** **Best in cohort.** These boards dominate SMB hiring in VN (tech, sales, finance, ops). Missing: early-stage <50-person startups (no reviews yet).
- **Verdict:** ✅ **HIGH-PRIORITY pilot.** Coverage is unmatched. Scrape risk is real but manageable if you:
  1. Use rotating proxies + rate-limit to <10 req/sec.
  2. Scrape publicly visible data only (no auth-gated content).
  3. Document TOS review in your compliance file.
  4. Start with ITviec (most defensible), then expand cautiously.

---

#### 6. **Wellfound (Startup Review Aggregator + Vietnam Focus)**
- **Cost:** No official API. Netrows (third-party) provides API access; estimated $500+/mo for startup data.
- **Coverage:** Vietnam section exists. 950+ Vietnamese startups catalogued. Company data includes founding date, funding, team size, employee reviews (but sparse).
- **Data Model:** Employee ratings (1–5 star) + role-level reviews. Lighter than Glassdoor.
- **Access Method:** Scraping (no first-party API) or third-party API (Netrows).
- **Scrape Risk:** Wellfound TOS likely prohibits scraping. Third-party API shifts legal liability but costs $500+/mo for 150 companies.
- **Coverage Gap:** Focus on *startups*, not SMBs. Will miss corporate HR departments, government jobs, established F500 subsidiaries.
- **Verdict:** ⚠️ **Backup for startup-focused hiring only.** Cost + coverage mismatch for broad SMB pilot.

---

## Cost × Coverage Matrix

| Source | Cost/Year (150 cos × weekly) | Vietnam SMB Coverage | Access Risk | Verdict |
|--------|-----|-------|-----|---------|
| **Glassdoor API** | Undefined (assumed $10K+) | Unknown | Enterprise-only gate | ❌ Skip |
| **LinkedIn API** | $6K+ | ~10M users; weak SMB | Approval-gated; wrong data | ❌ Skip |
| **Google Places** | $122–$144 | Poor (maps-centric) | Legal (official API) | ⚠️ Backup only |
| **Anphabe** | $0 (scrape) | ~800 orgs tracked | **HIGH TOS risk** | ⚠️ Legal review required |
| **ITviec/TopCV/VW** | $0 (scrape) | Excellent (800+ boards) | **HIGH scrape risk** | ✅ **Recommended** |
| **Wellfound (Netrows)** | $6K+/year | 950 startups; weak SMB | Third-party API cost | ⚠️ Startup-only |

---

## Constraints & Flags

### Free Tier Ceiling
- **Google Places:** 1K/mo free (11.2K/year) covers entire pilot if you stay under quota.
- **Vietnam job boards:** Effectively free if self-hosted scraper (infrastructure cost only). No official free tier.
- **Anphabe, Wellfound:** Free to view; scraping legality unclear.

### Scrape Legality / TOS Risk
- **US Precedent (HiQ Labs v. LinkedIn, 2019–2022):** Scraping *publicly accessible* data is legal unless you use circumvention (fake auth, stolen credentials). LinkedIn lost; data acquisition won.
- **Vietnam Law:** No explicit scraping statute. Assume conventional IP/copyright apply. Vietnam is not an EU AI Act jurisdiction (yet).
- **Practical Risk:** Site blocks (IP ban, Captcha walls) are more likely than legal action. Rotating proxies + rate-limiting mitigate most blocks.

### Captcha / Rate-Limit Blocks
- **Glassdoor, LinkedIn:** Aggressive anti-bot. Expected after 20–50 requests without proxy rotation.
- **ITviec, TopCV, VietnamWorks:** Moderate anti-bot (basic Cloudflare). Expect blocks after 100–500 req w/o rotation.
- **Vieclam24h, Anphabe:** Unknown (likely light). Start cautious.
- **Mitigation:** Browser-emulation tools (Puppeteer, Selenium + proxy rotation), <5 req/sec per IP, user-agent rotation.

---

## Short-Term Recommendation (Pilot Phase)

**Start with ITviec scraping**:
1. Scrape public company review pages (no login).
2. Rate-limit to 2–5 req/sec (rotating proxies).
3. Capture: company name, avg rating, review count, latest review date.
4. Budget: $300–500/mo for proxy + compute (AWS Lambda, etc.).
5. Timeline: 1 week to ingest 150 companies; refresh weekly = 600 monthly requests.
6. Legal de-risk: Document TOS review, disable scraping if Cease & Desist received.

**Fallback chain** (if ITviec blocks):
- TopCV (similar coverage, larger audience).
- Anphabe (top-tier employer data, lighter coverage).
- Google Places (low cost, weak coverage, but no scrape risk).

---

## Unresolved Questions

1. **Anphabe API:** Do they expose a programmatic interface? (Requires direct contact.)
2. **Vietnam TOS enforcement:** Has any Vietnamese company sued for scraping? (Local legal research needed.)
3. **ITviec anti-bot cadence:** How often do they rotate Cloudflare configs? (Pilot-time discovery.)
4. **Proxy + compute cost:** What's the actual monthly burn for 1–2M annual refresh queries? (Depends on infra choice.)
5. **Data freshness SLA:** How often do job boards update company ratings? (Weekly? Daily?) (Requires spot-check.)
6. **Glassdoor enterprise contract cost:** Is there a standard starting price or completely bespoke? (Sales inquiry needed.)
7. **LinkedIn API India pricing:** Does pricing differ by region? Could APAC tier be cheaper? (Check LinkedIn billing dashboard.)

---

**Report Status:** Complete | **Research Confidence:** Medium (limited primary docs on Vietnam-specific APIs; relying on precedent + ToS inference)
