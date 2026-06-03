# Vietnamese Finance Role Taxonomy

**Purpose**: Pre-filter job listings for finance vertical in CV-to-job scraper  
**Scope**: 10 finance sub-domains with bilingual (EN/VN) title patterns, disambiguation rules, and negative filters  
**Last Updated**: 2026-06-03  
**Sources**: 14 Vietnamese job boards, ACCA, VACPA, recruitment agencies (full citations in researcher report)

---

## Role Taxonomy by Sub-Domain

### 1. ACCOUNTING (Kế toán)

#### General Accountant
- **VN titles**: Kế toán tổng hợp, Kế toán viên, Nhân viên kế toán
- **EN titles**: Accountant, Staff Accountant, Accounting Staff, GL Accountant
- **Confirming keywords**: 
  - Processes: Bank reconciliation, GL posting, AR/AP, financial statement, sổ cái, báo cáo tài chính
  - Tools: SAP, Oracle, Misa, FAST, QuickBooks
  - Certifications: CPA, ACCA
- **Negative filters**: 
  - Sales support, HR payroll, Data entry (unless roles state "GL posting" or "financial statement")
- **Regex match**: `/\b(kế toán|accountant)\b.*(tổng hợp|staff|general|viên)/i`
- **Confidence**: 95%

#### Tax Accountant
- **VN titles**: Kế toán thuế, Chuyên viên thuế, Chuyên viên kế toán thuế
- **EN titles**: Tax Accountant, Tax Specialist, Tax Compliance Specialist
- **Confirming keywords**: 
  - Processes: Tax filing, tax return, corporate tax (CIT), personal tax (PIT), VAT, vat return, tax planning, Vietnam tax law
  - Standards: Vietnam Accounting Standard, IFRS 12
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(kế toán|tax).*(thuế|tax)/i`
- **Confidence**: 98%

#### Cost Accountant
- **VN titles**: Kế toán chi phí, Kế toán giá thành, Chuyên viên tính toán chi phí
- **EN titles**: Cost Accountant, Costing Analyst, Cost Controller
- **Confirming keywords**: 
  - Processes: Cost allocation, variance analysis, COGS, job costing, standard costing, tiêu chuẩn chi phí
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(kế toán|cost).*(chi phí|cost|costing)/i`
- **Confidence**: 85% (sparse in VN job boards)

#### AR/AP Specialist
- **VN titles**: Kế toán phải trả, Kế toán có phải, Chuyên viên phải trả
- **EN titles**: AR Specialist, AP Specialist, Receivables Specialist, Payables Specialist
- **Confirming keywords**: 
  - Processes: Invoice processing, vendor management, customer collections, dunning, aging report
- **Negative filters**: Sales support
- **Regex match**: `/(ar|ap|receivable|payable|phải trả|có phải)/i`
- **Confidence**: 80% (often bundled under "General Accountant")

#### Chief Accountant / Finance Manager
- **VN titles**: Kế toán trưởng, Trưởng phòng kế toán, Trưởng phòng tài chính, Quản lý tài chính
- **EN titles**: Finance Manager, Head of Finance, Chief Accountant, CFO (if + broader scope)
- **Confirming keywords**: 
  - Management: Budget control, revenue recognition, financial close, GAAP/IFRS compliance, team management
  - Tools: SAP, Oracle, Tableau, Power BI
- **Negative filters**: Sales, marketing
- **Regex match**: `/(kế toán trưởng|trưởng phòng (kế toán|tài chính)|finance manager|head of finance)/i`
- **Confidence**: 93%

---

### 2. AUDIT (Kiểm toán / Kiểm soát)

#### Internal Auditor
- **VN titles**: Kiểm toán nội bộ, Chuyên viên kiểm soát nội bộ, Trưởng đoàn kiểm toán nội bộ, Senior Internal Auditor
- **EN titles**: Internal Auditor, Internal Audit Specialist, Senior Internal Auditor
- **Confirming keywords**: 
  - Processes: Control testing, process audit, risk assessment, audit scope, audit plan, working papers, internal control design
  - Standards: IFRS, GAAP, Vietnam Accounting Standard, COSO framework
  - Certifications: CIA (Certified Internal Auditor)
- **Negative filters** (CRITICAL): 
  - "Security", "Penetration test", "Vulnerability assessment", "Code review", "Application security" → **REJECT (IT security audit)**
  - "QA", "Software testing" → **REJECT (QA, not audit)**
- **Regex match (POSITIVE)**: `/\b(kiểm toán nội bộ|internal audit(or)?)\b.*(control|risk|process|audit scope)/i`
- **Regex match (NEGATIVE)**: `/(audit|auditor|control).*(security|penetration|vulnerability|application security|soc 2|iso 27001)/i` → **REJECT**
- **Confidence**: 92%

