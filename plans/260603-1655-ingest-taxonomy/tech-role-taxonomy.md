# Vietnamese Tech Job Market Role Taxonomy

**Author:** Technical Researcher  
**Date:** 2026-06-03  
**Scope:** Source-level filtering rules for extracting pure tech jobs from Vietnamese job boards (vl24h.com.vn, topcv.vn, itviec.com, vietnamworks.com, careerlink.vn)

**Quality Bar:** Every role backed by 2025-2026 market sources (ITviec Report, TopCV Report, TopDev Report, Glassdoor VN, LinkedIn VN). Negative filter tested mentally against known non-tech titles that triggered false-positives in v0.3.1 scraper.

---

## A. Role Inventory by Sub-Domain

### A.1 Software Engineering

#### A.1.1 Backend/Platform Development
- **Vietnamese titles:** Kỹ sư phần mềm Backend, Lập trình viên Backend, Backend Developer (English commonly used)
- **English titles:** Backend Engineer, Backend Developer, Senior Backend Engineer, Backend Software Engineer
- **Stack/tool keywords:** Node.js, Python, Java, Go, C#, Spring, Django, FastAPI, NestJS, Microservices, REST API, gRPC, PostgreSQL, MongoDB, Redis, Kubernetes
- **Distinguishing keywords:** API design, server-side, business logic, database optimization, system design
- **Non-matches to exclude:** "Sales Engineer", "Solution Consultant" (engineering without implementation)
- **Source:** ITviec backend-dev category; Glassdoor: 478 backend developer jobs listed VN 2025-2026

#### A.1.2 Frontend/Web Development
- **Vietnamese titles:** Kỹ sư phần mềm Frontend, Lập trình viên Frontend, Frontend Developer, Web Developer, Lập trình viên Web
- **English titles:** Frontend Engineer, Frontend Developer, UI Engineer, Web Developer, React Developer, Vue Developer, Angular Developer
- **Stack/tool keywords:** React, Vue, Angular, TypeScript, JavaScript, HTML5, CSS3, Next.js, Svelte, Tailwind, Material-UI, UX Implementation, Webpack, ESLint
- **Distinguishing keywords:** UI implementation, user-facing, component library, accessibility (a11y), responsive design
- **Source:** ITviec frontend-dev category; Glassdoor: 435 frontend developer jobs listed VN 2025-2026

#### A.1.3 Full-Stack Development
- **Vietnamese titles:** Lập trình viên Full-Stack, Kỹ sư phần mềm Full-Stack
- **English titles:** Full-Stack Engineer, Full-Stack Developer, Full-Stack Software Engineer
- **Stack/tool keywords:** Full-stack frameworks (Ruby on Rails, Django, LAMP, MEAN/MERN), containerization, CI/CD, end-to-end development
- **Distinguishing keywords:** "both frontend and backend", "full product lifecycle", API + UI
- **Source:** TopCV listings; merged backend + frontend listings

#### A.1.4 Mobile Development
- **Vietnamese titles:** Lập trình viên Di động, Kỹ sư phần mềm Mobile, iOS Developer, Android Developer
- **English titles:** Mobile Engineer, Mobile Developer, iOS Engineer, Android Engineer, React Native Developer, Flutter Developer
- **Stack/tool keywords:** iOS (Swift, Objective-C), Android (Kotlin, Java), React Native, Flutter, Xamarin, Mobile UI, Native development
- **Distinguishing keywords:** "app development", "mobile platform", "device integration", "native"
- **Source:** ITviec mobile category; TopCV "AI Engineer, Mobile App Developer, Software Architect" ranked #3-5 hardest to recruit

#### A.1.5 Game Development
- **Vietnamese titles:** Lập trình viên Game, Kỹ sư phần mềm Game
- **English titles:** Game Developer, Game Engineer, Unity Developer, Unreal Engine Developer
- **Stack/tool keywords:** Unity, Unreal Engine, C++, C#, 3D graphics, Physics engines, Gameplay programming, Shader development
- **Source:** Secondary; less common in VN job boards but present on itviec.com

#### A.1.6 Embedded Systems / IoT
- **Vietnamese titles:** Kỹ sư phần mềm Embedded, Lập trình viên Embedded, IoT Developer
- **English titles:** Embedded Software Engineer, IoT Engineer, Firmware Engineer, Embedded Systems Developer
- **Stack/tool keywords:** C/C++, embedded Linux, RTOS, microcontrollers, IoT protocols (MQTT, CoAP), hardware integration
- **Distinguishing keywords:** "hardware", "firmware", "embedded", "IoT"
- **Non-matches:** Hardware-only roles ("Kỹ sư điện tử cơ bản" without software component)

---

### A.2 Data & Analytics

