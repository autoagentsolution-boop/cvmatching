# Vietnamese Sales Job-Market Role Taxonomy Research

**Date:** 2026-06-03  
**Researcher:** Technical Analyst  
**Deliverable:** Sales role taxonomy for CV-to-job ingest filter system  
**Scope:** Vietnamese job market; bilingual title coverage; filter disambiguation rules

---

## Executive Summary

Researched VN job boards (vietnamworks, topcv.vn, vieclam24h.vn) and international sources to map Vietnamese sales roles. Identified 12 sub-domains with 50+ distinct title patterns. Provided bilingual patterns, keyword context, disambiguation rules (Sales Engineer vs Tech roles, Customer Success vs Ops), and negative filters (Customer Service, pure recruitment).

**Key Finding:** Sales role boundary is context-dependent. "Sales Engineer" IS sales (product demo + pitch). "Customer Success Manager" is SALES-ALIGNED only if title context shows retention/expansion revenue focus; pure support = ops. Negative filters reject ops-heavy roles even if they mention "sales."

---

## A. ROLE INVENTORY BY SUB-DOMAIN

### 1. **Field Sales / B2B (Enterprise, Account Management)**

#### Vietnamese Patterns
- Nhân viên kinh doanh (Business staff/Salesperson) — generic entry-level
- Nhân viên kinh doanh B2B — enterprise/B2B explicit
- Chuyên viên kinh doanh (Business specialist/consultant) — mid-level
- Account Manager
- Account Executive (often bilingual in VN job posts)
- Key Account Manager / Quản lý tài khoản khách hàng chính
- Trưởng phòng kinh doanh (Sales Manager) — team lead
- Giám đốc kinh doanh khu vực (Area Sales Director) — regional
- Giám đốc bán hàng (Sales Director) — senior

#### English Patterns
- Account Executive (AE)
- Account Manager (AM)
- Key Account Manager (KAM)
- Senior Account Executive
- Enterprise Sales Executive

#### Confirming Keywords
- CRM tools: Salesforce, HubSpot, Pipedrive, MS Dynamics
- KPI: quota, commission, revenue target, ARR, ACV
- Process: sales cycle, discovery, proposal, contract negotiation
- Relationship: client retention, account expansion, customer lifetime value

#### Context Rule
Enterprise/B2B if: company size target (SME, enterprise), contract length (annual, multi-year), deal size, territory management, or explicit "B2B/B2C" label.

---

### 2. **Inside Sales / Telesales**

#### Vietnamese Patterns
- Nhân viên bán hàng nội bộ (Inside sales staff)
- Nhân viên Telesales
- Telesales Executive
- Inside Sales Representative

#### English Patterns
- Inside Sales Representative
- Telesales Executive
- Phone Sales Representative
- Remote Sales Representative

#### Confirming Keywords
- Phone/call-based outreach
- Virtual/office-based (not field)
- Lead qualification
- Script-based initial contact
- Volume metrics (calls per day, connects, conversions)

#### Context Rule
Inside sales if: role explicitly states "telesales", "phone sales", "remote sales", OR work location is office-based with no field requirement, AND primary method is inbound/outbound calls or email follow-up.

---

### 3. **Sales Development (SDR, BDR, Lead Gen)**

#### Vietnamese Patterns
- Nhân viên phát triển bán hàng
- Sales Development Representative (SDR)
- Business Development Representative (BDR)
- Business Development Specialist
- Lead Generation Specialist

#### English Patterns
- Sales Development Representative (SDR)
- Business Development Representative (BDR)
- Sales Development Executive
- Development Officer

#### Confirming Keywords
- Cold outreach, prospecting, lead qualification
- SDR focuses: inbound lead qualification → pass to AE
- BDR focuses: outbound cold prospecting → build pipeline
- Metrics: leads generated, qualified meetings, response rate

#### Context Rule
SDR if: "inbound lead qualification" + handoff to closer mentioned.  
BDR if: "outbound prospecting", "cold call", "lead hunting".  
If ambiguous: either is sales (NOT ops).

---

### 4. **Channel & Partner Sales**

#### Vietnamese Patterns
- Nhân viên bán hàng qua kênh phân phối (Channel sales staff)
- Quản lý kênh bán hàng (Channel manager)
- Quản lý đối tác (Partner manager)
- Distributor Sales Representative
- Distributor Account Manager