#### External Auditor
- **VN titles**: Kiểm toán độc lập, Kiểm toán viên, Chuyên viên kiểm toán, Trưởng nhóm kiểm toán
- **EN titles**: Auditor, External Auditor, Audit Associate, Senior Auditor, Audit Manager
- **Confirming keywords**: 
  - Processes: Financial statement audit, regulatory audit, compliance audit, IFRS audit, GAAP audit, financial reporting
  - Companies: Big 4 (Deloitte, EY, KPMG, PWC) + local firms (KPMG Vietnam, EY Vietnam, etc.)
  - Certifications: ACCA, CIA
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(kiểm toán|audit(or)?).*(độc lập|external|financial statement|statement)/i`
- **Confidence**: 95%

#### IT Auditor (FINANCE VARIANT)
- **VN titles**: Kiểm toán IT, Kiểm toán hệ thống thông tin, Kiểm soát hệ thống IT
- **EN titles**: IT Auditor, Systems Auditor, IT Controls Auditor
- **Confirming keywords** (FINANCE):
  - Processes: IT governance, IT controls, system access controls, change management, SOX compliance
  - Standards: COBIT, SOX (rare in VN)
  - NOT: Penetration testing, vulnerability scanning, code security
- **Negative filters** (CRITICAL):
  - Presence of "Penetration test", "Vulnerability assessment", "Security audit", "Code review" → **REJECT (IT security audit, not finance)**
- **Regex match (POSITIVE)**: `/\b(it audit|system audit).*(governance|control|access|change)/i`
- **Regex match (NEGATIVE)**: `/(it audit|system audit).*(penetration|vulnerability|security|code review)/i` → **REJECT**
- **Confidence**: 75% (high ambiguity risk)

#### Compliance Auditor
- **VN titles**: Kiểm toán tuân thủ, Chuyên viên tuân thủ quy định, Compliance Officer
- **EN titles**: Compliance Officer, Compliance Auditor, Compliance Specialist, Regulatory Compliance
- **Confirming keywords**: 
  - Processes: Policy adherence, regulatory mapping, control testing, audit trail, COA remediation
  - Domains: Data protection, sanctions, AML, GDPR (rare), KYC
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(tuân thủ|compliance).*(audit|officer|specialist|quy định)/i`
- **Confidence**: 90%

---

### 3. FINANCIAL PLANNING & ANALYSIS (FP&A / Phân tích tài chính)

#### FP&A Analyst
- **VN titles**: Chuyên viên FP&A, Chuyên viên phân tích tài chính, Chuyên viên kế hoạch & phân tích tài chính, FP&A Analyst
- **EN titles**: FP&A Analyst, Financial Analyst, Planning Analyst, Finance Analyst
- **Confirming keywords**: 
  - Processes: Forecasting, variance analysis, financial modeling, budget preparation, scenario planning, monthly reforecast, P&L analysis, EBITDA
  - Tools: Excel (advanced), Tableau, Power BI, Python, SQL
  - Techniques: 3-statement modeling, NPV, DCF, sensitivity analysis
- **Negative filters**: 
  - "Commission", "Sales targets", "Client advisory" (if MLM-style, check for sales language)
- **Regex match**: `/(fp&a|fpa|phân tích tài chính).*(analyst|specialist|officer|viên)/i` or `/(chuyên viên phân tích tài chính)/i`
- **Confidence**: 88%

#### Senior Financial Analyst
- **VN titles**: Chuyên viên phân tích tài chính cấp cao, Chuyên viên tài chính cao cấp, Senior Financial Analyst
- **EN titles**: Senior Financial Analyst, Lead Financial Analyst, Financial Business Partner, Finance Manager
- **Confirming keywords**: 
  - Additional scope: Business partner engagement, stakeholder management, strategic financial initiatives
  - Tools: Same as FP&A + broader dashboarding
- **Negative filters**: Same as FP&A
- **Regex match**: `/(senior|cao cấp).*(financial analyst|phân tích tài chính)/i`
- **Confidence**: 90%

#### Budget Analyst
- **VN titles**: Chuyên viên ngân sách, Chuyên viên lập kế hoạch ngân sách, Budget Analyst
- **EN titles**: Budget Analyst, Planning & Control Specialist, Budget Manager
- **Confirming keywords**: 
  - Processes: Budget forecasting, monthly/quarterly reforecast, variance reporting, capex planning
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(budget|ngân sách).*(analyst|specialist|viên)/i`
- **Confidence**: 82% (less common standalone role in VN)

#### Treasury Analyst
- **VN titles**: Chuyên viên quản trị dòng tiền, Chuyên viên tài chính, Treasury Specialist, Cash Flow Analyst
- **EN titles**: Treasury Analyst, Cash Flow Analyst, Working Capital Analyst, Liquidity Analyst
- **Confirming keywords**: 
  - Processes: Working capital management, cash forecasting, debt/equity optimization, FX hedging, liquidity analysis, quản trị dòng tiền
  - Tools: TMS (Treasury Management System), Bloomberg
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(treasury|quản trị dòng tiền|cash management).*(analyst|specialist|viên)/i`
- **Confidence**: 80%

