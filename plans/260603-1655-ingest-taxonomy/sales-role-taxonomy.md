# Vietnamese Sales Role Taxonomy for Ingest Filtering

**Date:** 2026-06-03  
**Purpose:** Structure sales role categories for CV-to-job vertical filtering  
**Scope:** Vietnam job market; bilingual support; disambiguation rules  
**Status:** Research-backed (see `../reports/researcher-260603-sales-taxonomy.md`)

---

## QUICK REFERENCE: POSITIVE INCLUSION RULES

Include if title or job description contains:
- Explicit sales titles: Account Executive, Account Manager, Key Account Manager, Sales Manager, Sales Director
- Inside sales: Telesales, Inside Sales Rep, Phone Sales
- Sales development: SDR, BDR, Sales Development, Business Development, Lead Generation
- Channel sales: Channel Manager, Distributor Sales, Partner Manager
- Retail: Store Manager, Floor Sales, Retail Manager, Retail Associate (FMCG/retail context)
- Real estate: Môi giới BĐS, Real Estate Broker, Real Estate Agent
- Technical sales: Sales Engineer, Technical Sales Engineer (demo/POC context)
- Insurance/Finance: Insurance Agent, Financial Product Sales, Insurance Consultant
- Pre-sales: Pre-sales Consultant, Solutions Consultant, Presales Engineer
- Customer success (with revenue focus): CSM with "expansion", "upsell", "retention revenue"
- Sales leadership: Sales Manager, Sales Director, VP Sales, Head of Sales
- Vietnamese: Nhân viên kinh doanh, Chuyên viên kinh doanh, Account Manager, Trưởng phòng kinh doanh, Giám đốc kinh doanh

---

## QUICK REFERENCE: NEGATIVE EXCLUSION RULES

Reject if:
- **Customer Service Officer / Nhân viên dịch vụ khách hàng** — support ≠ sales
- **Sales Coordinator** with primary focus on CRM updates, data entry, scheduling (ops function)
- **Order Processing Staff** — fulfillment ops, not sales
- **HR Recruitment / Recruitment Sales** — selling HR talent services, not product sales
- **Marketing Sales** — if pure campaign/content focus (not customer consultation)
- **Finance Operations / Claims Processor** — back-office, not sales
- **IT Support** — technical support ≠ sales

---

## A. ROLE INVENTORY

### 1. Field Sales / B2B

**Vietnamese Titles:**
- Nhân viên kinh doanh (Business staff)
- Nhân viên kinh doanh B2B (B2B explicit)
- Chuyên viên kinh doanh (Business specialist/consultant)
- Account Manager
- Account Executive
- Key Account Manager / Quản lý tài khoản khách hàng chính
- Trưởng phòng kinh doanh (Sales Manager)
- Giám đốc kinh doanh khu vực (Area Sales Director)
- Giám đốc bán hàng (Sales Director)

**English Titles:**
- Account Executive (AE)
- Account Manager (AM)
- Key Account Manager (KAM)
- Senior Account Executive
- Enterprise Sales Executive
- Territory Sales Manager

**Confirming Keywords:**
- CRM tools: Salesforce, HubSpot, Pipedrive, MS Dynamics
- KPI: quota, commission, revenue target, ARR, ACV, annual contract value
- Process: sales cycle, discovery call, proposal, contract negotiation
- Relationship: client retention, account expansion, customer lifetime value, managed service

**Scope Note:** Enterprise/B2B if company size target stated (SME, enterprise, Fortune 500), contract multi-year, deal size significant, or territory management mentioned.

---

### 2. Inside Sales / Telesales

**Vietnamese Titles:**
- Nhân viên bán hàng nội bộ (Inside sales staff)
- Nhân viên Telesales
- Telesales Executive
- Inside Sales Representative

**English Titles:**
- Inside Sales Representative
- Telesales Executive
- Phone Sales Representative
- Remote Sales Representative
- Call Center Sales

**Confirming Keywords:**
- Phone/call-based outreach
- Virtual/office-based (no field visit)
- Lead qualification
- Script-based conversation
- Metrics: calls per day, connect rate, conversions per call, closing rate
- Technology: dialer, call recording, CRM integration

