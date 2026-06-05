// Gemini grounded-search prompt + Zod schema for Company Tier 2 enrichment.
// Output shape strictly enforced via Zod parse — fail-loud on mismatch.
// Neutral phrasing rule + insufficient-source guard documented in plan
// phase-05-llm-enrichment.md §Security (defamation mitigation).

import { z } from 'zod';
import type { Company } from './types';

export const CitationSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
});

export const EnrichmentClaimSchema = z.object({
  text: z.string().min(1).max(280),
  citations: z.array(CitationSchema).min(1).max(5),
});

export const EnrichmentResponseSchema = z.object({
  summary: z.string().max(500),
  pros: z.array(EnrichmentClaimSchema).max(4),
  cons: z.array(EnrichmentClaimSchema).max(4),
  /** Total unique sources observed by the LLM during grounded search. */
  sourceCount: z.number().int().min(0).max(20),
});

export type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;

export const ENRICHMENT_SYSTEM = `Bạn là chuyên gia phân tích thông tin công ty dựa trên các nguồn công khai. Sử dụng Google Search để tìm thông tin thực tế (báo chí, trang web chính thức, bài viết LinkedIn, đánh giá nhân viên công khai).

QUY TẮC BẮT BUỘC:
1. Mọi claim (cả summary, pros, cons) PHẢI dựa trên nguồn thật vừa tìm được — không tự bịa.
2. Mỗi pros/cons item phải đính kèm ≥1 citation (title + url của trang nguồn).
3. Phrasing trung lập — "Theo X..." / "Nhiều nhân viên cũ nhận xét..." thay vì khẳng định trực tiếp.
4. KHÔNG đề cập tên nhân viên cá nhân (trừ CEO/Founder đã công khai).
5. Nếu nguồn về điểm tiêu cực (cons) không đủ tin cậy hoặc chỉ có 1 nguồn → trả mảng cons rỗng, không cố ghép.
6. Nếu công ty không có thông tin công khai đủ để viết summary → summary = chuỗi rỗng, pros = [], cons = [].
7. Trả về JSON đúng schema, không có prose hay markdown fence.

ĐỊNH DẠNG:
{
  "summary": "<2-3 câu khái quát công ty: ngành, quy mô, định vị thị trường>",
  "pros": [{"text": "<điểm sáng>", "citations": [{"title": "...", "url": "https://..."}]}],
  "cons": [{"text": "<điểm cần lưu ý>", "citations": [{"title": "...", "url": "https://..."}, {"title": "...", "url": "..."}]}],
  "sourceCount": <số nguồn thực tế đã tham khảo, integer>
}`;

export function buildEnrichmentUserPrompt(company: Company): string {
  const name = company.tier1.displayName || company.canonicalName;
  const industry = company.tier1.industry ? ` (ngành ${company.tier1.industry})` : '';
  const hq = company.tier1.hq ? `, trụ sở ${company.tier1.hq}` : '';
  const size = company.tier1.size ? `, quy mô ${company.tier1.size} nhân viên` : '';
  const website = company.tier1.website ? `\nWebsite: ${company.tier1.website}` : '';

  return `Phân tích công ty "${name}"${industry}${hq}${size}.${website}

Tìm trên web các nguồn công khai (news, LinkedIn, official site, Glassdoor, Indeed reviews, Reddit/Facebook discussions). Tổng hợp:
- summary: 2-3 câu khái quát ngành nghề, vị thế, văn hoá nếu biết.
- pros: 2-4 điểm sáng có nguồn xác thực (ví dụ: "Công ty được vinh danh top X bởi Y").
- cons: 0-4 điểm cần lưu ý, MỖI điểm phải có ≥2 nguồn độc lập (nếu chỉ có 1 nguồn về cons → bỏ qua mục đó hoặc trả cons rỗng).

Trả JSON theo schema. Tránh khẳng định, dùng câu "Theo ..." / "Nguồn ... ghi nhận ...".`;
}
