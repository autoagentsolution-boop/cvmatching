import { describe, it, expect } from 'vitest';
import {
  TAXONOMY,
  classifyTitle,
  pickSubVertical,
  slugToVerticalAndSub,
} from '@/lib/jobs/taxonomy';
import type { Vertical } from '@/lib/jobs/types';

// ── Coverage: every taxonomy md slug present in TAXONOMY ──────────────────

const EXPECTED_VL24H_SLUGS: Record<Vertical, string[]> = {
  tech: ['it-phan-mem', 'it-phan-cung-mang', 'phan-tich-thong-ke-du-lieu'],
  marketing: ['marketing', 'thiet-ke-sang-tao-nghe-thuat', 'thong-tin-truyen-thong-quang-cao', 'truyen-hinh-bao-chi-bien-tap'],
  finance: ['ke-toan', 'tai-chinh-dau-tu-chung-khoan', 'kiem-toan', 'ngan-hang', 'bao-hiem'],
  sales: ['ban-hang-kinh-doanh', 'ban-si-ban-le-quan-ly-cua-hang', 'bat-dong-san'],
  ops: [
    'nhan-su', 'hanh-chinh-thu-ky', 'thu-mua-kho-van-chuoi-cung-ung', 'san-xuat-lap-rap-che-bien',
    'quan-ly-tieu-chuan-va-chat-luong', 'quan-ly-du-an', 'cham-soc-khach-hang',
    'van-hanh-bao-tri-bao-duong', 'xuat-nhap-khau', 'van-tai-lai-xe-giao-nhan',
  ],
  other: ['co-khi-o-to-tu-dong-hoa', 'dien-dien-tu-dien-lanh', 'khoa-hoc-ky-thuat', 'buu-chinh-vien-thong'],
};

describe('TAXONOMY slug coverage', () => {
  for (const [vertical, slugs] of Object.entries(EXPECTED_VL24H_SLUGS) as Array<[Vertical, string[]]>) {
    it(`${vertical}: every expected vl24h slug appears in at least one sub-domain`, () => {
      const allSlugs = new Set(
        TAXONOMY[vertical].subDomains.flatMap((sd) => sd.sourceSlugs.vl24h ?? []),
      );
      for (const slug of slugs) expect(allSlugs.has(slug)).toBe(true);
    });
  }
});

// ── Positive matches: each vertical accepts real titles ──────────────────

const POSITIVE_FIXTURES: Array<{ vertical: Vertical; title: string; expectSub?: string }> = [
  // tech
  { vertical: 'tech', title: 'Senior Back-End Nodejs Developer', expectSub: 'tech.software' },
  { vertical: 'tech', title: 'Data Engineer - Spark & Airflow', expectSub: 'tech.data' },
  { vertical: 'tech', title: 'ML Engineer - Computer Vision', expectSub: 'tech.ml-ai' },
  { vertical: 'tech', title: 'DevOps Engineer - Kubernetes', expectSub: 'tech.infra' },
  { vertical: 'tech', title: 'Application Security Engineer', expectSub: 'tech.security' },
  // marketing
  { vertical: 'marketing', title: 'Senior Brand Manager', expectSub: 'marketing.brand-strategy' },
  { vertical: 'marketing', title: 'SEO Specialist', expectSub: 'marketing.digital' },
  { vertical: 'marketing', title: 'Content Writer', expectSub: 'marketing.content' },
  { vertical: 'marketing', title: 'Graphic Designer', expectSub: 'marketing.creative' },
  { vertical: 'marketing', title: 'Trade Marketing Executive', expectSub: 'marketing.trade-channel' },
  // finance
  { vertical: 'finance', title: 'Kế Toán Tổng Hợp', expectSub: 'finance.accounting' },
  { vertical: 'finance', title: 'Senior Financial Analyst', expectSub: 'finance.fpa' },
  { vertical: 'finance', title: 'Internal Audit Senior', expectSub: 'finance.audit' },
  { vertical: 'finance', title: 'Credit Analyst - Corporate Banking', expectSub: 'finance.banking' },
  { vertical: 'finance', title: 'Insurance Underwriter', expectSub: 'finance.insurance-ops' },
  // sales
  { vertical: 'sales', title: 'Nhân Viên Kinh Doanh', expectSub: 'sales.field-b2b' },
  { vertical: 'sales', title: 'Senior Account Executive', expectSub: 'sales.field-b2b' },
  { vertical: 'sales', title: 'Telesales Specialist', expectSub: 'sales.inside-telesales' },
  { vertical: 'sales', title: 'Môi Giới Bất Động Sản', expectSub: 'sales.real-estate' },
  { vertical: 'sales', title: 'Sales Engineer - Industrial Equipment', expectSub: 'sales.sales-engineer' },
  // ops
  { vertical: 'ops', title: 'Chuyên Viên Nhân Sự', expectSub: 'ops.hr' },
  { vertical: 'ops', title: 'HR Generalist', expectSub: 'ops.hr' },
  { vertical: 'ops', title: 'Trợ Lý Giám Đốc', expectSub: 'ops.admin' },
  { vertical: 'ops', title: 'Supply Chain Coordinator', expectSub: 'ops.supply-chain' },
  { vertical: 'ops', title: 'Customer Service Officer', expectSub: 'ops.customer-service' },
  // other
  { vertical: 'other', title: 'Giáo Viên Tiếng Anh', expectSub: 'other.education' },
  { vertical: 'other', title: 'Bác Sĩ Đa Khoa', expectSub: 'other.healthcare' },
  { vertical: 'other', title: 'Kỹ Sư Cơ Khí', expectSub: 'other.engineering-nontech' },
  { vertical: 'other', title: 'Kỹ Sư Xây Dựng', expectSub: 'other.construction' },
  { vertical: 'other', title: 'Lễ Tân Khách Sạn', expectSub: 'other.hospitality' },
];

