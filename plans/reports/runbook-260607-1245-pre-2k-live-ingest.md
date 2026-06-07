# Runbook — 2K live ingest + refresh

Date: 2026-06-07 14:00 ICT (rev 2)
Target: pool 171 → ≥2,000 active jobs, with refresh every 3-7 days.

## TL;DR — chỉ 1 lệnh

```powershell
# Lần đầu (seed 2K)
pnpm run seed-pool

# Mỗi 3-7 ngày: chạy lại cùng lệnh đó
pnpm run seed-pool
```

`seed-pool` chạy tuần tự: pre-stats → TopCV tech (15 slugs) → TopCV non-tech (5 slugs) → ITviec tech (5 slugs) → expire → post-stats. ~25-40 phút wall-clock. Mỗi bước chạy ở child process riêng → 1 source lỗi không kill toàn bộ.

Tùy chỉnh:
```powershell
pnpm run seed-pool -- --pages 2              # ít fetch hơn, ~15-20 phút
pnpm run seed-pool -- --max-age-days 5       # nới freshness lên 5 ngày
pnpm run seed-pool -- --skip-itviec          # chỉ TopCV
pnpm run seed-pool -- --help
```

## Prereqs (đã có)

- `GEMINI_API_KEY` trong `.env.local` ✅
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` trong `.env.local` ✅
- git checkout `main` với 4 commit pre-2K hardening đã push ✅
- Recommend route đã chạy trên Postgres (`JOBFIT_USE_POSTGRES=1` trên Vercel) ✅

Sau khi seed xong, app tự động pick up jobs mới — không cần redeploy. Recommend route đọc cùng Postgres mà ingest vừa write vào.

## Yield estimate (đã verify live)

| Source | Slugs đã verify | Jobs/slug/page (raw) | After classify+dedup |
|---|---|---|---|
| TopCV tech | 15 | ~14-50 | ~8-30 |
| TopCV non-tech | 5 | ~50 | ~20-30 |
| ITviec | 5 | ~10-20 | ~5-10 |

Với `--pages 3` mặc định: ~1,000-1,400 fresh jobs/cycle. Pool hiện tại 171 → 1 cycle là ≥1,200, 2 cycles là ≥2K.

## Hard guards (không bypass thầm lặng)

| Rule | Hành vi |
|---|---|
| `postedAt > 3 ngày` | Reject, log `Too old (datePosted=…, cap=3d)` |
| Thiếu `datePosted` | Reject, log `No datePosted in JSON-LD` |
| `validThrough` đã hết | Reject, log `Expired (validThrough=…)` |
| Description < 50 chars | Reject |
| Duplicate `sha256(sourceUrl)` | Skip, log `Skip dup: <title>` |
| Embed throttle | 5 rps token bucket |

Cần nới freshness? `pnpm run seed-pool -- --max-age-days 7`. Đừng vượt 14 — sẽ làm pool stale.

## Schedule (chọn 1 trong 3 cách)

### Cách 1 — Manual khi nào muốn (đơn giản nhất)

Mở terminal khi cần, chạy `pnpm run seed-pool`. Khỏi setup gì cả.

### Cách 2 — Windows Task Scheduler (nếu muốn auto, máy luôn bật)

```powershell
# Tạo task chạy mỗi 3 ngày lúc 02:00 sáng
$action = New-ScheduledTaskAction `
  -Execute "pwsh.exe" `
  -Argument "-NoProfile -Command `"cd 'C:\Users\Vincere\Desktop\Claude\CVMatching\cv-ex-refactor'; pnpm run seed-pool *> seed-pool-$(Get-Date -Format yyyyMMdd-HHmm).log`""

$trigger = New-ScheduledTaskTrigger -Daily -At 02:00 -DaysInterval 3

Register-ScheduledTask -TaskName "CVMatching-SeedPool" `
  -Action $action -Trigger $trigger `
  -Description "Refresh job pool every 3 days"
```

Đổi cadence: `-DaysInterval 7` cho mỗi tuần.

Xóa task: `Unregister-ScheduledTask -TaskName "CVMatching-SeedPool" -Confirm:$false`

Logs ghi vào `seed-pool-YYYYMMDD-HHMM.log` trong thư mục `cv-ex-refactor/`.

### Cách 3 — GitHub Actions (optional, nếu máy không bật 24/7)

File `.github/workflows/refresh-jobs.yml` đã có. Workflow gọi cùng `pnpm run seed-pool` script — không duplicate logic.

