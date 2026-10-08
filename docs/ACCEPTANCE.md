# Checklist nghiệm thu — Báo cáo Học vụ

Đối chiếu từng tiêu chí ở **mục 11 của spec** với bằng chứng kiểm tra tự động. Lần chạy gần nhất: **08/10/2026**, Chromium headless qua Playwright, mở trang bằng `file://`, viewport 1366 × 900, seed mặc định `20261008`.

Chạy lại toàn bộ:

```
node tools/build-standalone.js                 # đóng gói dist/GenieTeach-HocVu.html
node tools/qa/audit.js                         # tiêu chí 6, 7 (kiểm tra tĩnh, không cần trình duyệt)
node tools/qa/check-pages.js [--standalone]    # tiêu chí 1
node tools/qa/crawl-links.js [--standalone]    # tiêu chí 2
node tools/qa/interact.js [--standalone]       # tiêu chí 2, 4
```

Mở `tests.html` (tiêu chí 3, 5). `--standalone` chạy trên bản một file và chặn mọi request mạng.

## Tổng hợp

| # | Tiêu chí (mục 11) | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Mọi trang mở qua `file://` không lỗi console; render < 1 giây | ✅ Đạt | 17 trang/tab, cả hai bản: 0 lỗi console. Render 402–543 ms (bản nhiều file), 429–572 ms (bản một file) |
| 2 | Mọi click-through điều hướng đúng và giữ filter + kỳ dữ liệu | ✅ Đạt | 19 trang nguồn, 926 link, 441 đích (bản một file: 925 link, 506 đích, gồm tài liệu): đích đúng, giữ kỳ, mở không lỗi. 22/22 bước tương tác đạt ở cả hai bản |
| 3 | Bốn chế độ kỳ cho kết quả nhất quán (Σ ngày trong tuần = tuần) | ✅ Đạt | `tests.html`, nhóm "Kỳ dữ liệu — 4 chế độ": Σ Ngày = Tuần, Khoảng = Tuần, Σ Tuần = Tháng, kỳ liền trước của cả 4 chế độ |
| 4 | Đổi cấu hình → màu, nhãn diễn giải và cảnh báo đổi ở mọi trang | ✅ Đạt | Xem §4: số liệu trước/sau trên 7 trang |
| 5 | Mọi rule mục 5 kích hoạt ≥ 1 lần; không rule nào chạy dưới cỡ mẫu tối thiểu | ✅ Đạt | 38/38 rule phát sinh (332 cảnh báo). Ca biên 29 vs 30 bản ghi, 9 vs 10 học sinh, lớp TA-04 sĩ số 8 |
| 6 | Không câu chữ nào trên UI quy kết trực tiếp chất lượng giáo viên | ✅ Đạt | `audit.js` quét mọi chuỗi giao diện; kiểm tra văn bản hiển thị của trang giáo viên và popup T09 |
| 7 | OPEN-QUESTIONS.md liệt kê đủ mọi [GIẢ ĐỊNH] và [SỬA SPEC] | ✅ Đạt | 10 [GIẢ ĐỊNH] của spec → SP-GD-01..10; 4 [SỬA SPEC] → SP-SS-01..04; 59 giả định phát sinh OQ-01..59; 78/78 mã được nhắc đều có mục |

## 1. Lỗi console và thời gian render

`check-pages.js` mở từng trang, vẽ hết biểu đồ lười (`GT.charts.flush()`), thu lỗi `console.error`, `console.warn`, `pageerror` và đếm thẻ "Lỗi khi vẽ biểu đồ". Thời gian render = mốc cuối lần vẽ đầu (`GT.renderMs`), tính từ lúc bắt đầu tải trang, **đã gồm** sinh dữ liệu mock (~200–250 ms) và dựng index.

| Trang | Nhiều file (ms) | Một file (ms) |
|---|---:|---:|
| overview | 457 | 514 |
| attendance | 411 | 493 |
| homework | 410 | 538 |
| courses | 441 | 515 |
| course-detail?courseId=TOAN10 | 509 | 572 |
| schedule | 543 | 458 |
| class?classId=10A4 | 455 | 480 |
| class?classId=12A3&tab=learning | 460 | 438 |
| class?classId=TA04&tab=attendance | 435 | 467 |
| class?classId=12A5&tab=homework | 477 | 441 |
| teachers | 494 | 480 |
| student?studentId=S0016 | 402 | 448 |
| alerts | 505 | 541 |
| settings | 470 | 429 |
| chart-catalog (56 biểu đồ thu nhỏ) | 473 | 515 |