---

### 4. BANKING (Ngân hàng)

#### Retail Banking Officer (Teller)
- **VN titles**: Giao dịch viên bán lẻ, Giao dịch viên, Nhân viên giao dịch bán lẻ
- **EN titles**: Teller, Bank Teller, Transaction Officer, Banking Officer
- **Confirming keywords**: 
  - Processes: Cash handling, customer service, ATM management, deposit/withdrawal, customer onboarding
  - Salary: Entry-level (6–8M VND, per research)
- **Negative filters**: 
  - "Sales target", "Commission", "Cross-sell" → May indicate sales, but RM roles often use these terms; check seniority (Teller usually entry-level, RM is mid-to-senior)
- **Regex match**: `/(giao dịch viên|teller|banking officer|transaction officer)/i`
- **Confidence**: 93%

#### Corporate Banking Officer / Relationship Manager (RM)
- **VN titles**: Chuyên viên ngân hàng doanh nghiệp, Chuyên viên quan hệ khách hàng, Relationship Manager (RM), Chuyên viên quản lý mối quan hệ
- **EN titles**: Relationship Manager, Corporate Banker, Account Manager, Corporate Banking Specialist, RM
- **Confirming keywords**: 
  - Processes: Working capital lines, trade services, M&A advisory, client relationship mgmt, deposit/liability mgmt, customer development
  - Salary: Mid-to-senior (15–30M+ VND)
  - Abbr: "RM" common
- **Negative filters**: 
  - "Sales target", "Commission-heavy", "Cross-sell" → Can be **SALES** if primary KPI is revenue (not relationship); check base salary % and company culture
  - If "retail banking" + "commission" → Likely **SALES**
- **Regex match**: `/(chuyên viên ngân hàng doanh nghiệp|relationship manager|rm\b|corporate banker|account manager).*(ngân hàng|banking|corporate)/i`
- **Confidence**: 85% (gray zone: depends on compensation structure)

#### Investment Banking Analyst
- **VN titles**: Chuyên viên ngân hàng đầu tư, Analyst - Thương vụ, Chuyên viên thương vụ
- **EN titles**: Investment Banking Analyst, IB Analyst, Associate, Senior Analyst
- **Confirming keywords**: 
  - Processes: IPO, M&A, equity raises, pitch books, valuation, due diligence, deal execution
  - Companies: Big 4, boutique IB (rare in VN)
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(ngân hàng đầu tư|investment banking|ib analyst|analyst.*thương vụ)/i`
- **Confidence**: 95% (but sparse; <5% of banking roles in VN)

#### Credit Analyst / Credit Officer
- **VN titles**: Chuyên viên tín dụng, Chuyên viên duyệt tín dụng, Chuyên viên phê duyệt tín dụng, Loan Officer
- **EN titles**: Credit Analyst, Credit Officer, Loan Officer, Credit Specialist, Risk Analyst (credit context)
- **Confirming keywords**: 
  - Processes: Loan underwriting, credit risk assessment, covenant monitoring, LTV analysis, credit documentation, default risk
  - Tools: Credit scoring models, CIBIL (international), credit rating systems
  - Banking jargon: NPA (Non-performing Asset), LTV (Loan-to-Value), CCF (Credit Conversion Factor)
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(tín dụng|credit).*(chuyên viên|analyst|officer|specialist)/i`
- **Confidence**: 94%

---

### 5. TREASURY & CASH MANAGEMENT (Quản trị dòng tiền)

#### Treasury Manager
- **VN titles**: Trưởng phòng quản trị dòng tiền, Quản lý tài chính, Treasury Manager
- **EN titles**: Treasury Manager, Head of Treasury, Treasurer
- **Confirming keywords**: 
  - Processes: Cash forecasting, debt/equity management, FX risk, liquidity optimization, dividend/payback mgmt
  - Tools: TMS, Bloomberg, RMB settlement, LIBOR phase-out awareness
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(trưởng phòng|manager).*(quản trị dòng tiền|treasury)/i`
- **Confidence**: 85% (rare in SME VN market)

#### Cash Management Specialist
- **VN titles**: Chuyên viên quản trị dòng tiền, Chuyên viên tài chính, Cash Flow Specialist
- **EN titles**: Cash Management Specialist, Cash Flow Specialist, Working Capital Analyst
- **Confirming keywords**: 
  - Processes: Daily cash positioning, sweep accounts, vendor management, liquidity forecasting, netting
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(quản trị dòng tiền|cash management).*(chuyên viên|specialist)/i`
- **Confidence**: 80%

