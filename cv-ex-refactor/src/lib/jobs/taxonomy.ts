// Single source of truth for ingest vertical / sub-vertical classification.
// Drives BOTH the pre-scrape URL-slug filter (scrape-vl24h.ts / topcv / vnw)
// AND the post-ingest fallback classifier (classify.ts).
//
// Add a new sub-domain → update SubDomain entry in TAXONOMY → tests in
// taxonomy.test.ts must still pass. Add a new source board → add a `Source`
// member + extend `sourceSlugs` per sub-domain.

import type { Vertical } from './types';

export type Source = 'vl24h' | 'topcv' | 'vnw' | 'itviec';

export interface SubDomain {
  /** Stable id stored on Job.subVertical, e.g. 'tech.software', 'sales.field-b2b'. */
  id: string;
  vertical: Vertical;
  /** Title patterns that put a job INTO this sub-domain (VN + EN). */
  titlesPositive: RegExp;
  /**
   * URL category slugs per source board where this sub-domain may live.
   * The slug check is an inclusive gate — a slug here means "candidate", not
   * "guaranteed match"; the title regex is the second filter.
   */
  sourceSlugs: Partial<Record<Source, string[]>>;
}

export interface VerticalTaxonomy {
  vertical: Vertical;
  subDomains: SubDomain[];
  /** Vertical-wide negative regex — reject the job regardless of slug match. */
  titlesNegative: RegExp;
}

// ── tech ─────────────────────────────────────────────────────────────────
const TECH_SLUGS_VL24H = ['it-phan-mem', 'it-phan-cung-mang', 'phan-tich-thong-ke-du-lieu'];
const TECH_NEGATIVE = /(co[ -]?khi|c[oơ] kh[ií]|ki[eế]n tr[uú]c s[uư]|x[aâ]y d[uự]ng|c[aâ]u [dđ][uư][oờ]ng|sales engineer|kỹ sư bán hàng|delivery|giao h[aà]ng|customer service|hospitality|nh[aâ]n vi[eê]n giao|t[ai][ix]e?)/iu;