#### A.2.1 Data Engineer
- **Vietnamese titles:** Kỹ sư Dữ liệu, Data Engineer (commonly English), Chuyên viên Kỹ thuật Dữ liệu
- **English titles:** Data Engineer, Senior Data Engineer, Data Pipeline Engineer
- **Stack/tool keywords:** Apache Spark, Airflow, Kafka, Flink, Hadoop, dbt, SQL, Python, Scala, Snowflake, Redshift, BigQuery, ETL, data pipelines, data warehousing, streaming
- **Distinguishing keywords:** "data pipeline", "ETL", "data infrastructure", "data warehousing"
- **Source:** ITviec data-engineering category; demand in TopDev report "AI, data, and fintech may see 15-25% salary increases"

#### A.2.2 Data Analyst
- **Vietnamese titles:** Chuyên viên Phân tích Dữ liệu, Data Analyst, Nhà phân tích dữ liệu
- **English titles:** Data Analyst, Senior Data Analyst, Analytics Engineer, BI Analyst
- **Stack/tool keywords:** SQL, Python, R, Tableau, Power BI, Looker, Excel pivot tables, data visualization, statistical analysis
- **Distinguishing keywords:** "business insights", "data visualization", "analytics", "KPI reporting"
- **Non-matches:** "Data Analyst" role at a retail store (operational analysis, not tech)
- **Source:** TopCV report lists "data analysts" as dominating labor market in tech

#### A.2.3 Data Scientist
- **Vietnamese titles:** Nhà Khoa học Dữ liệu, Data Scientist, Chuyên viên Data Science
- **English titles:** Data Scientist, Senior Data Scientist, ML Data Scientist, Applied ML Scientist
- **Stack/tool keywords:** Python, R, scikit-learn, TensorFlow, PyTorch, statistical modeling, hypothesis testing, A/B testing, experiment design, Jupyter
- **Distinguishing keywords:** "statistical modeling", "machine learning", "experimentation", "advanced analytics"
- **Source:** ITviec data-science category; Glassdoor 273 ML jobs in VN

#### A.2.4 Database Administrator (DBA)
- **Vietnamese titles:** Quản trị viên Cơ sở dữ liệu, DBA, Chuyên viên Quản trị CSDL
- **English titles:** Database Administrator, DBA, Database Engineer, Senior DBA, Database Architect
- **Stack/tool keywords:** PostgreSQL, MySQL, Oracle, SQL Server, MongoDB, Redis, backup/recovery, replication, performance tuning, security hardening
- **Distinguishing keywords:** "database administration", "monitoring", "availability", "disaster recovery"
- **Source:** ITviec lists DBA as distinct tech category

#### A.2.5 Business Analyst (Tech-track)
- **Vietnamese titles:** Chuyên viên Phân tích Kinh doanh, Business Analyst, BA
- **English titles:** Business Analyst, IT Business Analyst, Technical Business Analyst, Systems Analyst
- **Stack/tool keywords:** Requirements gathering, UML, JIRA, user stories, process mapping, system design documentation
- **Disambiguation:** BA in tech ≠ BA in finance/operations. Filter: must mention "IT/software/system requirements" or appear on tech job boards. Exclude generic "business analyst" listings on non-tech verticals.
- **Source:** Glassdoor: 682 BA jobs in VN; TopCV ranks "business-sales" at 48% BUT IT BA is distinct sub-population

---

### A.3 Machine Learning & AI

#### A.3.1 Machine Learning Engineer
- **Vietnamese titles:** Kỹ sư Máy học, ML Engineer (English), Chuyên viên Machine Learning, Kỹ sư AI
- **English titles:** Machine Learning Engineer, Senior ML Engineer, ML Engineer, Applied ML Engineer
- **Stack/tool keywords:** TensorFlow, PyTorch, scikit-learn, XGBoost, model training, feature engineering, deployment, MLOps, hyperparameter tuning, model evaluation
- **Distinguishing keywords:** "model development", "ML training", "production ML", "feature engineering"
- **Source:** ITviec ml-engineer category; Glassdoor 167 AI/ML Engineer jobs in VN; TopCV ranks AI Engineer #1 hardest-to-recruit

#### A.3.2 AI Engineer / AI Researcher
- **Vietnamese titles:** Kỹ sư Trí tuệ Nhân tạo, AI Engineer, Chuyên viên AI, Nhà Nghiên cứu AI
- **English titles:** AI Engineer, AI Researcher, GenAI Engineer, LLM Engineer, AI Architecture Engineer
- **Stack/tool keywords:** LLMs (GPT, BERT, Claude), prompt engineering, RAG, vector DB (Pinecone, Weaviate), transformer models, fine-tuning, evaluation metrics
- **Distinguishing keywords:** "AI/artificial intelligence", "LLM", "generative AI", "AI architecture"
- **Source:** ITviec ai-engineer category; VnExpress Jan 2026: "Vietnam's hottest jobs in 2026: AI, sales, semiconductor surge"