`index.html` và `tests.html` cũng không lỗi console; `tests.html` báo **78/78 kiểm thử đạt**. Bản một file chạy với mọi request mạng bị chặn: 0 request. Không tràn ngang ở 768 px và 1280 px.

## 2. Click-through giữ bộ lọc và kỳ dữ liệu

`crawl-links.js` mở 19 trang nguồn đã đặt sẵn kỳ (Tuần/Tháng) và bộ lọc (nhóm lớp, khóa, lớp), thu mọi `<a href>` rồi kiểm tra:

- đích tồn tại;
- link sang trang báo cáo mang theo `period`/`date`. Không bắt buộc với Cấu hình, Danh mục biểu đồ, tài liệu, trang chủ;
- mở từng đích khác nhau không lỗi console, không có biểu đồ lỗi.

Kết quả: 926 link, 441 đích khác nhau (bản một file: 925 link, 506 đích, vì tài liệu cũng là trang), **0 vấn đề**. Điều hướng bằng code (click cột biểu đồ, dòng bảng, popup so sánh) đều đi qua `ctx.href` → `GT.nav.href`, giữ `period, date, from, to, groupId, classId, courseId`. Link "Chi tiết →" của cảnh báo giữ kỳ qua `GT.nav.carry`.

Các bước tương tác (`interact.js`, 22 bước, cả hai bản đều đạt): đổi kỳ Ngày/Tuần/Tháng/Khoảng, lùi kỳ, lọc nhóm lớp/khóa, menu bên giữ ngữ cảnh, popup so sánh → click lớp, chế độ Bảng, xuất CSV (UTF-8 BOM), báo cáo buổi học, đổi trạng thái + ghi chú cảnh báo (còn sau khi tải lại), mở rộng cảnh báo gộp, hồ sơ học sinh và bản in, lọc danh mục biểu đồ, tắt hạng mục Đề xuất, link công thức → anchor METRICS.md.

## 3. Nhất quán giữa các chế độ kỳ

`tests.html`, trên dữ liệu mock mặc định, qua đúng hàm `GT.period.range` / `previous` / `buckets` mà các trang dùng:

- Σ từng ngày (chế độ Ngày) của tuần 28/09–04/10/2026 = chế độ Tuần: lượt điểm danh, bản ghi chưa điểm danh, số buổi;
- Khoảng tùy chọn 28/09–04/10 = chế độ Tuần: cùng biên, cùng 5 trạng thái điểm danh, 4 trạng thái nhiệm vụ, số buổi;
- Σ các tuần cắt theo biên tháng = chế độ Tháng 9/2026: lượt điểm danh, nhiệm vụ đúng hạn, không hoàn thành;
- Σ từng ngày trong tháng = số liệu tháng, với nhiệm vụ tính theo `dueAt`;
- kỳ liền trước:
  - Tháng 10 → 01–30/09 (30 ngày); Tháng 3 → tháng 2 (28 ngày);
  - Tuần neo Chủ nhật 11/10 → 28/09–04/10;
  - Ngày Thứ Hai 05/10 → Chủ nhật 04/10;
  - Khoảng 10 ngày → 10 ngày ngay trước;
- biên `[from, to)`: hai ngày liền kề không chồng nhau, buổi 00:00 ngày sau không lọt vào ngày trước;
- tuần bắt đầu Thứ Hai, Chủ nhật thuộc tuần bắt đầu từ Thứ Hai trước đó.

## 4. Đổi cấu hình lan truyền tới màu, nhãn diễn giải, cảnh báo

Cấu hình lưu bằng `GT.config.save` (như nút "Lưu cấu hình"), rồi mở lại từng trang:

| Thay đổi | Màu CĐR (cặp lớp × CĐR) | Nhãn diễn giải | Cảnh báo |
|---|---|---|---|
| Mặc định | Xanh 188 · Cam 42 · Đỏ 16 · Xám 25 | LY11: "Nghi vấn ở lớp học" 2 | 332 |
| Xanh ≥ 90% (từ 80%) | Xanh 122 · Cam 108 · Đỏ 16 · Xám 25; chú thích heatmap "Xanh ≥ 90%" | không đổi (nhãn dựa trên Đỏ/Cam) | 332 (rule CĐR dựa trên Đỏ) |
| Ngưỡng Cam/Đỏ 60% (từ 50%) | Cam 34 · Đỏ 24 | — | 332 → 338: LO-C01 14 → 20, CUR-01 1 → 2, LO-C03 3 → 2 |
| Ngưỡng Cam/Đỏ 65% | Cam 30 · Đỏ 28 | courses: "Nghi vấn chương trình" 6 → 7 | 332 → 341 |
| Khoảng cách "nghi vấn ở lớp" 10 điểm (từ 25) | — | LY11: 2 → 5; trang Cảnh báo: 3 → 12 | 332 → 341 |
| Tắt rule ATT-S01 | — | — | ATT-S01 23 → 0 |
| Cỡ mẫu tối thiểu 200 bản ghi | — | — | ATT-C01..C05, HW-C01, ONL-C02 → 0 |
| Tắt "Hiển thị báo cáo theo giáo viên" | — | — | trang Giáo viên chỉ còn thông báo, trang chủ ẩn thẻ |