const TECH_TAXONOMY: VerticalTaxonomy = {
  vertical: 'tech',
  titlesNegative: TECH_NEGATIVE,
  subDomains: [
    {
      id: 'tech.software',
      vertical: 'tech',
      titlesPositive: /(software (engineer|developer)|backend|back[- ]?end|frontend|front[- ]?end|full[- ]?stack|mobile (developer|engineer)|ios|android|game (developer|programmer)|embedded|developer|programmer|lập trình|kỹ sư phần mềm|chuyên viên triển khai|implementation (engineer|consultant|specialist)|integration engineer|\berp\b|node\.?js|react|vue|angular|java|python|golang|ruby|php|\.net|c\+\+|kotlin|swift)/iu,
      sourceSlugs: {
        vl24h: TECH_SLUGS_VL24H,
        topcv: ['viec-lam-it', 'tim-viec-lam-it-phan-mem', 'tim-viec-lam-lap-trinh-vien', 'tim-viec-lam-cong-nghe-thong-tin-cr257'],
        vnw: ['software-engineer-kv', 'lap-trinh-vien-kv', 'java-developer-kv', 'python-developer-kv', 'android-developer-kv'],
      },
    },
    {
      id: 'tech.data',
      vertical: 'tech',
      // Short tokens (\bbi\b, \bba\b, \bdba\b) need word boundaries — bare
      // `bi`/`ba` matched substrings of unrelated words like "specialist".
      titlesPositive: /(data (engineer|analyst|scientist|architect|engineering|consultant)|business analy(?:st|sist)|business intelligence|\bbi\b|\bba\b(?! sale)|\bdba\b|database (admin|engineer)|\betl\b|\bspark\b|airflow|snowflake|bigquery|redshift|chuyên viên phân tích dữ liệu|kỹ sư dữ liệu)/iu,
      sourceSlugs: {
        vl24h: ['phan-tich-thong-ke-du-lieu', 'it-phan-mem'],
        topcv: ['tim-viec-lam-data-engineer'],
        vnw: ['data-engineer-kv', 'data-analyst-kv', 'data-scientist-kv', 'business-analyst-kv'],
      },
    },
    {
      id: 'tech.ml-ai',
      vertical: 'tech',
      // Short tokens (\bml\b, \bai\b, \bllm\b) need word boundaries — bare
      // `ai` matched substrings like "chAIn" in "supply chain".
      titlesPositive: /(machine learning|\bml\b|\bai\b|artificial intelligence|deep learning|computer vision|cv engineer|\bnlp\b|natural language|\bllm\b|generative ai|chatbot engineer|kỹ sư trí tuệ nhân tạo|kỹ sư máy học)/iu,
      sourceSlugs: {
        vl24h: ['it-phan-mem', 'phan-tich-thong-ke-du-lieu'],
        vnw: ['machine-learning-kv', 'ai-engineer-kv', 'artificial-intelligence-kv'],
      },
    },
    {
      id: 'tech.infra',
      vertical: 'tech',
      titlesPositive: /(devops|sre|site reliability|cloud (engineer|architect)|platform engineer|sysadmin|system admin(?:istrator)?|infrastructure engineer|kubernetes|terraform|aws|gcp|azure|kỹ sư hệ thống|kỹ sư cloud|kỹ sư devops|quản trị hệ thống|vận hành hệ thống|chuyên viên quản trị (hệ thống|mạng))/iu,
      sourceSlugs: {
        vl24h: ['it-phan-mem', 'it-phan-cung-mang'],
        vnw: ['quan-tri-he-thong-kv', 'linux-kv'],
      },
    },
    {
      id: 'tech.security',
      vertical: 'tech',
      titlesPositive: /(security engineer|cyber ?security|infosec|appsec|application security|soc analyst|penetration test|pentest|red team|blue team|it security|security compliance|kỹ sư an toàn thông tin|chuyên viên bảo mật)/iu,
      sourceSlugs: {
        vl24h: ['it-phan-mem', 'it-phan-cung-mang'],
        vnw: ['security-kv'],
      },
    },
    {
      id: 'tech.architecture',
      vertical: 'tech',
      titlesPositive: /(solution architect|software architect|technical lead|tech lead|engineering manager|em lead|cto|principal engineer|kiến trúc sư phần mềm|\bit (manager|lead|director|head|project manager)\b|head of (it|engineering|cntt)|trưởng phòng (it|cntt)|trưởng bộ phận (it|cntt))/iu,
      sourceSlugs: {
        vl24h: ['it-phan-mem'],
        vnw: ['solution-architect-kv', 'cto-kv'],
      },
    },
    {
      id: 'tech.qa',
      vertical: 'tech',
      titlesPositive: /(qa (engineer|automation|manual|tester|lead)|test (engineer|automation|lead)|sdet|quality (assurance|engineer) (engineer|software)?|automation tester|performance test|kỹ sư kiểm thử|chuyên viên qa)/iu,
      sourceSlugs: { vl24h: ['it-phan-mem'] },
    },
    {
      id: 'tech.product-tech',
      vertical: 'tech',
      titlesPositive: /(product manager (tech|technical)|technical product|technical writer|developer relations|devrel|scrum master|agile coach|technical program manager|tpm)/iu,
      sourceSlugs: { vl24h: ['it-phan-mem'] },
    },
  ],
};

// ── marketing ────────────────────────────────────────────────────────────
const MARKETING_SLUGS_VL24H = ['marketing', 'thiet-ke-sang-tao-nghe-thuat', 'thong-tin-truyen-thong-quang-cao', 'truyen-hinh-bao-chi-bien-tap'];
const MARKETING_NEGATIVE = /(sales marketing|telesales|tele-sales|brand ambassador.*(commission|hoa h[oồ]ng)|marketing engineer.*(sales|customer)|ho[ạa] h[oồ]ng b[aá]n h[aà]ng)/iu;