**Scope Note:** Inside sales if role explicitly states "telesales", "phone sales", "remote", OR work location office-based with inbound/outbound call focus.

---

### 3. Sales Development (SDR, BDR, Lead Gen)

**Vietnamese Titles:**
- Nhân viên phát triển bán hàng
- Sales Development Representative (SDR)
- Business Development Representative (BDR)
- Business Development Specialist
- Lead Generation Specialist

**English Titles:**
- Sales Development Representative (SDR)
- Business Development Representative (BDR)
- Sales Development Executive
- Lead Generation Manager
- Outbound Sales Development Rep

**Confirming Keywords:**
- Cold outreach, prospecting, lead qualification
- SDR focus: inbound lead qualification → pass qualified leads to Account Executive
- BDR focus: outbound cold prospecting → build pipeline from scratch
- Metrics: meetings booked, qualified leads, response rate, pipeline generated
- Technology: LinkedIn Sales Navigator, cold email tools, Outreach, Salesloft

**Scope Note:**
- SDR = inbound + qualification + handoff (not closing)
- BDR = outbound + prospecting (hunting for new accounts)
- If ambiguous: both = sales (not ops)

---

### 4. Channel & Partner Sales

**Vietnamese Titles:**
- Nhân viên bán hàng qua kênh phân phối (Channel sales staff)
- Quản lý kênh bán hàng (Channel manager)
- Quản lý đối tác (Partner manager)
- Distributor Sales Representative
- Distributor Account Manager

**English Titles:**
- Channel Manager
- Partner Manager
- Distributor Sales Rep
- Channel Account Manager
- Reseller Manager
- Indirect Sales Manager

**Confirming Keywords:**
- Distributor/reseller partnerships
- Indirect sales (through partners)
- Margin management, co-op funds
- Partner recruitment, enablement, training
- Channel incentive programs, spiff
- Territory: channel-based (not direct territory)

**Scope Note:** Channel sales if managing distributor/reseller partners; recruitment, training, or account support distinct from direct field sales.

---

### 5. Retail Sales

**Vietnamese Titles:**
- Nhân viên bán hàng (Generic "salesperson"; context determines if retail or field)
- Nhân viên bán hàng bán lẻ (Retail salesperson)
- Nhân viên bán hàng trực tiếp (Direct sales = retail/field staff)
- Trưởng cửa hàng (Store manager)
- Giám đốc bán lẻ (Retail manager)
- Quản lý cửa hàng (Store manager)
- Nhân viên sàn bán hàng (Floor sales)
- Nhân viên tại quầy (POS/counter staff)

**English Titles:**
- Retail Sales Associate
- Floor Sales Representative
- Store Manager
- Retail Manager
- Retail Supervisor
- POS Operator
- Sales Associate

**Confirming Keywords:**
- Industry: FMCG (fast-moving consumer goods), pharmacy, retail chain, cosmetics, electronics
- Location: specific store address, retail outlet, market stall
- Inventory: stock management, visual merchandising, stock-outs
- Technology: POS (point-of-sale) system, inventory system
- Customer service + product recommendation (combined)
- Shift-based work, floor presence required

**Scope Note:** Retail if location-specific (store address), merchandise visibility, or industry = FMCG/pharmacy/retail. Role name often vague; disambiguate by industry context + place of work.

---

### 6. Real Estate Sales

**Vietnamese Titles:**
- Môi giới bất động sản (Real estate broker)
- Chuyên viên kinh doanh bất động sản (BDS specialist/consultant)
- Agent bất động sản (Real estate agent)
- Nhân viên bán bất động sản (Real estate sales staff)
- Tư vấn bất động sản (Real estate consultant)
- Trưởng phòng kinh doanh bất động sản (Real estate sales manager)
- Giám đốc bán hàng bất động sản (Real estate sales director)
- Broker đất đai

**English Titles:**
- Real Estate Broker
- Real Estate Agent
- Real Estate Sales Executive
- Real Estate Consultant
- Residential Sales Agent
- Commercial Real Estate Broker
- Property Broker

