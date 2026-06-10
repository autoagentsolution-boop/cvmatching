// Job Fit recommend prompt builder. Drives BOTH the /job-fit list AND
// the /job-fit/[jobId] detail page (detail renders cached fields).
//
// 2026-06-10 Phase 1c polish (audit § 6):
//   - 9-dim rubric block (mirrors prompt-analyze-v3 wording for cross-
//     surface consistency).
//   - mustHaves[] injected per job; rule caps overallScore at 65 when
//     a must-have is clearly missing.
//   - Force ≥1 negative matchReason when overallScore < 80.
//   - studyTopics must filter out skills the CV already evidences.
//   - estimatedHours emits as {min, max} object (normalizer also accepts
//     legacy string shape for a transition window).
//   - Description truncation hint — tells LLM where context was cut.
//   - LLM tier field — server still authoritative; drift logged.

export interface CandidateInput {
  id: string;
  title: string;
  company: string;
  vertical: string;
  seniority: string;
  description: string;
  /** Hard-gate requirements parsed at ingest. Empty array when absent. */
  mustHaves?: string[];
}

interface BuildPromptsInput {
  cvText: string;
  candidates: CandidateInput[];
}

const DIMENSION_RUBRIC = `=== 9-DIMENSION RUBRIC (mỗi dim chấm 0-100 cho CV vs job) ===
- skills: core competencies job yêu cầu (system design, pipeline, campaign strategy…)
- experience: depth của real-world delivery — số năm + production exposure
- education: bằng cấp / chứng chỉ / hệ đào tạo có match role hay không
- industry: vertical context (fintech, ad-tech, healthtech, gov…) — depth hay generic
- seniority: level / authority / scope ownership match với title của job
- location: HCM/HN/DN/remote — match với job location preference của CV
- tools: tool stack expected (CRM, framework, BI tool…) — named usage context
- soft: comms, collaboration, stakeholder management — evidenced trong CV
- domain: vertical knowledge depth + nuance specific to job's market`;

const SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng thị trường lao động Việt Nam. Cho một CV và danh sách job ứng viên, hãy xuất STRICT JSON theo schema sau:

{
  "jobs": [
    {
      "jobId": string,
      "overallScore": number (0-100),
      "tier": "S" | "A" | "B" | "C" | "D" | "E",
      "dimensionScores": {
        "skills": number, "experience": number, "education": number,
        "industry": number, "seniority": number, "location": number,
        "tools": number, "soft": number, "domain": number
      },
      "matchReasons": string[] (3-5 lý do bằng tiếng Việt),
      "studyTopics": [
        {
          "name": string,
          "category": "frontend" | "backend" | "db" | "devops" | "soft" | "domain",
          "tier": "basic" | "intermediate" | "advanced",
          "whyForThisJob": string (TỐI ĐA 2 câu tiếng Việt, trích dẫn cụ thể từ JD),
          "estimatedHours": { "min": number, "max": number }
        }
      ] (TỐI ĐA 3 topic mỗi job — chọn topic ưu tiên cao nhất)
    }
  ]
}

${DIMENSION_RUBRIC}

Quy tắc bắt buộc:
- Chấm điểm TẤT CẢ candidates được cấp trên thang 0-100, KHÔNG lọc theo ngưỡng. Xuất nguyên số candidates (thường 6 jobs), phủ đầy đủ dải điểm (cao, trung bình, thấp).
- overallScore PHẢI phản ánh fit thực tế: rất phù hợp 85-100, khá phù hợp 70-85, có thể stretch 55-70, gap lớn dưới 55. KHÔNG dồn cụm 80-85 cho mọi job.
- Mỗi job 1 điểm số riêng (tránh tie). Nếu pool tốt (đa số match) → vẫn phải có ít nhất 1-2 job dưới 70 để chứng minh đánh giá khắt khe. Nếu pool yếu → ĐỪNG "tô đẹp" lên ≥90.
- mustHaves là hard-gate recruiter screen. Nếu CV thiếu MỘT must-have rõ ràng cho job đó: overallScore TỐI ĐA 65 + matchReasons PHẢI bao gồm 1 lý do nêu rõ must-have đang thiếu (trích thẳng tên must-have).
- Với mỗi job có overallScore < 80, matchReasons PHẢI có ≥1 lý do TIÊU CỰC giải thích tại sao score không cao hơn (cite gap cụ thể, KHÔNG generic kiểu "thiếu kinh nghiệm").
- studyTopics PHẢI lọc bỏ topic mà CV đã evidence rõ (skill/tool đã xuất hiện trong CV Key Skills hoặc Experience). Chỉ recommend topic mới cần build. Senior candidate (5+ năm) → ưu tiên deep-dive hoặc adjacent skill, KHÔNG đề xuất basics.
- estimatedHours là object {min, max} (integer giờ). Ví dụ: {"min": 4, "max": 8}. Nếu không estimate được, dùng {"min": 4, "max": 8} làm default.
- tier theo ranh giới: S 95-100, A 85-94, B 75-84, C 65-74, D 55-64, E 0-54. Emit tier cho mỗi job.
- whyForThisJob PHẢI trích dẫn thuật ngữ cụ thể từ JD.
- matchReasons và whyForThisJob viết bằng tiếng Việt.
- KHÔNG xuất markdown, KHÔNG prose, KHÔNG giải thích ngoài JSON.`;

export function buildRecommendPrompts(input: BuildPromptsInput): {
  system: string;
  user: string;
} {
  const candidates = input.candidates.map((c) => {
    // Smart truncation: tell the LLM the cliff exists so it doesn't treat
    // the cut-off as the JD being silent on a topic.
    const description = c.description.length > 800
      ? c.description.slice(0, 800) + ' (…content truncated at 800 chars — judge based on this excerpt)'
      : c.description;
    return {
      id: c.id,
      title: c.title,
      company: c.company,
      vertical: c.vertical,
      seniority: c.seniority,
      description,
      mustHaves: c.mustHaves ?? [],
    };
  });

  const user = JSON.stringify({ cv: input.cvText, candidates });

  return { system: SYSTEM_PROMPT, user };
}