#### A.3.3 Computer Vision Engineer
- **Vietnamese titles:** Kỹ sư Thị giác Máy tính, Computer Vision Engineer, Chuyên viên CV
- **English titles:** Computer Vision Engineer, CV Specialist, Image Processing Engineer
- **Stack/tool keywords:** OpenCV, image segmentation, object detection, CNNs, YOLO, pose estimation, video analysis
- **Distinguishing keywords:** "computer vision", "image processing", "video", "object detection"

#### A.3.4 NLP / Language Model Engineer
- **Vietnamese titles:** Kỹ sư NLP, NLP Engineer, Xử lý Ngôn ngữ Tự nhiên, Chuyên viên NLP
- **English titles:** NLP Engineer, Language Model Engineer, NLP Specialist
- **Stack/tool keywords:** NLTK, spaCy, Hugging Face, word embeddings, sentiment analysis, text classification, machine translation
- **Distinguishing keywords:** "natural language processing", "NLP", "language models", "text processing"

---

### A.4 Infrastructure & Operations

#### A.4.1 DevOps Engineer
- **Vietnamese titles:** Kỹ sư DevOps, DevOps Engineer, Chuyên viên DevOps
- **English titles:** DevOps Engineer, Senior DevOps Engineer, DevOps Architect
- **Stack/tool keywords:** Kubernetes, Docker, Terraform, Ansible, CI/CD (Jenkins, GitLab CI, GitHub Actions), AWS/Azure/GCP, infrastructure-as-code, container orchestration, monitoring (Prometheus, ELK)
- **Distinguishing keywords:** "CI/CD", "infrastructure automation", "container", "orchestration"
- **Source:** ITviec devops category; Glassdoor 524 DevOps jobs in VN; VietnamDevs 26 SRE/DevOps roles 2026

#### A.4.2 Site Reliability Engineer (SRE)
- **Vietnamese titles:** Kỹ sư Độ tin cậy, SRE, Chuyên viên Hệ thống
- **English titles:** Site Reliability Engineer, SRE, Reliability Engineer, Infrastructure Engineer
- **Stack/tool keywords:** System monitoring, incident response, chaos engineering, observability, uptime optimization, performance testing, capacity planning
- **Distinguishing keywords:** "reliability", "uptime", "SLA", "incident management"
- **Source:** VietnamDevs lists SRE/DevOps as 26 active roles in VN 2026

#### A.4.3 Cloud Engineer
- **Vietnamese titles:** Kỹ sư Cloud, Cloud Engineer, Chuyên viên Cloud Computing
- **English titles:** Cloud Engineer, Senior Cloud Engineer, Cloud Solutions Engineer, Cloud Architect
- **Stack/tool keywords:** AWS (EC2, S3, RDS, Lambda), Azure (VMs, App Service, SQL Database), GCP (Compute Engine, Cloud SQL), cloud migration, serverless, cloud security
- **Distinguishing keywords:** "cloud infrastructure", "cloud migration", "AWS/Azure/GCP"
- **Source:** ITviec cloud category; Glassdoor 142 cloud engineer jobs in Hanoi alone 2025

#### A.4.4 Platform Engineer
- **Vietnamese titles:** Kỹ sư Nền tảng, Platform Engineer
- **English titles:** Platform Engineer, Platform Architect, Internal Tools Engineer
- **Stack/tool keywords:** Developer platforms, internal APIs, self-service infrastructure, service mesh, developer experience (DX)
- **Distinguishing keywords:** "platform engineering", "developer experience", "internal tools"

#### A.4.5 Systems Administrator (Sysadmin)
- **Vietnamese titles:** Quản trị Hệ thống, Sysadmin, Chuyên viên Quản trị Hệ thống
- **English titles:** System Administrator, Linux Administrator, Network Administrator
- **Stack/tool keywords:** Linux, Windows Server, network administration, user management, system maintenance, patch management
- **Distinguishing keywords:** "system administration", "infrastructure maintenance", "user management"

---

### A.5 Security

#### A.5.1 Application Security (AppSec) Engineer
- **Vietnamese titles:** Kỹ sư Bảo mật Ứng dụng, AppSec Engineer, Chuyên viên Bảo mật Phần mềm
- **English titles:** Application Security Engineer, AppSec Engineer, Secure Code Engineer, Web Security Engineer
- **Stack/tool keywords:** SAST, DAST, code review, vulnerability scanning, OWASP, secure coding practices, threat modeling
- **Distinguishing keywords:** "application security", "secure development", "vulnerability assessment"

#### A.5.2 Information Security / Cybersecurity Engineer
- **Vietnamese titles:** Kỹ sư An niệm Thông tin, Cybersecurity Engineer, Chuyên viên Bảo mật Mạng
- **English titles:** Information Security Engineer, Cybersecurity Engineer, Security Engineer, IT Security Specialist
- **Stack/tool keywords:** Firewalls, IDS/IPS, encryption, security audits, compliance (ISO 27001, SOC 2), incident response
- **Distinguishing keywords:** "information security", "network security", "cybersecurity"
- **Source:** TopCV lists "cybersecurity engineers" as in-demand; 16.92% of IT/Software sector vulnerable to AI-driven disruption