**Confirming Keywords:**
- BĐS / BDS abbreviation (bất động sản = real estate)
- Commission-based compensation (no fixed salary typical)
- Property valuation, comparative market analysis (CMA)
- Legal documentation, contract support, transaction closing
- Developer partnerships (primary/new market) or secondary market
- Certification: practicing certificate required per Vietnam Real Estate Business Law 2023
- Transaction types: buy/sell, rent/lease, transfer

**Scope Note:** Real estate sales if explicitly mentions "bất động sản", "BĐS", "môi giới", "real estate", "property", or transaction context. Always = sales (broker/agent = sales by law).

---

### 7. Sales Engineer / Technical Sales / Solution Sales

**Vietnamese Titles:**
- Kỹ sư bán hàng (Sales engineer)
- Sales Engineer (English title used widely)
- Tư vấn kỹ thuật bán hàng (Technical sales consultant)
- Chuyên viên bán hàng kỹ thuật (Technical sales specialist)
- Solution Sales Engineer
- Kỹ sư bán hàng - [Technology] (e.g., IoT, Cloud)

**English Titles:**
- Sales Engineer (SE)
- Technical Sales Engineer
- Technical Sales Representative
- Solution Sales Engineer
- Sales Engineer - [Industry] (e.g., Industrial Equipment, Mechanical)
- Technical Account Executive

**Confirming Keywords:**
- Technical product knowledge (beyond pitch)
- Proof of Concept (POC), product demo, technical presentation
- Cost calculation, ROI analysis, proposal input
- Technology company context: SaaS, DaaS, AI, cloud, industrial tech, mechanical engineering, automotive
- Education: Bachelor's degree in IT/CS or engineering preferred
- Customer-facing technical consultation (not internal engineering)

**CRITICAL DISAMBIGUATION: Sales Engineer ≠ Tech-Engineering Role**

**POSITIVE rule: Sales Engineer IS SALES if:**
- Job mentions: demo, POC, customer pitch, cost calculation, customer consultation
- Job mentions: sales, revenue, quota, customer (in closing context)
- Primary role = selling tech product (not building it)
- Industry = technology/industrial/engineering/B2B software

**NEGATIVE rule: Reject if:**
- Primary role = building/developing the product itself
- Title = "Software Engineer" or "Hardware Engineer" (building, not selling)
- No customer pitch/demo mention

**Scope Note:** Sales Engineer if customer-facing, involves technical consultation (not R&D), and product demo/POC is primary activity. Industry = tech/industrial/engineering/B2B.

---

### 8. Insurance Sales / Financial Product Sales

**Vietnamese Titles:**
- Nhân viên bán hàng bảo hiểm (Insurance sales staff)
- Chuyên viên bảo hiểm (Insurance specialist)
- Đại lý bảo hiểm (Insurance agent)
- Tư vấn bảo hiểm (Insurance consultant)
- Nhân viên bán sản phẩm tài chính (Financial product sales)
- Tư vấn sản phẩm tài chính (Financial product consultant)
- Chuyên viên kinh doanh bảo hiểm (Insurance business specialist)

**English Titles:**
- Insurance Agent
- Insurance Sales Representative
- Insurance Specialist
- Financial Product Sales Representative
- Life Insurance Agent
- Health Insurance Consultant
- Motor Insurance Sales
- Investment Product Sales Representative

**Confirming Keywords:**
- Insurance policy types: life, health, motor, liability, property, travel
- Licensing: practicing certificate required (Vietnam law)
- Compensation: commission-based (primary or partial)
- Product education, customer consultation, needs assessment
- Premium quotes, policy enrollment, customer acquisition
- Regulatory compliance, disclosure requirements
- Customer retention (renewal focus)

**CRITICAL DISAMBIGUATION: Insurance/Finance Sales ≠ Finance-Operations Role**

**POSITIVE rule: IS SALES if:**
- Job mentions: policy, premium, product consultation, customer acquisition
- Agent/representative role title
- Direct customer interaction (sales, not admin)

**NEGATIVE rule: Reject if:**
- Primary role = claims processing, underwriting support, policy admin
- Back-office finance operations (AP/AR, accounting)
- No customer consultation

**Scope Note:** Insurance/financial product sales if customer consultation, product recommendation, or policy sales. Reject if claims processing, underwriting (ops), or administrative focus.

---

