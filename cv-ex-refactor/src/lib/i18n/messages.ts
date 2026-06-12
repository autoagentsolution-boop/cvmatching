// In-house i18n message catalog. Vietnamese is the source of truth (app
// is Vietnamese-first) — every key MUST exist in both VI and EN, and any
// new key should be added to vi first then translated to en.
//
// Why not next-intl: in-house is faster to ship and leverages the
// existing useAnalysis(s.language) toggle so language change is instant
// (no middleware rewrite, no locale-routed URLs). Trade-off: server
// components default to VI since they cannot read the client store —
// translate at the client boundary instead (most user-facing text is
// already in client components anyway).
//
// Conventions:
//   - Flat-ish key namespacing: `surface.key` (e.g. `nav.signOut`).
//   - Reuse keys across surfaces when wording is identical.
//   - Keep keys stable — rename = treat as migration.

export type Locale = 'vi' | 'en';

export const MESSAGES = {
  vi: {
    // ── Top nav + user menu ────────────────────────────────────────────
    'nav.signIn': 'Đăng nhập với Google',
    'nav.signOut': 'Đăng xuất',
    'nav.dashboard': 'Dashboard',
    'nav.myCVs': 'CV của tôi',
    'nav.history': 'Lịch sử',
    'nav.analyze': 'CV Analyze',
    'nav.jdMatching': 'JD Matching',
    'nav.jobFit': 'Job Fit',
    'nav.careerPath': 'Career Path',
    'nav.refinedCV': 'Refined CV',
    'nav.interview': 'Luyện phỏng vấn',
    'nav.help': 'Trợ giúp',
    'nav.privacy': 'Quyền riêng tư',

    // ── Settings drawer ────────────────────────────────────────────────
    'settings.title': 'Cài đặt LLM',
    'settings.outputLanguage': 'Ngôn ngữ output LLM',
    'settings.outputLanguage.help':
      'Áp dụng cho mọi output do AI sinh ra (analyze, refined CV, roadmap, cover letter, job fit). Toggle này cũng đổi ngôn ngữ UI.',
    'settings.provider': 'Provider',
    'settings.model': 'Model',
    'settings.baseUrl': 'Base URL',
    'settings.temperature': 'Temperature',
    'settings.saveKey': 'Lưu',
    'settings.saving': 'Đang lưu…',

    // ── Common buttons / states ────────────────────────────────────────
    'common.generate': 'Generate',
    'common.regenerate': 'Generate lại',
    'common.cancel': 'Huỷ',
    'common.retry': 'Thử lại',
    'common.dismiss': 'Đóng',
    'common.loading': 'Đang tải…',
    'common.openOriginal': 'Mở bản gốc',
    'common.copy': 'Copy',
    'common.copied': 'Đã copy',

    // ── Language picker ────────────────────────────────────────────────
    'lang.auto': 'Theo CV / JD (Auto)',
    'lang.en': 'English',
    'lang.vi': 'Tiếng Việt',

    // ── Career Path page ───────────────────────────────────────────────
    'careerPath.title': 'Map your',
    'careerPath.titleAccent': 'career path.',
    'careerPath.subtitle':
      'AI phân tích CV và đề xuất các hướng phát triển — chọn một hướng để dựng roadmap chi tiết, hoặc tuỳ chỉnh aspiration nếu muốn rẽ hướng khác.',
    'careerPath.needCv.title': 'Cần phân tích CV trước',
    'careerPath.needCv.desc':
      'Career Path đề xuất hướng nghề nghiệp dài hạn dựa trên CV của bạn. Hãy bắt đầu ở Analyze (paste CV) — kết quả sẽ dùng để gợi ý 3-5 path khả thi + roadmap.',
    'careerPath.needCv.cta': 'Bắt đầu ở Analyze',
    'careerPath.start.title': 'Tạo lộ trình sự nghiệp',
    'careerPath.start.titleSelected': 'Tạo lộ trình cho "{role}"',
    'careerPath.start.desc':
      'AI sẽ dựng roadmap tự nhiên từ CV của bạn. Hoặc xem các tùy chọn bên dưới để chọn hướng / tự nhập aspiration trước.',
    'careerPath.start.descSelected': 'Đã chọn hướng. Bấm Generate để dựng roadmap chi tiết.',
    'careerPath.suggest.cta': 'AI đề xuất 3-5 hướng (1 quota)',
    'careerPath.suggest.ctaPre': 'AI đề xuất 3-5 hướng trước (1 quota)',
    'careerPath.customAspiration.show': 'Tuỳ chỉnh aspiration thủ công',
    'careerPath.customAspiration.hide': 'Ẩn tuỳ chỉnh aspiration',
    'careerPath.loading': 'Đang xây lộ trình sự nghiệp...',
    'careerPath.error.title': 'Tạo lộ trình thất bại',
    'careerPath.current.title': 'Lộ trình hiện tại',
    'careerPath.current.desc':
      'Bạn có thể tinh chỉnh aspiration hoặc chọn hướng khác phía trên rồi Regenerate.',
    'careerPath.note': 'Lưu ý:',

    // ── Refined CV page ────────────────────────────────────────────────
    'refinedCV.title': 'Refined CV',
    'refinedCV.regenerate': 'Regenerate',
    'refinedCV.regenerating': 'Regenerating…',
    'refinedCV.tone': 'Tone',
    'refinedCV.length': 'Length',
    'refinedCV.aspirationRole': 'Aspiration role (optional)',
    'refinedCV.aspirationRole.help':
      "Where you're heading. Summary + top bullets will frame existing experience as trajectory evidence.",
    'refinedCV.aspirationRole.placeholder': 'e.g. Staff Engineer, Director of Platform, ML Tech Lead',
    'refinedCV.extraInstructions': 'Extra instructions',
    'refinedCV.extraInstructions.placeholder': 'e.g. Emphasise leadership experience...',
    'refinedCV.controls.title': 'Refine Controls',

    // ── Cover Letter block ─────────────────────────────────────────────
    'coverLetter.title': 'Generate Cover Letter',
    'coverLetter.descSuffix':
      'Quota: 3 lần / ngày.',
    'coverLetter.tone.professional': 'Professional',
    'coverLetter.tone.warm': 'Warm',
    'coverLetter.tone.concise': 'Concise',
    'coverLetter.tone.leadership': 'Leadership',
    'coverLetter.length.short': 'Short (150-200 words)',
    'coverLetter.length.medium': 'Medium (250-400 words)',
    'coverLetter.length.long': 'Long (400-550 words)',
    'coverLetter.addressGap': 'Address top critical gap from analysis (1 sentence near the close)',
    'coverLetter.quotaRemaining': 'Còn {n} lần hôm nay',
    'coverLetter.error': 'Cover Letter thất bại',
    'coverLetter.needCv': 'Cần CV trong phiên — chạy Analyze trước.',

    // ── JD Matching ────────────────────────────────────────────────────
    'jdMatch.readyTitle': 'Sẵn sàng so khớp CV với JD',
    'jdMatch.readyDesc':
      'Nhập JD bằng cách paste, fetch URL hoặc upload PDF/Word. Hệ thống sẽ so khớp với CV theo 9 chiều và surface các gap ưu tiên cần khép lại.',
    'jdMatch.cta': 'Match CV vs JD',
    'jdMatch.loading': 'Đang so khớp CV vs JD…',
    'jdMatch.error': 'JD Matching thất bại',
    'jdMatch.swap': 'So khớp với JD khác',
    'jdMatch.swap.help':
      'Nhập JD khác. Chạy match mới sẽ thay kết quả phía trên.',

    // ── Analyze ────────────────────────────────────────────────────────
    'analyze.runCta': 'Phân tích CV',
    'analyze.loading': 'Đang phân tích CV…',
    'analyze.error': 'Phân tích thất bại',

    // ── Interview Practice ─────────────────────────────────────────────
    'interview.landing.title': 'Luyện phỏng vấn',
    'interview.landing.subtitle':
      'AI phân tích góc nhìn của recruiter và của bạn cho vị trí mục tiêu, rồi sinh 10 câu hỏi medium-hard có rubric. Trả lời xong, AI chấm theo thang 0-3 và đề xuất cải thiện cụ thể.',
    'interview.mode.jobFit': 'Theo Job đã apply',
    'interview.mode.standalone': 'Theo vị trí mục tiêu',
    'interview.field.targetRole': 'Vị trí mục tiêu',
    'interview.field.targetRole.help': 'Tên role bạn muốn luyện phỏng vấn (vd: "Senior Backend Engineer").',
    'interview.field.anchorCv': 'CV neo (lấy ngữ cảnh kinh nghiệm)',
    'interview.field.anchorCv.help': 'Chọn CV trong thư viện. AI dùng để anchor câu behavioral / scenario vào kinh nghiệm thực.',
    'interview.field.anchorRoleTitle': 'Tên role trong CV neo',
    'interview.field.anchorRoleTitle.help': 'Role nào trong CV bạn muốn AI dùng làm chuẩn (vd: "Backend Engineer @ Foo Corp").',
    'interview.field.provider': 'Provider',
    'interview.start.button': 'Bắt đầu phỏng vấn',
    'interview.start.loading': 'Đang sinh câu hỏi…',
    'interview.start.disabled': 'Điền đầy đủ form để bắt đầu',
    'interview.start.cost.notice': 'Sẽ tiêu 1 lượt gọi LLM bằng API key của bạn.',
    'interview.byok.title': 'Cần API key riêng',
    'interview.byok.body':
      'Interview Practice v1 chỉ chạy với API key của bạn (Gemini / OpenAI / Anthropic). Mở Settings → BYOK dán key, rồi quay lại đây.',
    'interview.byok.cta': 'Mở Settings',
    'interview.dualLens.title': 'Góc nhìn',
    'interview.dualLens.recruiterHire': 'Recruiter: Lý do đồng ý',
    'interview.dualLens.recruiterNoHire': 'Recruiter: Lý do e ngại',
    'interview.dualLens.candidateHire': 'Bạn: Lý do đồng ý',
    'interview.dualLens.candidateNoHire': 'Bạn: Lý do e ngại',
    'interview.dualLens.reasons': 'Lý do',
    'interview.dualLens.signals': 'Tín hiệu',
    'interview.dualLens.risks': 'Rủi ro',
    'interview.dualLens.gaps': 'Thiếu hụt',
    'interview.dualLens.opportunities': 'Cơ hội',
    'interview.dualLens.growth': 'Tăng trưởng',
    'interview.dualLens.mismatches': 'Lệch pha',
    'interview.question.behavioral': 'Behavioral',
    'interview.question.technical': 'Technical',
    'interview.question.scenario': 'Scenario',
    'interview.question.placeholder': 'Viết câu trả lời của bạn ở đây — càng cụ thể (metric, trade-off, ngữ cảnh) càng tốt.',
    'interview.question.charCount': '{count}/{max}',
    'interview.submit.button': 'Nộp tất cả câu trả lời',
    'interview.submit.loading': 'Đang chấm điểm…',
    'interview.submit.disabled': 'Điền đủ 10 câu để nộp',
    'interview.results.overallScore': 'Điểm tổng',
    'interview.results.subtitle': 'Trên thang 0-10, trung bình từ 10 câu (mỗi câu chấm 0-10).',
    'interview.results.gradeFeedback': 'Nhận xét',
    'interview.results.improvements': 'Cải thiện',
    'interview.history.title': 'Phiên luyện gần đây',
    'interview.history.empty': 'Chưa có phiên nào. Bắt đầu phiên đầu từ Job Fit hoặc trang Luyện phỏng vấn.',
    'interview.history.viewResults': 'Xem kết quả',
    'interview.history.resume': 'Tiếp tục',
    'interview.errors.sessionExpired': 'Session đã hết hạn (>24h chưa hoàn thành). Bắt đầu phiên mới.',
    'interview.errors.providerDown': 'Provider quá tải. Thử lại sau ít phút.',
    'interview.errors.badOutput': 'LLM trả định dạng không hợp lệ. Thử lại.',
    'interview.grade.fail': 'Fail',
    'interview.grade.weak': 'Yếu',
    'interview.grade.solid': 'Khá',
    'interview.grade.excellent': 'Xuất sắc',
    'interview.jobFitCta.label': 'Luyện phỏng vấn cho job này',

    // Study plan (post-grade)
    'interview.studyPlan.title': 'Lộ trình học gợi ý',
    'interview.studyPlan.subtitle': 'Dựa trên các câu trả lời yếu, AI gom thành 2-4 chủ đề và đề xuất khóa học + tài liệu miễn phí cho từng chủ đề.',
    'interview.studyPlan.generate': 'Tạo lộ trình học',
    'interview.studyPlan.generating': 'Đang sinh lộ trình…',
    'interview.studyPlan.notice': 'Sẽ tốn 1 lượt gọi LLM bằng BYOK key. Chỉ tạo được 1 lần / session.',
    'interview.studyPlan.linkedQuestions': 'Bắt nguồn từ',
    'interview.studyPlan.courses': 'Khóa học',
    'interview.studyPlan.freeResource': 'Tài liệu miễn phí',
    'interview.studyPlan.searchHint': 'Tìm tên khóa trên platform — link không được kèm để tránh URL sai.',
    'interview.studyPlan.difficulty.beginner': 'Cơ bản',
    'interview.studyPlan.difficulty.intermediate': 'Trung cấp',
    'interview.studyPlan.difficulty.advanced': 'Nâng cao',
    'interview.studyPlan.hours': '~{hours}h',
    'interview.studyPlan.freeKind.youtube': 'YouTube',
    'interview.studyPlan.freeKind.docs': 'Official docs',
    'interview.studyPlan.freeKind.book': 'Sách',
  },

  en: {
    // ── Top nav + user menu ────────────────────────────────────────────
    'nav.signIn': 'Sign in with Google',
    'nav.signOut': 'Sign out',
    'nav.dashboard': 'Dashboard',
    'nav.myCVs': 'My CVs',
    'nav.history': 'History',
    'nav.analyze': 'CV Analyze',
    'nav.jdMatching': 'JD Matching',
    'nav.jobFit': 'Job Fit',
    'nav.careerPath': 'Career Path',
    'nav.refinedCV': 'Refined CV',
    'nav.interview': 'Interview Practice',
    'nav.help': 'Help',
    'nav.privacy': 'Privacy',

    // ── Settings drawer ────────────────────────────────────────────────
    'settings.title': 'LLM Settings',
    'settings.outputLanguage': 'LLM output language',
    'settings.outputLanguage.help':
      'Applies to all AI-generated output (analyze, refined CV, roadmap, cover letter, job fit). This toggle also switches the UI language.',
    'settings.provider': 'Provider',
    'settings.model': 'Model',
    'settings.baseUrl': 'Base URL',
    'settings.temperature': 'Temperature',
    'settings.saveKey': 'Save',
    'settings.saving': 'Saving…',

    // ── Common buttons / states ────────────────────────────────────────
    'common.generate': 'Generate',
    'common.regenerate': 'Regenerate',
    'common.cancel': 'Cancel',
    'common.retry': 'Retry',
    'common.dismiss': 'Dismiss',
    'common.loading': 'Loading…',
    'common.openOriginal': 'Open original',
    'common.copy': 'Copy',
    'common.copied': 'Copied',

    // ── Language picker ────────────────────────────────────────────────
    'lang.auto': 'Match CV / JD (Auto)',
    'lang.en': 'English',
    'lang.vi': 'Vietnamese',

    // ── Career Path page ───────────────────────────────────────────────
    'careerPath.title': 'Map your',
    'careerPath.titleAccent': 'career path.',
    'careerPath.subtitle':
      'AI analyzes your CV and proposes growth directions — pick one to build a detailed roadmap, or customize an aspiration to pivot somewhere new.',
    'careerPath.needCv.title': 'Analyze a CV first',
    'careerPath.needCv.desc':
      'Career Path proposes long-term directions based on your CV. Start at Analyze (paste CV) — the result will seed 3-5 viable paths + a roadmap.',
    'careerPath.needCv.cta': 'Start at Analyze',
    'careerPath.start.title': 'Build a career roadmap',
    'careerPath.start.titleSelected': 'Roadmap for "{role}"',
    'careerPath.start.desc':
      'AI will build a natural roadmap from your CV. Or use the options below to pick a direction / enter an aspiration first.',
    'careerPath.start.descSelected': 'Direction picked. Click Generate to build the detailed roadmap.',
    'careerPath.suggest.cta': 'AI suggest 3-5 paths (1 quota)',
    'careerPath.suggest.ctaPre': 'AI suggest 3-5 paths first (1 quota)',
    'careerPath.customAspiration.show': 'Customize aspiration manually',
    'careerPath.customAspiration.hide': 'Hide aspiration customizer',
    'careerPath.loading': 'Building your career roadmap...',
    'careerPath.error.title': 'Roadmap generation failed',
    'careerPath.current.title': 'Current roadmap',
    'careerPath.current.desc':
      'Refine your aspiration or pick a different direction above, then Regenerate.',
    'careerPath.note': 'Note:',

    // ── Refined CV page ────────────────────────────────────────────────
    'refinedCV.title': 'Refined CV',
    'refinedCV.regenerate': 'Regenerate',
    'refinedCV.regenerating': 'Regenerating…',
    'refinedCV.tone': 'Tone',
    'refinedCV.length': 'Length',
    'refinedCV.aspirationRole': 'Aspiration role (optional)',
    'refinedCV.aspirationRole.help':
      "Where you're heading. Summary + top bullets will frame existing experience as trajectory evidence.",
    'refinedCV.aspirationRole.placeholder': 'e.g. Staff Engineer, Director of Platform, ML Tech Lead',
    'refinedCV.extraInstructions': 'Extra instructions',
    'refinedCV.extraInstructions.placeholder': 'e.g. Emphasize leadership experience...',
    'refinedCV.controls.title': 'Refine Controls',

    // ── Cover Letter block ─────────────────────────────────────────────
    'coverLetter.title': 'Generate Cover Letter',
    'coverLetter.descSuffix': 'Quota: 3 per day.',
    'coverLetter.tone.professional': 'Professional',
    'coverLetter.tone.warm': 'Warm',
    'coverLetter.tone.concise': 'Concise',
    'coverLetter.tone.leadership': 'Leadership',
    'coverLetter.length.short': 'Short (150-200 words)',
    'coverLetter.length.medium': 'Medium (250-400 words)',
    'coverLetter.length.long': 'Long (400-550 words)',
    'coverLetter.addressGap': 'Address top critical gap from analysis (1 sentence near the close)',
    'coverLetter.quotaRemaining': '{n} left today',
    'coverLetter.error': 'Cover Letter failed',
    'coverLetter.needCv': 'No CV in session — run Analyze first.',

    // ── JD Matching ────────────────────────────────────────────────────
    'jdMatch.readyTitle': 'Ready to match CV vs JD',
    'jdMatch.readyDesc':
      'Bring in a job description by pasting it, fetching a URL, or uploading a PDF/Word file. We will compare it against your CV across 9 recruiter dimensions and surface the priority gaps to close.',
    'jdMatch.cta': 'Match CV vs JD',
    'jdMatch.loading': 'Matching CV vs JD…',
    'jdMatch.error': 'JD Matching failed',
    'jdMatch.swap': 'Match a different JD',
    'jdMatch.swap.help':
      'Bring in another job description. Running a new match replaces the result above.',

    // ── Analyze ────────────────────────────────────────────────────────
    'analyze.runCta': 'Analyze CV',
    'analyze.loading': 'Analyzing CV…',
    'analyze.error': 'Analysis failed',

    // ── Interview Practice ─────────────────────────────────────────────
    'interview.landing.title': 'Interview Practice',
    'interview.landing.subtitle':
      'AI analyzes the role from the recruiter\'s view and yours, then generates 10 medium-hard interview questions with rubrics. Answer them, AI grades on a 0-3 scale with concrete improvements.',
    'interview.mode.jobFit': 'For an applied job',
    'interview.mode.standalone': 'For a target role',
    'interview.field.targetRole': 'Target role',
    'interview.field.targetRole.help': 'The role you want to practice for (e.g. "Senior Backend Engineer").',
    'interview.field.anchorCv': 'Anchor CV (for experience context)',
    'interview.field.anchorCv.help': 'Pick a CV from your library. AI uses it to anchor behavioral / scenario questions to your real experience.',
    'interview.field.anchorRoleTitle': 'Role title within the anchor CV',
    'interview.field.anchorRoleTitle.help': 'Which role inside this CV should AI use as the baseline (e.g. "Backend Engineer @ Foo Corp").',
    'interview.field.provider': 'Provider',
    'interview.start.button': 'Start interview',
    'interview.start.loading': 'Generating questions…',
    'interview.start.disabled': 'Fill in the form to start',
    'interview.start.cost.notice': 'Will consume 1 LLM call against your own API key.',
    'interview.byok.title': 'BYOK API key required',
    'interview.byok.body':
      'Interview Practice v1 only runs against your own API key (Gemini / OpenAI / Anthropic). Open Settings → BYOK to paste your key, then come back.',
    'interview.byok.cta': 'Open Settings',
    'interview.dualLens.title': 'Perspectives',
    'interview.dualLens.recruiterHire': 'Recruiter: Case for',
    'interview.dualLens.recruiterNoHire': 'Recruiter: Case against',
    'interview.dualLens.candidateHire': 'You: Case for',
    'interview.dualLens.candidateNoHire': 'You: Case against',
    'interview.dualLens.reasons': 'Reasons',
    'interview.dualLens.signals': 'Signals',
    'interview.dualLens.risks': 'Risks',
    'interview.dualLens.gaps': 'Gaps',
    'interview.dualLens.opportunities': 'Opportunities',
    'interview.dualLens.growth': 'Growth',
    'interview.dualLens.mismatches': 'Mismatches',
    'interview.question.behavioral': 'Behavioral',
    'interview.question.technical': 'Technical',
    'interview.question.scenario': 'Scenario',
    'interview.question.placeholder': 'Write your answer here — the more specific (metrics, trade-offs, context), the better.',
    'interview.question.charCount': '{count}/{max}',
    'interview.submit.button': 'Submit all answers',
    'interview.submit.loading': 'Grading…',
    'interview.submit.disabled': 'Fill in all 10 answers to submit',
    'interview.results.overallScore': 'Overall score',
    'interview.results.subtitle': 'On a 0-10 scale, averaged across 10 questions (each scored 0-10).',
    'interview.results.gradeFeedback': 'Feedback',
    'interview.results.improvements': 'Improvements',
    'interview.history.title': 'Recent practice sessions',
    'interview.history.empty': 'No sessions yet. Start your first one from Job Fit or the Interview Practice page.',
    'interview.history.viewResults': 'View results',
    'interview.history.resume': 'Resume',
    'interview.errors.sessionExpired': 'Session expired (>24h not completed). Start a new one.',
    'interview.errors.providerDown': 'Provider is overloaded. Try again in a few minutes.',
    'interview.errors.badOutput': 'LLM returned an invalid format. Try again.',
    'interview.grade.fail': 'Fail',
    'interview.grade.weak': 'Weak',
    'interview.grade.solid': 'Solid',
    'interview.grade.excellent': 'Excellent',
    'interview.jobFitCta.label': 'Practice interview for this job',

    // Study plan (post-grade)
    'interview.studyPlan.title': 'Recommended study plan',
    'interview.studyPlan.subtitle': 'Based on your weak answers, AI clusters them into 2-4 themes and recommends courses + free resources per theme.',
    'interview.studyPlan.generate': 'Generate study plan',
    'interview.studyPlan.generating': 'Generating…',
    'interview.studyPlan.notice': 'Costs 1 LLM call against your BYOK key. Generated once per session.',
    'interview.studyPlan.linkedQuestions': 'Stems from',
    'interview.studyPlan.courses': 'Courses',
    'interview.studyPlan.freeResource': 'Free resource',
    'interview.studyPlan.searchHint': 'Search the course title on the platform — URLs are intentionally omitted to avoid broken links.',
    'interview.studyPlan.difficulty.beginner': 'Beginner',
    'interview.studyPlan.difficulty.intermediate': 'Intermediate',
    'interview.studyPlan.difficulty.advanced': 'Advanced',
    'interview.studyPlan.hours': '~{hours}h',
    'interview.studyPlan.freeKind.youtube': 'YouTube',
    'interview.studyPlan.freeKind.docs': 'Official docs',
    'interview.studyPlan.freeKind.book': 'Book',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['vi'];

/**
 * Translate. Supports {placeholder} interpolation via `vars`.
 * Falls back to the key string itself when an unknown key sneaks in
 * (instead of throwing) so a missing translation never breaks render.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const bundle = MESSAGES[locale] ?? MESSAGES.vi;
  const raw = (bundle as Record<string, string>)[key] ?? MESSAGES.vi[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => {
    const v = vars[name];
    return v === undefined ? m : String(v);
  });
}