#### Trade Finance Specialist
- **VN titles**: Chuyên viên tài chính thương mại, Chuyên viên hỗ trợ thương mại
- **EN titles**: Trade Finance Specialist, LC Advisor, Trade Finance Officer
- **Confirming keywords**: 
  - Processes: L/C processing, export/import financing, trade facilitation, bill of lading
  - Jargon: L/C (Letter of Credit), D/P (Documents against Payment)
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(tài chính thương mại|trade finance).*(chuyên viên|specialist|officer)/i`
- **Confidence**: 88% (banking sector specific)

---

### 6. CORPORATE FINANCE / M&A

#### Corporate Finance Manager
- **VN titles**: Chuyên viên tài chính doanh nghiệp, Quản lý tài chính doanh nghiệp, Corporate Finance Manager
- **EN titles**: Corporate Finance Manager, Finance Manager, Finance Director
- **Confirming keywords**: 
  - Processes: Capital structure planning, dividend policy, strategic investment, acquisition support, capex planning
  - Tools: Excel modeling, Tableau
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(tài chính doanh nghiệp|corporate finance).*(chuyên viên|manager|director)/i`
- **Confidence**: 90%

#### M&A Analyst
- **VN titles**: Chuyên viên M&A, Analyst - Thương vụ, Chuyên viên thương vụ, M&A Analyst
- **EN titles**: M&A Analyst, Deal Analyst, Analyst - Corporate Development
- **Confirming keywords**: 
  - Processes: Valuation, due diligence, purchase price allocation (PPA), integration planning
  - Tools: DCF, comps, precedent transactions
  - Companies: Big 4, investment banks, corporate dev teams
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(m&a|thương vụ).*(analyst|chuyên viên|officer)/i`
- **Confidence**: 95% (but sparse in VN SME market; <2% of finance roles)

#### Investment Analyst
- **VN titles**: Chuyên viên đầu tư, Investment Analyst, Chuyên viên phân tích đầu tư
- **EN titles**: Investment Analyst, Investment Manager, Investment Advisor
- **Confirming keywords**: 
  - Processes: Portfolio analysis, equity research, fund allocation, risk/return optimization
  - Certifications: CFA, CFP
- **Negative filters**: 
  - "Sales-focused", "Commission-based" → May be **SALES** (investment advisory sales), check for fiduciary language
- **Regex match**: `/(đầu tư|investment).*(analyst|manager|officer|chuyên viên)/i`
- **Confidence**: 82% (disambiguation from investment sales needed)

---

### 7. SECURITIES & INVESTMENT (Chứng khoán / Đầu tư)

#### Equity Research Analyst
- **VN titles**: Chuyên viên nghiên cứu cổ phiếu, Equity Research Analyst, Chuyên viên phân tích chứng khoán
- **EN titles**: Equity Research Analyst, Research Analyst, Analyst - Research
- **Confirming keywords**: 
  - Processes: Financial modeling, earnings forecasts, equity ratings, stock picking, buy/sell/hold recommendations
  - Tools: Bloomberg Terminal, FactSet, Reuters, Eikon
  - Certifications: CFA
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(equity research|nghiên cứu cổ phiếu).*(analyst|chuyên viên)/i`
- **Confidence**: 93%

#### Trader (Securities)
- **VN titles**: Giao dịch viên chứng khoán, Giao dịch viên cổ phiếu, Trader
- **EN titles**: Trader, Equity Trader, Derivatives Trader, Trading Analyst
- **Confirming keywords**: 
  - Processes: Trading desk, position management, P&L management, risk limits, execution strategy
  - Tools: Bloomberg, order mgmt systems, pricing tools
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(giao dịch viên|trader).*(chứng khoán|securities|equity|derivatives)/i`
- **Confidence**: 91%

#### Portfolio Manager
- **VN titles**: Quản lý danh mục đầu tư, Portfolio Manager, Chuyên viên quản lý danh mục
- **EN titles**: Portfolio Manager, Fund Manager, Asset Manager, Portfolio Analyst
- **Confirming keywords**: 
  - Processes: Asset allocation, fund performance, risk/return optimization, rebalancing, benchmarking
  - Tools: Bloomberg, FactSet, risk analytics (Morningstar, PortfolioLab)
  - Certifications: CFA, CFP
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(quản lý danh mục|portfolio manager).*(chuyên viên|manager|officer)/i`
- **Confidence**: 92%