### 9. Pre-sales / Solution Consultant

**Vietnamese Titles:**
- Tư vấn bán hàng (Sales consultant — often pre-sales)
- Tư vấn giải pháp (Solution consultant)
- Pre-sales Consultant
- Nhân viên hỗ trợ bán hàng (Sales support — can be pre-sales or ops)
- Business Analyst (often pre-sales-adjacent)
- Solution Architect (sales-aligned)

**English Titles:**
- Pre-sales Consultant
- Solutions Consultant
- Sales Consultant
- Solutions Engineer
- Business Analyst (sales-facing)
- Solution Architect
- Pre-sales Engineer

**Confirming Keywords:**
- Proposal writing, technical input, RFP response
- Demo/POC support (alongside or before sales)
- Customer needs analysis, requirements gathering
- Solution design, architecture, implementation planning
- Customer handoff post-sale (distinct from account management)
- Working with account executives (supporting role)
- Technology/SaaS/software context typical

**Scope Note:** Pre-sales if explicitly states "pre-sales", "proposal", "POC support", OR role involves customer needs assessment followed by sales team handoff. Not closing deals; supporting sale process.

---

### 10. Sales Operations / Sales Enablement

**Vietnamese Titles:**
- Nhân viên hỗ trợ bán hàng (Sales support)
- Chuyên viên hỗ trợ bán hàng (Sales enablement specialist)
- Quản lý hoạt động bán hàng (Sales operations manager)
- CRM Administrator
- Sales Coordinator
- Sales Operations Analyst

**English Titles:**
- Sales Operations Manager
- Sales Enablement Specialist
- Sales Coordinator (ops-focused)
- CRM Administrator
- Sales Support Specialist
- Sales Operations Analyst
- Revenue Operations Manager

**Confirming Keywords (Operations)**
- CRM tool management, data hygiene, system admin
- Sales process administration, workflow automation
- Reporting, analytics, forecasting, commission tracking
- Training delivery, resource management, tool rollout
- No direct customer revenue responsibility
- Internal process focus

**CRITICAL DISAMBIGUATION: Sales Ops ≠ Sales Coordinator with customer touch**

**IS OPERATIONS if:**
- CRM admin, reporting, workflow setup, training (internal)
- Tools/systems management focus
- Process improvement, operations support

**NOT if (= Sales instead):**
- "Sales Coordinator" with "schedule customer calls", "customer communication"
- Customer-touching activity is material to role

**Scope Note:** Sales Ops if primary responsibility is internal process/tools/training. If role touches customers (meeting scheduling, order management), classify by primary activity: if customer-interaction-heavy → sales; if admin-heavy → ops.

---

### 11. Sales Leadership

**Vietnamese Titles:**
- Trưởng phòng kinh doanh (Sales Manager — team lead)
- Giám đốc kinh doanh (Sales Director — department head)
- Giám đốc bán hàng (Sales Director)
- Phó giám đốc kinh doanh (Associate Sales Director)
- Trưởng nhóm bán hàng (Sales Team Lead)
- Supervisor Bán hàng (Sales Supervisor)
- VP Bán hàng / VP Sales / Head of Sales (C-suite)

**English Titles:**
- Sales Manager
- Sales Director
- VP Sales / Head of Sales
- Area Manager / Regional Sales Manager
- Sales Supervisor
- Senior Sales Manager
- Sales VP / Chief Revenue Officer (CRO)

**Confirming Keywords:**
- Team management, hiring, training
- Revenue responsibility (quota, targets, OKRs)
- Strategic planning, sales strategy, territory management
- Performance management, coaching, motivation
- Reporting to executives or C-suite
- Commission/bonus tied to team results

**Scope Note:** Sales leadership if role involves managing sales team members (direct reports), setting targets, or strategic revenue planning.

---

### 12. Customer Success (Sales-Aligned Variant)

**Vietnamese Titles:**
- Nhân viên chăm sóc khách hàng (Customer care staff)
- Chuyên viên chăm sóc khách hàng (Customer success specialist)
- Customer Success Manager (bilingual)
- Account Specialist (retention-focused)
- Customer Advocate

