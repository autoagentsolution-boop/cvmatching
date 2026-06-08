import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Notice — Resume Refactor',
  description: 'How Resume Refactor handles your CV and JD data.',
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

      <Section title="Tóm tắt">
        <ul>
          <li>
            <strong>Chúng tôi không lưu nội dung CV / JD của bạn.</strong> Sau khi phân tích xong,
            văn bản bạn dán/upload không tồn tại trên server của chúng tôi nữa.
          </li>
          <li>
            Để phân tích được, văn bản CV và JD của bạn sẽ được gửi tới{' '}
            <strong>nhà cung cấp AI bạn chọn</strong> (Google Gemini hoặc OpenAI). Họ xử lý theo
            chính sách riêng — xem mục 3.
          </li>
          <li>
            API key bạn nhập (nếu dùng BYOK) chỉ giữ trong tab trình duyệt của bạn cho phiên hiện
            tại, không lưu đâu khác. Đóng tab = key biến mất.
          </li>
          <li>
            Khi đăng nhập Google, chúng tôi chỉ nhận thông tin cơ bản tài khoản của bạn (tên, email,
            ảnh đại diện).
          </li>
        </ul>
      </Section>

      <Section title="1. Dữ liệu chúng tôi sử dụng">
        <p>Khi bạn dùng app, bạn cung cấp các dữ liệu sau:</p>
        <ul>
          <li>
            <strong>Mô tả công việc (JD):</strong> bạn dán văn bản hoặc nhập URL để app tự lấy.
          </li>
          <li>
            <strong>CV của bạn:</strong> bạn dán văn bản hoặc upload file (PDF, DOCX, TXT — tối đa
            4MB).
          </li>
          <li>
            <strong>Profile bổ sung (tuỳ chọn):</strong> kinh nghiệm thật của bạn chưa có trong CV —
            giúp app phân biệt giữa "thiếu skill thật" và "CV chưa diễn đạt rõ".
          </li>
          <li>
            <strong>Tham số phân tích:</strong> ngành nghề, độ khắt khe, ngôn ngữ phản hồi, phong
            cách viết CV.
          </li>
        </ul>
        <p>
          Nếu bạn đăng nhập Google: tên, email, ID Google và ảnh đại diện. Chỉ vậy — chúng tôi không
          truy cập email, lịch, drive hay bất kỳ dữ liệu Google nào khác của bạn.
        </p>
      </Section>

      <Section title="2. Khi bạn nhấn Analyze hoặc Generate CV">
        <p>
          Văn bản JD + CV + profile của bạn được gửi tới <strong>nhà cung cấp AI bạn chọn</strong>{' '}
          (cấu hình trong Settings):
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
              Điều khoản API
            </a>
            . Google giữ data tạm thời để chống lạm dụng (thường ≤ 55 ngày), không dùng để huấn
            luyện model trên gói trả phí.
          </li>
          <li>
            <strong>OpenAI</strong> —{' '}
            <a
              href="https://openai.com/policies/api-data-usage-policies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Chính sách sử dụng data API
            </a>
            . OpenAI giữ ≤ 30 ngày cho việc chống lạm dụng, không huấn luyện model trên API data.
          </li>
          <li>
            <strong>Endpoint tuỳ chỉnh</strong> (nếu bạn cấu hình): chính sách tuỳ thuộc nhà cung
            cấp bạn chọn.
          </li>
        </ul>
        <p>
          Khi muốn xóa dữ liệu của bạn ở nhà cung cấp AI, bạn cần liên hệ trực tiếp họ theo chính
          sách trên — chúng tôi không can thiệp được vào hệ thống của họ.
        </p>
      </Section>

      <Section title="3. Chúng tôi KHÔNG lưu gì">
        <ul>
          <li>
            <strong>Nội dung CV / JD / Profile của bạn:</strong> sau khi phân tích xong, các văn
            bản này không tồn tại trên server của chúng tôi. Không database, không lưu trữ file.
          </li>
          <li>
            <strong>Kết quả phân tích chi tiết:</strong> chỉ tồn tại trong trình duyệt của bạn cho
            phiên hiện tại. Refresh trang là mất.
          </li>
          <li>
            <strong>API key bạn nhập</strong> (BYOK): chỉ giữ trong RAM tab trình duyệt. Đóng tab =
            mất. Không lưu vào ổ cứng hay localStorage.
          </li>
        </ul>
      </Section>

      <Section title="4. Chúng tôi có lưu (rất ít)">
        <ul>
          <li>
            <strong>Bộ đếm sử dụng:</strong> số lần bạn phân tích, độ dài tổng (số token), nhằm
            kiểm soát hạn mức hàng ngày và lập kế hoạch chi phí. Không chứa nội dung CV/JD.
          </li>
          <li>
            <strong>Cookie đăng nhập:</strong> khi bạn đăng nhập Google, một cookie chứa session
            token được lưu trên trình duyệt bạn để giữ bạn đăng nhập. Cookie này được ký bằng khoá
            bí mật và chỉ server đọc được.
          </li>
        </ul>
      </Section>

      <Section title="5. BYOK vs Shared key — bạn chọn">
        <ul>
          <li>
            <strong>BYOK (dùng key của bạn):</strong> không cần đăng nhập, không tốn hạn mức. Bạn
            tự trả chi phí cho nhà cung cấp AI. Nếu bạn ưu tiên privacy tối đa, đây là lựa chọn nên
            dùng — request đi qua server chúng tôi để forward (TLS encrypt) nhưng key và nội dung
            không lưu lại ở chúng tôi.
          </li>
          <li>
            <strong>Shared key (key của chúng tôi):</strong> bạn đăng nhập Google, app dùng key của
            chúng tôi → chúng tôi trả chi phí AI. Vì vậy có hạn mức:{' '}
            <strong>5 lần phân tích + 2 lần viết lại CV mỗi ngày</strong> (reset 00:00 giờ Việt
            Nam). Khi hết hạn mức trong ngày, chuyển sang BYOK.
          </li>
        </ul>
      </Section>

      <Section title="6. Quyền của bạn">
        <ul>
          <li>
            <strong>Không cần xóa:</strong> vì chúng tôi không lưu nội dung của bạn, không có gì để
            xóa từ phía chúng tôi.
          </li>
          <li>
            <strong>Đăng xuất:</strong> click vào menu user → Logout. Cookie session bị xóa, khôi
            phục trạng thái khách (anonymous).
          </li>
          <li>
            <strong>Thu hồi quyền Google:</strong>{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              myaccount.google.com/permissions
            </a>{' '}
            → tìm Resume Refactor → Remove access.
          </li>
          <li>
            <strong>Xóa data tại nhà cung cấp AI:</strong> liên hệ Google/OpenAI theo mục 2.
          </li>
        </ul>
      </Section>

      <Section title="7. Thay đổi chính sách">
        <p>
          Nếu chính sách thay đổi (vd: thêm nhà cung cấp, thêm tính năng lưu lịch sử cá nhân), trang
          này được cập nhật và ngày ở đầu trang được đổi. Khuyến nghị bạn kiểm tra lại định kỳ.
        </p>
      </Section>

      <Section title="8. Liên hệ">
        <p>
          Câu hỏi về privacy hoặc yêu cầu cụ thể: vui lòng phản hồi qua kênh hỗ trợ của ứng dụng
          (xem trang Help).
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