#### Fund Manager
- **VN titles**: Quản lý quỹ, Quản lý tài sản, Fund Manager, Asset Manager
- **EN titles**: Fund Manager, Asset Manager, Fund Director
- **Confirming keywords**: 
  - Processes: Fund launch, investor relations, performance reporting, strategy implementation, NAV calculation
  - Domains: Mutual funds, ETFs, PE/VC funds (rare in VN SME boards)
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(quản lý quỹ|fund manager).*(chuyên viên|manager|director)/i`
- **Confidence**: 90%

---

### 8. INSURANCE (Bảo hiểm) — FINANCE OPERATIONS ONLY

#### Insurance Underwriter
- **VN titles**: Chuyên viên thẩm định bảo hiểm, NV Thẩm Định Bảo Hiểm, Underwriter
- **EN titles**: Underwriter, Risk Underwriter, Insurance Underwriter, Underwriting Specialist
- **Confirming keywords**: 
  - Processes: Risk assessment, premium calculation, policy approval, underwriting guidelines, coverage determination
  - Jargon: Underwriting criteria, risk selection, loss ratios
  - Salary: Fixed salary + bonus (mid-to-senior, 18–30M+ VND per research)
- **Negative filters** (CRITICAL): 
  - Presence of "Commission", "Sales", "Lead generation", "Customer acquisition" → **Likely insurance agent (SALES), REJECT**
- **Regex match**: `/\b(thẩm định bảo hiểm|underwriter|underwriting)\b.*(chuyên viên|specialist|officer)/i`
- **Confidence**: 90%

#### Insurance Actuary
- **VN titles**: Chuyên viên duyệt định giá, Chuyên viên tính toán bảo hiểm, Actuary, Insurance Actuarian
- **EN titles**: Actuary, Insurance Actuary, Actuarial Analyst
- **Confirming keywords**: 
  - Processes: Mortality tables, premium adequacy, reserve calculations, actuarial valuation
  - Certifications: CIA, SOA (Society of Actuaries), IAA (rare in VN)
  - Tools: Prophet, MoSes, actuarial software
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(actuary|duyệt định giá).*(chuyên viên|specialist|analyst)/i`
- **Confidence**: 92% (but very sparse in VN; <0.5% of insurance roles)

#### Insurance Claims Handler
- **VN titles**: Chuyên viên xử lý yêu cầu bồi thường, Chuyên viên bồi thường, Claims Specialist
- **EN titles**: Claims Adjuster, Claims Examiner, Claims Specialist, Settlement Officer
- **Confirming keywords**: 
  - Processes: Claim assessment, policy review, settlement approval, loss investigation, reserve setting
  - Jargon: Claim triage, loss reserve, claim closure
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(xử lý bồi thường|claims).*(chuyên viên|specialist|examiner)/i`
- **Confidence**: 88%

#### Insurance Agent (SALES — REJECT)
- **VN titles**: **Nhân viên kinh doanh bảo hiểm**, Tư vấn bảo hiểm (if commission-driven), Sales Consultant
- **EN titles**: **Insurance Sales Representative**, Insurance Agent, Sales Consultant
- **Confirming keywords (REJECTION)**: 
  - Commission structure: "Hoa hồng" (commission), "Chỉ tiêu" (sales quota), "Lợi nhuận" (profit-driven)
  - Processes: Lead generation, customer acquisition, sales targets, product push
  - Income: Commission-only or minimal base (10–50M VND based on contracts, per research)
- **Negative filters** (CRITICAL — REJECT FOR FINANCE): 
  - "Nhân viên kinh doanh bảo hiểm" → **EXPLICITLY SALES, NOT FINANCE OPS**
  - "Tư vấn bảo hiểm" + "Commission", "Sales target", "Lead gen" → **SALES, REJECT**
  - "Insurance Agent" + "Commission", "Quota", "Customer acquisition" → **SALES, REJECT**
- **Regex match (NEGATIVE)**: `/(nhân viên kinh doanh bảo hiểm|insurance (sales|agent)).*(commission|chỉ tiêu|hoa hồng|lead generation)/i` → **REJECT**
- **Confidence**: 98% (clear distinction in VN market; always SALES, not finance)

#### Advisory Note: Insurance Agent vs Underwriter Distinction
**Vietnamese market conflates advisor and sales roles.** Distinguish by:
1. **Title exact match**: "Nhân viên kinh doanh bảo hiểm" = 100% SALES
2. **Job description keywords**: 
   - FINANCE OPS: "Underwriting criteria", "Risk assessment", "Premium approval", "Policy coverage"
   - SALES: "Lead generation", "Customer acquisition", "Sales targets", "Commission structure"
3. **Salary structure**: 
   - FINANCE OPS: Fixed salary 18–30M+ VND
   - SALES: Commission-only or minimal base (10–50M VND variable)

---

### 9. RISK & COMPLIANCE (Rủi ro & Tuân thủ)

#### Risk Manager
- **VN titles**: Chuyên viên quản lý rủi ro, Risk Manager, Chuyên viên quản trị rủi ro
- **EN titles**: Risk Manager, Risk Officer, Risk Analyst (senior context)
- **Confirming keywords**: 
  - Processes: Risk identification, scenario analysis, risk appetite, hedging, risk monitoring, risk mitigation
  - Standards: Risk framework, COSO, Basel III (banking context)
  - Tools: Risk modeling, stress testing, heat maps
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(quản lý|quản trị).*(rủi ro|risk).*(chuyên viên|manager|officer)/i`
- **Confidence**: 93%