**English Titles:**
- Customer Success Manager (CSM)
- Customer Care Specialist
- Account Specialist
- Customer Account Manager (CAM)
- Customer Retention Manager
- Onboarding Specialist (post-sale, upsell-focused)

**Confirming Keywords (SALES-ALIGNED CSM)**
- Upsell, expansion revenue, account growth
- Retention-driven, customer health, churn prevention
- Revenue impact (direct or indirect)
- Account management, customer relationship (post-sale)

**Confirming Keywords (PURE SUPPORT — REJECT)**
- Troubleshooting, issue resolution, helpdesk
- Support ticket management, break-fix support
- Customer service (support function)
- No revenue mention

**CRITICAL DISAMBIGUATION: CSM ≠ Customer Service**

**IS SALES-ALIGNED if:**
- Job mentions: "upsell", "expansion revenue", "retention", "customer health", "revenue expansion"
- Role involves post-sale customer relationship with revenue implications
- Distinct from support/troubleshooting

**NOT (= SUPPORT, REJECT) if:**
- Primary language: "support", "issue resolution", "helpdesk", "support ticket"
- Pure support role (no revenue impact)
- Title = "Customer Service Officer" (explicit)

**Scope Note:** CSM is SALES if job description includes expansion revenue or account growth language. CSM is OPS/SUPPORT if focused on support, troubleshooting, ticket resolution. Default: ambiguous CSM → INCLUDE (benefit of doubt on expansion potential).

---

## B. JOB BOARD CATEGORY MAPPING

### VietnamWorks.com
- **Main Category:** Sales & Business Development
- **Sub-filters:** Account Manager, Sales Manager, Business Development, Sales Support, Sales Engineer
- **URL:** https://www.vietnamworks.com/tim-viec-lam
- **Volume:** 600+ active sales engineer listings; 300+ account manager roles

### TopCV.vn
- **Main Category:** Sale (11,909+ jobs as of 2026-06-03)
- **Sub-categories:**
  - Nhân viên tư vấn (Consulting staff)
  - Nhân viên bán hàng (Sales staff)
  - Nhân viên kinh doanh (Business staff)
  - Bán hàng ngoài (Outside/field sales)
  - Bán hàng trong (Inside sales)
  - Telesales
  - Bán hàng online (Online sales)
  - Bán hàng thị trường (Market sales — retail/FMCG)
  - Bán lẻ (Retail)
  - Quản lý cửa hàng (Store manager)
  - Sale Admin
  - Sales Marketing
  - Kinh doanh xuất nhập khẩu (Import/Export business sales)
  - Thực tập sinh kinh doanh (Business internship — exclude)
- **URL:** https://www.topcv.vn/tim-viec-lam-sale
- **Volume:** Largest active sales category on platform

### Việc Làm 24h (VL24h.vn / VieclAM24h.vn)
- **Main Category:** Bán hàng & Kinh doanh (Sales & Business)
- **Sub-jobs:**
  - Nhân viên kinh doanh (Business staff)
  - Nhân viên kinh doanh B2B
  - Tư vấn bán hàng (Sales consultant)
  - Trưởng phòng kinh doanh (Sales manager)
  - Trưởng phòng kinh doanh dự án (Project sales manager)
- **URL slug:** `/ban-hang-kinh-doanh/` (e.g., `vieclam24h.vn/ban-hang-kinh-doanh/...`)
- **Coverage:** Mid-tier; SME/local companies

### Real Estate Vertical
- **Separate Category:** Bất Động Sản (Real Estate)
- **VietnamWorks:** `/real-estate-jobs`
- **TopCV:** Separate category
- **VL24h:** Separate category
- **Roles:** Brokers, agents, consultants, managers, project managers

---

## C. BILINGUAL TITLE MATCHING

### High-Confidence Matches (Use for Index/Tokenization)