const MARKETING_TAXONOMY: VerticalTaxonomy = {
  vertical: 'marketing',
  titlesNegative: MARKETING_NEGATIVE,
  subDomains: [
    {
      id: 'marketing.brand-strategy',
      vertical: 'marketing',
      titlesPositive: /(brand (manager|director|specialist|strategist)|marketing (manager|director|strategist|lead)|chief marketing officer|cmo|trưởng phòng marketing|giám đốc marketing)/iu,
      sourceSlugs: {
        vl24h: ['marketing'],
        vnw: ['brand-manager-kv', 'marketing-kv'],
      },
    },
    {
      id: 'marketing.digital',
      vertical: 'marketing',
      titlesPositive: /(digital marketing|performance marketing|seo|sem|programmatic|affiliate|paid media|facebook ads|google ads|tiktok ads|chuyên viên digital|chuyên viên seo)/iu,
      sourceSlugs: {
        vl24h: ['marketing'],
        vnw: ['digital-marketing-kv'],
      },
    },
    {
      id: 'marketing.content',
      vertical: 'marketing',
      titlesPositive: /(content (writer|marketing|manager|creator|specialist|editor)|copywriter|copywriting|seo writer|editorial|content strategist|biên tập viên|chuyên viên content|người viết nội dung)/iu,
      sourceSlugs: {
        vl24h: ['marketing', 'truyen-hinh-bao-chi-bien-tap'],
        vnw: ['content-marketing-kv'],
      },
    },
    {
      id: 'marketing.social',
      vertical: 'marketing',
      titlesPositive: /(social media|community manager|influencer (marketing|manager)|smm|chuyên viên social|quản lý mạng xã hội)/iu,
      sourceSlugs: { vl24h: ['marketing', 'thong-tin-truyen-thong-quang-cao'] },
    },
    {
      id: 'marketing.creative',
      vertical: 'marketing',
      titlesPositive: /(art director|graphic designer|motion designer|video editor|creative director|illustrator|designer.*creative|thiết kế đồ họa|chuyên viên thiết kế|biên tập video)/iu,
      sourceSlugs: {
        vl24h: ['thiet-ke-sang-tao-nghe-thuat'],
        vnw: ['thiet-ke-do-hoa-kv'],
      },
    },
    {
      id: 'marketing.pr',
      vertical: 'marketing',
      titlesPositive: /(pr (manager|specialist|officer|executive)|public relations|internal comms|communications (manager|specialist)|đối ngoại|truyền thông nội bộ)/iu,
      sourceSlugs: { vl24h: ['thong-tin-truyen-thong-quang-cao', 'truyen-hinh-bao-chi-bien-tap'] },
    },
    {
      id: 'marketing.trade-channel',
      vertical: 'marketing',
      titlesPositive: /(trade marketing|channel marketing|brand activation|in-store marketing|merchandising|chuyên viên trade)/iu,
      sourceSlugs: { vl24h: ['marketing'] },
    },
    {
      id: 'marketing.growth-crm',
      vertical: 'marketing',
      titlesPositive: /(growth (marketing|hacker)|crm manager|email marketing|marketing automation|lifecycle marketing|retention marketing)/iu,
      sourceSlugs: { vl24h: ['marketing'] },
    },
  ],
};

// ── finance ──────────────────────────────────────────────────────────────
const FINANCE_SLUGS_VL24H = ['ke-toan', 'tai-chinh-dau-tu-chung-khoan', 'kiem-toan', 'ngan-hang', 'bao-hiem'];
const FINANCE_NEGATIVE = /(insurance agent|insurance sales|kinh doanh b[aả]o hi[eể]m|sales banking|t[uư] v[aấ]n t[aà]i ch[ií]nh.*(hoa h[oồ]ng|commission|ch[ỉi] ti[eê]u)|it auditor|audit.*(security|penetration|vulnerability))/iu;