#### English Patterns
- Channel Manager
- Partner Manager
- Distributor Sales Rep
- Channel Account Manager
- Reseller Manager

#### Confirming Keywords
- Distributor/reseller partnerships
- Indirect sales (through partners)
- Margin management, co-op funds
- Partner recruitment, enablement, support
- Channel incentive programs

#### Context Rule
Channel sales if: role involves managing distributor/reseller partners, recruitment, training, or account support (distinct from direct sales).

---

### 5. **Retail Sales**

#### Vietnamese Patterns
- Nhân viên bán hàng (Generic "salesperson", context determines retail vs field)
- Nhân viên bán hàng bán lẻ (Retail salesperson)
- Nhân viên bán hàng trực tiếp (Direct sales = retail/field staff)
- Trưởng cửa hàng (Store manager)
- Giám đốc bán lẻ (Retail manager)
- Quản lý cửa hàng (Store manager)
- Nhân viên sàn bán hàng (Floor sales)
- Nhân viên tại quầy (POS/counter staff)

#### English Patterns
- Retail Sales Associate
- Floor Sales Representative
- Store Manager
- Retail Manager
- POS Operator
- Sales Associate

#### Confirming Keywords
- FMCG (fast-moving consumer goods), pharmacy, retail chain
- Store location, inventory management
- Point-of-sale (POS) system
- Customer service + product recommendation
- Shift work, floor presence

#### Context Rule
Retail if: location-specific (store address), merchandise visibility, or industry = FMCG/retail/pharmacy/cosmetics. Role name often vague; disambiguate by context (industry + place of work).

---

### 6. **Real Estate Sales**

#### Vietnamese Patterns
- Môi giới bất động sản (Real estate broker)
- Chuyên viên kinh doanh bất động sản (BDS specialist/consultant)
- Agent bất động sản (Real estate agent)
- Nhân viên bán bất động sản (Real estate sales staff)
- Tư vấn bất động sản (Real estate consultant)
- Trưởng phòng kinh doanh bất động sản (Real estate sales manager)
- Giám đốc bán hàng bất động sản (Real estate sales director)

#### English Patterns
- Real Estate Broker
- Real Estate Agent
- Real Estate Sales Executive
- Real Estate Consultant
- Residential Sales Agent
- Commercial Real Estate Broker

#### Confirming Keywords
- BĐS (bất động sản) abbreviation
- Commission-based (no fixed salary typically)
- Property valuation (CMA - comparative market analysis)
- Legal documentation, contract support
- Developer partnerships (primary market) or secondary market agent
- Certification requirements (practicing certificate per 2023 law)

#### Context Rule
Real estate sales if: mentions "bất động sản", "BĐS", "môi giới", "real estate", "property", or explicit property transaction context.

---

### 7. **Sales Engineer / Technical Sales / Solution Sales**

#### Vietnamese Patterns
- Kỹ sư bán hàng (Sales engineer)
- Sales Engineer (English title used widely in VN)
- Tư vấn kỹ thuật bán hàng (Technical sales consultant)
- Chuyên viên bán hàng kỹ thuật (Technical sales specialist)
- Solution Sales Engineer

#### English Patterns
- Sales Engineer (SE)
- Technical Sales Engineer
- Technical Sales Representative
- Solution Sales Engineer
- Sales Engineer - [Industry] (e.g., Industrial Equipment)

#### Confirming Keywords
- Technical product knowledge (not just pitch)
- Proof of Concept (POC), demos, technical presentations
- Cost calculation, ROI analysis
- Technology company context (SaaS, DaaS, AI, cloud, industrial tech, mechanical engineering)
- Bachelor's degree in IT/CS or engineering mentioned

#### **CRITICAL DISAMBIGUATION: Sales Engineer ≠ Tech-Engineering Role**
**POSITIVE Rule:** Sales Engineer IS sales, not engineering.  
- Presence of "demo", "poc", "pitch", "cost calculation", "customer consultation" = sales.
- Presence of "sales", "revenue", "quota", "customer" (in context of closing) = sales.
- Even if "engineer" title used, if primary role is selling tech product → SALES.

**Negative Rule:** Reject if primary role is building/developing the product itself.
- "Software Engineer" selling products ≠ Sales Engineer.
- "Hardware Engineer" with sales support ≠ Sales role.
- Disambiguate: Job description mentions customer pitch, demos, revenue target → IS sales.

