import { describe, it, expect } from 'vitest';
import { detectLocaleFromText } from '@/lib/llm/detect-locale';

describe('detectLocaleFromText', () => {
  it('returns vi for empty / null / undefined (Vietnamese-first default)', () => {
    expect(detectLocaleFromText('')).toBe('vi');
    expect(detectLocaleFromText(null)).toBe('vi');
    expect(detectLocaleFromText(undefined)).toBe('vi');
  });

  it('returns vi for short strings (insufficient signal)', () => {
    expect(detectLocaleFromText('Quick brown fox')).toBe('vi');
  });

  it('returns en for English CV text', () => {
    const text =
      'Senior Backend Engineer with 8 years of experience building distributed systems on AWS and GCP. Led the design and rollout of a payment processing platform handling 5 million transactions per day. Mentored a team of 6 engineers across two timezones, established the on-call rotation, and reduced p99 latency by 40%.';
    expect(detectLocaleFromText(text)).toBe('en');
  });

  it('returns vi for Vietnamese CV text with diacritics', () => {
    const text =
      'Kỹ sư phần mềm với 8 năm kinh nghiệm xây dựng hệ thống phân tán trên AWS. Chịu trách nhiệm thiết kế và triển khai nền tảng xử lý thanh toán phục vụ 5 triệu giao dịch mỗi ngày. Dẫn dắt đội ngũ 6 kỹ sư, thiết lập quy trình on-call, giảm độ trễ p99 xuống 40%.';
    expect(detectLocaleFromText(text)).toBe('vi');
  });

  it('returns vi for mixed VN + English tooling (typical VN CV pattern)', () => {
    const text =
      'Triển khai hệ thống microservices trên Kubernetes với Spring Boot, PostgreSQL và Redis. Xây dựng pipeline CI/CD bằng GitHub Actions và ArgoCD. Quản lý đội ngũ 5 thành viên, đạt SLA 99.9% trong 6 tháng liên tục.';
    expect(detectLocaleFromText(text)).toBe('vi');
  });

  it('returns en when diacritic ratio is below threshold (occasional loanword)', () => {
    // Mostly English with one or two accidental diacritic-looking chars
    const text =
      'Software Engineer with experience in distributed systems, microservices architecture, and cloud-native deployment patterns. Led the implementation of the payments gateway integration with Visa, Mastercard, and Stripe across 12 markets including Singapore and Vietnam (Hanoi office). Mentored 6 engineers and shipped over 200 production releases.';
    expect(detectLocaleFromText(text)).toBe('en');
  });
});