const FINANCE_TAXONOMY: VerticalTaxonomy = {
  vertical: 'finance',
  titlesNegative: FINANCE_NEGATIVE,
  subDomains: [
    {
      id: 'finance.accounting',
      vertical: 'finance',
      titlesPositive: /(accountant|accounting|kế toán|chief accountant|cost accountant|tax (accountant|specialist|manager)|kế toán (trưởng|tổng hợp|thuế|chi phí|công nợ))/iu,
      sourceSlugs: { vl24h: ['ke-toan'], vnw: ['ke-toan-kv'] },
    },
    {
      id: 'finance.audit',
      vertical: 'finance',
      titlesPositive: /(auditor|internal audit|external audit|audit (senior|manager|associate)|kiểm toán (viên|nội bộ|độc lập))/iu,
      sourceSlugs: { vl24h: ['kiem-toan'], vnw: ['kiem-toan-kv'] },
    },
    {
      id: 'finance.fpa',
      vertical: 'finance',
      titlesPositive: /(financial analyst|fp&a|finance manager|budget analyst|chuyên viên phân tích tài chính|fpna)/iu,
      sourceSlugs: { vl24h: ['tai-chinh-dau-tu-chung-khoan'], vnw: ['tai-chinh-kv'] },
    },
    {
      id: 'finance.banking',
      vertical: 'finance',
      titlesPositive: /(banking|credit analyst|relationship manager|rm corporate|teller|loan officer|chuyên viên (tín dụng|quan hệ khách hàng)|giao dịch viên|nhân viên ngân hàng)/iu,
      sourceSlugs: { vl24h: ['ngan-hang'], vnw: ['ngan-hang-kv'] },
    },
    {
      id: 'finance.treasury',
      vertical: 'finance',
      titlesPositive: /(treasury|cash management|liquidity|chuyên viên (kho quỹ|ngân quỹ))/iu,
      sourceSlugs: { vl24h: ['ngan-hang', 'tai-chinh-dau-tu-chung-khoan'] },
    },
    {
      id: 'finance.securities',
      vertical: 'finance',
      titlesPositive: /(securities|equity research|portfolio manager|fund manager|trader|investment (analyst|associate)|môi giới chứng khoán|chuyên viên đầu tư)/iu,
      sourceSlugs: { vl24h: ['tai-chinh-dau-tu-chung-khoan'] },
    },
    {
      id: 'finance.insurance-ops',
      vertical: 'finance',
      titlesPositive: /(underwriter|actuary|claims (officer|analyst|manager)|insurance underwriting|chuyên viên (thẩm định bảo hiểm|định phí|bồi thường))/iu,
      sourceSlugs: { vl24h: ['bao-hiem'] },
    },
    {
      id: 'finance.risk-compliance',
      vertical: 'finance',
      titlesPositive: /(risk (manager|analyst|officer)|compliance (manager|officer|specialist)|aml|kyc|chuyên viên (rủi ro|tuân thủ))/iu,
      sourceSlugs: { vl24h: ['ngan-hang', 'tai-chinh-dau-tu-chung-khoan'] },
    },
  ],
};

// ── sales ────────────────────────────────────────────────────────────────
const SALES_SLUGS_VL24H = ['ban-hang-kinh-doanh', 'ban-si-ban-le-quan-ly-cua-hang', 'bat-dong-san'];
const SALES_NEGATIVE = /(customer service|claims processor|recruitment sales|order processor|finance ops|it support|sales operations data)/iu;