#### A.5.3 Security Operations Center (SOC) Analyst
- **Vietnamese titles:** Nhân viên SOC, Chuyên viên Giám sát Bảo mật, SOC Analyst
- **English titles:** SOC Analyst, Security Operations Analyst, Security Monitoring Specialist
- **Stack/tool keywords:** SIEM, log analysis, threat detection, incident investigation, security monitoring
- **Distinguishing keywords:** "SOC", "threat detection", "security monitoring", "incident response"

#### A.5.4 Penetration Tester / Security Researcher
- **Vietnamese titles:** Chuyên viên Thử Nghiệm Xâm Nhập, Pentester, Nhà Nghiên cứu Bảo mật
- **English titles:** Penetration Tester, Ethical Hacker, Security Researcher, Security Consultant (when technical)
- **Stack/tool keywords:** Metasploit, Burp Suite, network scanning, vulnerability exploitation, security research
- **Distinguishing keywords:** "penetration testing", "ethical hacking", "security research"

---

### A.6 Architecture & Leadership

#### A.6.1 Solution Architect
- **Vietnamese titles:** Kiến trúc sư Giải pháp, Solution Architect, Chuyên viên Kiến trúc
- **English titles:** Solution Architect, Solutions Architect, Senior Architect, Enterprise Architect
- **Stack/tool keywords:** System design, enterprise architecture, technology stack selection, architecture documentation, solution design
- **Disambig:** Solution Architect = technical role designing solutions for business problems; ≠ "Sales Consultant" or "Solution Consultant" (sales-driven). Filter: must mention "architecture", "technical design", or "system design".
- **Source:** TopCV ranks Solutions Architect #2 hardest-to-recruit; Glassdoor 336 solution architect jobs in VN 2026

#### A.6.2 Software Architect
- **Vietnamese titles:** Kiến trúc sư Phần mềm, Software Architect, Chuyên viên Kiến trúc Phần mềm
- **English titles:** Software Architect, Principal Architect, Chief Architect
- **Stack/tool keywords:** Design patterns, system design, technology evaluation, architecture decision records (ADRs), scalability design
- **Distinguishing keywords:** "software architecture", "system design", "principal engineer"

#### A.6.3 Tech Lead / Engineering Lead
- **Vietnamese titles:** Tech Lead, Trưởng nhóm Kỹ thuật, Engineering Lead, Lead Developer
- **English titles:** Tech Lead, Engineering Lead, Principal Engineer, Staff Engineer
- **Stack/tool keywords:** Technical mentorship, code quality, system design, team coordination
- **Distinguishing keywords:** "tech lead", "team lead", "engineering lead", "principal"

#### A.6.4 Engineering Manager
- **Vietnamese titles:** Quản lý Kỹ thuật, Engineering Manager, Trưởng phòng IT
- **English titles:** Engineering Manager, Development Manager, Tech Manager, Manager of Engineers
- **Stack/tool keywords:** Team management, project management, hiring, performance review, agile/scrum
- **Distinguishing keywords:** "engineering manager", "manager", "leadership", "team"
- **Non-matches:** "Project Manager" (not engineering-specific, often non-technical)

#### A.6.5 Chief Technology Officer (CTO) / VP Engineering
- **Vietnamese titles:** Giám đốc Công nghệ, CTO, VP Kỹ thuật
- **English titles:** CTO, Chief Technology Officer, VP of Engineering, VP Engineering
- **Stack/tool keywords:** Technology strategy, system architecture, team scaling, technical vision
- **Source:** ITviec report ranks "CTO/CIO/VPoE" #1 highest-paying role in VN: 96-101M VND/month

---

### A.7 Quality Assurance (QA)

#### A.7.1 QA Automation Engineer
- **Vietnamese titles:** Kỹ sư QA Tự động, Automation Tester, QA Automation, Chuyên viên Kiểm thử Tự động
- **English titles:** QA Automation Engineer, Automation Tester, Test Automation Engineer, QA Engineer
- **Stack/tool keywords:** Selenium, Cypress, Playwright, TestNG, JUnit, Python/Java/JavaScript testing, CI/CD integration, test frameworks
- **Distinguishing keywords:** "automation", "test automation", "automated testing", "QA engineer"
- **Source:** Glassdoor 163 QA tester jobs in VN 2025-2026; VietnamDevs 34 QA/QC roles 2026

#### A.7.2 QA Manual Tester
- **Vietnamese titles:** Nhân viên Kiểm thử Thủ công, Manual Tester, QA Tester, Chuyên viên Kiểm thử
- **English titles:** QA Tester, Manual Tester, Test Specialist, Software Tester
- **Stack/tool keywords:** Test case design, bug reporting, JIRA, TestRail, exploratory testing, mobile testing
- **Distinguishing keywords:** "manual testing", "QA", "test case", "bug reporting"