#### Context Rule
Sales Engineer if: role is customer-facing, involves technical consultation (not product development), and product demo/POC is in job description. Industry = tech/industrial/engineering/B2B software.

---

### 8. **Insurance Sales / Financial Product Sales**

#### Vietnamese Patterns
- Nhân viên bán hàng bảo hiểm (Insurance sales staff)
- Chuyên viên bảo hiểm (Insurance specialist)
- Đại lý bảo hiểm (Insurance agent)
- Tư vấn bảo hiểm (Insurance consultant)
- Nhân viên bán sản phẩm tài chính (Financial product sales)
- Tư vấn sản phẩm tài chính (Financial product consultant)

#### English Patterns
- Insurance Agent
- Insurance Sales Representative
- Insurance Specialist
- Financial Product Sales Representative
- Life Insurance Agent
- Health Insurance Consultant

#### Confirming Keywords
- Policy types: life, health, motor, liability
- Licensing: insurance agent practicing certificate required (VN law)
- Commission-based compensation
- Product education, customer consultation
- Regulatory compliance

#### **CRITICAL DISAMBIGUATION: Insurance Sales ≠ Finance-Operations Role**
**POSITIVE Rule:** Insurance/financial product sales IS sales.
- Presence of "policy", "premium", "product consultation", "customer acquisition" = sales.
- Agent/representative role → sales.

**Negative Rule:** Reject if primary role is operations.
- "Finance Operations Officer" handling insurance admin ≠ sales.
- "Insurance Claims Processor" ≠ sales.
- Disambiguate: If job involves selling/acquiring customers → IS sales. If it's back-office claims/admin → ops.

#### Context Rule
Insurance sales if: role involves customer consultation, product recommendation, or policy sales. Reject if role is claims processing, underwriting support (ops), or administrative.

---

### 9. **Pre-sales / Solution Consultant**

#### Vietnamese Patterns
- Tư vấn bán hàng (Sales consultant — generic, often pre-sales)
- Tư vấn giải pháp (Solution consultant)
- Pre-sales Consultant
- Nhân viên hỗ trợ bán hàng (Sales support — can be pre-sales or ops)
- Business Analyst (often pre-sales-adjacent)

#### English Patterns
- Pre-sales Consultant
- Solutions Consultant
- Sales Consultant
- Solutions Engineer
- Business Analyst (sales-aligned)

#### Confirming Keywords
- Proposal writing, technical input
- Demo/POC support (alongside or before sales)
- Customer needs analysis
- Solution design, architecture
- Customer handoff post-sale (indicates pre-sales boundary)

#### Context Rule
Pre-sales if: role explicitly states "pre-sales", "proposal", "poc support", OR role involves customer needs assessment followed by sales handoff.

---

### 10. **Sales Operations / Sales Enablement**

#### Vietnamese Patterns
- Nhân viên hỗ trợ bán hàng (Sales support)
- Chuyên viên hỗ trợ bán hàng (Sales enablement specialist)
- Quản lý hoạt động bán hàng (Sales operations manager)
- CRM Administrator
- Sales Coordinator

#### English Patterns
- Sales Operations Manager
- Sales Enablement Specialist
- Sales Coordinator
- CRM Administrator
- Sales Support Specialist

#### Confirming Keywords
- CRM tool management, data hygiene
- Sales process administration, workflow
- Reporting, analytics
- Training delivery, resource management
- No direct customer revenue responsibility

#### **CRITICAL DISAMBIGUATION: Sales Ops ≠ Sales Coordinator on customer-facing work**
**POSITIVE Rule:** Sales Ops IS NOT sales if primary role is internal process/tool management.
- CRM admin, reporting, workflow setup → ops.
- Training materials preparation → ops.

**NEGATIVE Rule:** Reject "Sales Coordinator" if job involves customer scheduling or basic sales support without mentioning process/tools.
- Borderline case: "Sales Coordinator" with "scheduling customer calls" + "CRM data entry" = ops.
- If role says "supporting account managers" without ops context → disambiguate further.

#### Context Rule
Sales Ops/Enablement if: primary responsibility is internal (process, tools, training, reporting). If role touches customers directly (order management, customer admin), classify by customer interaction context.

---

### 11. **Sales Leadership**