| Vietnamese | English | Confidence | Domain |
|---|---|---|---|
| Nhân viên kinh doanh | Sales staff / Business staff | Very High | Field Sales, Inside, Retail |
| Chuyên viên kinh doanh | Business consultant / Sales consultant | Very High | Field Sales, Pre-sales |
| Account Manager | Account Manager | Very High | Field Sales (B2B) |
| Account Executive | Account Executive | Very High | Field Sales (Enterprise) |
| Key Account Manager | Key Account Manager / Account Manager | Very High | Field Sales (B2B) |
| Trưởng phòng kinh doanh | Sales Manager | Very High | Sales Leadership |
| Giám đốc kinh doanh | Sales Director | Very High | Sales Leadership |
| Nhân viên Telesales | Telesales / Phone Sales Rep | Very High | Inside Sales |
| Inside Sales Representative | Inside Sales Representative | Very High | Inside Sales |
| SDR / BDR | Sales Development / Business Development Rep | Very High | Sales Development |
| Sales Engineer / Kỹ sư bán hàng | Sales Engineer | Very High | Sales Engineer |
| Môi giới bất động sản | Real Estate Broker | Very High | Real Estate |
| Nhân viên bán lẻ | Retail Sales Associate | Very High | Retail |
| Trưởng cửa hàng | Store Manager | Very High | Retail |
| Tư vấn giải pháp | Solutions Consultant | High | Pre-sales |
| Customer Success Manager | Customer Success Manager | High | Sales-Adjacent |
| Đại lý bảo hiểm | Insurance Agent | Very High | Insurance |
| Nhân viên bán hàng ngoài | Outside Sales Rep / Field Sales | High | Field Sales |

### Context-Dependent Matches (Require Descriptor Review)

| Vietnamese | English | Ambiguity | Resolution |
|---|---|---|---|
| Nhân viên tư vấn | Consultant / Advisor | High | Product/sales mention → Sales; process/admin → Ops |
| Sales Marketing | Sales & Marketing / Sales Support | High | Marketing focus → Marketing; sales support → Sales |
| Business Analyst | Business Analyst | High | Customer-facing + proposal → Pre-sales; system → Tech/Ops |
| Nhân viên hỗ trợ bán hàng | Sales Support / Sales Coordinator | High | Customer touch → Sales; admin focus → Ops |
| Chuyên viên kinh doanh BĐS | Real Estate Specialist | Medium | BĐS explicit → always Real Estate |

---

## D. FILTER IMPLEMENTATION GUIDE

### Token-Based Positive Matching (Fast Path)

**Exact title match (language-agnostic tokenization):**
1. Tokenize job title by space/hyphen/comma
2. Check for ANY of these tokens:
   - Sales, kinh doanh, Account Manager, Account Executive, KAM, AE, AM
   - Telesales, Inside Sales, SDR, BDR, Business Development
   - Channel, Distributor, Partner Manager
   - Store Manager, Retail Manager, Floor Sales, POS
   - Môi giới, BĐS, Real Estate, Broker, Agent
   - Sales Engineer, Kỹ sư bán hàng, Technical Sales, Presales
   - Insurance Agent, Bảo hiểm, Financial Sales
   - Solutions Consultant, Tư vấn giải pháp
   - Sales Manager, Sales Director, Trưởng phòng, Giám đốc kinh doanh
   - Customer Success Manager (if expansion keywords present)

**If any token matches → INCLUDE (unless negative filter overrides)**

### Descriptor-Based Positive Matching (Nuance Path)

**If title ambiguous, scan job description for these keywords:**

For "Consultant", "Specialist", "Support" titles:
- Contains "customer", "bán hàng" (sales), "chào mời" (pitch), "demo", "POC", "proposal" → SALES
- Contains "CRM", "report", "admin", "data entry", "schedule" (without customer context) → OPS
- Contains "support", "troubleshoot", "issue", "helpdesk" → SUPPORT (reject)

For "CSM" or "Customer Success":
- Contains "expansion", "upsell", "retention", "revenue", "account growth" → SALES
- Contains only "support", "training", "onboarding" (no revenue) → OPS (reject)

For "Sales Coordinator":
- Contains "schedule customer", "meeting setup", "customer communication" → SALES
- Contains "CRM update", "data entry", "order process" (prominent) → OPS (reject)

### Negative Matching (Definitive Rejection)

**Reject if title contains ANY of:**
- "Customer Service" (Officer, Representative, Specialist) → OPS
- "Claims Processor", "Claims Handler" → OPS
- "Recruitment", "Recruiter", "HR Sales" (selling recruitment services) → OPS/HR
- "Finance", "Accounting", "Billing", "AP/AR" → OPS
- "Order Processing", "Fulfillment", "Warehouse" → OPS
- Explicit "Marketing" (no sales context) → MARKETING