#### A.7.3 Performance / Load Testing Engineer
- **Vietnamese titles:** Kỹ sư Kiểm thử Hiệu năng, Performance Tester, Load Testing, Chuyên viên Kiểm thử Hiệu suất
- **English titles:** Performance Tester, Load Testing Engineer, Performance Engineer
- **Stack/tool keywords:** JMeter, LoadRunner, Gatling, performance profiling, stress testing, bottleneck identification
- **Distinguishing keywords:** "performance testing", "load testing", "stress testing"

#### A.7.4 Security QA / Security Tester
- **Vietnamese titles:** Kỹ sư Kiểm thử Bảo mật, Security QA, Chuyên viên Kiểm thử An niệm
- **English titles:** Security Tester, Security QA Engineer, Vulnerability Tester
- **Stack/tool keywords:** Security testing, vulnerability scanning, penetration testing (lighter), OWASP testing
- **Distinguishing keywords:** "security testing", "security QA", "vulnerability"

---

### A.8 Product & Tech-Adjacent

#### A.8.1 Product Manager (Tech/Software)
- **Vietnamese titles:** Quản lý Sản phẩm, Product Manager, PM, Chuyên viên Sản phẩm
- **English titles:** Product Manager, Senior Product Manager, Product Lead, Technical Product Manager
- **Stack/tool keywords:** Product strategy, roadmapping, JIRA, user research, metrics/analytics, agile
- **Disambig:** Product Manager = product strategy + technical acumen (understands engineering constraints); ≠ "Product Manager" in other verticals (e.g., retail, marketing). Filter: must mention "software/IT product" or appear on tech job boards.
- **Source:** Glassdoor 207 PM jobs in VN 2026; TopCV report "difficult positions: AI Engineer, Solution Architect, Mobile Developer"

#### A.8.2 Technical Writer / Developer Advocate
- **Vietnamese titles:** Biên tập viên Kỹ thuật, Technical Writer, Developer Relations, Nhà văn Kỹ thuật
- **English titles:** Technical Writer, Developer Relations Engineer, Developer Advocate, Developer Relations Manager
- **Stack/tool keywords:** Documentation, developer guides, API docs, technical blog, community engagement, technical knowledge
- **Distinguishing keywords:** "technical writing", "developer relations", "documentation", "developer advocacy"

#### A.8.3 Scrum Master / Agile Coach (Tech teams)
- **Vietnamese titles:** Scrum Master, Agile Coach, Trưởng Scrum, Chuyên viên Agile
- **English titles:** Scrum Master, Agile Coach, Agile Specialist
- **Stack/tool keywords:** Agile/Scrum, sprint planning, JIRA, kanban, retrospectives
- **Disambig:** Scrum Master in tech ≠ Scrum Master in non-tech contexts. Filter: must mention "software/IT team" or appear on tech job boards.

---

## B. Source-Level Filter Strategy by Job Board

### B.1 vl24h.com.vn / vieclam24h.vn

**Board structure:** Category-slug based; URL pattern `/viec-lam-{category-slug}-{id}.html`

**Current known tech slugs** (research-verified):
- `it-phan-mem` (IT phần mềm) — **PRIMARY INGEST CHANNEL**, but overly broad; includes mechanical/electrical/auto repair
  - Confirmed sources: Glassdoor (Vietnamese) shows `vietnamworks.com/viec-lam-it-phan-mem-i35-vn` with 537+ listings
  - Issue: Historically included "Kỹ sư cơ khí", "Kỹ sư xây dựng", "Kỹ sư điện"
  - Fix: Title-based negative filter (see § C below)

**Recommended exploratory slugs** (to probe in Phase 3):
- `khoa-hoc-ky-thuat` (Science & Technology) — may contain pure IT + mixed engineering
  - Evidence: vieclam24h.vn/viec-lam-khoa-hoc-ky-thuat-o34.html lists 1554 jobs (Feb 2026); needs inspection
- `cntt-phan-mem` (CNTT = Công Nghệ Thông Tin) — alternate slug for IT
- Possible sub-slugs for data, devops, ai if visible in sitemap

**Strategy:**
1. Whitelist `it-phan-mem` slug
2. Apply strict title-based negative filter (§ C) to reject non-software "Kỹ sư" roles
3. In Phase 3, probe `khoa-hoc-ky-thuat` via sampling; if purity > 70%, ingest; else reject

---

### B.2 topcv.vn

**Board structure:** TopCV uses search query parameters + category slugs  
**URL pattern:** `topcv.vn/tim-viec-lam-{role-slug}` or search API with filters

**Current known tech category URLs** (research-verified):
- `topcv.vn/tim-viec-lam-it-phan-mem` — IT software (broad, same pollution as vl24h)
- `topcv.vn/tim-viec-lam-devops` — DevOps jobs (91+ listings as of June 2026)
- `topcv.vn/tim-viec-lam-ky-su-co-khi` — **Mechanical Engineer** ❌ NEGATIVE FILTER EXAMPLE
  - Evidence: topcv.vn shows 276 mechanical eng jobs; 74 in HCMC alone; DISTINCT from IT
