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
          "whyForThisJob": string (1-2 câu tiếng Việt, trích dẫn cụ thể từ JD),
          "estimatedHours": string (ví dụ: "4-8h")
        }
      ] (3-5 topic mỗi job — chọn topic ưu tiên cao nhất)
    }
  ]
}

Quy tắc bắt buộc:
- Chỉ xuất những job có overallScore > 80; tổng cộng 3-5 job (chọn fit nhất).
- studyTopics phải cụ thể với JD, KHÔNG được chung chung.
- whyForThisJob PHẢI trích dẫn thuật ngữ cụ thể từ JD.
- matchReasons và whyForThisJob viết bằng tiếng Việt.
- KHÔNG xuất markdown, KHÔNG prose, KHÔNG giải thích ngoài JSON.`;

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