#### Compliance Officer
- **VN titles**: Chuyên viên tuân thủ, Chuyên viên tuân thủ quy định, Officer Tuân thủ, Compliance Officer
- **EN titles**: Compliance Officer, Compliance Manager, Regulatory Affairs Officer
- **Confirming keywords**: 
  - Processes: Policy adherence, regulatory monitoring, control testing, compliance audit, audit trail, remediation
  - Domains: Data protection, sanctions, KYC, GDPR (rare in VN)
  - Standards: Regulatory requirements, internal controls (COSO)
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(tuân thủ|compliance).*(chuyên viên|officer|manager|quy định)/i`
- **Confidence**: 92%

#### AML Specialist
- **VN titles**: Chuyên viên chống rửa tiền, AML Officer, Chuyên viên AML, Chuyên viên KYC
- **EN titles**: AML Analyst, AML Specialist, AML Officer, AML Compliance, KYC Officer, KYC Analyst
- **Confirming keywords**: 
  - Processes: KYC (Know Your Customer), CDD (Customer Due Diligence), SAR (Suspicious Activity Report) filing, transaction monitoring, sanctions screening
  - Standards: AML/CFT (Anti-Money Laundering / Counter-Terrorist Financing), FATCA, CRS
  - Tools: Sanctions screening systems, transaction monitoring systems (TMS)
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(chống rửa tiền|aml|kyc).*(chuyên viên|officer|analyst|specialist)/i`
- **Confidence**: 94%

#### Internal Controls Specialist
- **VN titles**: Chuyên viên kiểm soát nội bộ, Control Specialist, Internal Controls Manager
- **EN titles**: Control Specialist, Internal Controls Manager, Control Auditor
- **Confirming keywords**: 
  - Processes: Control design, control testing, COA remediation, control matrix, risk/control mapping
  - Standards: COSO framework, Internal Control Integrated Framework
- **Negative filters**: None (domain-specific)
- **Regex match**: `/(kiểm soát nội bộ|internal control).*(chuyên viên|specialist|manager)/i`
- **Confidence**: 88%

---

### 10. FINTECH-ADJACENT ROLES (Disambiguation Required)

#### Product Manager - Fintech (FINANCE)
- **Conditions for FINANCE classification**:
  - Primary product feature: Payment platform, lending platform, investment app, financial operations
  - Title context: "Product Manager - Fintech", "PM - Digital Finance", "PM - Financial Services"
  - Keywords: Payments, lending, FX, trade finance, investment, financial operations, API for finance
- **Conditions for TECH classification**:
  - Primary feature: Data platform, event streaming, API architecture, infrastructure
  - Keywords: Data pipeline, microservices, Kafka, event streaming, third-party integrations
- **Regex match (FINANCE)**: `/(product manager|pm).*(fintech|financial|payment|lending|investment).*(?!api architecture|data platform)/i`
- **Regex match (TECH)**: `/(product manager|pm).*(fintech|api|data|platform|infrastructure|microservices)/i` → **TECH**
- **Confidence**: 65% (high ambiguity; requires manual inspection)

#### Business Analyst - Finance Systems
- **VN titles**: Chuyên viên phân tích kinh doanh - Tài chính, Business Analyst - Finance, Chuyên viên phân tích hệ thống tài chính
- **EN titles**: Business Analyst - Finance, Financial Systems Analyst, Finance Process Analyst
- **Confirming keywords**: 
  - Processes: Finance system requirements, ERP implementation, process automation, financial reporting rules
  - Tools: SAP, Oracle, Misa
- **Negative filters**: None (domain-specific to finance)
- **Regex match**: `/(business analyst|phân tích kinh doanh).*(finance|tài chính|accounting|kế toán)/i` → **FINANCE**
- **Confidence**: 93%

