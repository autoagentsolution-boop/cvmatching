# Chính sách bảo mật dữ liệu — ResumeRefine

> Phiên bản: v0.3 (Job Fit & Study). Cập nhật khi triển khai tính năng mới có xử lý dữ liệu người dùng.

Tài liệu này mô tả chính xác dữ liệu nào được lưu trữ, ở đâu, trong bao lâu, và cách người dùng có thể yêu cầu xóa. Ngôn ngữ kỹ thuật (tên key KV) được ghi rõ để minh bạch với người dùng Việt Nam theo tinh thần PDPD (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).

---

## 1. CV embedding cache (Bộ nhớ đệm vector CV)

**Mục đích:** Tránh gọi lại Gemini embedding khi cùng một CV được phân tích nhiều lần.

**Dữ liệu lưu trữ:**
- Vector embedding của CV dạng `Float32Array(768)` được mã hóa base64.
- Key KV: `embed-cache:<hmac>` với `<hmac>` = HMAC-SHA256(cvText, EMBED_CACHE_SECRET).
- TTL: **21.600 giây = 6 giờ** (tự xóa sau 6h).
- Giá trị: base64-encoded Float32Array, không lưu văn bản CV gốc.

**Xóa dữ liệu:**
- Tự động: hết hạn sau 6h.
- Thủ công: yêu cầu email (xem §6) → xử lý trong 72h với lệnh `kv.del('embed-cache:<hmac>')`.

**Quản lý `EMBED_CACHE_SECRET`:**
- Xoay vòng hàng quý (quarterly). Mỗi lần xoay, mọi entry cũ tự hết hạn trong 6h — không cần xóa thủ công.
- Preimage (văn bản CV gốc) không thể tái tạo từ HMAC — an toàn kể cả nếu `<hmac>` bị lộ.

---

## 2. JD-to-LLM (Mô tả công việc gửi lên mô hình AI)

**Mục đích:** Phân tích độ phù hợp giữa CV và mô tả công việc (Job Description).

**Dữ liệu xử lý:**
- Văn bản CV + JD được gửi **một lần duy nhất** tới Gemini Flash (Google Cloud) để tính điểm khớp 9 chiều và chủ đề học tập.
- Dữ liệu **không** lưu trữ trong KV hay database của ResumeRefine.

**Chính sách lưu trữ Google:**
- Google Gemini API có thể giữ logs tạm thời theo điều khoản dịch vụ: [Google AI Terms of Service](https://ai.google.dev/terms).
- Dữ liệu không được dùng để fine-tune model hay huấn luyện lại mô hình Google.
- Xem Google Cloud Security Command Center cho data residency options (nếu dùng BYOK key).

**BYOK (mang key riêng):**
- Nếu bạn cung cấp API key Gemini của chính mình (Settings → "Thêm key"), dữ liệu đi qua tài khoản Google của bạn riêng biệt, không chia sẻ với key dùng chung.

---

## 3. Vertical classifier (Phân loại ngành nghề)

**Mục đích:** Gắn nhãn ngành (tech, finance, marketing, ops, v.v.) cho mỗi job listing khi ingest dữ liệu vào hệ thống.

**Cách hoạt động:**
- Thuật toán **regex heuristic** chạy 100% phía server, không gọi LLM.
- Phân tích tiêu đề + tên công ty job để xác định ngành dự kiến.
- **Không xử lý** dữ liệu CV hay thông tin cá nhân người dùng.

**Dữ liệu lưu trữ:**
- Nhãn ngành (vertical) và mức cấp bậc (seniority) được lưu cùng job record trong KV: `job:<jobId>` = `{ title, company, vertical, seniority, embedding, ... }`.
- TTL: Theo thời gian xác minh `verifiedAt` của job (tối đa 21 ngày).
- Không có dữ liệu cá nhân người dùng liên quan.

---

## 4. Redirect tracking (Theo dõi lượt nhấp vào tin tuyển dụng) — Phase 4

**Mục đích:** Đo lượng người dùng click "Apply" trên mỗi job để cải thiện gợi ý chất lượng cao.

**Dữ liệu lưu trữ:**
- Khi user click nút "Apply" → tập vào redirect `/api/r/<jobId>` → server ghi metric vào KV:
  - **Click count:** `metrics:click:<jobId>:<YMD>` = số lần nhấp trong ngày, key đó.
  - **Daily total:** `metrics:click:total:<YMD>` = tổng click mọi job hôm nay.
  - TTL: **2 ngày** (48h, tự xóa).
- **Chỉ lưu:**
  - `jobId` (không lưu user ID, email, IP, user-agent).
  - Ngày (YMD bucket, không lưu giờ/phút/giây).

**Xóa dữ liệu:**
- Tự động hết hạn sau 2 ngày.
- Không có nhân dạng cá nhân → không có "xóa dữ liệu riêng lẻ" cần xử lý.

## 5. Topic feedback (Phản hồi chủ đề học tập) — Phase 4

**Mục đích:** Người dùng nhấn "Không thích" trên chủ đề học tập (ví dụ: "React Hook Patterns") để cải thiện gợi ý trong tương lai.

**Dữ liệu lưu trữ:**
- Khi user click "Không thích" trên topic:
  - **Counter:** `dislikes:<topicId>:<weekYMD>` (ví dụ: `dislikes:react-hooks:2026-06-W23`) = số lần dislike tuần này. TTL: 60 ngày.
  - **Feedback log:** `topic-feedback:<topicId>` = hàng đợi tối đa 1000 entries (jobId + action + timestamp). Không có TTL — bounded by `ltrim(0, 999)`; entries cũ bị đẩy ra khi đạt giới hạn.
- **Schema bắt buộc** (`.strict()` enforcement):
  - Chấp nhận: `{ jobId, topicId, action: 'dislike' }`
  - **Từ chối:** bất kỳ field khác (ví dụ: `reason`, `comment`) — bảo vệ quyền riêng tư.

**Xóa dữ liệu:**
- Counters tự hết hạn sau 60 ngày.
- Log entries không có TTL nhưng list giới hạn 1000 mục — entries cũ tự bị đẩy ra khi đạt giới hạn (FIFO qua `ltrim`).
- Không lưu text tự do → không có dữ liệu cá nhân nhạy cảm để xóa theo yêu cầu.

---

## 6. Yêu cầu xóa dữ liệu — liên hệ & quy trình

**Địa chỉ liên hệ:** Gửi email tới **privacy@example.com** với tiêu đề:
```
[ResumeRefine] Yêu cầu xóa dữ liệu cá nhân
```

**Nội dung đơn:**
- Mô tả dữ liệu cần xóa (ví dụ: "embedding cache từ CV của tôi ngày hôm qua").
- Ngày xảy ra sự kiện (giúp xác định key).

**Thời gian xử lý:** **7 ngày làm việc** (tính từ khi nhận email).

**Xác nhận:** Chúng tôi sẽ gửi email xác nhận khi xóa hoàn tất, kèm chi tiết lệnh KV đã chạy (ví dụ: `kv.del('embed-cache:...')`).

**Lưu ý:** Ngoại trừ cache tự hết hạn (6h embedding, 2d click metric, 60d dislike counter), mọi dữ liệu đều xóa hoàn toàn theo yêu cầu — không giữ lại bản sao, log audit, hay backup tạo ra trước ngày xóa.
