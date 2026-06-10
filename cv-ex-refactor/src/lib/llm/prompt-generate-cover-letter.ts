// Cover letter prompt builder.
//
// 2026-06-10 Phase 1d:
//   - 4 tone presets (warm / professional / concise / leadership).
//   - 3 length bands (short / medium / long).
//   - Optional strengthsToLead + gapToAddress feed from analyze findings.
//   - Bilingual system prompt — VI for vi/auto-vi-detected, EN for en/
//     auto-en-detected. Stops mixed-language instructions to the LLM.
//   - Heading sanitized — jobTitle + company stripped of Markdown-active
//     chars to prevent h1 breakage.

import type {
  CoverLetterBodyT,
  CoverLetterToneT,
  CoverLetterLengthT,
} from '@/lib/schemas/cover-letter-request';
import { sanitizeMarkdownInline } from './sanitize-markdown';

export interface BuiltCoverLetterPrompts {
  system: string;
  user: string;
}

const LENGTH_BAND: Record<CoverLetterLengthT, { vi: string; en: string }> = {
  short: { vi: '150-200 từ tổng', en: '150-200 words total' },
  medium: { vi: '250-400 từ tổng', en: '250-400 words total' },
  long: { vi: '400-550 từ tổng', en: '400-550 words total' },
};

const TONE_INSTR_VI: Record<CoverLetterToneT, string> = {
  warm: 'Tone ấm áp, cá nhân hoá. Thể hiện sự quan tâm chân thật với company/role; gắn evidence với câu chuyện ngắn.',
  professional: 'Tone professional, recruiter-grade. Concrete, đo lường được; không overclaim, không marketing speak.',
  concise: 'Tone cô đọng. Câu ngắn, mỗi câu đẩy một dimension. Bullets nếu phù hợp. Recruiter scan 20s là nắm.',
  leadership: 'Tone lãnh đạo. Emphasize ownership scope, business outcome, mentorship; framing như senior reaching out to peer.',
};

const TONE_INSTR_EN: Record<CoverLetterToneT, string> = {
  warm: 'Tone: warm, personalized. Express genuine curiosity about the company/role; weave a short story into the evidence.',
  professional: 'Tone: professional, recruiter-grade. Concrete, measured; no overclaim, no marketing-speak.',
  concise: 'Tone: concise. Short sentences, each pushing one dimension. Use bullets when they fit. Recruiter-scannable in 20s.',
  leadership: 'Tone: leadership. Emphasize ownership scope, business outcomes, mentorship; framed as a senior reaching out to a peer.',
};

function buildSystemVi(lengthBand: string): string {
  return `Bạn là chuyên gia viết cover letter, chuyên giúp ứng viên Việt Nam tiếp cận thị trường tech & professional.

Mục tiêu: viết MỘT cover letter ${lengthBand} — đủ ngắn để recruiter đọc trong 30 giây, đủ cụ thể để chứng minh fit.

Cấu trúc bắt buộc (3 đoạn):
1. **Mở (1-2 câu):** thể hiện hiểu biết về công ty hoặc role; lý do quan tâm — phải cụ thể, KHÔNG nói chung chung "I'm passionate about...".
2. **Bằng chứng (2-3 đoạn ngắn):** match concrete bullets từ CV gốc với requirements trong JD. Cite con số / project / scope cụ thể. Mỗi đoạn nên focus một dimension (e.g. tech skill, business impact, leadership) — KHÔNG dồn cụm.
3. **Đóng (1 câu):** proactive next step — sẵn sàng phỏng vấn, mention portfolio / GitHub nếu có trong CV.

Quy tắc tuyệt đối:
- KHÔNG fabricate skills, tools, employers, hoặc kết quả không có trong CV.
- KHÔNG dùng generic phrases: "passionate", "team player", "results-driven", "go-getter", "synergy". Thay bằng evidence cụ thể.
- PHẢI cite ≥1 chi tiết cụ thể từ JD (tech stack name, business domain, team size, product name).
- KHÔNG stiff, KHÔNG marketing speak.
- KHÔNG thêm greeting "Dear Hiring Manager," — chỉ output thân thư bắt đầu trực tiếp từ câu 1.
- KHÔNG ký tên placeholder ("[Your Name]"); kết bằng câu hành động, không ký.
- Output ONLY Markdown. KHÔNG preamble, KHÔNG code fence, KHÔNG meta-commentary.

Bắt đầu với heading \`# Cover Letter — {jobTitle} @ {company}\` rồi xuống dòng, viết trực tiếp 3 đoạn.`;
}