#### Data Analyst - Finance
- **VN titles**: Chuyên viên phân tích dữ liệu - Tài chính, Data Analyst - Finance, Chuyên viên phân tích dữ liệu tài chính
- **EN titles**: Financial Data Analyst, Finance Data Analyst, Data Analyst - Finance
- **Confirming keywords**: 
  - Processes: Financial reporting, consolidation, audit analytics, variance analysis, monthly close reporting
  - Tools: SQL, Python, Tableau, Power BI (finance-specific dashboards)
- **Negative filters**: 
  - "Machine learning", "Predictive analytics" (without finance context) → Likely **TECH**
- **Regex match**: `/(data analyst|phân tích dữ liệu).*(finance|tài chính|financial|accounting|reporting)/i` → **FINANCE**
- **Confidence**: 88%

#### Data Analyst - Tech
- **Conditions for TECH classification**:
  - Primary domain: Machine learning, predictive analytics, data engineering, data lakes
  - Keywords: ML models, feature engineering, data pipeline, data warehouse, ETL
- **Regex match (TECH)**: `/(data analyst|data engineer).*(machine learning|ml|predictive|pipeline|warehouse|etl|data lake)/i` → **TECH**
- **Confidence**: 95% (domain-specific)

---

## Negative Filter Priority Matrix

**Apply negative filters FIRST (in order) before accepting role as FINANCE:**

| Filter | Pattern | Action |
|--------|---------|--------|
| 1. Insurance Sales | `/(nhân viên kinh doanh bảo hiểm\|insurance sales).*(commission\|chỉ tiêu\|hoa hồng)/i` | **REJECT** (Sales vertical) |
| 2. Sales Banking | `/(banking\|rm\|relationship manager).*(sales target\|commission\|cross.sell)/i` | **REJECT** (Sales vertical) |
| 3. Sales Finance Advisory | `/(tư vấn tài chính\|financial advisor).*(bán\|sell\|commission\|khai phục)/i` | **REJECT** (Sales vertical) |
| 4. IT Security Audit | `/(audit\|auditor\|control).*(security\|penetration\|vulnerability\|code review)/i` | **REJECT** (Tech vertical) |
| 5. QA Audit | `/\b(qa\|qc)\b.*(audit\|test)/i` | **REJECT** (Tech QA) |
| 6. Fintech Sales PM | `/(product manager\|pm).*(fintech\|api\|data\|platform\|infrastructure)/i` without finance keywords | **REJECT** or FLAG (Tech vertical) |

**Only if all negative filters pass**: Proceed to positive finance keyword matching.

---

## Company Allowlist

### Current Approved Finance Companies

**Banks (Tier 1–3):**
- Techcombank, BIDV, VPBank, Vietcombank, ACB, MB Bank / MBBank, Sacombank, HDBank, TPBank, VIB, OCB, SHB, LPBank, Agribank, VietinBank, BacABank

**Insurance (Underwriting & Claims):**
- Bảo Việt, Bao Viet, Manulife Vietnam, Prudential Vietnam, AIA Vietnam, FWD Vietnam, HDI Global, ICBC Vietnam

**Securities / Brokerage (Stocks, Bonds, Funds):**
- VNDirect, SSI (listed in original list)

### Recommended Additions

**Securities / Brokerage (High Confidence):**
- VDSC (Vietnam Securities Depository), HSC (Ho Chi Minh Securities), SHS (Smartinvest), ACX (Asia Capital), VCI (Vietnam Credit), HCM Securities

**Investment / Wealth Management:**
- Quỹ đầu tư (nameless fund companies; match via job description), VFMF Vietnam Fund, IMBF (listed in some postings)

**Major Corporates with Large Finance Teams:**
- Samsung Vietnam, Intel Vietnam (APAC ops), Apple Operations APAC, Pfizer Vietnam, GSK Vietnam, P&G Vietnam
  - *Note*: These have significant FP&A, Controller, Treasury teams; not primary finance companies but high-volume finance hiring

**Fintech (Emerging):**
- Momo, GrabPay, Agribank FinTech (subsidiary), Techcombank FinTech (subsidiary), Seabank, Tap.VN, Sendo Financial

### Recommended Removals

**Vingroup (REMOVE):**
- Rationale: Conglomerate with diverse verticals (real estate, retail, automotive, fintech). Jobs may be non-finance. Subcategorize if adding Techcombank FinTech (Vintech) separately.

---

## Test Cases for Implementation Validation

### Positive Test Cases (ACCEPT)

**Test 1: Kế Toán Tổng Hợp**
```
Title: "Kế Toán Tổng Hợp"
Company: "Techcombank" (matches allowlist)
Description: "Ghi sổ kế toán, lập báo cáo tài chính, quản lý chi phí"
Expected: ACCEPT (Accounting)
Validation: Matches "kế toán" pattern + company allowlist ✓
```

