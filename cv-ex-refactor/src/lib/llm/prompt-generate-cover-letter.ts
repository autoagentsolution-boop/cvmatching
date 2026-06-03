import type { CoverLetterBodyT } from '@/lib/schemas/cover-letter-request';

export interface BuiltCoverLetterPrompts {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `Bạn là chuyên gia viết cover letter, chuyên giúp ứng viên Việt Nam tiếp cận thị trường tech & professional.

Mục tiêu: viết MỘT cover letter 250-400 từ — đủ ngắn để recruiter đọc trong 30 giây, đủ cụ thể để chứng minh fit.

Cấu trúc bắt buộc (3 đoạn):
1. **Mở (1-2 câu):** thể hiện hiểu biết về công ty hoặc role; lý do quan tâm — phải cụ thể, KHÔNG nói chung chung "I'm passionate about..."
2. **Bằng chứng (2-3 đoạn ngắn):** match concrete bullets từ CV gốc với requirements trong JD. Cite con số / project / scope cụ thể. Mỗi đoạn nên focus một dimension (e.g. tech skill, business impact, leadership) — KHÔNG dồn cụm.
3. **Đóng (1 câu):** proactive next step — sẵn sàng phỏng vấn, mention portfolio / GitHub nếu có trong CV.

Quy tắc tuyệt đối:
- KHÔNG fabricate skills, tools, employers, hoặc kết quả không có trong CV.
- KHÔNG dùng generic phrases: "passionate", "team player", "results-driven", "go-getter", "synergy". Thay bằng evidence cụ thể.
- PHẢI cite ≥1 chi tiết cụ thể từ JD (tech stack name, business domain, team size, product name).
- Tone: professional + human; KHÔNG stiff, KHÔNG marketing speak.
- KHÔNG thêm greeting "Dear Hiring Manager," — chỉ output thân thư bắt đầu trực tiếp từ câu 1.
- KHÔNG ký tên placeholder ("[Your Name]"); kết bằng câu hành động, không ký.
- Output ONLY Markdown. KHÔNG preamble, KHÔNG code fence, KHÔNG meta-commentary.

Bắt đầu với heading \`# Cover Letter — {jobTitle} @ {company}\` rồi xuống dòng, viết trực tiếp 3 đoạn ngắn.`;

export function buildCoverLetterPrompts(body: CoverLetterBodyT): BuiltCoverLetterPrompts {
  const { inputs } = body;
  const langInstr =
    inputs.language === 'vi'
      ? 'Write the cover letter in Vietnamese.'
      : inputs.language === 'auto'
        ? 'Write the cover letter in the same language as the JD (default English if JD is bilingual).'
        : 'Write the cover letter in English.';

  const user = `Write a cover letter for this candidate applying to the role below.

=== TARGET ROLE ===
Job Title: ${inputs.jobTitle}
Company: ${inputs.company}

=== JOB DESCRIPTION ===
${inputs.jdText}

=== CANDIDATE'S CV ===
${inputs.cvText}

=== STYLE ===
- ${langInstr}
- Length: 250-400 words total.
- Heading: \`# Cover Letter — ${inputs.jobTitle} @ ${inputs.company}\`

Follow the HARD RULES from the system prompt exactly. Output ONLY Markdown.`;

  return { system: SYSTEM_PROMPT, user };
}