const SALES_TAXONOMY: VerticalTaxonomy = {
  vertical: 'sales',
  titlesNegative: SALES_NEGATIVE,
  subDomains: [
    {
      id: 'sales.field-b2b',
      vertical: 'sales',
      titlesPositive: /(account (executive|manager)|key account|enterprise sales|field sales|sales executive|sales manager|nhân viên kinh doanh|chuyên viên kinh doanh|trưởng phòng kinh doanh|kinh doanh b2b)/iu,
      sourceSlugs: {
        vl24h: ['ban-hang-kinh-doanh'],
        vnw: ['nhan-vien-kinh-doanh-kv', 'sales-executive-kv', 'sales-manager-kv', 'account-manager-kv'],
      },
    },
    {
      id: 'sales.inside-telesales',
      vertical: 'sales',
      titlesPositive: /(inside sales|telesales|tele[- ]?sales|phone sales|nhân viên telesales|chuyên viên telesales|tư vấn qua điện thoại)/iu,
      sourceSlugs: { vl24h: ['ban-hang-kinh-doanh'] },
    },
    {
      id: 'sales.sdr-bdr',
      vertical: 'sales',
      titlesPositive: /(sdr|bdr|sales development|business development (representative|associate)|lead generation)/iu,
      sourceSlugs: { vl24h: ['ban-hang-kinh-doanh'] },
    },
    {
      id: 'sales.channel-partner',
      vertical: 'sales',
      titlesPositive: /(channel (manager|sales)|partner (manager|sales)|distributor sales|alliance manager|kênh phân phối)/iu,
      sourceSlugs: { vl24h: ['ban-hang-kinh-doanh', 'ban-si-ban-le-quan-ly-cua-hang'] },
    },
    {
      id: 'sales.retail',
      vertical: 'sales',
      titlesPositive: /(store manager|retail (sales|associate|manager)|floor sales|pos|cashier|bán lẻ|quản lý cửa hàng|nhân viên bán hàng siêu thị)/iu,
      sourceSlugs: { vl24h: ['ban-si-ban-le-quan-ly-cua-hang'] },
    },
    {
      id: 'sales.real-estate',
      vertical: 'sales',
      titlesPositive: /(real estate (sales|broker|agent)|môi giới bất động sản|chuyên viên kinh doanh bất động sản|bds broker|nhân viên kinh doanh dự án)/iu,
      sourceSlugs: { vl24h: ['bat-dong-san'] },
    },
    {
      id: 'sales.sales-engineer',
      vertical: 'sales',
      titlesPositive: /(sales engineer|technical sales|solution sales|presales (engineer|consultant)|pre-sales)/iu,
      sourceSlugs: { vl24h: ['ban-hang-kinh-doanh'] },
    },
    {
      id: 'sales.insurance-financial',
      vertical: 'sales',
      titlesPositive: /(insurance (sales|agent|consultant|advisor)|financial product sales|nhân viên kinh doanh bảo hiểm|tư vấn tài chính.*hoa hồng|đại lý bảo hiểm)/iu,
      sourceSlugs: { vl24h: ['ban-hang-kinh-doanh', 'bao-hiem'] },
    },
  ],
};

// ── ops ──────────────────────────────────────────────────────────────────
const OPS_SLUGS_VL24H = [
  'nhan-su', 'hanh-chinh-thu-ky', 'thu-mua-kho-van-chuoi-cung-ung', 'san-xuat-lap-rap-che-bien',
  'quan-ly-tieu-chuan-va-chat-luong', 'quan-ly-du-an', 'cham-soc-khach-hang',
  'van-hanh-bao-tri-bao-duong', 'xuat-nhap-khau', 'van-tai-lai-xe-giao-nhan',
];
const OPS_NEGATIVE = /(marketing operations|sales operations|data operations|devops|finops|it operations engineer|cloud operations engineer)/iu;