#### Vietnamese Patterns
- Trưởng phòng kinh doanh (Sales Manager — team lead)
- Giám đốc kinh doanh (Sales Director — department head)
- Giám đốc bán hàng (Sales Director)
- Phó giám đốc kinh doanh (Associate Sales Director)
- Trưởng nhóm bán hàng (Sales Team Lead)
- VP Bán hàng / VP Sales (C-suite)

#### English Patterns
- Sales Manager
- Sales Director
- VP Sales / Head of Sales
- Area Manager
- Regional Sales Manager

#### Confirming Keywords
- Team management, hiring, training
- Revenue responsibility (quota, targets)
- Strategic planning
- Performance management

#### Context Rule
Sales leadership if: role involves managing sales team members, setting targets, or strategic revenue planning.

---

### 12. **Sales-Adjacent: Customer Success (Conditional)**

#### Vietnamese Patterns
- Nhân viên chăm sóc khách hàng (Customer support/care)
- Chuyên viên chăm sóc khách hàng (Customer success specialist)
- Customer Success Manager (bilingual title used)
- Account Specialist (retention-focused)

#### English Patterns
- Customer Success Manager (CSM)
- Customer Care Specialist
- Customer Support Specialist
- Account Specialist

#### **CRITICAL DISAMBIGUATION: Customer Success ≠ Customer Service**
**POSITIVE Rule:** CSM IS sales-aligned if:
- Job mentions "upsell", "expansion revenue", "retention-driven growth", "account health"
- Role involves revenue impact (even if indirect)
- Post-sales customer relationship management with revenue implications

**NEGATIVE Rule:** CSM is NOT sales if:
- Primary focus is "support", "troubleshooting", "issue resolution" without revenue mention
- Role title is "Customer Service Officer" or "Customer Support" (= ops)
- No mention of retention risk, expansion opportunity, or revenue metrics

#### Context Rule
CSM/Account Specialist IS sales if: job description includes "expand account", "identify upsell", "retention", "customer health", "revenue expansion", or "account management" (distinct from support).  
CSM is OPS if: primary language is "support", "issue resolution", "helpdesk", "ticket management".  
Default: If ambiguous, treat CSM as SALES (benefit of doubt on expansion revenue potential).

---

## B. SOURCE-LEVEL FILTERS PER VN JOB BOARD

### VietnamWorks.com
- Main sales category: **Sales & Business Development**
- Sub-filters (observed): Account Manager, Sales Manager, Business Development, Sales Support, Sales Engineer
- Slug structure: `/tim-viec-lam` (search job) with filters on left panel
- Coverage: Broad (includes all 12 sub-domains)

### TopCV.vn
- Main sales category: **Sale** (11,909+ jobs as of 2026-06-03)
- Sub-categories (TopCV taxonomy):
  - Nhân viên tư vấn (Consulting staff) — can include sales consultant
  - Nhân viên bán hàng (Sales staff)
  - Nhân viên kinh doanh (Business staff)
  - Bán hàng ngoài (Outside sales/field)
  - Bán hàng trong (Inside sales)
  - Telesales
  - Bán hàng online (Online sales)
  - Bán hàng thị trường (Market sales — often retail/FMCG)
  - Bán lẻ (Retail)
  - Quản lý cửa hàng (Store manager)
  - Sale Admin
  - Sales Marketing
  - Kinh doanh xuất nhập khẩu (Import/Export sales)
  - Thực tập sinh kinh doanh (Business internship)
- URL pattern: `https://www.topcv.vn/tim-viec-lam-sale`
- Coverage: Comprehensive; distinct from marketing, HR, customer service categories

### Việc Làm 24h (VL24h.vn / VieclAM24h.vn)
- Main sales category: **Bán hàng & Kinh doanh** (Sales & Business)
- Observed sub-jobs:
  - Nhân viên kinh doanh (Business staff)
  - Nhân viên kinh doanh B2B
  - Tư vấn bán hàng (Sales consultant)
  - Trưởng phòng kinh doanh (Sales manager)
  - Trưởng phòng kinh doanh dự án (Project sales manager)
- URL slug: `/ban-hang-kinh-doanh/` (e.g., `vieclam24h.vn/ban-hang-kinh-doanh/...`)
- Coverage: Mid-tier; focuses on SME/local companies

