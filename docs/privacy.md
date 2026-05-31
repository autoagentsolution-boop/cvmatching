# Chính sách bảo mật dữ liệu — ResumeRefine

> Phiên bản: v0.3 (Job Fit & Study). Cập nhật khi triển khai tính năng mới có xử lý dữ liệu người dùng.

Tài liệu này mô tả chính xác dữ liệu nào được lưu trữ, ở đâu, trong bao lâu, và cách người dùng có thể yêu cầu xóa. Ngôn ngữ kỹ thuật (tên key KV) được ghi rõ để minh bạch với người dùng Việt Nam theo tinh thần PDPD (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).

---

## 1. CV embedding cache (Bộ nhớ đệm vector CV)

**Mục đích:** Tránh gọi lại LLM khi cùng một CV được phân tích nhiều lần trong phiên làm việc.

**Dữ liệu lưu trữ:**
- Vector embedding của CV (dạng số thực, không phải văn bản gốc).
- Key trong Vercel KV (Upstash Redis): `embeddings:active:v<n>` và `embed:cache:<hmac>`.
  - `<hmac>` là mã HMAC-SHA256 của nội dung CV, được tạo từ `EMBED_CACHE_SECRET`. Không ai có thể tái tạo văn bản CV từ key này.
- TTL (thời gian tự xóa): **6 giờ** kể từ lần ghi cuối.

**Không lưu trữ:**
- Văn bản CV gốc trong KV.
- Dữ liệu nhận dạng cá nhân (tên, email, SĐT) trong KV.

**Xóa dữ liệu:** Embedding tự hết hạn sau 6h. Người dùng có thể yêu cầu xóa thủ công bằng cách gửi email đến địa chỉ liên hệ — chúng tôi sẽ chạy `kv.del('embed:cache:<hmac>')` trong vòng 72h.

**Quản lý khóa bí mật (`EMBED_CACHE_SECRET`):** Xoay vòng hàng quý (quarterly rotation). Sau khi xoay, mọi key cũ tự hết hạn trong tối đa 6h — không cần xóa thủ công.

---

## 2. JD-to-LLM (Mô tả công việc gửi lên mô hình AI)

**Mục đích:** Phân tích độ phù hợp giữa CV và mô tả công việc (JD).

**Dữ liệu xử lý:**
- Văn bản JD do người dùng dán vào được gửi lên **Gemini Flash** (Google) để phân tích.
- Văn bản CV cũng được gửi kèm trong cùng yêu cầu đó.

**Không lưu trữ:**
- Nội dung JD hay CV không được lưu trong KV hay database của ResumeRefine.
- Google có thể lưu tạm theo điều khoản dịch vụ Gemini API — xem [Google AI Terms of Service](https://ai.google.dev/terms).

**Người dùng BYOK (mang key riêng):** Nếu bạn dùng Gemini API key của chính mình, dữ liệu đi qua tài khoản Google của bạn, không qua key dùng chung của ResumeRefine.

---

## 3. Vertical classifier (Phân loại ngành nghề)

**Mục đích:** Tự động gắn nhãn ngành nghề (ví dụ: "tech", "finance") cho job listing trong quá trình ingest dữ liệu.

**Cách hoạt động:**
- Thuật toán heuristic chạy hoàn toàn **phía server tại thời điểm ingest** (không gọi LLM).
- Sử dụng danh sách từ khóa cố định được mã hóa sẵn trong source code.
- Không xử lý dữ liệu CV hay thông tin cá nhân người dùng.

**Dữ liệu lưu trữ:**
- Nhãn ngành nghề được lưu cùng job listing trong KV: `jobs:listing:<jobId>`.
- Không có dữ liệu người dùng trong bước này.

---

## 4. Redirect tracking (Theo dõi lượt nhấp vào tin tuyển dụng)

**Mục đích:** Đo lường mức độ quan tâm đến các tin tuyển dụng để cải thiện chất lượng gợi ý.

**Dữ liệu lưu trữ:**
- Mỗi lần nhấp vào tin tuyển dụng qua `/api/r/[jobId]` ghi một bộ đếm vào KV:
  - Key: `metrics:redirect:<jobId>:<YMD>` (ví dụ: `metrics:redirect:job_abc123:2026-06-01`).
  - TTL: **2 ngày** (tự xóa sau 48h).
- Chỉ lưu `jobId` + ngày (bucket ngày, không phải giờ/phút/giây).

**Không lưu trữ:**
- Địa chỉ IP người dùng trong key này.
- Thông tin nhận dạng cá nhân.

**Xóa dữ liệu:** Metric tự hết hạn sau 2 ngày. Không có dữ liệu cá nhân để xóa theo yêu cầu riêng lẻ.

---

## Liên hệ & yêu cầu xóa dữ liệu

Gửi email đến **vinh2000ld11@gmail.com** với tiêu đề `[ResumeRefine] Yêu cầu xóa dữ liệu`. Chúng tôi xử lý trong vòng 72 giờ làm việc.