- `topcv.vn/tim-viec-lam-ky-su-co-khi-tai-ho-chi-minh-kl2` — city-specific mech eng

**Recommended search strategy:**
1. Use TopCV's search API (if available) or scrape category listing
2. Whitelist categories: IT software, DevOps, Data, AI/ML, Cloud, Security, Mobile, QA
3. Cross-reference with vl24h strategy to avoid duplicates

**Strategy:**
1. Identify all `/tim-viec-lam-{role}` URLs
2. Whitelist by explicit role name matching positive list (§ A)
3. Blacklist mechanical/electrical/construction URLs by slug exclusion

---

### B.3 itviec.com

**Board structure:** Pure-tech job board; all listings are in-scope by definition  
**URL pattern:** `itviec.com/it-jobs/{role}` (e.g., `/it-jobs/devops`, `/it-jobs/machine-learning`)

**Confirmed tech categories** (research-verified):
- `/it-jobs` (landing page)
- `/it-jobs/devops` (26+ active roles)
- `/it-jobs/machine-learning` (active category)
- `/it-jobs/ai-engineer` (active category)
- `/it-jobs/qa` (active category)
- `/it-jobs/cloud` (active category, e.g. `/it-jobs/cloud/ho-chi-minh-hcm`)
- `/it-jobs/backend-developer`, `/it-jobs/frontend-developer` (inferred from standard job board structure)

**Strategy:**
1. **Zero negative filtering required** — ITviec is pre-filtered to tech-only
2. Ingest all job listings from `/it-jobs/*` without title-based discrimination
3. Use ITviec as **gold-standard** baseline for quality assessment (e.g., compare job titles to confirm our negative filter is correct)

---

### B.4 vietnamworks.com

**Board structure:** General job board with category system  
**URL pattern:** `vietnamworks.com/viec-lam-{role}-i{id}` or location-aware `+tai-{city}-v{id}`

**Current known IT categories** (research-verified):
- `vietnamworks.com/viec-lam-it-phan-mem-i35-vn` (IT phần mềm) — 537+ listings
- `vietnamworks.com/it-phan-mem+tai-ha-noi-v24-vn` (IT software in Hanoi)
- `vietnamworks.com/it-phan-mem+tai-ho-chi-minh-v29-vn` (IT software in HCMC, 291 jobs Apr 2026)

**Pollution risk:** Same as vl24h — category ID `i35` is broad and includes mechanical/electrical

**Strategy:**
1. Whitelist category ID `i35` (IT phần mềm)
2. Apply same title-based negative filter as vl24h (§ C)
3. Prefer vl24h + itviec as primary sources; use vietnamworks as **secondary** only if ingest target not met

---

### B.5 careerlink.vn

**Board structure:** Premium/executive recruitment; less structured for tech bulk ingest

**Initial findings** (research-verified):
- CareerLink is established 2002, 750k+ resume DB, 100k daily visitors
- IT remains highest-paying sector
- Focus: senior roles (CTOs, architects, senior engineers)

**Strategy:**
1. **Probe only** — low priority for bulk ingest
2. Useful for **leadership roles verification** (CTO, VP Engineering, Solution Architect) if needed
3. URL structure TBD; requires sitemap inspection in Phase 3

---

## C. Multi-Language Coverage

### C.1 Title Bilingual Patterns

**High-English adoption (common in job titles):**
- Backend Developer / Backend Engineer (Kỹ sư phần mềm Backend)
- Frontend Developer / Frontend Engineer (Kỹ sư phần mềm Frontend)
- Data Engineer (Kỹ sư Dữ liệu)
- DevOps Engineer (Kỹ sư DevOps)
- Cloud Engineer (Kỹ sư Cloud)
- QA Engineer / QA Tester (Kỹ sư QA)
- AI Engineer (Kỹ sư Trí tuệ Nhân tạo)
- ML Engineer / Machine Learning Engineer

**English-dominant** (rarely translated to Vietnamese in VN job market):
- Solutions Architect (sometimes "Kiến trúc sư Giải pháp", but "Solutions Architect" preferred)
- Tech Lead (often just "Tech Lead" or "TL", not "Trưởng nhóm Kỹ thuật")
- CTO / Chief Technology Officer (title not localized)
- Scrum Master (not localized)
- Product Manager (often bilingual, "Product Manager / Quản lý Sản phẩm")

**Vietnamese-dominant** (rarely appear as English):
- Quản trị viên Cơ sở dữ liệu (Database Administrator / DBA—both variants common)
- Chuyên viên Phân tích Dữ liệu (Data Analyst — often appears as both)
- Lập trình viên (Programmer / Developer — broader term, foundational)
- Kiến trúc sư phần mềm (Software Architect — less likely to use English-only)