Trang được kiểm tra: courses, course-detail (TOAN10, LY11), class tab Phân tích học tập (11A3, 10A4), overview, alerts. Trang Cấu hình có **xem trước** số cảnh báo theo mức và số cặp lớp–CĐR Đỏ trước khi lưu. Validate: ngưỡng cấp phải tăng dần, tổng trọng số = 1.

## 5. Rule cảnh báo và cỡ mẫu tối thiểu

- 38/38 rule có ít nhất một cảnh báo với seed mặc định: 332 cảnh báo sau gộp và chống trùng. Đối chiếu kịch bản K01–K30 → rule: mở trang bất kỳ với `?debug=1`.
- Ca biên trong `tests.html`: 29 bản ghi → ATT-C01 không chạy, 30 → chạy; 9 học sinh có dữ liệu (dù 36 bản ghi) → không chạy, 10 → chạy; lớp TA-04 (sĩ số 8) không có cảnh báo tỉ lệ cấp lớp.
- Diễn giải nguyên nhân có ngưỡng dữ liệu riêng: < 10 học sinh có dữ liệu hoặc evidence TB < 3 câu → "Chưa đủ dữ liệu để kết luận".

## 6. Câu chữ về giáo viên

- `audit.js` quét mọi chuỗi trong `assets/js` và `index.html`, tìm cụm "giáo viên/GV/GVCN" đi gần "kém, yếu, giỏi, xuất sắc, tệ, năng lực" (bỏ qua câu phủ định như "không dùng làm kết luận đánh giá giáo viên"). Kết quả: 0.
- Trang Vận hành giáo viên chỉ đo hành vi vận hành, không xếp hạng theo kết quả học tập; kết quả lớp chỉ tham chiếu, kèm lưu ý mục 3.6. Văn bản hiển thị của trang và popup giáo viên T09 (kịch bản giáo viên chậm điểm danh) đã được quét.
- Nhãn diễn giải gắn vào lớp/CĐR ("Nghi vấn ở lớp học — cần xem xét"), không gắn vào giáo viên.

## 7. Giả định và sửa spec

| Nguồn | Số lượng | Ở OPEN-QUESTIONS.md |
|---|---:|---|
| [GIẢ ĐỊNH] có sẵn trong spec | 10 | Mục B: SP-GD-01 … SP-GD-10 |
| [SỬA SPEC] có sẵn trong spec | 4 | Mục C: SP-SS-01 … SP-SS-04 |
| Câu hỏi mục 6 của spec | 5 | Mục A: Q-01 … Q-05 |
| Giả định phát sinh khi làm (lập plan, Phase 1–4, đóng gói) | 59 | Mục D, E, F: OQ-01 … OQ-59 |

`audit.js` kiểm tra mọi mã được nhắc trong code/tài liệu (78) đều có mục, mọi chú thích `[GIẢ ĐỊNH]`/`[SỬA SPEC]` trong code kèm mã tra cứu, mọi mã chỉ số `M-…` dùng ở danh mục biểu đồ có anchor trong METRICS.md (62/62), và 38 rule của `config.js` khớp ALERTS.md.

## Giới hạn của lần kiểm tra

- Thời gian render đo trên máy build bằng Chromium headless; máy yếu hơn có thể chậm hơn, nhưng trang chậm nhất vẫn còn dư khoảng 430 ms so với mốc 1 giây.
- Môi trường build chặn CDN jsDelivr. Khi kiểm tra bản nhiều file, request CDN được phục vụ bằng `vendor/echarts-5.5.0/echarts.min.js`, cùng phiên bản 5.5.0 lấy từ npm. Trang thật vẫn nạp từ CDN.
- Chỉ kiểm tra Chromium; Firefox/Safari chưa chạy tự động.