**Test 2: Senior Financial Analyst**
```
Title: "Senior Financial Analyst"
Company: "Samsung Vietnam"
Description: "Financial forecasting, variance analysis, budget planning, business partner to operations"
Expected: ACCEPT (FP&A)
Validation: Matches FP&A keywords (forecasting, variance, budget) + no sales indicators ✓
```

**Test 3: Tax Accountant**
```
Title: "Tax Accountant" or "Kế toán thuế"
Company: "Deloitte Vietnam"
Description: "Tax compliance, tax planning, corporate tax returns, VN tax regulations"
Expected: ACCEPT (Accounting - Tax)
Validation: Matches tax accounting pattern ✓
```

**Test 4: Internal Audit Senior**
```
Title: "Internal Audit Senior"
Company: "BIDV"
Description: "Internal control testing, risk assessment, audit scoping, process audit"
Expected: ACCEPT (Audit)
Validation: Matches internal audit + contains "control testing" (not IT security) ✓
```

**Test 5: Credit Analyst - Corporate Banking**
```
Title: "Credit Analyst - Corporate Banking"
Company: "VPBank"
Description: "Loan underwriting, credit risk assessment, covenant monitoring, LTV analysis"
Expected: ACCEPT (Banking - Credit)
Validation: Matches credit analyst pattern + banking domain ✓
```

### Negative Test Cases (REJECT)

**Test 6: Nhân viên kinh doanh bảo hiểm**
```
Title: "Nhân viên kinh doanh bảo hiểm"
Company: "Prudential Vietnam"
Description: "Tìm kiếm khách hàng, tư vấn bảo hiểm cá nhân, chỉ tiêu lợi nhuận, hoa hồng"
Expected: REJECT (Sales vertical)
Validation: Matches negative filter "nhân viên kinh doanh bảo hiểm" + "commission" keywords ✗
```

**Test 7: Sales Tư Vấn Tài Chính**
```
Title: "Tư vấn tài chính cá nhân"
Company: "Momo"
Description: "Bán sản phẩm tài chính, khai phục thị trường, hoa hồng, chỉ tiêu bán hàng"
Expected: REJECT (Sales vertical)
Validation: Matches negative filter "tư vấn tài chính" + "bán sản phẩm" + "commission" ✗
```

**Test 8: IT Auditor (Security)**
```
Title: "IT Auditor"
Company: "BIDV"
Description: "Review security controls, penetration testing, vulnerability assessment, application security"
Expected: REJECT (Tech vertical)
Validation: Matches negative filter "audit" + "penetration testing" / "vulnerability" ✗
```

**Test 9: QA Auditor**
```
Title: "QA Auditor" or "Quality Audit"
Company: "Samsung Vietnam"
Description: "Test software functionality, ensure compliance with specs, quality testing, bug tracking"
Expected: REJECT (Tech QA vertical)
Validation: Matches negative filter "qa" + "audit" + "test" ✗
```

**Test 10: Relationship Manager (Commission-Driven)**
```
Title: "Relationship Manager"
Company: "MBBank"
Description: "Develop customer relationships, cross-sell products, achieve deposit targets, sales commission"
Expected: FLAG / REJECT (Likely Sales vertical)
Validation: Matches "rm" + "sales target" / "cross-sell" + commission keyword → Assume SALES ✗
```

---

## Implementation Checklist

- [ ] Add negative filter regexes to classify.ts before positive matching
- [ ] Extend FINANCE_COMPANIES allowlist with 12–15 additions; remove Vingroup
- [ ] Implement bilingual keyword matching for 10 sub-domains
- [ ] Add fintech PM disambiguation logic
- [ ] Test against 10 test cases (5 positive, 5 negative)
- [ ] Set up quarterly review of company allowlist (fintech churn)
- [ ] Document IT audit vs financial audit distinction in team wiki
- [ ] Document insurance agent vs underwriter distinction in team wiki

---

## References

See `researcher-260603-finance-taxonomy.md` for full source citations and research methodology.

**Key sources:**
- VietnamWorks (vietnamworks.com) — 543+ accounting & finance jobs
- ACCA Global (jobs.accaglobal.com) — Professional certification pathways
- Glassdoor Vietnam — 2,039 finance jobs, market data
- Michael Page Vietnam — Recruitment agency bilingual titles
- AM Vietnam — 19 EN-VN accounting title mappings
- TopCV.vn / CareerViet.vn — VN career guides & role definitions
- VACPA (Vietnam Association of Certified Public Accountants) — CPA pathways

---

**Last Reviewed**: 2026-06-03  
**Next Review**: 2026-09-03 (quarterly)