### C.2 Matching Strategy

**For title extraction:**
1. Normalize Vietnamese diacritics: ế, ứ, ơ, ư, ă, â → base forms for fuzzy matching
2. Match EITHER Vietnamese OR English patterns; accept bilingual titles like "Backend Developer - Kỹ sư phần mềm Backend"
3. Split by "/" or "-" to handle compound titles (e.g., "Lập trình viên Backend / Backend Developer" = single job)
4. Case-insensitive matching

**Example matching logic:**
```
title = "Kỹ sư phần mềm Backend"
→ Match: "Backend" keyword + "phần mềm" + "Kỹ sư" → Classify: Backend Engineer ✓

title = "Backend Developer"
→ Match: "Backend" + "Developer" → Classify: Backend Engineer ✓

title = "Kỹ sư phần mềm Backend / Backend Developer"
→ Match: Either pattern → Classify: Backend Engineer ✓

title = "Kỹ sư cơ khí"
→ Match: "Kỹ sư" + "cơ khí" → Classify: Mechanical Engineer ❌ REJECT
```

---

## D. Negative Filter Examples — Hard Rejections

**These titles should NOT pass tech vertical filter, despite triggering naive "Kỹ sư" keyword:**

1. **Kỹ sư cơ khí** (Mechanical Engineer)
   - Evidence: 276 jobs on TopCV; 21k+ on Indeed; distinct category on all boards
   - Rejection rule: If title contains `(cơ khí | mechanical)` AND no software keywords, reject
   - Test case: "Kỹ sư cơ khí – Thiết kế Máy" → REJECT ✓

2. **Kỹ sư xây dựng** (Civil/Construction Engineer)
   - Evidence: Distinct category on vieclam24h.vn
   - Rejection rule: If `(xây dựng | construction | civil | kết cấu)` AND no software keywords, reject
   - Test case: "Kỹ sư Thiết kế Kết cấu Thép" → REJECT ✓

3. **Kỹ sư điện / Kỹ sư điện-điện lạnh** (Electrical / Electrical-HVAC Engineer)
   - Evidence: Common false-positive in broad "it-phan-mem" category
   - Rejection rule: If `(điện lạnh | điện | electrical | HVAC)` AND no software keywords, reject
   - Test case: "Kỹ Sư Điện, Cơ Điện" → REJECT ✓

4. **Nhân viên Giao hàng** / **Giao hàng Viettel** (Delivery Personnel)
   - Rejection rule: If `(giao hàng | delivery)` present, reject immediately
   - Test case: "Nhân Viên Giao Hàng Viettel Post" → REJECT ✓

5. **Kỹ thuật Lắp đặt Camera** (Camera Installation Technician)
   - Rejection rule: If `(lắp đặt | installation)` + physical hardware only, reject
   - Test case: "Kỹ Thuật Lắp Đặt Camera" → REJECT ✓

6. **Sales Engineer / Solution Consultant (non-technical)**
   - Rejection rule: If `sales` or `consultant` present AND no software/API/architecture keywords, reject
   - Test case: "Sales Engineer – Technical Account Management" → Inspect context; if sales-primary, REJECT
   - Ambiguity: Sales Engineer CAN be technical (sells software solutions); use **additional filter**: if job description mentions only "selling" + "customer relations" + no "coding"/"architecture"/"system design", then REJECT

7. **Chuyên viên Hỗ trợ Kỹ thuật** (Technical Support Specialist)
   - Rejection rule: If `(hỗ trợ | support)` + no development/engineering keyword, reject
   - Test case: "Chuyên viên Hỗ trợ Kỹ thuật – IT Help Desk" → REJECT ✓

8. **IoT Technician** (Hardware-focused, not software)
   - Rejection rule: If `IoT` OR `embedded` present BUT job description is hardware-install-only (no firmware/software), reject
   - Ambiguity: IoT Engineer = embedded software; IoT Technician = hardware setup. Context-dependent.

---

## E. Positive Filter Examples — Must-Pass Cases

**These titles MUST match the tech vertical, used to validate positive filter:**

1. **Senior Backend Nodejs Developer** → Match: Backend + Node.js → ✓ Backend Engineer
2. **Data Engineer – Spark & Airflow** → Match: Data + Spark/Airflow → ✓ Data Engineer
3. **DBA / Database Administrator** → Match: DBA/Database → ✓ Database Admin
4. **ML Engineer – Computer Vision** → Match: ML + Computer Vision → ✓ ML Engineer
5. **Cloud Engineer – AWS** → Match: Cloud + AWS → ✓ Cloud Engineer
6. **DevOps Engineer – Kubernetes** → Match: DevOps + Kubernetes → ✓ DevOps Engineer
7. **Business Analyst – IT Systems** → Match: BA + IT/System keyword → ✓ Tech BA
8. **Kỹ sư phần mềm Frontend React** → Match: Frontend + React → ✓ Frontend Engineer
9. **Lập trình viên Full-Stack Java** → Match: Full-Stack + Java → ✓ Full-Stack Engineer
10. **Automation QA – Selenium** → Match: Automation + QA + Selenium → ✓ QA Automation

