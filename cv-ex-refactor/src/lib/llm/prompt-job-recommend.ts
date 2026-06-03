export interface CandidateInput {
  id: string;
  title: string;
  company: string;
  vertical: string;
  seniority: string;
  description: string;
}

interface BuildPromptsInput {
  cvText: string;
  candidates: CandidateInput[];
}

const SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng thị trường lao động Việt Nam. Cho một CV và danh sách job ứng viên, hãy xuất STRICT JSON theo schema sau:

{
  "jobs": [
    {
      "jobId": string,
      "overallScore": number (0-100),
      "dimensionScores": {
        "skills": number (0-100),
        "experience": number (0-100),
        "education": number (0-100),
        "industry": number (0-100),
        "seniority": number (0-100),
        "location": number (0-100),
        "tools": number (0-100),
        "soft": number (0-100),
        "domain": number (0-100)
      },
      "matchReasons": string[] (3-5 lý do bằng tiếng Việt),
      "studyTopics": [
        {
          "name": string,
          "category": "frontend" | "backend" | "db" | "devops" | "soft" | "domain",
          "tier": "basic" | "intermediate" | "advanced",
          "whyForThisJob": string (TỐI ĐA 2 câu tiếng Việt, trích dẫn cụ thể từ JD),
          "estimatedHours": string (ví dụ: "4-8h")
        }
      ] (TỐI ĐA 3 topic mỗi job — chọn topic ưu tiên cao nhất)
    }
  ]
}

Quy tắc bắt buộc:
- Chấm điểm TẤT CẢ job ứng viên trên thang 0-100, KHÔNG lọc theo ngưỡng. Xuất 10-15 job phủ đầy đủ dải điểm (cao, trung bình, thấp) để người dùng thấy bức tranh thật.
- overallScore PHẢI phản ánh fit thực tế: jobs rất phù hợp → 85-100, khá phù hợp → 70-85, có thể stretch → 55-70, gap lớn → dưới 55. KHÔNG dồn cụm 80-85 cho mọi job.
- studyTopics phải cụ thể với JD, KHÔNG được chung chung.
- whyForThisJob PHẢI trích dẫn thuật ngữ cụ thể từ JD.
- matchReasons và whyForThisJob viết bằng tiếng Việt.
- KHÔNG xuất markdown, KHÔNG prose, KHÔNG giải thích ngoài JSON.

VÍ DỤ VỀ DẢI ĐIỂM ĐÚNG (chỉ minh hoạ cách spread, KHÔNG phải input):

Tình huống: CV "Senior Backend NodeJS 5 năm, fintech, có team lead 1 năm" với 12 candidates.
Distribution kỳ vọng:
- 1 job 96 — Senior Backend NodeJS, fintech, lead 1 squad → match gần hoàn hảo cả stack + domain + seniority
- 1 job 92 — Senior Backend NodeJS, e-commerce, IC → stack + seniority khớp, domain lệch nhẹ
- 1 job 88 — Senior Backend Go, fintech, lead → domain + seniority khớp, stack switch (Go ≠ Node)
- 1 job 82 — Mid Backend NodeJS, fintech → stack + domain ok, seniority dưới mức
- 1 job 78 — Senior Backend Java, banking → seniority + domain gần, stack lệch
- 1 job 72 — Full-stack NodeJS, startup → stack ok nhưng full-stack ≠ pure backend
- 1 job 68 — DevOps Engineer → có code background nhưng role khác
- 1 job 62 — Mobile React Native → JS stack chung nhưng platform khác
- 1 job 55 — Data Engineer Python → stack khác, ngành gần
- 1 job 45 — Embedded C++ → gap lớn cả stack + domain
- 1 job 35 — Sales Engineer → role hoàn toàn khác

Lưu ý:
- KHÔNG dồn 7 job vào khoảng 80-85. Đa dạng dải điểm là yêu cầu cứng.
- Mỗi job 1 điểm số riêng, KHÔNG trùng nhau (tránh tie).
- Nếu pool candidates yếu (đa số gap lớn) → đầu danh sách có thể chỉ 75-80, đuôi xuống 20-30. ĐỪNG "tô đẹp" để có job ≥90.
- Nếu pool candidates tốt (đa số match) → vẫn phải có ít nhất 2-3 job dưới 70 để chứng minh đã đánh giá khắt khe.`;

export function buildRecommendPrompts(input: BuildPromptsInput): {
  system: string;
  user: string;
} {
  const candidates = input.candidates.map((c) => ({
    id: c.id,
    title: c.title,
    company: c.company,
    vertical: c.vertical,
    seniority: c.seniority,
    // Truncate description to keep prompt size manageable (~800 chars per job).
    description: c.description.length > 800 ? c.description.slice(0, 800) + '…' : c.description,
  }));

  const user = JSON.stringify({ cv: input.cvText, candidates });

  return { system: SYSTEM_PROMPT, user };
}