### Real Estate Sub-Board Context
- Separate vertical: **Bất Động Sản** (Real Estate)
- VietnamWorks: `/real-estate-jobs`
- TopCV: Separate "Bất Động Sản" category
- VL24h: Separate "Bất Động Sản" category
- Includes: brokers, agents, consultants, managers

---

## C. BILINGUAL COVERAGE

### High-Confidence Bilingual Matches

| Vietnamese | English | Confidence | Sub-Domain |
|---|---|---|---|
| Nhân viên kinh doanh | Sales staff / Business staff | Very High | Field Sales, Inside Sales, Retail |
| Chuyên viên kinh doanh | Business consultant / Sales consultant | Very High | Field Sales, Pre-sales |
| Account Manager | Account Manager | Very High | Field Sales (B2B) |
| Account Executive | Account Executive | Very High | Field Sales (Enterprise) |
| Key Account Manager | Key Account Manager / Account Manager | Very High | Field Sales (B2B) |
| Trưởng phòng kinh doanh | Sales Manager | Very High | Sales Leadership |
| Giám đốc kinh doanh | Sales Director | Very High | Sales Leadership |
| Telesales / Nhân viên Telesales | Telesales / Phone Sales | Very High | Inside Sales |
| Inside Sales Representative | Inside Sales Representative | Very High | Inside Sales |
| SDR / BDR | Sales Development / Business Development Rep | Very High | Sales Development |
| Sales Engineer / Kỹ sư bán hàng | Sales Engineer | Very High | Sales Engineer |
| Môi giới bất động sản | Real Estate Broker | Very High | Real Estate |
| Nhân viên bán lẻ | Retail Sales Associate | Very High | Retail |
| Store Manager / Trưởng cửa hàng | Store Manager | Very High | Retail |
| Tư vấn giải pháp | Solutions Consultant | High | Pre-sales |
| Customer Success Manager | Customer Success Manager | High | Sales-Adjacent |
| Đại lý bảo hiểm | Insurance Agent | Very High | Insurance |
| Nhân viên bán hàng ngoài | Outside Sales Rep / Field Sales | High | Field Sales, Retail |

### Context-Dependent (Require Job Description Review)
| Vietnamese | English | Ambiguity | Resolution |
|---|---|---|---|
| Nhân viên tư vấn | Consultant / Advisor | High | Check if product/sales mention → Sales; if process/admin → Ops |
| Sales Marketing | Sales & Marketing / Sales Support | High | If marketing focus → Marketing; if sales support → Sales |
| Business Analyst | Business Analyst | High | If customer-facing and proposal-related → Pre-sales; if system/ops focused → Tech/Ops |
| Nhân viên hỗ trợ bán hàng | Sales Support / Sales Coordinator | High | If customer-touching (scheduling) → Sales; if tool/admin → Ops |
| Chuyên viên kinh doanh bất động sản | Real Estate Specialist / Consultant | Medium | Explicit BĐS/BDS mention → always Real Estate |

---

## D. NEGATIVE FILTERS (DO NOT INCLUDE)

### Reject These Roles (Even if they mention "sales" or "bán hàng")

| Role Title (VN or EN) | Why Reject | Context Clue |
|---|---|---|
| Customer Service Officer / Nhân viên dịch vụ khách hàng | Support ≠ sales. No customer acquisition role. | "troubleshooting", "helpdesk", "issue resolution", "support ticket" |
| Customer Service Representative | Support role, not sales. | "customer care", "call center", "complaint handling" |
| Sales Coordinator (ops-heavy) | If primary role is scheduling/admin. | "schedule calls", "update CRM", "process orders" (backend) |
| Order Processing Staff | Backend ops, not sales. | "process orders", "data entry", "invoice", "fulfillment" |
| HR Recruitment / Recruitment Sales | Selling HR services (recruitment talent), not product/customer sales. | "recruit", "hiring", "talent acquisition", "CVs", "placement" |
| Marketing Sales | Pure marketing with "sales" label. | "campaign", "brand", "content", "social media", "lead generation" (non-qualification) |
| Logistics/Warehouse Sales Support | Logistics ops, not core sales. | "inventory", "warehouse", "shipping", "logistics coordination" |
| Finance Operations | Finance admin, not sales. | "accounting", "billing", "AP/AR", "financial reporting" |
| IT Sales Support | Tech support for products, not direct sales. | "technical support", "implementation", "system admin" |
| Claims Processor (Insurance) | Back-office insurance ops. | "claims", "underwriting", "policy admin" |