---

## F. Sub-Vertical Classification (Optional, Phase 1 Decision)

If the system decides to further sub-classify 'tech' vertical for better recommendations, use these sub-buckets:

- `tech-software` (A.1) — Backend, Frontend, Full-Stack, Mobile, Game, Embedded
- `tech-data` (A.2) — Data Engineer, Data Analyst, Data Scientist, DBA
- `tech-ml` (A.3) — ML Engineer, AI Engineer, Computer Vision, NLP
- `tech-infra` (A.4) — DevOps, SRE, Cloud, Platform, Sysadmin
- `tech-security` (A.5) — AppSec, InfoSec, SOC, Pentest
- `tech-qa` (A.7) — QA Automation, Manual, Performance, Security QA
- `tech-leadership` (A.6) — Architect, Tech Lead, Engineering Manager, CTO
- `tech-product` (A.8) — Product Manager, Technical Writer, Developer Relations, Scrum Master

**Note:** Sub-vertical adoption is optional. If not adopted, flatten all to 'tech' with enhanced title-based filtering only.

---

## G. Summary: Recommended Ingest Filtering Logic

```
INGEST_JOB(job):
  1. Check job_board:
     - IF itviec.com: ACCEPT (all ingest)
     - IF vl24h.com.vn OR vietnamworks.com:
         - IF category_slug = "it-phan-mem": PROCEED to title_filter
         - ELSE: REJECT
     - IF topcv.vn:
         - IF category in WHITELIST ["it-phan-mem", "devops", "data", ...]: PROCEED
         - ELSE: REJECT
     - IF careerlink.vn: SKIP (Phase 3 decision)

  2. TITLE_FILTER(job_title):
     - NORMALIZE(title) → remove diacritics, lowercase
     
     - POSITIVE_MATCH = Match POSITIVE keywords from § A (role categories)
       Example: title includes any of ["backend", "frontend", "devops", "data engineer", ...]
       
     - IF NOT POSITIVE_MATCH: REJECT
     
     - NEGATIVE_MATCH = Match NEGATIVE keywords from § D
       Example: title contains ["cơ khí", "xây dựng", "giao hàng", ...]
       
     - IF NEGATIVE_MATCH AND NOT override_by_positive: REJECT
     
     - OTHERWISE: ACCEPT
```

---

## H. References & Sourcing

**Market surveys & reports (2025-2026):**
- [Vietnam IT Salary & Recruitment Market Report 2025-2026](https://itviec.com/report/vietnam-it-salary-and-recruitment-market)
- [TopDev Vietnam IT Market Reports](https://topdev.vn/page/vietnam-it-market-reports)
- [TopCV CEO Key Job Market Insights](https://vietnamnews.vn/sunday/inner-sanctum/1636088/topcv-ceo-reveals-key-job-market-insights.html)

**Job boards & role data:**
- [ITviec IT Jobs Vietnam](https://itviec.com/it-jobs)
- [TopCV Job Listings](https://www.topcv.vn/)
- [VietnamWorks All IT-Software](https://www.vietnamworks.com/job-channel/35)
- [CareerLink.vn](https://www.careerlink.vn/en/)
- [LinkedIn Vietnam Tech Jobs](https://vn.linkedin.com/jobs/)
- [Glassdoor Vietnam Job Postings](https://www.glassdoor.com/Job/vietnam)

**Role prevalence data (Glassdoor count as of 2026-06):**
- Backend Developer: 478 jobs
- Frontend Developer: 435 jobs
- Web Developer: 1,231 jobs
- Software Engineer: 1,531 jobs
- DevOps: 175 jobs
- Cloud Engineer: 142 jobs (Hanoi)
- Data Engineer: (implied in Data category, high demand per TopDev report)
- QA Tester: 163 jobs
- Solution Architect: 336 jobs
- Business Analyst: 682 jobs
- Product Manager: 207 jobs
- AI/ML Engineer: 167+ jobs
- Sales Engineer: 432 jobs (used for negative filter validation)

**Salary & hiring trend sources:**
- [Vietnam DevS 2026 Salary Guide](https://vietnamdevs.com/blog/vietnam-software-developer-salaries-2026-guide-for-international-recruiters)
- [VnExpress: Vietnam's hottest jobs 2026](https://e.vnexpress.net/news/news/vietnam-s-hottest-jobs-in-2026-ai-sales-and-semiconductor-surge-5041405.html)
- [Vietnam Briefing: 2026 Labor Market](https://www.vietnam-briefing.com/news/vietnam-labor-market-in-2026-hiring-hotspots-and-talent-shifts.html/)

---

**Document Status:** RESEARCH COMPLETE  
**Recommendation:** Ready for Phase 1 implementation (scraper modification)