**Setup (~2 phút):**
```powershell
gh secret set GEMINI_API_KEY
gh secret set DATABASE_URL
gh secret set DATABASE_URL_UNPOOLED
gh secret set KV_REST_API_URL
gh secret set KV_REST_API_TOKEN
```

Schedule mặc định: cron `0 19 */3 * *` (mỗi 3 ngày 19:00 UTC = 02:00 ICT). Đổi cadence: sửa `schedule.cron` trong workflow YAML.

**Trigger thủ công (admin):**
```powershell
gh workflow run refresh-jobs.yml                              # full sweep mặc định
gh workflow run refresh-jobs.yml -f pages=2                   # nhẹ hơn
gh workflow run refresh-jobs.yml -f topcv_slugs="tim-viec-lam-data-engineer" -f pages=3  # custom slugs
gh run watch                                                  # xem live
```

Hoặc: GitHub UI → Actions → "Refresh job pool" → Run workflow.

**Disable schedule (vẫn cho phép manual trigger):**
```powershell
gh workflow disable refresh-jobs.yml
```

## Hai layer refresh chạy cùng lúc

| Layer | Cadence | Làm gì |
|---|---|---|
| **Vercel cron** `/api/jobs/refresh` | Hàng ngày 20:00 UTC | HEAD-check sourceUrl của job hiện tại; 404/410 → expire; `verifiedAt > 21d` → expire. Đã wire sẵn, đã PG-backed. |
| **seed-pool** (manual / Task / GH Actions) | 3-7 ngày | Scrape jobs mới từ TopCV + ITviec; ingest vào Postgres; expire pass. |

Daily cron chăm sóc "URLs đã có còn sống không"; seed-pool chăm sóc "có jobs mới không". Hai concern riêng biệt, không trùng.

## Test app sau khi seed

1. Browser: `https://resume-refactor.vercel.app/job-fit` → upload CV → xem trả 5-10 jobs mix tier.
2. Refresh trang vài lần — `seenIds` dedup → surface jobs khác mỗi lần.
3. Vertical breakdown (Neon SQL editor):
   ```sql
   SELECT vertical, COUNT(*) FROM jobs WHERE active=true GROUP BY vertical ORDER BY 2 DESC;
   ```
   Mục tiêu: tech ≥150, mỗi vertical khác ≥100.

## Log signals khi seed chạy

| Log | Ý nghĩa |
|---|---|
| `Embedding: <title> @ <company>` | Đang gọi Gemini + write vào Postgres |
| `Skip dup: <title>` | URL đã ingest, dedup làm việc |
| `Too old (datePosted=… cap=3d)` | Freshness gate reject — bình thường |
| `No datePosted in JSON-LD` | TopCV có thể đổi format — báo lại nếu thấy nhiều |
| `resolveCompany failed for "…"` | Cache miss, không block — bình thường |
| `✓ <step> done in N.Ns` | Mỗi step xong |
| `⚠ <step> exited with code N` | Step lỗi nhưng sweep vẫn tiếp tục |

Nếu Ctrl+C giữa chừng: `data/ingest-progress.json` lưu cursor. Chạy lại bình thường — dedup tự skip jobs đã ingest.

## Câu hỏi đã trả lời

**Q: Tại sao tech ít?**
A: Slug `viec-lam-it` chứa nhiều non-tech (designer, CNC). Đã thêm 12 slug tech-cụ-thể vào taxonomy + seed-pool: backend-developer, frontend-developer, devops, mobile-developer, data-analyst, tester, qa-qc, java, nodejs, reactjs, python, ios. Mỗi slug 19-50 URLs raw → tech yield tăng ~3-4 lần.

**Q: Tại sao phải làm từng bước, không local script?**
A: Giờ là 1 lệnh local: `pnpm run seed-pool`. Step-by-step trong runbook cũ là cách thủ công nếu muốn fine-grained control — không bắt buộc.

**Q: Tại sao phải setup GitHub Actions?**
A: Không bắt buộc. Chọn:
- Manual khi nào nhớ (đơn giản nhất)
- Windows Task Scheduler nếu máy hay bật
- GitHub Actions chỉ khi muốn auto-refresh kể cả máy tắt

## Known limitations

- VNW: parked — detail pages CSR-empty. Discovery vẫn work cho future re-enable.
- TopCV broad `viec-lam-it`: client-side carousel pagination → đã loại khỏi seed-pool, dùng `tim-viec-lam-*` thay thế.
- tech.qa: chỉ có `tester` + `qa-qc` slug, độ phủ thấp hơn các sub-domain khác.
- ITviec scraper: behavior cũ, chưa được verify lại hôm nay.