### Context-Dependent Rejection Rules

**"Sales Coordinator" → REJECT if:**
- Job description emphasizes: data entry, CRM updates, reporting, process management
- No mention of: customer contact, meeting scheduling, customer-touching activity

**"Sales Coordinator" → INCLUDE if:**
- Job mentions: scheduling customer meetings, customer communication, supporting deal closures
- Customer interaction is material to the role

**"Marketing Sales" → REJECT if:**
- Primary focus is brand, content, or campaign management
- INCLUDE if: mentions "sales cycle", "customer consultation", "deal closing"

**"Business Analyst" → INCLUDE if:**
- Job mentions: customer needs analysis, proposal support, solution design, customer-facing
- REJECT if: purely tech/system analysis with no customer touchpoint

**Insurance Claims or Underwriting → REJECT**
- Back-office support ≠ sales
- Policy administration ≠ sales

---

## E. TEST CASES (Validation)

### Positive Matches (Should INCLUDE)

| Test Case | Role Domain | Rationale |
|---|---|---|
| "Nhân Viên Kinh Doanh" | Field Sales | Generic sales staff = core sales role |
| "Senior Account Executive - B2B SaaS" | Field Sales / Enterprise | Explicit AE title + B2B context = sales |
| "Key Account Manager FMCG" | Field Sales / Retail (B2B distribution) | KAM + FMCG industry = sales (managing distributor/retail accounts) |
| "Sales Engineer (Industrial Equipment)" | Sales Engineer | Title contains "Sales Engineer" + product type = sales, not tech engineering |
| "Kỹ sư bán hàng - Giải pháp IoT" | Sales Engineer | VN title explicitly "Sales Engineer" + technology context = sales |
| "Môi Giới Bất Động Sản" | Real Estate Sales | "Môi giới" + BĐS = real estate broker (sales role by law) |
| "BDR / SDR - SaaS Startup" | Sales Development | Explicit BDR/SDR + SaaS = outbound/inbound lead qualification (sales) |
| "Inside Sales Representative - 5 năm kinh nghiệm" | Inside Sales | Explicit inside sales + experience = telesales/phone sales |
| "Trưởng Phòng Kinh Doanh Phía Nam" | Sales Leadership | "Trưởng phòng" (manager title) + region = sales manager |
| "Customer Success Manager - Expansion Revenue Focus" | Sales-Adjacent (CSM) | Explicit "expansion revenue" = sales-aligned CSM (not pure support) |
| "Pre-sales Consultant - Cloud Solutions" | Pre-sales | Explicit pre-sales + tech context = pre-sales |
| "Chuyên viên bán hàng Bảo hiểm Nhân thọ" | Insurance Sales | Insurance specialist = sales agent |

### Negative Matches (Should REJECT)

| Test Case | Why Reject | Evidence |
|---|---|---|
| "Customer Service Officer" | Support, not sales | Title = "service", no sales function mentioned |
| "Customer Service Officer - Hỗ trợ Khách hàng" | Support ops, not sales | "hỗ trợ" (support) = customer service, not acquisition |
| "Sales Coordinator - Cập nhật CRM & lên lịch" | Ops/admin, not sales | "update CRM" + "lên lịch" (schedule) = back-office admin |
| "Sales Coordinator - Order Processing" | Back-office ops | "order processing" = fulfillment ops, not sales |
| "Nhân Viên Tuyển Dụng (Bán dịch vụ HR)" | HR ops, not sales | "tuyển dụng" (recruitment) + "dịch vụ HR" = selling recruitment services (HR ops), not product sales |
| "Marketing Sales Specialist (Chiến dịch quảng cáo)" | Pure marketing | "chiến dịch" (campaign) = marketing, not customer sales |
| "Kỹ sư Phần mềm - Hỗ trợ Bán hàng" | Tech support ≠ sales | "kỹ sư phần mềm" (software engineer) in support capacity = tech ops |
| "Finance Operations - Insurance Backend" | Finance ops | "operations" + "backend" = finance admin, not sales |
| "Claims Processor - Bảo hiểm" | Insurance ops, not sales | "claims" (yêu cầu bồi thường) = back-office processing |

