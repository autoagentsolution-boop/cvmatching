import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Notice — ResumeRefine',
  description: 'How ResumeRefine handles your CV, JD, and account data.',
};

const LAST_UPDATED = '2026-05-27';

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl text-on-surface">
      <header className="mb-8">
        <h1 className="font-display text-display-sm font-bold text-primary">Privacy Notice</h1>
        <p className="text-label-md text-on-surface-variant">
          Cập nhật / Last updated: {LAST_UPDATED}
        </p>
      </header>

      <Section title="Tóm tắt nhanh (TL;DR)">
        <ul>
          <li>
            Chúng tôi <strong>KHÔNG lưu nội dung CV / JD / Profile</strong> của bạn trên server.
            Không database, không filesystem.
          </li>
          <li>
            Khi bạn phân tích, <strong>full text</strong> CV/JD/Profile được gửi tới nhà cung cấp
            LLM bạn chọn (Google Gemini / OpenAI / endpoint OpenAI-compatible) để xử lý. Họ giữ data
            theo policy của họ.
          </li>
          <li>
            Server chỉ lưu <strong>counter quota</strong> (số lần dùng/ngày) và <strong>counter rate-limit</strong>
            (theo IP). Không chứa nội dung, không chứa PII.
          </li>
          <li>
            API key BYOK của bạn chỉ giữ trong <strong>RAM của tab trình duyệt</strong>, không persist
            localStorage. Đóng tab = key biến mất.
          </li>
        </ul>
      </Section>

      <Section title="1. Dữ liệu bạn cung cấp">
        <ul>
          <li>
            <strong>JD text / JD URL:</strong> bạn dán trực tiếp hoặc cho phép server fetch từ URL.
          </li>
          <li>
            <strong>CV text:</strong> bạn dán trực tiếp hoặc upload file PDF/DOCX/TXT (≤ 4MB).
            Server parse in-memory, không ghi file ra disk.
          </li>
          <li>
            <strong>Profile text (tuỳ chọn):</strong> kinh nghiệm thật chưa lên CV — nhạy cảm hơn,
            được gửi cùng channel tới LLM.
          </li>
          <li>
            <strong>Tham số phân tích:</strong> target role, strictness, language, tone, length.
          </li>
        </ul>
      </Section>

      <Section title="2. Bên thứ ba nhận dữ liệu">
        <p>
          Khi bạn nhấn <em>Analyze</em>, <em>Generate CV</em>, hoặc <em>Extract must-haves</em>,
          server forward full text JD/CV/Profile tới một trong các nhà cung cấp sau (phụ thuộc bạn chọn):
        </p>
        <ul>
          <li>
            <strong>Google Gemini</strong> —{' '}
            <a
              href="https://ai.google.dev/gemini-api/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Gemini API Terms
            </a>
            . Retention thông thường ≤ 55 ngày cho abuse review (paid tier có thể disable).
          </li>
          <li>
            <strong>OpenAI</strong> —{' '}
            <a
              href="https://openai.com/policies/api-data-usage-policies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              API Data Usage Policies
            </a>
            . Retention ≤ 30 ngày cho abuse, không train model trên API data.
          </li>
          <li>
            <strong>Custom endpoint</strong> (OpenAI-compatible) — policy phụ thuộc endpoint bạn cấu hình.
          </li>
        </ul>
        <p>
          Nếu bạn đăng nhập Google để dùng shared-key path, <strong>Google OAuth</strong> nhận thông tin
          cơ bản (user id, email, name, avatar URL). Không sync sang nơi khác.
        </p>
      </Section>

      <Section title="3. Server-side lưu gì?">
        <ul>
          <li>
            <strong>Vercel KV (Redis):</strong> chỉ counter dạng <code>q:&#123;userId&#125;:&#123;day&#125;:&#123;kind&#125;</code>
            (quota) và <code>r:&#123;endpoint&#125;:&#123;ip&#125;:&#123;bucket&#125;</code> (rate-limit).
            TTL hết ngày VN (00:00 GMT+7) cho quota, ~60s cho rate-limit. <strong>Không chứa CV/JD/PII.</strong>
          </li>
          <li>
            <strong>Usage metering (KV):</strong> counter aggregated hàng tháng — số lần gọi mỗi
            endpoint, char volume tổng (input + output), tỉ lệ BYOK vs shared. Key dạng
            <code> usage:user:&#123;userId&#125;:&#123;ym&#125;:* </code>. Dùng cho capacity planning
            và quyết định pricing. <strong>Không chứa nội dung CV/JD/LLM output</strong> — chỉ count
            và độ dài. Chỉ admin được cấu hình mới đọc được.
          </li>
          <li>
            <strong>Database:</strong> không có.
          </li>
          <li>
            <strong>Filesystem:</strong> không ghi. File upload xử lý in-memory rồi vứt.
          </li>
          <li>
            <strong>Logs (Vercel stdout):</strong> chỉ metadata operational — endpoint, provider, model,
            byok flag, latency, input/output <em>char count</em>, error message head. KHÔNG có content
            CV/JD/LLM output. Retention theo Vercel plan.
          </li>
        </ul>
      </Section>

      <Section title="4. Client-side lưu gì?">
        <ul>
          <li>
            <strong>localStorage <code>cv-ex-settings-v1</code>:</strong> chỉ preferences LLM
            (provider, model, temperature, baseUrl, useSharedKey). <strong>KHÔNG bao giờ lưu API key.</strong>
          </li>
          <li>
            <strong>In-memory state (Zustand):</strong> CV/JD/Profile text bạn nhập, kết quả phân tích.
            Mất khi refresh tab.
          </li>
          <li>
            <strong>Cookie:</strong> NextAuth JWT session khi đăng nhập (httpOnly, signed, SameSite=Lax).
            Chứa user.id + email + name + avatar URL.
          </li>
        </ul>
      </Section>

      <Section title="5. API key (BYOK) bạn cung cấp được xử lý thế nào?">
        <ul>
          <li>
            Key được giữ trong RAM của tab trong session hiện tại. <strong>Không persist localStorage.</strong>
          </li>
          <li>
            Khi gọi LLM, key đi qua server chúng tôi (TLS) rồi forward tới provider trong HTTP
            Authorization header (TLS). Key value phải plaintext ở HTTP layer để provider validate —
            đây là bản chất của BYOK passthrough.
          </li>
          <li>
            Key không bao giờ được ghi vào log, database, hoặc filesystem ở server.
          </li>
          <li>
            Đóng tab / Clear key → key biến mất hoàn toàn.
          </li>
        </ul>
      </Section>

      <Section title="6. BYOK vs Shared key">
        <ul>
          <li>
            <strong>BYOK:</strong> bạn dùng key của bạn, không tốn quota, không cần đăng nhập. Mọi chi phí
            LLM tính trực tiếp vào tài khoản provider của bạn.
          </li>
          <li>
            <strong>Shared key:</strong> bạn đăng nhập Google, server dùng key của chúng tôi. Giới hạn
            mặc định: <strong>5 phân tích + 2 generate-cv mỗi ngày</strong> (reset 00:00 giờ VN).
          </li>
        </ul>
      </Section>

      <Section title="7. Quyền của bạn">
        <ul>
          <li>
            <strong>Xóa data:</strong> vì chúng tôi không lưu content, không có gì để xóa từ server.
            Quota counter tự reset mỗi ngày.
          </li>
          <li>
            <strong>Revoke Google login:</strong>{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              myaccount.google.com/permissions
            </a>
            .
          </li>
          <li>
            <strong>Xóa data tại LLM provider:</strong> liên hệ trực tiếp Google/OpenAI theo policy
            của họ (link mục 2).
          </li>
        </ul>
      </Section>

      <Section title="8. Security headers áp dụng">
        <ul>
          <li>HTTPS bắt buộc, HSTS preload (2 năm).</li>
          <li>
            Content-Security-Policy với per-request nonce + <code>strict-dynamic</code> chống XSS.
          </li>
          <li>X-Frame-Options: DENY (chống clickjacking).</li>
          <li>X-Content-Type-Options: nosniff.</li>
          <li>Referrer-Policy: strict-origin-when-cross-origin.</li>
          <li>Permissions-Policy: camera/microphone/geolocation tắt.</li>
        </ul>
      </Section>

      <Section title="9. Thay đổi chính sách">
        <p>
          Nếu chúng tôi thay đổi cách xử lý data (vd: thêm provider, bật server-side history), trang
          này sẽ được cập nhật ngày và bạn thấy diff qua git history.
        </p>
      </Section>

      <Section title="10. Liên hệ">
        <p>
          Câu hỏi về privacy: mở issue trên repo dự án hoặc email người maintain.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">{title}</h2>
      <div className="space-y-2 text-body-md text-on-surface-variant [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}