const OPS_TAXONOMY: VerticalTaxonomy = {
  vertical: 'ops',
  titlesNegative: OPS_NEGATIVE,
  subDomains: [
    {
      id: 'ops.hr',
      vertical: 'ops',
      titlesPositive: /(hr|human resources|hrbp|talent (acquisition|management)|recruiter|compensation.*benefits|l&d|payroll|nhân sự|tuyển dụng|chuyên viên (nhân sự|đào tạo|lương thưởng))/iu,
      sourceSlugs: { vl24h: ['nhan-su'], vnw: ['nhan-su-kv', 'hr-kv'] },
    },
    {
      id: 'ops.admin',
      vertical: 'ops',
      titlesPositive: /(office (manager|admin)|receptionist|executive assistant|personal assistant|secretary|administrative|hành chính|thư ký|trợ lý giám đốc|lễ tân văn phòng)/iu,
      sourceSlugs: { vl24h: ['hanh-chinh-thu-ky'], vnw: ['hanh-chinh-kv'] },
    },
    {
      id: 'ops.supply-chain',
      vertical: 'ops',
      titlesPositive: /(supply chain|logistics (coordinator|manager)|warehouse|inventory (analyst|manager)|procurement|buyer|chuỗi cung ứng|quản lý kho|thu mua|chuyên viên mua hàng)/iu,
      sourceSlugs: { vl24h: ['thu-mua-kho-van-chuoi-cung-ung'], vnw: ['logistics-kv'] },
    },
    {
      id: 'ops.manufacturing',
      vertical: 'ops',
      titlesPositive: /(production (planner|manager|supervisor)|plant manager|manufacturing (engineer|supervisor)|quản lý sản xuất|nhân viên sản xuất|công nhân sản xuất)/iu,
      sourceSlugs: { vl24h: ['san-xuat-lap-rap-che-bien'] },
    },
    {
      id: 'ops.quality-compliance',
      vertical: 'ops',
      titlesPositive: /(qa officer|qc (officer|inspector)|quality (assurance|control) (officer|specialist|manager) (?!engineer)|iso|haccp|quản lý chất lượng|kiểm soát chất lượng)/iu,
      sourceSlugs: { vl24h: ['quan-ly-tieu-chuan-va-chat-luong'] },
    },
    {
      id: 'ops.project-mgmt',
      vertical: 'ops',
      titlesPositive: /(project manager (?!(it|software|tech|engineering))|pmo|operations manager|quản lý dự án(?! it| phần mềm))/iu,
      sourceSlugs: { vl24h: ['quan-ly-du-an'] },
    },
    {
      id: 'ops.customer-service',
      vertical: 'ops',
      titlesPositive: /(customer (service|care|support) (representative|officer|specialist)|csr|support specialist|chăm sóc khách hàng|hỗ trợ khách hàng|tổng đài viên)/iu,
      sourceSlugs: {
        vl24h: ['cham-soc-khach-hang'],
        vnw: ['customer-service-kv', 'cham-soc-khach-hang-kv'],
      },
    },
    {
      id: 'ops.import-export',
      vertical: 'ops',
      titlesPositive: /(import.export|customs (officer|specialist)|trade compliance|xuất nhập khẩu|chuyên viên xuất nhập khẩu|chứng từ xuất nhập khẩu)/iu,
      sourceSlugs: { vl24h: ['xuat-nhap-khau'] },
    },
    {
      id: 'ops.transportation',
      vertical: 'ops',
      titlesPositive: /(driver|courier|delivery|fleet manager|transportation|tài xế|lái xe|nhân viên giao hàng|nhân viên giao nhận)/iu,
      sourceSlugs: { vl24h: ['van-tai-lai-xe-giao-nhan'] },
    },
    {
      id: 'ops.maintenance',
      vertical: 'ops',
      titlesPositive: /(maintenance (officer|technician|engineer)|facilities|vận hành|bảo trì|bảo dưỡng|kỹ thuật viên bảo trì)/iu,
      sourceSlugs: { vl24h: ['van-hanh-bao-tri-bao-duong'] },
    },
  ],
};

// ── other (catch-all for non-supported verticals: education, healthcare, …)
const OTHER_SLUGS_VL24H = [
  'giao-duc-dao-tao', 'y-te-cham-soc-suc-khoe',
  'co-khi-o-to-tu-dong-hoa', 'dien-dien-tu-dien-lanh', 'khoa-hoc-ky-thuat', 'buu-chinh-vien-thong',
  'xay-dung', 'kien-truc-thiet-ke-noi-ngoai-that',
  'khach-san-nha-hang-du-lich', 'luat-phap-ly-tuan-thu', 'nong-lam-ngu-nghiep',
  'cong-nghe-thuc-pham-dinh-duong', 'duoc-pham', 'hoa-hoc-hoa-sinh', 'thuc-pham-do-uong',
  'an-ninh-bao-ve', 'lao-dong-pho-thong', 'nghe-nghiep-khac',
];