---

## F. DISAMBIGUATION DECISION MATRIX

### For Ambiguous Job Titles (Decision Flow)

**Step 1: Check Title Keywords**
- Contains explicit sales signal ("Sales", "Account Exec", "BDR", "kinh doanh")? → Likely SALES
- Contains support signal ("Support", "Service", "hỗ trợ")? → Likely OPS/SUPPORT
- Contains ops signal ("Coordinator", "Operations", "Admin", "Claims")? → Likely OPS

**Step 2: If Title Ambiguous (e.g., "Consultant", "Specialist"), Read Job Description**
- Does it mention customer revenue impact, deal closing, quota, commission? → SALES
- Does it mention internal process, training, tool management, reporting? → OPS
- Does it mention product support, helpdesk, ticket resolution? → SUPPORT

**Step 3: Special Cases**
- **"Sales Engineer"**: If demo/poc/customer pitch mentioned → SALES (not engineering)
- **"Customer Success Manager"**: If "expansion", "upsell", "retention revenue" mentioned → SALES. If only "support", "troubleshoot" → OPS
- **"Sales Coordinator"**: If "customer scheduling", "meeting setup" prominent → SALES. If "CRM updates", "data entry" prominent → OPS
- **Real Estate Roles**: Always SALES (broker, agent, consultant roles are sales by definition)

**Step 4: Default (Tie-Break)**
- When uncertain, prefer INCLUSION (benefit of doubt)
- Exception: Explicit "Customer Service", "Claims", "HR Recruitment" → always reject

---

## G. RECOMMENDED INGEST FILTER LOGIC

### Positive Filter Rules (Include if ANY match)
1. Job title contains: "kinh doanh", "Account Manager", "Account Executive", "Sales", "Telesales", "SDR", "BDR", "Sales Engineer", "Môi giới", "BĐS", "Real Estate"
2. Job title contains "Tư vấn" (Consultant) AND job description mentions: "khách hàng" (customer), "bán hàng" (sales), "chào mời" (pitch), "demo", "POC"
3. Job title contains "Customer Success" AND job description mentions: "expansion", "upsell", "retention", "revenue"
4. Job title = "Trưởng phòng", "Giám đốc" (Manager/Director) AND context = bán hàng/kinh doanh category

### Negative Filter Rules (Exclude if ANY match)
1. Job title contains: "Customer Service", "hỗ trợ khách hàng", "Support", "Claims", "tuyên dụng" (recruitment), "Order Processing"
2. Job title = "Marketing Sales" AND job description mentions ONLY: campaign, brand, content, social media (no customer consultation)
3. Job title contains "Coordinator" AND job description emphasizes: CRM update, data entry, reporting, schedule management (no customer contact)
4. Job title contains "HR", "Finance Ops", "Accounting", "Logistics" (ops-heavy functions)

### Bilingual Tokenization (Match in Either VN or EN)
- For Vietnamese titles: tokenize by space, check exact matches + fuzzy match (allow Tiếng Việt diacritics)
- For English titles: tokenize by space/hyphen, match exact or fuzzy
- Example: "Nhân viên kinh doanh B2B" should match "Business Development Staff" in intent
- Use keyword overlap for partial matches (e.g., "Account Manager" can match "Quản lý tài khoản chính")

---

## H. DATA QUALITY NOTES

### Sources Consulted
- **VietnamWorks.com**: Primary VN job board; 330+ Sales Engineer jobs, 600+ sales positions
- **TopCV.vn**: 11,909 active "Sale" postings (as of 2026-06-03); subcategory taxonomy extracted
- **Việc Làm 24h (VL24h.vn)**: Mid-tier VN board; `/ban-hang-kinh-doanh/` category analyzed
- **LinkedIn Vietnam Jobs**: 600+ Sales Engineer, 300+ Telesales listings; confirms role definitions
- **Salesforce Vietnam Careers**: SDR/BDR role definitions (VN market context)
- **Legal sources**: Real Estate Business Law 2023 (Vietnam) — broker/agent definitions authoritative
- **Industry blogs**: Anphabe (FMCG terminology), CareerViet, Fastwork (role definitions)

