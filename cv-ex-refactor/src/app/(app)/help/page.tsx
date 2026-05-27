import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help — ResumeRefine',
  description: 'Hướng dẫn sử dụng ResumeRefine.',
};

export default function HelpPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl text-on-surface">
      <header className="mb-8">
        <h1 className="font-display text-display-sm font-bold text-primary">Help</h1>
        <p className="text-body-md text-on-surface-variant">
          Hướng dẫn sử dụng ResumeRefine — từ phân tích CV đến viết lại CV phù hợp với JD.
        </p>
      </header>

      <Section title="Bắt đầu nhanh (3 bước)">
        <ol>
          <li>
            <strong>Dán hoặc nhập JD:</strong> dán văn bản mô tả công việc vào ô <em>Job
            Description</em>, hoặc nhập URL tin tuyển dụng (LinkedIn, công ty, job board) — app sẽ
            tự lấy nội dung.
          </li>
          <li>
            <strong>Dán hoặc upload CV:</strong> dán văn bản hoặc kéo thả file (PDF / DOCX / TXT,
            tối đa 4MB) vào ô <em>Your CV</em>.
          </li>
          <li>
            <strong>Nhấn Analyze:</strong> app sẽ chấm điểm CV của bạn so với JD trên 9 tiêu chí,
            chỉ ra điểm mạnh, gap, và đề xuất chỉnh sửa cụ thể.
          </li>
        </ol>
      </Section>

      <Section title="Hiểu kết quả phân tích">
        <p>Sau khi Analyze, bạn nhận được:</p>
        <ul>
          <li>
            <strong>Tổng quan:</strong> điểm tổng (Overall Score), xác suất qua màn screening đầu
            tiên, đánh giá mức độ rủi ro tuyển dụng.
          </li>
          <li>
            <strong>9 tiêu chí:</strong> mỗi tiêu chí được chấm 0–100 dựa trên CV của bạn so với
            yêu cầu cụ thể của JD. Xem từng tiêu chí có lý do giải thích chi tiết:
            <ul>
              <li>
                <strong>Core skill / Tool / Scope / Production / Domain</strong> — kỹ năng cốt lõi,
                công cụ, phạm vi công việc, môi trường thực tế, lĩnh vực
              </li>
              <li>
                <strong>Evidence / Seniority / Impact / Communication</strong> — bằng chứng cụ
                thể, mức độ kinh nghiệm, tác động đo lường, giao tiếp
              </li>
            </ul>
          </li>
          <li>
            <strong>Strengths (Điểm mạnh):</strong> những gì CV của bạn đã thể hiện rõ phù hợp với
            JD.
          </li>
          <li>
            <strong>Gaps (Khoảng trống):</strong> những gì còn thiếu hoặc chưa rõ. Mỗi gap có
            <em> type</em>:
            <ul>
              <li>
                <strong>wording</strong> — bạn có kinh nghiệm nhưng CV chưa diễn đạt rõ → có thể
                sửa CV
              </li>
              <li>
                <strong>real</strong> — bạn thực sự thiếu → cần upskill hoặc trung thực thừa nhận
              </li>
            </ul>
          </li>
          <li>
            <strong>Coverage:</strong> bảng đối chiếu từng yêu cầu của JD với bằng chứng trong CV
            (match / partial / missing).
          </li>
          <li>
            <strong>Recommendations:</strong> các bước cụ thể để cải thiện, có ưu tiên cao/vừa/thấp.
          </li>
        </ul>
      </Section>

      <Section title="Tùy chỉnh điểm số (Sliders)">
        <p>
          Sau khi Analyze, mỗi tiêu chí hiện dưới dạng thanh trượt. <strong>Số mặc định = đánh giá
          của AI</strong> dựa trên CV của bạn vs JD.
        </p>
        <p>
          Nếu bạn không đồng ý với AI ở một tiêu chí (vd: AI chấm bạn 60 ở "Tool" nhưng thực sự bạn
          rất mạnh) → kéo thanh trượt để điều chỉnh. <strong>Overall Score sẽ tính lại ngay</strong>
          theo điểm bạn đặt.
        </p>
        <p>
          Lưu ý: chỉ Overall Score tính lại. Phần Strengths / Gaps / Recommendations vẫn giữ
          nguyên (vì đó là phân tích từ JD/CV cụ thể, không tỉ lệ thuận đơn thuần với điểm số).
        </p>
      </Section>

      <Section title="Must-Haves (Yêu cầu bắt buộc)">
        <p>
          App tự động trích các yêu cầu cứng từ JD (vd: "5 năm kinh nghiệm Python", "AWS
          certification"). Đây là <strong>hard gate</strong> recruiter dùng để loại CV ngay vòng
          screening.
        </p>
        <p>
          Nếu CV của bạn thiếu một must-have nào → app sẽ đánh dấu gap đó là <strong>critical
          </strong> và đưa vào ưu tiên cao trong Recommendations. Có thể chỉnh sửa list must-have
          thủ công nếu app trích sai.
        </p>
      </Section>

      <Section title="Viết lại CV (Generate CV)">
        <p>
          Sau khi có kết quả analysis, sang tab <em>Refined CV</em> để app viết lại CV của bạn phù
          hợp hơn với JD. Tùy chọn:
        </p>
        <ul>
          <li>
            <strong>Tone:</strong>
            <ul>
              <li>
                <em>Concise</em> — ngắn gọn, chuyên nghiệp
              </li>
              <li>
                <em>Impact</em> — dẫn đầu bằng kết quả đo lường được
              </li>
              <li>
                <em>Recruiter</em> — ATS-friendly, lặp lại từ khoá JD đúng chỗ
              </li>
              <li>
                <em>Executive</em> — nhấn quyền sở hữu, phạm vi lãnh đạo, kết quả kinh doanh
              </li>
            </ul>
          </li>
          <li>
            <strong>Độ dài:</strong> Short (1 trang), Medium (1.5), Long (2 trang).
          </li>
          <li>
            <strong>Ngôn ngữ:</strong> EN / VN / auto (theo ngôn ngữ JD).
          </li>
          <li>
            <strong>Extra instructions:</strong> hướng dẫn thêm (vd: "highlight startup experience").
          </li>
        </ul>
        <p>
          App <strong>không bịa kinh nghiệm</strong>. Chỉ diễn đạt lại những gì bạn đã có (trong
          CV + profile) cho khớp với JD. Phần cuối CV mới sẽ có mục "Changes Made" liệt kê cụ thể
          những gì app đã chỉnh và những gap nào CỐ Ý không lấp (vì sẽ rủi ro khi phỏng vấn).
        </p>
      </Section>

      <Section title="API Key: dùng key của bạn (BYOK) hay key của app (Shared)?">
        <table className="w-full border-collapse text-label-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="px-2 py-2 text-left font-medium">Tiêu chí</th>
              <th className="px-2 py-2 text-left font-medium">BYOK</th>
              <th className="px-2 py-2 text-left font-medium">Shared key</th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-2 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-outline-variant/50">
            <tr>
              <td>Đăng nhập</td>
              <td>Không cần</td>
              <td>Bắt buộc (Google)</td>
            </tr>
            <tr>
              <td>Hạn mức</td>
              <td>Không giới hạn</td>
              <td>5 analyze + 2 generate-cv / ngày</td>
            </tr>
            <tr>
              <td>Ai trả phí</td>
              <td>Bạn (qua tài khoản provider của bạn)</td>
              <td>Chúng tôi</td>
            </tr>
            <tr>
              <td>Privacy</td>
              <td>Tối ưu — key chỉ ở phiên hiện tại</td>
              <td>Phụ thuộc chính sách provider</td>
            </tr>
            <tr>
              <td>Setup</td>
              <td>Lấy key từ Gemini / OpenAI, dán vào Settings</td>
              <td>Click Login → Continue with Google</td>
            </tr>
          </tbody>
        </table>
        <p>
          Lấy Gemini API key (miễn phí ở tier cơ bản):{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            aistudio.google.com/apikey
          </a>
        </p>
        <p>
          Lấy OpenAI API key:{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            platform.openai.com/api-keys
          </a>
        </p>
      </Section>

      <Section title="FAQ">
        <dl className="space-y-4">
          <Faq q="Hết hạn mức trong ngày, làm sao tiếp tục?">
            Mở <em>Settings</em> → tắt "Use shared key" → dán API key của bạn (BYOK) vào → tiếp tục
            phân tích không giới hạn. Hạn mức shared key sẽ tự reset lúc 00:00 giờ Việt Nam.
          </Faq>
          <Faq q="Upload CV nhưng app báo 'không trích được nội dung'?">
            File có thể là PDF dạng ảnh (scan). App chỉ đọc được text. Giải pháp: mở file CV bằng
            Word/Google Docs, copy text, dán trực tiếp vào ô CV.
          </Faq>
          <Faq q="Nhập URL JD nhưng app báo 'có anti-bot'?">
            Một số trang (LinkedIn, một số ATS) chặn scraper. Giải pháp: mở link trong trình duyệt,
            copy text JD, dán vào ô.
          </Faq>
          <Faq q="Kết quả phân tích không chính xác?">
            Vài cách cải thiện:
            <ul className="mt-1">
              <li>Chọn ngành nghề (Target Role) đúng với JD</li>
              <li>Điều chỉnh Strictness — Strict cho recruiter, Friendly khi tự đánh giá</li>
              <li>
                Thêm thông tin vào Profile (kinh nghiệm thật chưa lên CV) — giúp app phân biệt
                wording-gap vs real-gap
              </li>
              <li>Kéo slider điều chỉnh điểm số nếu bạn không đồng ý với AI</li>
            </ul>
          </Faq>
          <Faq q="Generate CV ra kết quả không hài lòng?">
            Thử đổi Tone (Concise / Impact / Recruiter / Executive), độ dài, hoặc thêm Extra
            Instructions cụ thể. Nếu vẫn không đạt → analyze lại với profile chi tiết hơn.
          </Faq>
          <Faq q="App có lưu CV/JD của tôi không?">
            Không. Sau khi phân tích xong, không có nội dung nào được lưu trên server chúng tôi.
            Chi tiết ở <a href="/privacy" className="text-primary underline">Privacy Notice</a>.
          </Faq>
        </dl>
      </Section>

      <Section title="Liên hệ hỗ trợ">
        <p>Có bug, đề xuất tính năng, hoặc câu hỏi khác — vui lòng liên hệ qua kênh hỗ trợ của ứng dụng.</p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">{title}</h2>
      <div className="space-y-2 text-body-md text-on-surface-variant [&_dd]:mt-1 [&_dt]:font-medium [&_dt]:text-on-surface [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-body-md font-medium text-on-surface">{q}</dt>
      <dd className="text-body-md text-on-surface-variant">{children}</dd>
    </div>
  );
}