function buildSystemEn(lengthBand: string): string {
  return `You are a cover-letter specialist who helps Vietnamese candidates pitch into tech and professional markets.

Goal: write ONE cover letter — ${lengthBand} — short enough for a recruiter to read in 30 seconds, specific enough to prove fit.

Required structure (3 paragraphs):
1. **Opening (1-2 sentences):** show understanding of the company or role; cite a concrete reason for interest — NEVER vague "I'm passionate about...".
2. **Evidence (2-3 short paragraphs):** match concrete CV bullets with JD requirements. Cite specific numbers / project / scope. Each paragraph should focus on one dimension (e.g. tech skill, business impact, leadership) — do NOT cluster.
3. **Close (1 sentence):** proactive next step — open to interview, mention portfolio / GitHub if in the CV.

Absolute rules:
- Do NOT fabricate skills, tools, employers, or outcomes the CV does not state.
- Do NOT use generic phrases: "passionate", "team player", "results-driven", "go-getter", "synergy". Use concrete evidence instead.
- MUST cite at least one specific detail from the JD (tech stack name, business domain, team size, product name).
- Not stiff, not marketing-speak.
- Do NOT add a greeting ("Dear Hiring Manager,") — start directly with sentence 1.
- No signature placeholder ("[Your Name]"); close with an action sentence, no signature.
- Output ONLY Markdown. No preamble, no code fence, no meta-commentary.

Begin with the heading \`# Cover Letter — {jobTitle} @ {company}\` then write the 3 paragraphs directly.`;
}

/**
 * Resolve effective language. `auto` defaults to en when JD has no
 * meaningful Vietnamese-diacritic density; vi otherwise. KISS heuristic —
 * single regex pass over the JD body.
 */
function resolveLanguage(language: 'en' | 'vi' | 'auto', jdText: string): 'en' | 'vi' {
  if (language === 'en' || language === 'vi') return language;
  const diacritics = jdText.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g);
  const ratio = (diacritics?.length ?? 0) / Math.max(jdText.length, 1);
  return ratio > 0.02 ? 'vi' : 'en';
}

export function buildCoverLetterPrompts(body: CoverLetterBodyT): BuiltCoverLetterPrompts {
  const { inputs } = body;
  const lang = resolveLanguage(inputs.language, inputs.jdText);
  const lengthBand = LENGTH_BAND[inputs.length][lang];
  const toneInstr = lang === 'vi' ? TONE_INSTR_VI[inputs.tone] : TONE_INSTR_EN[inputs.tone];

  const system = lang === 'vi' ? buildSystemVi(lengthBand) : buildSystemEn(lengthBand);

  const safeTitle = sanitizeMarkdownInline(inputs.jobTitle);
  const safeCompany = sanitizeMarkdownInline(inputs.company);

  const strengthsBlock =
    inputs.strengthsToLead && inputs.strengthsToLead.length > 0
      ? `\n=== STRENGTHS TO LEAD ===
${inputs.strengthsToLead.map((s) => `- ${s}`).join('\n')}
${lang === 'vi'
        ? 'Đoạn Bằng chứng PHẢI lead với những điểm này (cite số / project / scope từ CV).'
        : 'The Evidence paragraph MUST lead with these points (cite numbers / project / scope from the CV).'}`
      : '';

  const gapBlock = inputs.gapToAddress
    ? `\n=== GAP TO ADDRESS ===
${inputs.gapToAddress}
${lang === 'vi'
      ? 'Address gap này NGẮN GỌN (1 câu) gần đoạn kết — không xin lỗi, không over-explain. Frame như sẵn sàng học/đã có plan.'
      : 'Address this gap BRIEFLY (1 sentence) near the close — no apology, no over-explanation. Frame as ready-to-learn / plan in place.'}`
    : '';

  const langInstr = lang === 'vi'
    ? 'Viết cover letter bằng tiếng Việt.'
    : 'Write the cover letter in English.';

  const user = `${lang === 'vi' ? 'Viết cover letter cho ứng viên dưới đây.' : 'Write a cover letter for the candidate below.'}

=== TARGET ROLE ===
Job Title: ${safeTitle}
Company: ${safeCompany}

=== JOB DESCRIPTION ===
${inputs.jdText}

=== CANDIDATE'S CV ===
${inputs.cvText}
${strengthsBlock}${gapBlock}

=== STYLE ===
- ${langInstr}
- ${toneInstr}
- ${lang === 'vi' ? 'Độ dài' : 'Length'}: ${lengthBand}.
- Heading: \`# Cover Letter — ${safeTitle} @ ${safeCompany}\`

${lang === 'vi' ? 'Tuân thủ HARD RULES từ system prompt. Output ONLY Markdown.' : 'Follow the HARD RULES from the system prompt exactly. Output ONLY Markdown.'}`;

  return { system, user };
}