// Other vertical accepts anything in its slugs; sub-domains are informational
// (no strict negative — these slugs are themselves the filter).
const OTHER_TAXONOMY: VerticalTaxonomy = {
  vertical: 'other',
  titlesNegative: /(data engineer|sales engineer|software engineer|devops|ml engineer|kỹ sư phần mềm)/iu,
  subDomains: [
    {
      id: 'other.education',
      vertical: 'other',
      titlesPositive: /(teacher|lecturer|giáo viên|giảng viên|trợ giảng|đào tạo|tutor|instructor)/iu,
      sourceSlugs: { vl24h: ['giao-duc-dao-tao'] },
    },
    {
      id: 'other.healthcare',
      vertical: 'other',
      titlesPositive: /(doctor|nurse|pharmacist|medical|bác sĩ|y tá|dược sĩ|điều dưỡng|kỹ thuật viên xét nghiệm)/iu,
      sourceSlugs: { vl24h: ['y-te-cham-soc-suc-khoe'] },
    },
    {
      id: 'other.construction',
      vertical: 'other',
      titlesPositive: /(construction|architect(?! software)|xây dựng|kiến trúc sư(?! phần mềm)|giám sát công trình)/iu,
      sourceSlugs: { vl24h: ['xay-dung', 'kien-truc-thiet-ke-noi-ngoai-that'] },
    },
    {
      id: 'other.engineering-nontech',
      vertical: 'other',
      titlesPositive: /(mechanical|electrical|civil|chemical|environmental|industrial) engineer|kỹ sư (cơ khí|điện(?!\s*tử)|hóa|môi trường|công nghiệp|cầu đường|kết cấu|thiết kế kết cấu)/iu,
      sourceSlugs: { vl24h: ['co-khi-o-to-tu-dong-hoa', 'dien-dien-tu-dien-lanh', 'khoa-hoc-ky-thuat', 'buu-chinh-vien-thong'] },
    },
    {
      id: 'other.hospitality',
      vertical: 'other',
      titlesPositive: /(hotel|restaurant|chef|bartender|tour|hospitality|khách sạn|nhà hàng|đầu bếp|lễ tân khách sạn|du lịch)/iu,
      sourceSlugs: { vl24h: ['khach-san-nha-hang-du-lich'] },
    },
    {
      id: 'other.legal',
      vertical: 'other',
      titlesPositive: /(lawyer|legal counsel|paralegal|luật sư|tư vấn pháp lý|chuyên viên pháp chế)/iu,
      sourceSlugs: { vl24h: ['luat-phap-ly-tuan-thu'] },
    },
    {
      id: 'other.security-services',
      vertical: 'other',
      titlesPositive: /(security guard|bảo vệ|nhân viên an ninh)/iu,
      sourceSlugs: { vl24h: ['an-ninh-bao-ve'] },
    },
    {
      id: 'other.misc',
      vertical: 'other',
      titlesPositive: /.+/,
      sourceSlugs: { vl24h: ['nghe-nghiep-khac', 'lao-dong-pho-thong', 'nong-lam-ngu-nghiep', 'cong-nghe-thuc-pham-dinh-duong', 'duoc-pham', 'hoa-hoc-hoa-sinh', 'thuc-pham-do-uong'] },
    },
  ],
};

// Raw taxonomy carries patterns with VN diacritics for readability. At module
// load we fold every regex to its diacritic-free form so the runtime patterns
// match both diacritic titles (detail-stage ld.title) and folded URL slugs
// (pre-filter from vl24h sitemap). Normalize step on the title side strips
// diacritics symmetrically — see `normalizeTitle` below.
const RAW_TAXONOMY: Record<Vertical, VerticalTaxonomy> = {
  tech: TECH_TAXONOMY,
  marketing: MARKETING_TAXONOMY,
  finance: FINANCE_TAXONOMY,
  sales: SALES_TAXONOMY,
  ops: OPS_TAXONOMY,
  other: OTHER_TAXONOMY,
};

/** Strip Vietnamese diacritics. NFD decomposition + combining-mark removal +
 *  explicit đ/Đ → d/D (NFD doesn't decompose those). */
function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function foldRegex(re: RegExp): RegExp {
  return new RegExp(stripDiacritics(re.source), re.flags);
}