describe('TAXONOMY positive matches', () => {
  for (const fixture of POSITIVE_FIXTURES) {
    it(`${fixture.vertical}: "${fixture.title}" → accepted${fixture.expectSub ? ` as ${fixture.expectSub}` : ''}`, () => {
      const result = classifyTitle(fixture.vertical, fixture.title);
      expect(result.accept).toBe(true);
      if (fixture.expectSub && result.accept) {
        expect(result.subVertical).toBe(fixture.expectSub);
      }
    });
  }
});

// ── Negative matches: each vertical rejects polluting titles ─────────────

const NEGATIVE_FIXTURES: Array<{ vertical: Vertical; title: string }> = [
  // tech polluters → reject
  { vertical: 'tech', title: 'Kỹ Sư Cơ Khí' },
  { vertical: 'tech', title: 'Kỹ Sư Xây Dựng' },
  { vertical: 'tech', title: 'Kỹ Sư Điện, Cơ Điện' },
  { vertical: 'tech', title: 'Sales Engineer - Industrial Equipment' },
  { vertical: 'tech', title: 'Nhân Viên Giao Hàng Viettel Post' },
  // marketing polluters
  { vertical: 'marketing', title: 'Sales Marketing Manager' },
  { vertical: 'marketing', title: 'Telesales / Marketing Specialist' },
  // finance polluters — insurance sales (not insurance ops)
  { vertical: 'finance', title: 'Insurance Sales Agent (commission only)' },
  { vertical: 'finance', title: 'Nhân Viên Kinh Doanh Bảo Hiểm' },
  // sales polluters
  { vertical: 'sales', title: 'Customer Service Representative' },
  // ops polluters
  { vertical: 'ops', title: 'DevOps Engineer' },
  { vertical: 'ops', title: 'Marketing Operations Manager' },
];

describe('TAXONOMY negative rejection', () => {
  for (const fixture of NEGATIVE_FIXTURES) {
    it(`${fixture.vertical}: "${fixture.title}" → rejected`, () => {
      const result = classifyTitle(fixture.vertical, fixture.title);
      expect(result.accept).toBe(false);
    });
  }
});

// ── Cross-vertical routing: pickSubVertical sends polluters to right home

describe('pickSubVertical cross-vertical routing', () => {
  it('routes "Kỹ Sư Cơ Khí" to other.engineering-nontech, NOT tech', () => {
    const result = pickSubVertical('Kỹ Sư Cơ Khí');
    expect(result?.vertical).toBe('other');
    expect(result?.subVertical).toBe('other.engineering-nontech');
  });

  it('routes "Sales Engineer" to sales.sales-engineer, NOT tech', () => {
    const result = pickSubVertical('Sales Engineer - Industrial Equipment');
    expect(result?.vertical).toBe('sales');
  });

  it('routes "Nhân Viên Kinh Doanh Bảo Hiểm" to sales.insurance-financial, NOT finance', () => {
    const result = pickSubVertical('Nhân Viên Kinh Doanh Bảo Hiểm');
    expect(result?.vertical).toBe('sales');
  });

  it('routes a clean Data Engineer to tech.data', () => {
    const result = pickSubVertical('Data Engineer - Spark & Airflow');
    expect(result?.vertical).toBe('tech');
    expect(result?.subVertical).toBe('tech.data');
  });
});

// ── slugToVerticalAndSub: slugs map correctly ────────────────────────────

describe('slugToVerticalAndSub', () => {
  it('it-phan-mem → tech', () => {
    const result = slugToVerticalAndSub('vl24h', 'it-phan-mem');
    expect(result?.vertical).toBe('tech');
  });

  it('co-khi-o-to-tu-dong-hoa → other (after slug remap)', () => {
    const result = slugToVerticalAndSub('vl24h', 'co-khi-o-to-tu-dong-hoa');
    expect(result?.vertical).toBe('other');
  });

  it('ke-toan → finance', () => {
    const result = slugToVerticalAndSub('vl24h', 'ke-toan');
    expect(result?.vertical).toBe('finance');
  });

  it('unknown slug → null', () => {
    const result = slugToVerticalAndSub('vl24h', 'not-a-real-slug-xyz');
    expect(result).toBeNull();
  });
});