**Exception:** Can override if job description clearly mentions "closing sales", "customer acquisition", "revenue target". But default = reject.

---

## E. TEST CASES (Validation)

### Positive (INCLUDE)

| Test Case | Domain | Reason |
|---|---|---|
| "Nhân Viên Kinh Doanh" | Field Sales | Generic sales staff = core role |
| "Senior Account Executive - B2B SaaS" | Field Sales/Enterprise | Title + B2B + SaaS = sales |
| "Key Account Manager FMCG" | Field Sales/Retail | KAM + FMCG = B2B distributor sales |
| "Sales Engineer (Industrial Equipment)" | Sales Engineer | Contains "Sales Engineer" + industrial context = sales (not tech eng) |
| "Kỹ sư bán hàng - Giải pháp IoT" | Sales Engineer | VN "Sales Engineer" + tech = sales |
| "Môi Giới Bất Động Sản" | Real Estate | "Môi giới" + BĐS = broker (sales by law) |
| "BDR / SDR - SaaS Startup" | Sales Development | Explicit BDR/SDR + SaaS = outbound/inbound qualification (sales) |
| "Inside Sales Representative - 5 năm kinh nghiệm" | Inside Sales | Explicit inside sales + experience = telesales |
| "Trưởng Phòng Kinh Doanh Phía Nam" | Sales Leadership | Manager title + region = sales manager |
| "Customer Success Manager - Expansion Revenue Focus" | CSM (sales-aligned) | Explicit "expansion revenue" = sales CSM |
| "Pre-sales Consultant - Cloud Solutions" | Pre-sales | Explicit pre-sales + tech = pre-sales |
| "Chuyên viên bán hàng Bảo hiểm Nhân thọ" | Insurance | Insurance specialist = sales |

### Negative (REJECT)

| Test Case | Why | Evidence |
|---|---|---|
| "Customer Service Officer" | Support, not sales | Title = "service" only; no sales function |
| "Customer Service Officer - Hỗ trợ Khách hàng" | Support ops | "hỗ trợ" (support) = service, not acquisition |
| "Sales Coordinator - Cập nhật CRM & lên lịch" | Ops/admin | "CRM update" + "schedule" = admin, not customer-facing sales |
| "Sales Coordinator - Order Processing" | Ops | "order processing" = fulfillment, not sales |
| "Nhân Viên Tuyển Dụng (Bán dịch vụ HR)" | HR ops | "tuyển dụng" + "dịch vụ HR" = recruitment ops, not sales |
| "Marketing Sales Specialist (Chiến dịch quảng cáo)" | Marketing | "chiến dịch" (campaign) = marketing, not customer sales |
| "Kỹ sư Phần mềm - Hỗ trợ Bán hàng" | Tech support | Software engineer in support role = tech ops, not sales |
| "Finance Operations - Insurance Backend" | Finance ops | "operations" + "backend" = finance admin |
| "Claims Processor - Bảo hiểm" | Insurance ops | "claims" (yêu cầu bồi thường) = processing, not sales |
| "HR Manager - Sales Recruitment" | HR ops | "HR" + "recruitment" = people ops, not product sales |

---

## F. IMPLEMENTATION CHECKLIST

- [ ] Tokenize job title (VN + EN, handle diacritics)
- [ ] Apply positive token match → INCLUDE if any match
- [ ] If no token match, check negative token list → REJECT if any match
- [ ] If still ambiguous (rare), scan job description for descriptor keywords
- [ ] Apply customer-facing CSM descriptor rule (expansion revenue?)
- [ ] Apply Sales Coordinator descriptor rule (customer touch vs. admin focus?)
- [ ] Apply "Sales Engineer" rule (demo/POC + customer pitch = sales, not tech role)
- [ ] Log decision (reason for include/reject) for audit trail
- [ ] Test on sample 100 job postings before production rollout

---

**Last Updated:** 2026-06-03  
**Research Report:** `../reports/researcher-260603-sales-taxonomy.md`  
**Maintainer Contact:** CVMatching Lead