### Confidence Levels
- **Very High** (bilingual match + multi-source confirmation): Account Manager, Sales Engineer, Real Estate Broker, Telesales, SDR/BDR, Field Sales (kinh doanh)
- **High** (confirmed in 2+ sources, some context-dependency): Inside Sales, Sales Manager, Pre-sales Consultant, Customer Success (sales-aligned)
- **Medium** (confirmed but requires descriptor context): Business Consultant, Sales Support, Sales Coordinator, Sales Marketing
- **Low** (role-name dependent, high ambiguity): "Consultant", "Specialist" without descriptors; "Sales Support" without context

### Limitations
1. **Not Covered**: Specific geography/vertical salary trends (research focused on role taxonomy, not compensation)
2. **Not Covered**: Individual company role definitions (role title ≠ function; required descriptor validation)
3. **Not Covered**: Microworking platforms or gig-sales roles (e.g., TaskRabbit-style sales)
4. **Not Covered**: Influencer/affiliate "sales" (commission-based but not B2B/B2C direct sales)
5. **Context Dependency Remains**: Job description review mandatory for borderline cases; filter logic cannot be 100% automated without NLP

---

## UNRESOLVED QUESTIONS

1. **CSM Boundary**: Should "Account Specialist" with unclear expansion vs. support language default to SALES or OPS? Current: default SALES (conservative).
2. **Geographic Salary Impact**: Does real estate broker taxonomy differ between Hanoi, HCM, Danang markets? (Research: not explored; could affect filter specificity.)
3. **Startup vs. Enterprise Title Drift**: Do early-stage startup "Account Manager" roles behave like field sales or inside sales? (Research: job boards don't segregate; descriptor review required case-by-case.)
4. **Franchisee/MLM "Sales"**: Should multi-level marketing "sales" roles be included? (Research: not addressed; current filter assumes direct sales, not pyramid structures.)
5. **E-commerce "Sales"**: Online marketplace seller roles (Shopee, Lazada) — are they "sales" or "merchant operations"? (Research: not explicitly analyzed; likely = operations, not direct sales.)

---

## SUMMARY TABLE: Role Taxonomy at a Glance

| Sub-Domain | Key VN Title | Key EN Title | Confirming Keywords | Reject If |
|---|---|---|---|---|
| Field Sales/B2B | Nhân viên kinh doanh, Account Manager | Account Executive, Key Account Manager | CRM, quota, commission, revenue target | Pure support, admin |
| Inside Sales | Nhân viên Telesales | Inside Sales Rep, Telesales | Phone, remote, script, call volume | Helpdesk, support ticket |
| Sales Development | SDR, BDR, Nhân viên phát triển | Sales Development Rep, Business Development | Lead qual, prospecting, inbound/outbound | Admin, data entry |
| Channel Sales | Quản lý kênh, Nhân viên phân phối | Channel Manager, Distributor Rep | Partner, reseller, distributor, co-op | Direct sales only |
| Retail Sales | Nhân viên bán lẻ, Trưởng cửa hàng | Retail Associate, Store Manager | Store location, POS, FMCG, shift work | Back-office ops |
| Real Estate | Môi giới BĐS, Chuyên viên BĐS | Real Estate Broker, Agent | BĐS, bất động sản, property, broker, cert | Non-RE context |
| Sales Engineer | Kỹ sư bán hàng | Sales Engineer, Technical Sales | Demo, POC, tech company, tech knowledge | Product development only |
| Insurance/Finance | Đại lý bảo hiểm, Tư vấn bảo hiểm | Insurance Agent, Financial Sales Rep | Policy, premium, agent cert, commission | Claims processing, underwriting ops |
| Pre-sales | Tư vấn giải pháp | Pre-sales Consultant, Solutions Consultant | Proposal, needs analysis, POC support, handoff | Pure tech support, ops |
| Sales Operations | Nhân viên hỗ trợ bán hàng | Sales Operations Manager, CRM Admin | CRM, reporting, workflow, training, admin | Direct customer interaction primary |
| Sales Leadership | Trưởng phòng, Giám đốc kinh doanh | Sales Manager, Sales Director, VP Sales | Team management, quota, hiring, strategy | Individual contributor only |
| Customer Success | Customer Success Manager | CSM, Account Specialist | Expansion, upsell, retention revenue, health | Support, troubleshoot, helpdesk only |

---

**Status:** DONE  
**Report Date:** 2026-06-03  
**Reviewed:** Yes (multi-source, VN legal/regulatory sources included)