function foldTaxonomy(raw: Record<Vertical, VerticalTaxonomy>): Record<Vertical, VerticalTaxonomy> {
  const out = {} as Record<Vertical, VerticalTaxonomy>;
  for (const v of Object.keys(raw) as Vertical[]) {
    const tax = raw[v];
    out[v] = {
      vertical: tax.vertical,
      titlesNegative: foldRegex(tax.titlesNegative),
      subDomains: tax.subDomains.map((sd) => ({
        ...sd,
        titlesPositive: foldRegex(sd.titlesPositive),
      })),
    };
  }
  return out;
}

export const TAXONOMY: Record<Vertical, VerticalTaxonomy> = foldTaxonomy(RAW_TAXONOMY);

// ── helpers ──────────────────────────────────────────────────────────────

/**
 * Map a source's category slug to {vertical, candidate sub-domains}. Returns
 * null when the slug is in NO known vertical — caller treats as reject OR
 * falls back to 'other' depending on policy.
 */
export function slugToVerticalAndSub(
  source: Source,
  slug: string,
): { vertical: Vertical; candidateSubDomains: SubDomain[] } | null {
  for (const tax of Object.values(TAXONOMY)) {
    const matching = tax.subDomains.filter((sd) => sd.sourceSlugs[source]?.includes(slug));
    if (matching.length > 0) {
      return { vertical: tax.vertical, candidateSubDomains: matching };
    }
  }
  return null;
}

export type ClassifyResult =
  | { accept: true; subVertical: string; reason: 'positive-match' | 'fallback' }
  | { accept: false; reason: 'negative-match' | 'no-positive-match' };

/**
 * Given a job title + the candidate sub-domains (from slug step), decide:
 * - if any sub-domain's titlesPositive matches AND vertical's titlesNegative
 *   does NOT match → accept with the first matching sub-domain
 * - if titlesNegative matches → reject
 * - if no titlesPositive matches → reject (caller can opt in to fallback)
 */
// Titles arrive from two sources: pre-filter passes folded URL slugs (ASCII,
// no diacritics) and detail-stage passes ld.title (often with diacritics).
// We strip diacritics symmetrically here so both sources match the folded
// patterns built by `foldTaxonomy` at module load.
function normalizeTitle(s: string): string {
  return stripDiacritics(s.toLowerCase());
}

export function classifyTitle(
  vertical: Vertical,
  title: string,
  candidateSubDomains?: SubDomain[],
): ClassifyResult {
  const tax = TAXONOMY[vertical];
  const norm = normalizeTitle(title);
  if (tax.titlesNegative.test(norm)) {
    return { accept: false, reason: 'negative-match' };
  }
  const candidates = candidateSubDomains ?? tax.subDomains;
  for (const sd of candidates) {
    if (sd.titlesPositive.test(norm)) {
      return { accept: true, subVertical: sd.id, reason: 'positive-match' };
    }
  }
  return { accept: false, reason: 'no-positive-match' };
}

/**
 * Used by post-ingest classify.ts when the slug isn't enough. Scans every
 * vertical and returns the first sub-domain whose titlesPositive matches AND
 * vertical-negative doesn't reject. Returns undefined if nothing matches.
 */
// Cross-vertical priority: when a title can plausibly land in multiple verticals
// (e.g. "Sales Engineer" — tech keyword "engineer" AND sales role), check the
// most-specific verticals first so the title doesn't get stolen by a noisy match.
const PICK_ORDER: Vertical[] = ['tech', 'finance', 'marketing', 'sales', 'ops', 'other'];

export function pickSubVertical(title: string): { vertical: Vertical; subVertical: string } | undefined {
  const norm = normalizeTitle(title);
  for (const vertical of PICK_ORDER) {
    const tax = TAXONOMY[vertical];
    if (tax.titlesNegative.test(norm)) continue;
    for (const sd of tax.subDomains) {
      // other.misc is a catch-all by slug only — skip when scanning by title
      // alone, otherwise it eats every input.
      if (sd.id === 'other.misc') continue;
      if (sd.titlesPositive.test(norm)) {
        return { vertical, subVertical: sd.id };
      }
    }
  }
  return undefined;
}
