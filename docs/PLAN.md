# PLAN — Prototype báo cáo Học vụ GenieTeach

> Trạng thái: **bản kế hoạch, chờ duyệt trước khi code**.
> Mọi điểm chưa rõ trong spec được đánh dấu `[GIẢ ĐỊNH]` / `[SỬA SPEC]` và gom đầy đủ ở [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

---

## 0. Hiện trạng repo và hướng xử lý

- Repo `Loki-VN/Genieteach-report` **đang trống** (chưa có commit, chưa có `assets/js/metrics.js`, `alerts.js`, `mock-data.js` của bộ báo cáo Giáo viên).
- Áp dụng nhánh "repo chưa có" của spec: tạo mới theo cấu trúc mục 2, nhưng `metrics.js` thiết kế dạng **pure function nhận danh sách id bất kỳ** (`classIds`, `studentIds`, `courseIds`, `sessionIds`) để sau này dùng chung cho vai trò Giáo viên mà không phải fork.
- **Không làm** role switcher Giáo viên/Học vụ và chế độ chỉ đọc của trang cấu hình Giáo viên (vì chưa có trang Giáo viên). `index.html` vẫn để sẵn một vùng "Vai trò" chỉ có Học vụ, kèm ghi chú, để sau này bổ sung. → OQ-01.

---

## 1. Nguyên tắc kiến trúc

| Lớp | File | Trách nhiệm | Không được làm |
|---|---|---|---|
| Cấu hình | `config.js` | Giá trị mặc định cấp trường + đọc/ghi override từ `localStorage` (try/catch), "Khôi phục mặc định" | Tính toán |
| Tiện ích | `util.js` | RNG có seed (mulberry32), ngày giờ, định dạng vi-VN, thống kê (median, quantile), CSV, query string, memo cache | Biết về nghiệp vụ |
| Dữ liệu thô | `mock-data.js` | Sinh bản ghi thô theo seed + kịch bản mục 7; trả thêm `scenarios[]` để đối chiếu | Tính metric |
| Index | `data-index.js` | Build index **một lần khi load**: theo `classId`, `courseId`, `studentId`, ngày (`dayKey`), `sessionId`, `taskId`, `assignmentId`, `loId` | Tính metric |
| Metric | `metrics.js` | Pure function, JSDoc có công thức, nhận `(data, scope, cfg)`; cache theo khóa (filter + kỳ) | Đụng DOM |
| Cảnh báo | `alerts.js` | Danh mục rule + engine đọc config + cỡ mẫu tối thiểu + chống trùng + gộp + lưu trạng thái xử lý | Đụng DOM (trừ store) |
| Kỳ dữ liệu | `period.js` | Mô hình 4 chế độ kỳ, lùi/tiến, kỳ liền trước, đọc/ghi query string | Đụng DOM |
| Biểu đồ | `charts.js` | Builder ECharts dùng chung (theme thương hiệu, nhãn chữ trên ô màu, empty state) | Tính metric |
| Giao diện | `ui.js` | Khung trang, menu, KPI card, bảng sort/CSV, modal, popup so sánh, khối cảnh báo, filter, component kỳ dữ liệu | Tính metric |
| Trang | `pages/*.js` | Ghép metric → chart/ui cho từng trang | Định nghĩa lại công thức |

Quy ước kỹ thuật:

- HTML5 + CSS + JS thuần, `<script>` thường, global `window.GT`, mở được qua `file://`. Không module, không build step.
- ECharts **5.5.0** qua CDN pin version: `https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`.
- Thứ tự nạp mỗi trang: `echarts (CDN) → config → util → mock-data → data-index → metrics → alerts → period → charts → ui → catalog (chỉ chart-catalog) → pages/<trang>.js`.
- **Thời gian**: mọi mốc thời gian là số ms biểu diễn **giờ tường Việt Nam mã hóa theo UTC** (`Date.UTC(...)`, chỉ dùng `getUTC*`). Tránh lệch giờ/DST khi người xem ở múi giờ khác. Tuần bắt đầu Thứ Hai.
- **Hiệu năng** (ngân sách mỗi trang < 1 giây): sinh dữ liệu + index ≈ 150–300 ms; chạy rule engine ≈ 100–200 ms (memo); render trang ≈ 200–400 ms. Biểu đồ dưới màn hình đầu được khởi tạo lười (IntersectionObserver). Footer hiện "Render trong X ms" để kiểm tra nghiệm thu.
- **Cache metric**: `GT.metrics.memo(key, fn)`, khóa = tên metric + JSON(scope đã chuẩn hóa: id sắp xếp) + `from|to` + version cấu hình.
- **Định dạng**: `dd/MM/yyyy`, `HH:mm`, dấu phẩy thập phân (`85,3%`), chênh lệch tỉ lệ ghi "điểm %" (`+2,1 điểm %`). Chia cho 0 → hiển thị `–` kèm tooltip lý do, **không bao giờ** NaN/Infinity.
- **Màu**: thương hiệu tím `#A878D8`, tím đậm `#5B3E8C`, tím nhạt `#F2EBFA`, xanh dương `#0098F0`; trạng thái Xanh `#22A06B` / Cam `#F59E0B` / Đỏ `#E5484D` / Xám `#B0B4BA`; 6 mức chuẩn đầu ra; 5 trạng thái điểm danh (đúng mã màu trong spec). Mọi ô màu đều có nhãn chữ hoặc ký hiệu: trạng thái `✓ Xanh`, `! Cam`, `✕ Đỏ`, `– Xám`; điểm danh `Đ / M / P / K / ?`; cấp chuẩn đầu ra `RT / T / TB / CCT / CT / –`.
- **Hạng mục [ĐỀ XUẤT]**: phần tử mang thuộc tính `data-proposal` + badge "Đề xuất". Toggle ẩn/hiện ở `index.html`, lưu `localStorage` (cấp người xem), áp dụng mọi trang.
- Responsive ≥ 1280px (menu trái) và 768px (menu thu gọn); bảng rộng cuộn ngang trong container riêng.
- Font: "Be Vietnam Pro" (Google Fonts) có fallback hệ thống. Khi demo offline, font tự lùi về font hệ thống.

---

## 2. Cây file

```
index.html                     # Trang khởi động: danh sách báo cáo, toggle [ĐỀ XUẤT], vùng vai trò
tests.html                     # Bộ assert Phase 1 (điểm biên, mẫu số 0, nhiều lớp, weighted, cỡ mẫu…)
hoc-vu/
├── overview.html              # 4.1 Tổng quan
├── attendance.html            # 4.2 Báo cáo chuyên cần
├── homework.html              # 4.3 Báo cáo học ở nhà (nhiệm vụ + khóa trực tuyến)
├── courses.html               # 4.4 Báo cáo khóa học — Tổng quan
├── course-detail.html         # 4.4 Phân tích chi tiết khóa học
├── schedule.html              # 4.5 Báo cáo lịch học
├── class.html                 # 4.6 Báo cáo lớp học (4 tab)
├── teachers.html              # [ĐỀ XUẤT] 4.7 Báo cáo vận hành giáo viên
├── student.html               # [ĐỀ XUẤT] 4.8 Hồ sơ học sinh (có @media print)
├── alerts.html                # [ĐỀ XUẤT] 4.9 Trung tâm cảnh báo
├── settings.html              # 4.10 Cấu hình ngưỡng & cảnh báo (cấp trường)
└── chart-catalog.html         # 9. Danh mục biểu đồ
assets/
├── css/
│   └── base.css               # token màu, layout, component, print
└── js/
    ├── config.js              # GT.config
    ├── util.js                # GT.util, GT.fmt, GT.date, GT.stats, GT.csv, GT.qs
    ├── mock-data.js           # GT.mock.generate(seed, today, now) → raw + scenarios
    ├── data-index.js          # GT.data (raw + idx), GT.boot()
    ├── metrics.js             # GT.metrics (pure, JSDoc công thức)
    ├── alerts.js              # GT.alerts (rule catalog, engine, dedupe, group, store)
    ├── period.js              # GT.period
    ├── charts.js              # GT.charts
    ├── ui.js                  # GT.ui, GT.nav
    ├── catalog.js             # GT.catalog (metadata mọi biểu đồ, dùng cho chart-catalog)
    └── pages/
        ├── overview.js  attendance.js  homework.js  courses.js  course-detail.js
        ├── schedule.js  class.js  teachers.js  student.js  alerts.js
        ├── settings.js  chart-catalog.js
        └── tests.js
docs/
├── PLAN.md  METRICS.md  ALERTS.md  OPEN-QUESTIONS.md
README.md                      # Cách mở, cấu trúc, cách đổi "hôm nay"/seed, GT.debug
```

---

## 3. Data model

### 3.1 Entity (đúng spec, phần mở rộng ghi rõ)

| Entity | Trường | Ghi chú |
|---|---|---|
| ClassGroup | id, name | 4 nhóm |
| Class | id, name, groupId, homeroomTeacherId (nullable) | 20 lớp |
| Student | id, fullName, code | ~600; có trùng họ tên, phân biệt bằng `code` |
| Enrollment | studentId, classId, **startAt, endAt (nullable)** | `[GIẢ ĐỊNH]` thêm ngày hiệu lực để mô phỏng chuyển lớp giữa kỳ (OQ-17) |
| Teacher | id, name, **subject** | `subject` chỉ để hiển thị |
| Course | id, name, passThreshold, weightTaskCompletion, weightTestScore | 5 khóa; ngưỡng/trọng số có thể ghi đè ở cấu hình |
| ClassCourse | classId, courseId, teacherIds[], startAt, endAt | |
| LearningOutcome | id, courseId, code, description, order | 8–12 chuẩn đầu ra/khóa, mô tả thực tế |
| **Question** | id, courseId, loId, code, text, order | `[GIẢ ĐỊNH]` cần để hiển thị danh sách câu hỏi (QuestionAttempt chỉ có questionId) |
| Session | id, classId, courseId, teacherId, start, end, attendanceSubmittedAt, reportSubmittedAt, **slot** | `slot` = khung giờ (ca) cho heatmap thứ × khung giờ |
| AttendanceRecord | sessionId, studentId, status ∈ {ON_TIME, LATE, EXCUSED, UNEXCUSED, NOT_TAKEN}, markedAt | Sinh cho mọi học sinh đang ghi danh của mọi buổi **đã bắt đầu** |
| Task | id, classId, courseId, sessionId, assignedAt, dueAt, itemCount, requiresManualGrading, maxScore, **title** | `title` dùng chung giữa các lớp cùng khóa cùng tuần → phát hiện vấn đề ở đề bài |
| TaskSubmission | taskId, studentId, completedItems, submittedAt, score, gradedAt | Chỉ tồn tại khi đã nộp (submittedAt ≤ bây giờ) |
| OnlineCourseAssignment | id, classId, courseId, startAt, dueAt, **title, contentKey, totalItems** | `[GIẢ ĐỊNH]` `contentKey` để so sánh cùng một nội dung trực tuyến giữa các lớp (OQ-20) |
| OnlineCourseProgress | assignmentId, studentId, completedItems, totalItems, completedAt, testScore (0–100), **itemCompletedAt[]** | `[GIẢ ĐỊNH]` log thời điểm hoàn thành từng mục → tính được tiến độ tại mốc bất kỳ (OQ-21) |
| QuestionAttempt | studentId, classId, courseId, loId, questionId, isCorrect, attemptedAt | |
| LOAchievement | studentId, classId, courseId, loId, percent (nullable), evidenceCount, updatedAt | Gắn theo cặp học sinh–lớp (`[GIẢ ĐỊNH]` của spec). Mock tính từ QuestionAttempt để nhất quán |
| LOSnapshot `[ĐỀ XUẤT]` | weekStart, classId, courseId, loId, passRate, coverage | Mock "chạy job hằng tuần" từ QuestionAttempt lũy kế đến cuối tuần |

### 3.2 Quy mô và bố cục mock (seed mặc định `20261008`)

- **Hôm nay** = Thứ Năm **08/10/2026**, **bây giờ** = **09:40** (cấu hình trong `config.js`; toàn bộ dữ liệu sinh tương đối theo mốc này).
- Cửa sổ dữ liệu: 16 tuần lịch sử (từ Thứ Hai 22/06/2026, gồm tuần hiện tại) + 4 tuần tương lai (đến 08/11/2026). Nghỉ lễ Quốc khánh 01–02/09 (không có buổi học). → OQ-29.
- Khung giờ: Ca 1 07:00–08:30 · Ca 2 08:45–10:15 · Ca 3 10:30–12:00 · Ca 4 13:30–15:00 · Ca 5 15:15–16:45 · Ca 6 18:00–19:30 (lớp tiếng Anh). Lúc 09:40 hôm nay các buổi Ca 2 **đang diễn ra** để demo bảng vận hành.

| Nhóm lớp | Lớp (sĩ số) | Khóa học |
|---|---|---|
| Khối 10 | 10A1–10A6 (33–40) | Toán 10 (**6 lớp**, 12 CĐR); Lập trình Python cơ bản (10A1, 10A2) |
| Khối 11 | 11A1–11A5 (32–40) | Vật lý 11 (5 lớp, 10 CĐR); Python (11A1–11A3) |
| Khối 12 | 12A1–12A5 (34–40) | Hóa học 12 (5 lớp, 9 CĐR); Python (12A1–12A3) |
| Lớp tiếng Anh tăng cường | TA-01 (20), TA-02 (18), TA-03 (16), TA-04 (**8**) | IELTS Foundation (4 lớp, 10 CĐR) |

- Python dạy ở **8 lớp**, 8 CĐR. ~600 học sinh; học sinh lớp tiếng Anh tăng cường đều đồng thời ở một lớp chính quy → **~10% học sinh thuộc 2 lớp**.
- 25 giáo viên: Toán 4, Vật lý 3, Hóa 3, Tiếng Anh 4, Tin học 3, và 8 giáo viên chủ nhiệm dạy môn chưa lên LMS. Lớp tiếng Anh không có GVCN (null).
- 2–4 buổi/tuần/lớp (lớp chính quy 3 buổi môn chính + 1 buổi Python nếu có; lớp tiếng Anh 2 buổi tối). ≈ 1.250 buổi; ≈ 30 nghìn bản ghi điểm danh; ≈ 1.000 nhiệm vụ (3–10 bài nhỏ/nhiệm vụ) và ≈ 30 nghìn bài nộp; ≈ 35 nghìn lượt làm câu hỏi; ≈ 9 nghìn LOAchievement; ≈ 4 nghìn LOSnapshot.
- Khóa trực tuyến (1–2/lớp): Toán 10 "Hàm số & đồ thị" (10/08–20/09, đã đóng) và "Vectơ" (21/09–25/10, đang chạy); Vật lý 11 "Thí nghiệm ảo: Điện trường" (07/09–11/10, sắp hạn); Hóa 12 "Luyện đề Este – Lipit" (17/08–27/09, đã đóng); IELTS "Từ vựng học thuật" (01/09–15/11, đang chạy); Python "Python trên GenieTeach Code" (11A1–11A3, 12A1–12A3; 14/09–04/10, vừa đóng tuần trước).
- Thời lượng khóa tại "hôm nay": Toán 10 / Vật lý 11 / Hóa 12 ≈ 78%; IELTS ≈ 56%; Python ≈ 45%. CĐR được đưa vào giảng dạy dần trong 70% đầu thời lượng.
- Mô hình sinh: mỗi học sinh có các thuộc tính ẩn (năng lực, độ chăm, độ đúng giờ, xu hướng xin phép). Mỗi lớp có hiệu ứng lớp, mỗi CĐR/câu hỏi có độ khó. Xác suất điểm danh, nộp bài, điểm số, đúng/sai câu hỏi đều suy ra từ các thuộc tính này. Kịch bản bên dưới được "cấy" đè lên.

### 3.3 Kịch bản cài sẵn (mỗi rule mục 5 kích hoạt ≥ 1 lần)

| # | Kịch bản | Rule kỳ vọng |
|---|---|---|
| K01 | Toán 10 — CĐR "Tích vô hướng của hai vectơ" Đỏ ở 5/6 lớp | CUR-01, CUR-02, LO-C01 |
| K02 | Câu hỏi T10-LO08-Q04 (đáp án gây nhiễu) đúng ~8% ở mọi lớp | CUR-03 |
| K03 | 10A4 Đỏ ở 5 CĐR Toán 10 trong khi các lớp khác Xanh | LO-C03, LO-C02, LO-C01, LO-S01 (gộp lớp) |
| K04 | Vật lý 11 — CĐR "Tụ điện" tỉ lệ đạt toàn trường ~45% nhưng chỉ Đỏ ở 2/5 lớp (CUR-02 mà không CUR-01) | CUR-02 |
| K05 | Một giáo viên Hóa (dạy 12A3, 12A4) thường điểm danh muộn/quên báo cáo; buổi Ca 2 hôm nay chưa điểm danh | OPS-01, OPS-02, OPS-03, OPS-06 |
| K06 | Một buổi Ca 1 hôm nay của 10A5 bị quên điểm danh | OPS-01 |
| K07 | Nhiệm vụ Hóa 12 chấm tay, quá hạn 6 ngày vẫn còn bài chưa chấm | OPS-04 |
| K08 | 11A3 có buổi học trong 7 ngày gần nhất nhưng không được giao nhiệm vụ | OPS-05 |
| K09 | Nhóm "Lớp tiếng Anh tăng cường" có tỉ lệ có mặt ~82% (trường ~93%) | ATT-C05, ATT-C01 |
| K10 | Ngày 17/09/2026 (bão) cả trường vắng bất thường | Thấy rõ trên calendar heatmap |
| K11 | 7 học sinh 12A5 + 2 học sinh 11A4 vắng triền miên (không phép) | ATT-S01 (gộp 12A5), ATT-S02, HW-S01, HW-S02 |
| K12 | 10A3 đi muộn 18% (trường ~6%); ca 07:00 Thứ Hai đi muộn cao toàn trường | ATT-C02, ATT-S03 (gộp) |
| K13 | 11A5 dịch cúm 7 ngày gần nhất: có mặt từ ~95% xuống ~80% | ATT-C03, ATT-C01 |
| K14 | Buổi 11A4 ngày 06/10 trùng sự kiện, có mặt ~55% | ATT-C04 |
| K15 | Học sinh 10A2 có tỉ lệ có mặt giảm mạnh so với tháng trước | ATT-S04 |
| K16 | 2 học sinh đội tuyển vắng có phép ≥ 4 buổi/30 ngày | ATT-S05 |
| K17 | 12A5 nộp đúng hạn ~65% trong 7 ngày gần nhất | HW-C01 |
| K18 | 11A2 điểm TB Vật lý thấp hơn các lớp khác cùng khóa ~1,7 điểm | HW-C02 |
| K19 | Nhiệm vụ Vật lý "Điện trường của hệ điện tích – nâng cao" điểm TB ~4,3 ở mọi lớp; nhiệm vụ Python hạn cuối tuần tỉ lệ nộp ~52% | HW-T01 |
| K20 | Học sinh 10A6 có điểm TB nhiệm vụ giảm > 2 điểm so với tháng trước | HW-S03 |
| K21 | 10A6 chậm tiến độ khóa "Vectơ": chỉ ~45% học sinh đúng tiến độ | ONL-C01, ONL-S01 (gộp) |
| K22 | Vật lý "Điện trường" còn ≤ 30% thời gian, nhiều học sinh có điểm tổng hợp dự kiến < 50 | ONL-S02 |
| K23 | Một số học sinh chưa bắt đầu khóa trực tuyến sau 7 ngày | ONL-S03 |
| K24 | 12A5 hoàn thành đúng hạn khóa "Este – Lipit" ~45% (lớp khác ~75%) | ONL-C02 |
| K25 | Học sinh 11A1 làm 100% bài nhưng 3 CĐR Vật lý "Chưa tốt" | LO-S02 |
| K26 | Hóa 12 — CĐR "Polime" coverage ~20% (dữ liệu mỏng) khi khóa đã qua 78% | DATA-01 |
| K27 | Hóa 12 — CĐR "Ăn mòn kim loại" chưa có dữ liệu (Xám) khi khóa đã qua 78% | DATA-02 |
| K28 | TA-03 tạm dừng, không có buổi học từ 21/09 (> 14 ngày) | DATA-03 |
| K29 | TA-04 sĩ số 8, chuyên cần kém nhưng **không** được sinh cảnh báo cấp lớp (dưới cỡ mẫu) | Kiểm tra không rule cấp lớp nào chạy |
| K30 | 1 học sinh chuyển 10A2 → 10A5 ngày 31/08; ~60 học sinh học 2 lớp; ≥ 3 cặp trùng họ tên | Kiểm tra gộp cấp học sinh |

`GT.debug = true` (hoặc `?debug=1`) → `console.table` đối chiếu: kịch bản → rule kỳ vọng → số cảnh báo đã sinh → ✓/✕.

---

## 4. Kỳ dữ liệu và điều hướng

- 4 chế độ: `day` (mặc định hôm nay), `week` (tuần chứa ngày neo, Thứ Hai–Chủ nhật), `month` (tháng dương lịch), `custom` (`from`–`to`, bỏ trống `to` = đến hiện tại). Nút lùi/tiến kỳ; nút "Hôm nay".
- Bản ghi thuộc kỳ theo: `Session.start` (chuyên cần, lịch học), `Task.dueAt` (nhiệm vụ), `OnlineCourseAssignment.dueAt` (hoàn thành khóa trực tuyến). Riêng tiến độ dùng `min(cuối kỳ, bây giờ)` làm mốc.
- Kỳ liền trước: day → ngày trước; week → tuần trước; month → tháng dương lịch trước; custom → khoảng cùng số ngày ngay trước. `[GIẢ ĐỊNH]` OQ-24.
- KPI tỉ lệ: mũi tên + chênh lệch "điểm %". KPI đếm: chỉ hiện chênh lệch khi kỳ hiện tại đã kết thúc; nếu chưa, hiện "Kỳ trước: N".
- Mặc định: Chuyên cần / Lịch học = Ngày; Học ở nhà = Tuần (`[ĐỀ XUẤT]`, OQ-30).
- Query string dùng chung: `period, date, from, to, groupId, classId, courseId, teacherId, studentId, loId, tab` (+ `severity, alertGroup, status` cho alerts). `GT.nav.href(page, overrides)` luôn giữ filter + kỳ hiện tại. Ví dụ `class.html?classId=10A3&tab=attendance&period=week&date=2026-10-05`.

---

## 5. Danh mục metric (chi tiết công thức → METRICS.md)

Quy tắc tổng hợp chung: **cấp nhóm lớp và toàn trường luôn cộng gộp tử/mẫu (weighted)**, không lấy trung bình các tỉ lệ lớp. Cấp học sinh toàn trường gộp mọi lớp học sinh tham gia. Cấp lớp chỉ tính dữ liệu của lớp đó.

### Chuyên cần (ATT)
| ID | Metric | Công thức |
|---|---|---|
| M-ATT-01 | Đếm bản ghi theo trạng thái | Đếm AttendanceRecord của các buổi có `start` trong kỳ |
| M-ATT-02 | Mẫu số chuyên cần | ON_TIME + LATE + EXCUSED + UNEXCUSED (không gồm NOT_TAKEN) |
| M-ATT-03 | Tỉ lệ đúng giờ | ON_TIME / M-ATT-02 |
| M-ATT-04 | Tỉ lệ đi muộn | LATE / M-ATT-02 |
| M-ATT-05 | Tỉ lệ vắng có phép | EXCUSED / M-ATT-02 |
| M-ATT-06 | Tỉ lệ vắng không phép | UNEXCUSED / M-ATT-02 |
| M-ATT-07 | Tỉ lệ có mặt | (ON_TIME + LATE) / M-ATT-02 |
| M-ATT-08 | Tỉ lệ bản ghi chưa điểm danh (chỉ số vận hành) | NOT_TAKEN / tổng bản ghi (gồm NOT_TAKEN) |
| M-ATT-09 | Số buổi vắng có phép / không phép của học sinh | Đếm theo học sinh, gộp mọi lớp |
| M-ATT-10 | Chuỗi vắng không phép liên tiếp dài nhất | Theo thứ tự buổi của học sinh (gộp lớp); NOT_TAKEN bỏ qua, trạng thái khác cắt chuỗi |
| M-ATT-11 | Phân bố học sinh theo số buổi vắng không phép | Bucket 0, 1, 2, 3, 4, 5+ |
| M-ATT-12 | Ma trận thứ × khung giờ | Tỉ lệ đi muộn / tỉ lệ vắng theo (thứ, ca) |
| M-ATT-13 | Tỉ lệ có mặt theo ngày | M-ATT-07 theo `dayKey` (calendar) |

### Lịch học & vận hành (OPS)
| ID | Metric | Công thức |
|---|---|---|
| M-OPS-00 | Lớp đang hoạt động | Có ≥ 1 ClassCourse với `startAt ≤ mốc ≤ endAt` (`[GIẢ ĐỊNH]` của spec) |
| M-OPS-01 | Số lịch học | Đếm Session có `start` trong kỳ (gồm cả chưa diễn ra) |
| M-OPS-02 | Trạng thái thời gian buổi | Chưa diễn ra (`start > now`) / Đang diễn ra / Đã kết thúc |
| M-OPS-03 | Tỉ lệ lịch học đã điểm danh | Buổi đã bắt đầu có `attendanceSubmittedAt` / buổi đã bắt đầu |
| M-OPS-04 | Tỉ lệ lịch học đã báo cáo | Buổi đã kết thúc có `reportSubmittedAt` / buổi đã kết thúc |
| M-OPS-05 | Phân loại buổi | Đủ điểm danh + báo cáo · Chỉ điểm danh · Chỉ báo cáo · Chưa có gì · Chưa diễn ra |
| M-OPS-06 | Tỉ lệ điểm danh đúng thời điểm | Buổi có `attendanceSubmittedAt ≤ start + 15'` / buổi đã bắt đầu ≥ 15' (`[GIẢ ĐỊNH]`) |
| M-OPS-07 | Độ trễ báo cáo | `reportSubmittedAt − end`: < 2h · 2–24h · 1–3 ngày · > 3 ngày · chưa nộp |
| M-OPS-08 | Tỉ lệ báo cáo trong 24h | Buổi đã kết thúc ≥ 24h có báo cáo trong 24h / các buổi đó |
| M-OPS-09 | Số nhiệm vụ đã giao | Task có `assignedAt` trong kỳ (theo giáo viên của buổi) |
| M-OPS-10 | Số bài quá hạn chưa chấm | Bài nộp của nhiệm vụ chấm tay, đã quá hạn, `gradedAt = null` |
| M-OPS-11 | Thời gian chấm trung bình | TB(`gradedAt − max(submittedAt, dueAt)`) với nhiệm vụ chấm tay |

### Nhiệm vụ (HW)
| ID | Metric | Công thức |
|---|---|---|
| M-HW-01 | Trạng thái học sinh–nhiệm vụ | ĐANG MỞ nếu `dueAt > now`; ĐÚNG HẠN nếu `submittedAt ≤ dueAt`; MUỘN nếu nộp sau hạn; KHÔNG HOÀN THÀNH nếu quá hạn chưa nộp. Trạng thái con "Nộp chưa đủ" khi `completedItems < itemCount` |
| M-HW-02/03/04 | Tỉ lệ đúng hạn / muộn / không hoàn thành | Trên cặp học sinh–nhiệm vụ đã quá hạn (ĐANG MỞ hiển thị riêng) |
| M-HW-05 | Tỉ lệ nộp chưa đủ | (ĐÚNG HẠN + MUỘN có `completedItems < itemCount`) / đã quá hạn |
| M-HW-06 | Tỉ lệ nộp | (ĐÚNG HẠN + MUỘN) / đã quá hạn |
| M-HW-07 | Điểm nhiệm vụ thang 10, điểm TB | `score / maxScore × 10`; TB cộng gộp trên mọi bài **đã có điểm** |
| M-HW-08 | Phân bố điểm | Min, Q1, trung vị, Q3, max (boxplot); histogram 0–10 |
| M-HW-09 | Thời điểm nộp so với hạn | > 72h · 24–72h · 6–24h · < 6h trước hạn · muộn |
| M-HW-10 | Nhiệm vụ bất thường | Tỉ lệ nộp thấp hơn trung vị nhiệm vụ cùng khóa ≥ 20 điểm % hoặc điểm TB thấp hơn ≥ 1,5 (`[GIẢ ĐỊNH]`) |
| M-HW-11 | Nhiệm vụ đang diễn ra | `assignedAt ≤ now < dueAt` |

### Khóa trực tuyến (ONL)
| ID | Metric | Công thức |
|---|---|---|
| M-ONL-01 | Tiến độ | completedItems(tại mốc) / totalItems |
| M-ONL-02 | Tiến độ kỳ vọng | clamp((mốc − startAt) / (dueAt − startAt), 0, 1) |
| M-ONL-03 | Đúng tiến độ | Tiến độ ≥ kỳ vọng − dung sai (mặc định 10 điểm %, `[GIẢ ĐỊNH]`) |
| M-ONL-04 | Trạng thái 4 mức | Như M-HW-01, theo `completedAt` so với `dueAt` |
| M-ONL-05 | Tỉ lệ hoàn thành đúng hạn | ĐÚNG HẠN / cặp học sinh–khóa đã đến hạn |
| M-ONL-06 | Điểm tổng hợp (thang 100) | wTask × tỉ lệ hoàn thành bài tập + wTest × testScore (mặc định 0,3 / 0,7; ngưỡng 50; theo khóa) |
| M-ONL-07 | Điểm tổng hợp dự kiến | wTask × tiến độ dự phóng tới hạn (theo tốc độ hiện tại, ≤ 100) + wTest × (testScore ?? 0) (`[GIẢ ĐỊNH]`) |
| M-ONL-08 | Funnel | Được giao → Đã bắt đầu (≥ 1 mục) → Đang học (≥ 50% nội dung, `[GIẢ ĐỊNH]`) → Hoàn thành → Đạt ngưỡng điểm tổng hợp |
| M-ONL-09 | Tỉ lệ học sinh đúng tiến độ | Đếm M-ONL-03 / học sinh được giao (khóa đang chạy) |
| M-ONL-10 | Điểm TB khóa trực tuyến | TB điểm tổng hợp của học sinh **đã có điểm kiểm tra**, khóa đến hạn trong kỳ (`[GIẢ ĐỊNH]`) |
| M-ONL-11 | Khóa trực tuyến đang diễn ra | Assignment có `startAt ≤ now < dueAt` (đếm theo lớp) |

### Chuẩn đầu ra (LO)
| ID | Metric | Công thức |
|---|---|---|
| M-LO-01 | Quy đổi cấp | ≥ 90 Rất tốt · 75–<90 Tốt · 60–<75 Trung bình · 40–<60 Cần cải thiện · < 40 Chưa tốt · null Chưa có thông tin |
| M-LO-02 | Đạt yêu cầu | Cấp ≥ Trung bình (cấu hình được) |
| M-LO-03 | Coverage | Học sinh có dữ liệu / sĩ số (ghi danh hiệu lực tại mốc) |
| M-LO-04 | Tỉ lệ đạt | Học sinh đạt / học sinh có dữ liệu |
| M-LO-05 | Màu trạng thái | Xám nếu coverage = 0; Xanh nếu tỉ lệ đạt ≥ 80%; Cam nếu 50% ≤ … < 80%; Đỏ nếu < 50%; badge "Dữ liệu mỏng" nếu 0 < coverage < 30% |
| M-LO-06 | Phân bố 6 mức | Trên mọi cặp (học sinh–lớp) × CĐR của lớp đang học khóa; không có dữ liệu → "Chưa có thông tin" |
| M-LO-07 | Số câu hỏi đã thực hiện | Σ evidenceCount; TB/học sinh có dữ liệu |
| M-LO-08 | % chuẩn đầu ra Xanh | Cặp lớp–CĐR Xanh / cặp lớp–CĐR không Xám (`[GIẢ ĐỊNH]`) |
| M-LO-09 | Nhãn diễn giải nguyên nhân | Mục 3.6 (xem §7 cảnh báo CUR-01, LO-C03) |
| M-LO-10 | Tỉ lệ đúng theo câu hỏi | isCorrect / lượt làm, theo câu hỏi × lớp |
| M-LO-11 | Xu hướng tỉ lệ đạt | Từ LOSnapshot theo tuần |
| M-LO-12 | Thời lượng khóa đã qua | (mốc − startAt) / (endAt − startAt), cấp khóa = TB các ClassCourse đang hoạt động |

### Benchmark & tổng hợp
| ID | Metric | Công thức |
|---|---|---|
| M-BM-01 | Benchmark lớp | 5 chỉ số: tỉ lệ có mặt, tỉ lệ nộp đúng hạn, điểm TB nhiệm vụ, tỉ lệ hoàn thành khóa trực tuyến đúng hạn, % CĐR Xanh — của lớp vs TB nhóm lớp vs TB trường (đều weighted) |
| M-BM-02 | Độ lệch so với TB trường (heatmap nhóm × chỉ số) | Chỉ số nhóm − chỉ số trường, đơn vị điểm % (điểm thang 10 quy ra ×10) |

---

## 6. Biểu đồ theo trang

Ký hiệu nhãn: **SG** = Spec gốc · **ĐX** = Đề xuất · **LS** = Cần dữ liệu lịch sử · **CH** = Cần dữ liệu câu hỏi. Mọi biểu đồ/bảng có: tiêu đề, dòng "Câu hỏi biểu đồ này trả lời: …", empty state; bảng danh sách có nút CSV; bảng xếp hạng lớp có mốc TB trường + TB nhóm lớp và ghi mẫu số.

### 6.1 overview.html — Tổng quan (cửa sổ: hôm nay / 7 ngày gần nhất / 30 ngày gần nhất, ghi rõ trên từng thẻ, OQ-06)
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| OV-K1..K4 | Lớp đang hoạt động · Lịch học hôm nay · Nhiệm vụ đang diễn ra · Khóa trực tuyến đang diễn ra | KPI | SG |
| OV-01 | Tỉ lệ đi học hôm nay (+ số bản ghi chưa điểm danh) | Donut | SG |
| OV-02 | Nhiệm vụ đúng hạn / muộn / không hoàn thành — 7 ngày qua | Stacked bar 100% ngang | SG |
| OV-03 | Top lớp đi học đúng giờ → `class.html?tab=attendance` | Bar ngang cuộn, top 5 nổi bật, mốc TB | SG (+ĐX Top 5 cao/thấp song song) |
| OV-04 | Top lớp làm bài đúng hạn → `tab=homework` | Như trên | SG (+ĐX) |
| OV-05 | Top lớp điểm TB cao nhất → `tab=homework` | Như trên | SG (+ĐX) |
| OV-06 | Thẻ nhóm lớp (+ 3 chỉ số tóm tắt + cảnh báo theo mức) | Card | SG (+ĐX) |
| OV-07 | Thẻ lớp: sĩ số, khóa, nhiệm vụ đang mở + tỉ lệ, khóa TT + tiến độ, lịch hôm nay + trạng thái, cảnh báo | Card | SG / SỬA SPEC |
| OV-08 | Bảng vận hành hôm nay: timeline buổi học theo khung giờ, vạch "Bây giờ" | Custom timeline (ECharts custom series) | ĐX |
| OV-09 | Nhóm lớp × 6 chỉ số, tô theo độ lệch so với TB trường | Heatmap phân kỳ (có số trong ô) | ĐX |
| OV-10 | Xu hướng 8 tuần: tỉ lệ có mặt & nộp đúng hạn | Line | ĐX |
| OV-11 | Cảnh báo mở: nhóm (Vận hành, Chuyên cần, Học ở nhà, Chuẩn đầu ra) × mức → alerts.html | Ma trận số đếm | ĐX |

### 6.2 attendance.html — Chuyên cần (kỳ 4 chế độ; filter nhóm lớp, khóa [ĐX])
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| AT-K | Lớp đang hoạt động; lịch học diễn ra; 4 tỉ lệ + có mặt; tỉ lệ bản ghi chưa điểm danh (kèm so sánh kỳ trước) | KPI | SG |
| AT-01 | Lịch sử 4 trạng thái theo ngày (> 31 ngày tự gộp tuần) | Stacked bar 100% | SG |
| AT-02 | Lịch học đã điểm danh / chưa điểm danh | Donut | SG |
| AT-03 | Top lớp đúng giờ / đi muộn → popup so sánh (bảng sort + bar có mốc TB) → class.html | Bar + popup | SG |
| AT-04 | Top nhóm lớp đúng giờ / muộn → popup; click nhóm → lọc trang | Bar + popup | SG |
| AT-05 | Cảnh báo nhóm ATT | Khối cảnh báo | SG |
| AT-06 | Tỉ lệ có mặt toàn trường theo ngày, 3 tháng | Calendar heatmap | ĐX |
| AT-07 | Thứ × khung giờ: tỉ lệ đi muộn / vắng (toggle) | Heatmap | ĐX |
| AT-08 | Học sinh theo số buổi vắng không phép (0…5+) | Histogram | ĐX |
| AT-09 | Học sinh vắng nhiều nhất (lớp, CP/KP, chuỗi dài nhất) → student.html | Bảng + CSV | ĐX |
| AT-10 | Vắng có phép vs không phép theo tuần | Line/area | ĐX |
| AT-11 | Tỉ lệ bản ghi chưa điểm danh theo lớp (chất lượng dữ liệu) | Bar ngang + ngưỡng 10% | ĐX |

### 6.3 homework.html — Học ở nhà (mặc định Tuần [ĐX]; filter nhóm lớp, khóa)
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| HW-K | 7 KPI (lớp HĐ, nhiệm vụ đã giao, khóa TT đã giao, % đúng hạn, % hoàn thành khóa đúng hạn, điểm TB nhiệm vụ, điểm TB khóa TT) | KPI | SG |
| HW-01 | Top lớp nhiệm vụ đúng hạn / muộn + KHT → popup | Bar + popup | SG |
| HW-02 | Top lớp điểm nhiệm vụ TB → popup điểm TB | Bar + popup | SỬA SPEC |
| HW-03 | Top lớp hoàn thành khóa TT đúng hạn / KHT → popup | Bar + popup | SG |
| HW-04 | Top lớp điểm khóa TT → popup | Bar + popup | SG |
| HW-05 | Cảnh báo HW + ONL | Khối cảnh báo | SG |
| HW-06 | Điểm nhiệm vụ theo lớp (hoặc nhóm khi "tất cả") | Boxplot | ĐX |
| HW-07 | Lớp: % nộp đúng hạn × điểm TB, 4 góc phần tư theo trung vị | Scatter | ĐX |
| HW-08 | Xu hướng tuần: % đúng hạn & điểm TB trường + line từng nhóm | Line 2 trục | ĐX |
| HW-09 | Funnel khóa TT (lọc khóa) | Funnel | ĐX |
| HW-10 | Tiến độ thực tế vs kỳ vọng theo lớp, từng khóa TT đang chạy | Bar ngang + vạch kỳ vọng | ĐX |
| HW-11 | Nhiệm vụ bất thường (so với nhiệm vụ cùng khóa) | Bảng + CSV | ĐX |
| HW-12 | Thời điểm nộp so với hạn theo nhóm lớp | Stacked bar 100% | ĐX |
| HW-13 | Học sinh không hoàn thành nhiều nhất → student.html | Bảng + CSV | ĐX |

### 6.4 courses.html — Khóa học (tổng quan)
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| CO-K | Khóa đang diễn ra · Lớp đang diễn ra · CĐR đang diễn ra | KPI | SG |
| CO-01 | Phân bố 6 mức toàn trường | Donut + stacked 100% | SG |
| CO-02 | Thẻ từng khóa: lớp, số CĐR, stacked 6 mức (+ĐX: số CĐR Đỏ/Cam/Xanh/Xám, số nhãn "Nghi vấn chương trình") → course-detail | Card | SG (+ĐX) |
| CO-03 | So sánh các khóa, sort theo Chưa tốt + Cần cải thiện | Stacked bar 100% | ĐX |
| CO-04 | Top 10 CĐR yếu nhất toàn trường (xuyên khóa) + nhãn 3.6 | Bảng | ĐX |

### 6.5 course-detail.html — Chi tiết khóa học (filter khóa, lớp)
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| CD-K | Số CĐR; phân bố 6 mức | KPI + stacked | SG |
| CD-01 | Bảng CĐR phân màu (mã, mô tả, stacked 6 mức, tỉ lệ đạt, coverage, số câu hỏi, ô màu + nhãn); sort/lọc màu; click → popup: học sinh nhóm theo lớp (accordion), histogram % đạt, [ĐX] boxplot theo lớp | Bảng + popup | SG (+ĐX) |
| CD-02 | Cảnh báo LO + CUR | Khối cảnh báo | SG |
| CD-03 | **Lớp × CĐR** (tỉ lệ đạt, Xanh/Cam/Đỏ/Xám, tooltip GV phụ trách + evidence) + nhãn 3.6 + dòng diễn giải | Heatmap trung tâm | ĐX |
| CD-04 | Tỉ lệ đạt từng CĐR sort tăng, vạch ngưỡng Xanh/Đỏ | Bar | ĐX |
| CD-05 | Coverage × tỉ lệ đạt theo CĐR | Scatter | ĐX |
| CD-06 | Xu hướng tỉ lệ đạt theo tuần từng CĐR | Line (multi) | ĐX · LS |
| CD-07 | Câu hỏi tỉ lệ đúng < 30% trên mọi lớp | Bảng + bar | ĐX · CH |
| CD-08 | Lớp: % hoàn thành khóa TT × tỉ lệ đạt TB CĐR | Scatter | ĐX |

### 6.6 schedule.html — Lịch học (kỳ 4 chế độ; filter nhóm, lớp, khóa, GV [ĐX])
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| SC-K | Tổng lịch học; % đã điểm danh; % đã báo cáo | KPI | SG |
| SC-01 | Số lịch học theo lớp / nhóm (toggle) | Bar | SG |
| SC-02 | % điểm danh / % báo cáo theo lớp / nhóm (toggle) | Grouped bar | SG |
| SC-03 | Phân loại trạng thái buổi theo lớp/nhóm | Stacked bar | ĐX |
| SC-04 | Điểm danh đúng thời điểm (≤ 15' đầu buổi) | KPI + bar theo lớp | ĐX |
| SC-05 | Độ trễ báo cáo | Histogram | ĐX |
| SC-06 | Ngày × lớp trạng thái buổi (ô = trạng thái kém nhất trong ngày) | Heatmap phân loại | ĐX |
| SC-07 | Danh sách buổi học đầy đủ, lọc, CSV, "Xem báo cáo" (popup mô phỏng) | Bảng | ĐX |
| SC-08 | Cảnh báo OPS | Khối cảnh báo | SG |

### 6.7 class.html — Lớp học (4 tab; tất cả/nhóm → chế độ so sánh giữa lớp)
| ID | Biểu đồ | Loại | Nhãn |
|---|---|---|---|
| CL-OV-K | Sĩ số, khóa đang học, nhiệm vụ đang thực hiện (→ tab Bài về nhà), khóa TT (→ `#online`) | KPI | SG |
| CL-OV-01 | GV phụ trách theo khóa; GVCN | Danh sách | ĐX |
| CL-OV-02 | Benchmark 5 chỉ số: lớp vs nhóm vs trường | Bullet chart | ĐX |
| CL-OV-03 | (chế độ so sánh) Bảng lớp × 5 chỉ số | Bảng | SG |
| CL-AT-01..04 | Donut 4 trạng thái (+ chưa ĐD); lịch sử stacked theo tuần/tháng; Top đúng giờ / đi muộn; cảnh báo | Donut, stacked, bar | SG |
| CL-AT-05 | Học sinh × buổi (5 trạng thái, mã chữ), sort theo số buổi vắng | Heatmap | ĐX |
| CL-HW-01..06 | Nhiệm vụ đúng hạn/muộn/KHT; khóa TT đúng hạn/muộn/KHT (`#online`); điểm TB theo nhiệm vụ; Top 5 làm đủ/KHT; Top 5 điểm cao/thấp; cảnh báo | Stacked, bar, bảng | SG / SỬA SPEC |
| CL-HW-07 | Phân bố điểm | Histogram | ĐX |
| CL-HW-08 | Học sinh: tỉ lệ hoàn thành × điểm TB (4 góc) | Scatter | ĐX |
| CL-HW-09 | Tiến độ thực tế vs kỳ vọng từng học sinh (khóa TT) | Bar ngang + vạch | ĐX |
| CL-LO-01 | Bảng CĐR phân màu → popup học sinh % đạt (link sang settings) | Bảng + popup | SG |
| CL-LO-02 | Bảng học sinh × số CĐR ở 6 cấp, sort, click → popup % từng CĐR | Bảng + popup | SG |
| CL-LO-03 | Cảnh báo | Khối cảnh báo | SG |
| CL-LO-04 | Mini bar tỉ lệ đạt các lớp khác cùng khóa + nhãn 3.6 trên từng dòng CĐR | Sparkbar | ĐX |
| CL-LO-05 | Học sinh × CĐR | Heatmap | ĐX |

### 6.8 teachers.html [ĐX] (ẩn nếu cấu hình tắt "Hiển thị báo cáo theo giáo viên")
| ID | Biểu đồ | Loại |
|---|---|---|
| TE-01 | Bảng GV: số buổi dạy, % điểm danh đúng thời điểm, % báo cáo trong 24h, nhiệm vụ đã giao, bài quá hạn chưa chấm, thời gian chấm TB, số lớp — chỉ hành vi vận hành, không xếp hạng theo kết quả học tập | Bảng + CSV |
| TE-02 | Popup GV: buổi chưa điểm danh/báo cáo, nhiệm vụ tồn chấm, kết quả lớp chỉ để tham chiếu + lưu ý 3.6 | Popup |

### 6.9 student.html [ĐX]
ST-01 thông tin + các lớp · ST-02 chuyên cần theo lớp (stacked) · ST-03 nhiệm vụ theo lớp/khóa · ST-04 khóa TT: tiến độ + điểm tổng hợp vs ngưỡng (bullet) · ST-05 % đạt từng CĐR vs TB lớp (dot plot) · ST-06 cảnh báo đang mở · bản in.

### 6.10 alerts.html [ĐX]
AL-01 tóm tắt theo mức × nhóm · AL-02 hàng đợi: mức, nhóm, đối tượng, lý do, phát hiện lúc, trạng thái (Mới / Đang xử lý / Đã xử lý / Bỏ qua), ghi chú, người xử lý; lọc mức/nhóm/nhóm lớp/lớp/trạng thái; sort mức → thời gian; dòng gộp cấp lớp mở rộng được; lưu `localStorage`.

### 6.11 settings.html
Form các ngưỡng (CĐR, khóa học, cảnh báo từng rule, diễn giải 3.6, hiển thị GV), validate tăng dần / không chồng lấn / tổng trọng số = 1; **preview trước khi lưu**: số cảnh báo theo mức và số cặp lớp–CĐR Đỏ (hiện tại → mới).

### 6.12 chart-catalog.html
Mỗi biểu đồ ở trên là một thẻ: render thu nhỏ (dùng chung `charts.js`), tên, trang/tab, loại, nguồn dữ liệu (entity + trường), link công thức METRICS.md, câu hỏi nghiệp vụ, hành động gợi ý, lý do chọn loại biểu đồ, nhãn SG/ĐX/LS/CH. Lọc theo trang và nhãn.

---

## 7. Danh mục alert rule (chi tiết → ALERTS.md)

Cấu trúc: `{ id, key, ruleId, severity, group, scope, entityIds, title, reason, suggestedAction, drilldownUrl, detectedAt, status, classId?, groupId?, children? }`. `reason` luôn có số liệu cụ thể, ví dụ *"Lớp 10A3 có tỉ lệ đi muộn 7 ngày gần nhất 18,0%, cao hơn trung bình trường (6,1%) 11,9 điểm %."*

Quy tắc chung:
- **Cỡ mẫu tối thiểu**: rule tỉ lệ cấp lớp/nhóm không chạy nếu mẫu số < 30 hoặc < 10 học sinh có dữ liệu.
- **Chống trùng**: khóa = `ruleId + entity`. Cùng khóa, cảnh báo cũ chưa xử lý trong 7 ngày → không sinh mới (giữ `detectedAt` cũ).
- **Gộp**: ≥ 5 học sinh cùng lớp vi phạm cùng rule → 1 cảnh báo cấp lớp, `children` = danh sách học sinh. Học sinh nhiều lớp được gán vào lớp có nhiều vi phạm nhất (`[GIẢ ĐỊNH]`).
- **Thời điểm đánh giá** = "bây giờ"; mỗi rule có cửa sổ riêng (cấu hình được), không phụ thuộc kỳ đang xem trên trang (`[GIẢ ĐỊNH]` OQ-02). Khối cảnh báo của từng trang lọc theo nhóm rule + filter lớp/nhóm/khóa của trang.
- Nhóm hiển thị ở Tổng quan: Vận hành = OPS + DATA-03; Chuyên cần = ATT; Học ở nhà = HW + ONL; Chuẩn đầu ra = LO + CUR + DATA-01/02 (`[GIẢ ĐỊNH]`).

| ID | Điều kiện mặc định | Mức | Scope | Cửa sổ / tham số | Kịch bản |
|---|---|---|---|---|---|
| OPS-01 | Buổi đã bắt đầu > 15' chưa điểm danh | HIGH | SESSION | Các buổi hôm nay | K05, K06 |
| OPS-02 | Buổi kết thúc > 24h chưa báo cáo | MEDIUM | SESSION | 7 ngày gần nhất | K05 |
| OPS-03 | GV có ≥ 3 buổi chưa điểm danh hoặc chưa báo cáo | HIGH | TEACHER | 7 ngày | K05 |
| OPS-04 | Nhiệm vụ quá hạn > 3 ngày còn bài chưa chấm | MEDIUM | TASK | 30 ngày | K07 |
| OPS-05 | Lớp có buổi học nhưng không được giao nhiệm vụ | LOW | CLASS | 7 ngày | K08 |
| OPS-06 | Tỉ lệ bản ghi chưa điểm danh của lớp > 10% | MEDIUM | CLASS | 30 ngày | K05 |
| ATT-S01 | Vắng (CP + KP) > 3 buổi | HIGH | STUDENT | 30 ngày | K11, K16 |
| ATT-S02 | Vắng KP ≥ 2 buổi liên tiếp | HIGH | STUDENT | 30 ngày | K11 |
| ATT-S03 | Đi muộn ≥ 3 lần | MEDIUM | STUDENT | 14 ngày | K12 |
| ATT-S04 | Tỉ lệ có mặt giảm ≥ 20 điểm % so với 30 ngày trước đó | MEDIUM | STUDENT | 30 vs 30 ngày, ≥ 5 buổi mỗi cửa sổ | K15 |
| ATT-S05 | Vắng có phép ≥ 4 buổi | LOW | STUDENT | 30 ngày | K16 |
| ATT-C01 | Tỉ lệ có mặt của lớp < 85% | MEDIUM | CLASS | 7 ngày | K09, K13 |
| ATT-C02 | Tỉ lệ đi muộn lớp ≥ TB trường + 10 điểm % | MEDIUM | CLASS | 7 ngày | K12 |
| ATT-C03 | Tỉ lệ có mặt giảm ≥ 10 điểm % so với kỳ trước | MEDIUM | CLASS | 7 vs 7 ngày | K13 |
| ATT-C04 | Một buổi có tỉ lệ có mặt thấp hơn TB lớp ≥ 25 điểm % | LOW | SESSION | 14 ngày | K14 |
| ATT-C05 | Nhóm lớp có tỉ lệ có mặt thấp hơn TB trường ≥ 5 điểm % | MEDIUM | GROUP | 7 ngày | K09 |
| HW-S01 | Không hoàn thành ≥ 2 nhiệm vụ liên tiếp (theo lớp–khóa) | HIGH | STUDENT | 30 ngày | K11 |
| HW-S02 | Không hoàn thành ≥ 30% nhiệm vụ | HIGH | STUDENT | 30 ngày, ≥ 4 nhiệm vụ | K11 |
| HW-S03 | Điểm TB giảm ≥ 2 điểm so với tháng trước | MEDIUM | STUDENT | 30 vs 30 ngày, ≥ 3 bài có điểm mỗi cửa sổ | K20 |
| HW-C01 | Tỉ lệ nộp đúng hạn của lớp < 70% | MEDIUM | CLASS | 7 ngày | K17 |
| HW-C02 | Điểm TB lớp thấp hơn TB các lớp khác cùng khóa ≥ 1,5 | MEDIUM | CLASS | 30 ngày | K18 |
| HW-T01 | Nhiệm vụ có tỉ lệ nộp < 60% hoặc điểm TB < 5 → nghi vấn đề bài | MEDIUM | TASK | 30 ngày | K19 |
| ONL-S01 | Tiến độ thấp hơn kỳ vọng ≥ 25 điểm % | HIGH | STUDENT | Khóa đang chạy | K21 |
| ONL-S02 | Điểm tổng hợp dự kiến < ngưỡng khi còn ≤ 30% thời gian | HIGH | STUDENT | Khóa đang chạy | K22 |
| ONL-S03 | Chưa bắt đầu sau 7 ngày kể từ ngày giao | MEDIUM | STUDENT | Khóa đang chạy | K23 |
| ONL-C01 | Tỉ lệ học sinh đúng tiến độ của lớp < 60% | MEDIUM | CLASS | Khóa đang chạy | K21 |
| ONL-C02 | % hoàn thành đúng hạn thấp hơn TB các lớp khác cùng khóa ≥ 20 điểm % | MEDIUM | CLASS | Khóa đến hạn trong 30 ngày | K24 |
| LO-S01 | > 3 CĐR không đạt trong một khóa | HIGH | STUDENT | Lũy kế | K03 |
| LO-S02 | Hoàn thành ≥ 90% nhiệm vụ nhưng ≥ 2 CĐR Chưa tốt | MEDIUM | STUDENT | Lũy kế | K25 |
| LO-C01 | CĐR Đỏ ở một lớp | HIGH | LO (lớp–CĐR) | Lũy kế | K01, K03 |
| LO-C02 | Lớp có ≥ 30% CĐR của khóa ở trạng thái Đỏ | HIGH | CLASS | Lũy kế | K03 |
| LO-C03 | "Nghi vấn ở lớp học" (lớp thấp hơn trung vị lớp khác ≥ 25 điểm %, trung vị ≥ ngưỡng Cam) | MEDIUM | CLASS (gom CĐR theo lớp–khóa) | Lũy kế | K03 |
| CUR-01 | "Nghi vấn chương trình" (Đỏ ở ≥ 60% lớp đủ dữ liệu, tối thiểu 3 lớp) | HIGH | LO | Lũy kế | K01 |
| CUR-02 | Tỉ lệ đạt toàn trường < 50% | HIGH | LO | Lũy kế | K01, K04 |
| CUR-03 | Câu hỏi đúng < 30% trên ≥ 3 lớp (≥ 10 lượt/lớp) | MEDIUM | LO (câu hỏi) | Lũy kế | K02 |
| DATA-01 | Coverage < 30% khi khóa qua ≥ 50% thời lượng | MEDIUM | LO | Cấp khóa | K26 |
| DATA-02 | CĐR Xám khi khóa qua ≥ 70% thời lượng | MEDIUM | LO | Cấp khóa | K27 |
| DATA-03 | Lớp đang hoạt động không có buổi học nào | LOW | CLASS | 14 ngày | K28 |

Ngôn ngữ cảnh báo: dùng "lớp học", "cần xem xét", "đề xuất trao đổi/dự giờ"; **không** câu nào quy kết chất lượng giáo viên. Cảnh báo cấp TEACHER (OPS-03) chỉ mô tả hành vi vận hành (số buổi chưa điểm danh/báo cáo).

---

## 8. Cấu hình (cấp trường, `localStorage` key `gt.hocvu.config.v1`)

```
school   { name, today:'2026-10-08', now:'09:40', seed:20261008 }       // chỉ đổi trong config.js
lo       { levels:{excellent:90, good:75, average:60, needsImprovement:40}, passLevel:'AVERAGE',
           color:{green:80, orange:50}, thinCoverage:30 }
cause    { curriculumRedShare:60, minClassesForCurriculum:3, classGapPts:25,
           minStudentsWithData:10, minAvgEvidence:3 }
courses  { [courseId]: { passThreshold:50, weightTaskCompletion:0.3, weightTestScore:0.7 } }
ops      { attendanceGraceMin:15, reportOnTimeHours:24 }
online   { onTrackTolerancePts:10, activeLearningPct:50 }
homework { anomalyRateGapPts:20, anomalyScoreGap:1.5 }
ranking  { minSample:30 }
alerts   { minDenominator:30, minStudentsWithData:10, dedupeDays:7, groupMinStudents:5,
           rules:{ 'OPS-01':{ enabled:true, severity:'HIGH', params:{ minutes:15 } }, … } }
display  { showTeacherReport:true }
```
Trạng thái xử lý cảnh báo: `gt.hocvu.alertState.v1`. Toggle hạng mục đề xuất (cấp người xem): `gt.ui.showProposals`.

---

## 9. Kiểm thử & nghiệm thu

- `tests.html`: assert hiển thị pass/fail cho: điểm biên tỉ lệ đạt 50% (Cam) / 80% (Xanh) / 49,99% (Đỏ); biên quy đổi cấp 90/75/60/40; coverage = 0 → Xám; coverage 30% không "mỏng"; mẫu số = 0 → `–`; NOT_TAKEN không vào mẫu số; học sinh nhiều lớp (cấp học sinh gộp, cấp lớp tách); weighted ≠ unweighted (ví dụ số cụ thể); cỡ mẫu tối thiểu (29 vs 30 bản ghi, 9 vs 10 học sinh, TA-04); nộp đúng `dueAt` = ĐÚNG HẠN; nhiệm vụ ĐANG MỞ không vào tỉ lệ; điểm tổng hợp; nhãn 3.6 tại biên 60% / 25 điểm / trung vị = ngưỡng Cam / thiếu dữ liệu; chống trùng 7 ngày; gộp ≥ 5 học sinh; nhất quán kỳ (Σ ngày = tuần, custom = tuần, Σ tuần = tháng); kỳ liền trước (đầu tháng, tuần bắt đầu Thứ Hai); định dạng vi-VN; tích hợp: **mọi rule mục 5 kích hoạt ≥ 1 lần** với seed mặc định.
- Kiểm tra tự động cuối mỗi phase: Playwright + Chromium headless mở từng trang qua `file://`, thu lỗi console/pageerror, đo thời gian render, thử click-through chính. (Môi trường build chặn CDN jsDelivr nên khi test tôi chặn request CDN và phục vụ bản `echarts@5.5.0` lấy từ npm registry. Trang thật vẫn dùng CDN.)

---

## 10. Thứ tự build

| Phase | Nội dung | Kết quả bàn giao |
|---|---|---|
| 1 — Nền tảng | `config.js`, `util.js`, `mock-data.js` (đủ kịch bản §3.3), `data-index.js`, `metrics.js`, `alerts.js`, `METRICS.md`, `ALERTS.md`, `OPEN-QUESTIONS.md` cập nhật, `tests.html` | Báo cáo: số bản ghi, thời gian sinh, bảng kịch bản → rule, kết quả test |
| 2 — Vận hành | `period.js` + component kỳ 4 chế độ, khung UI (`ui.js`, `charts.js`, `base.css`), `overview.html`, `schedule.html`, `settings.html`, `alerts.html` | Báo cáo console + thời gian render từng trang |
| 3 — Chất lượng học tập | `courses.html`, `course-detail.html` (ưu tiên heatmap lớp × CĐR), `class.html` (4 tab) | Như trên |
| 4 — Còn lại | `attendance.html`, `homework.html`, `teachers.html`, `student.html`, `chart-catalog.html` + `catalog.js`, `index.html`, `README.md` | Như trên + checklist nghiệm thu mục 11 |

Mỗi phase: commit + push lên `claude/pensive-heisenberg-uq798q`, kiểm tra không lỗi console, báo cáo kết quả.
