# METRICS — Định nghĩa chỉ số

> Nguồn sự thật duy nhất: `assets/js/metrics.js` (mỗi hàm có JSDoc ghi công thức và mã `M-…`).
> Tài liệu này mô tả công thức, mẫu số, cấp tổng hợp và điểm biên. Mọi trang/biểu đồ chỉ gọi các hàm này, không tự tính lại.
> Ngưỡng nằm trong `assets/js/config.js` (cấu hình cấp trường, chỉnh ở `hoc-vu/settings.html`).

## 0. Quy ước chung

| Quy ước | Nội dung |
|---|---|
| Thời gian | Số ms của **giờ tường Việt Nam** mã hóa UTC. Khoảng `[from, to)`: gồm `from`, không gồm `to`. Tuần bắt đầu Thứ Hai. |
| Kỳ dữ liệu | Chuyên cần & lịch học theo `Session.start`; nhiệm vụ theo `Task.dueAt`; khóa trực tuyến theo `OnlineCourseAssignment.dueAt` (riêng tiến độ dùng mốc `min(cuối kỳ, bây giờ)`). |
| Scope | `{ classIds?, groupIds?, courseIds?, teacherIds?, studentIds? }` — danh sách id bất kỳ. Không truyền = toàn trường. |
| Tổng hợp | **Cấp nhóm lớp và toàn trường cộng gộp tử/mẫu (weighted)**, không lấy trung bình tỉ lệ các lớp. Ví dụ: lớp A 9/10, lớp B 50/100 → nhóm = 59/110 = 53,6% (không phải 70%). |
| Cấp học sinh | Toàn trường: gộp mọi buổi/nhiệm vụ của mọi lớp học sinh tham gia. Cấp lớp: chỉ dữ liệu của lớp đó. |
| Sĩ số | Số ghi danh hiệu lực tại mốc tính (`Enrollment.startAt ≤ t ≤ endAt`). Học sinh chuyển lớp không tính vào lớp cũ sau ngày chuyển. |
| Chia cho 0 | Hàm trả `null` → UI hiển thị `–` kèm tooltip; không bao giờ NaN/Infinity. |
| Điểm biên | So sánh ngưỡng dùng số nguyên (`pass × 100 ≥ ngưỡng × withData`) hoặc dung sai 1e-9, để 7/10 với ngưỡng 70% đúng là "đạt". |
| Định dạng | `85,3%` · `+2,1 điểm %` (chênh lệch tỉ lệ) · `6,5` (điểm thang 10) · `dd/MM/yyyy` · `HH:mm`. |

---

## 1. Chuyên cần (ATT)

<a id="M-ATT-01"></a>
### M-ATT-01 — Bộ đếm điểm danh
`attendanceCounts(D, scope, from, to)` — đếm AttendanceRecord của các buổi có `start ∈ [from, to)` theo 5 trạng thái `ON_TIME, LATE, EXCUSED, UNEXCUSED, NOT_TAKEN`. Bản ghi được sinh cho mọi học sinh có ghi danh hiệu lực của mọi buổi **đã bắt đầu**.

<a id="M-ATT-02"></a>
### M-ATT-02 — Mẫu số chuyên cần
`taken = ON_TIME + LATE + EXCUSED + UNEXCUSED`. **NOT_TAKEN không vào mẫu số.** `total = taken + NOT_TAKEN`.

| Mã | Chỉ số | Công thức |
|---|---|---|
| <a id="M-ATT-03"></a>M-ATT-03 | Tỉ lệ đúng giờ | `ON_TIME / taken` |
| <a id="M-ATT-04"></a>M-ATT-04 | Tỉ lệ đi muộn | `LATE / taken` |
| <a id="M-ATT-05"></a>M-ATT-05 | Tỉ lệ vắng có phép | `EXCUSED / taken` |
| <a id="M-ATT-06"></a>M-ATT-06 | Tỉ lệ vắng không phép | `UNEXCUSED / taken` |
| <a id="M-ATT-07"></a>M-ATT-07 | Tỉ lệ có mặt | `(ON_TIME + LATE) / taken` |
| <a id="M-ATT-08"></a>M-ATT-08 | Tỉ lệ bản ghi chưa điểm danh | `NOT_TAKEN / total` — **chỉ số vận hành của giáo viên / chất lượng dữ liệu**, không phải hành vi học sinh. Lớp có tỉ lệ này cao thì mọi chỉ số chuyên cần của lớp kém tin cậy. |

<a id="M-ATT-09"></a>
### M-ATT-09 — Số buổi vắng của học sinh
`attendanceByStudent(D, scope, from, to)` — theo học sinh: số buổi từng trạng thái, các lớp tham gia. Scope toàn trường → gộp mọi lớp.

<a id="M-ATT-10"></a>
### M-ATT-10 — Chuỗi vắng không phép liên tiếp dài nhất
Xét các bản ghi của học sinh theo `Session.start` tăng dần (gộp các lớp trong scope). `UNEXCUSED` cộng chuỗi; `NOT_TAKEN` bỏ qua (không cộng, không cắt); mọi trạng thái khác (kể cả vắng có phép) cắt chuỗi.

<a id="M-ATT-11"></a>
### M-ATT-11 — Phân bố học sinh theo số buổi vắng không phép
Học sinh có ≥ 1 bản ghi đã điểm danh trong kỳ, xếp vào bucket `0, 1, 2, 3, 4, 5+`.

<a id="M-ATT-12"></a>
### M-ATT-12 — Ma trận thứ × khung giờ
Bộ đếm M-ATT-01 theo (thứ trong tuần, ca học). Ô hiển thị tỉ lệ đi muộn hoặc tỉ lệ vắng.

<a id="M-ATT-13"></a>
### M-ATT-13 — Tỉ lệ có mặt theo ngày
M-ATT-07 theo `dayKey(Session.start)` (calendar heatmap). Ngày không có buổi học → không có ô (khác với 0%).

---

## 2. Lịch học & vận hành (OPS)

| Mã | Chỉ số | Công thức / quy tắc |
|---|---|---|
| <a id="M-OPS-00"></a>M-OPS-00 | Lớp đang hoạt động | Có ≥ 1 ClassCourse với `startAt ≤ t ≤ endAt` (t = `min(cuối kỳ, bây giờ)`). |
| <a id="M-OPS-01"></a>M-OPS-01 | Số lịch học | Số Session có `start` trong kỳ (gồm cả buổi chưa diễn ra). |
| <a id="M-OPS-02"></a>M-OPS-02 | Trạng thái thời gian | `start > now` → Chưa diễn ra; `start ≤ now < end` → Đang diễn ra; còn lại → Đã kết thúc. |
| <a id="M-OPS-03"></a>M-OPS-03 | Tỉ lệ lịch học đã điểm danh | Buổi đã bắt đầu có `attendanceSubmittedAt` / buổi đã bắt đầu. |
| <a id="M-OPS-04"></a>M-OPS-04 | Tỉ lệ lịch học đã báo cáo | Buổi đã kết thúc có `reportSubmittedAt` / buổi đã kết thúc. |
| <a id="M-OPS-05"></a>M-OPS-05 | Phân loại buổi | Chưa diễn ra · Đủ điểm danh + báo cáo · Chỉ điểm danh · Chỉ báo cáo · Chưa có gì. |
| <a id="M-OPS-06"></a>M-OPS-06 | Tỉ lệ điểm danh đúng thời điểm | Buổi có `attendanceSubmittedAt ≤ start + 15'` / buổi đã bắt đầu ≥ 15'. (Ngưỡng `ops.attendanceGraceMin`.) |
| <a id="M-OPS-07"></a>M-OPS-07 | Độ trễ báo cáo | `reportSubmittedAt − end`: < 2 giờ · 2–24 giờ · 1–3 ngày · > 3 ngày · chưa nộp (buổi đã kết thúc). |
| <a id="M-OPS-08"></a>M-OPS-08 | Tỉ lệ báo cáo trong 24h | Buổi kết thúc ≥ 24h có báo cáo trong 24h / các buổi đó. |
| <a id="M-OPS-09"></a>M-OPS-09 | Số nhiệm vụ đã giao (giáo viên) | Task có `assignedAt` trong kỳ, giáo viên = giáo viên của buổi giao. |
| <a id="M-OPS-10"></a>M-OPS-10 | Bài quá hạn chưa chấm | Bài nộp của nhiệm vụ `requiresManualGrading`, đã quá hạn, `gradedAt = null`. |
| <a id="M-OPS-11"></a>M-OPS-11 | Thời gian chấm TB | TB `gradedAt − max(submittedAt, dueAt)` của nhiệm vụ chấm tay. |

---

## 3. Nhiệm vụ (HW)

<a id="M-HW-01"></a>
### M-HW-01 — Trạng thái học sinh–nhiệm vụ (tại "bây giờ")
| Trạng thái | Điều kiện |
|---|---|
| ĐANG MỞ | `dueAt > now` (kể cả đã nộp sớm; hiển thị thêm "đã nộp x/y") |
| ĐÚNG HẠN | `submittedAt ≤ dueAt` |
| MUỘN | `submittedAt > dueAt` |
| KHÔNG HOÀN THÀNH | quá hạn, chưa nộp |
| *Nộp chưa đủ* (trạng thái con) | ĐÚNG HẠN/MUỘN với `completedItems < itemCount` |

Học sinh được giao = có ghi danh hiệu lực tại `Task.assignedAt`.

| Mã | Chỉ số | Công thức |
|---|---|---|
| <a id="M-HW-02"></a>M-HW-02 | Tỉ lệ đúng hạn | `ĐÚNG HẠN / (ĐÚNG HẠN + MUỘN + KHÔNG HOÀN THÀNH)` — chỉ nhiệm vụ đã quá hạn |
| <a id="M-HW-03"></a>M-HW-03 | Tỉ lệ muộn | `MUỘN / đã quá hạn` |
| <a id="M-HW-04"></a>M-HW-04 | Tỉ lệ không hoàn thành | `KHÔNG HOÀN THÀNH / đã quá hạn` |
| <a id="M-HW-05"></a>M-HW-05 | Tỉ lệ nộp chưa đủ | `Nộp chưa đủ / đã quá hạn` |
| <a id="M-HW-06"></a>M-HW-06 | Tỉ lệ nộp | `(ĐÚNG HẠN + MUỘN) / đã quá hạn` |
| <a id="M-HW-07"></a>M-HW-07 | Điểm nhiệm vụ & điểm TB | Điểm thang 10 = `score / maxScore × 10`. **Chỉ tính bài đã có điểm.** Điểm TB cộng gộp trên mọi bài (không TB các lớp). |
| <a id="M-HW-08"></a>M-HW-08 | Phân bố điểm | min, Q1, trung vị, Q3, max (nội suy tuyến tính); histogram 0–10. |
| <a id="M-HW-09"></a>M-HW-09 | Thời điểm nộp so với hạn | > 72h · 24–72h · 6–24h · < 6h trước hạn · muộn (nhiệm vụ đã quá hạn). |
| <a id="M-HW-10"></a>M-HW-10 | Nhiệm vụ bất thường | Tỉ lệ nộp thấp hơn **trung vị các nhiệm vụ đã quá hạn cùng khóa (từ đầu khóa)** ≥ 20 điểm %, hoặc điểm TB thấp hơn ≥ 1,5 điểm; nhiệm vụ cần ≥ 5 học sinh được giao. |
| <a id="M-HW-11"></a>M-HW-11 | Nhiệm vụ đang diễn ra | `assignedAt ≤ now < dueAt`. |

---

## 4. Khóa trực tuyến (ONL)

| Mã | Chỉ số | Công thức |
|---|---|---|
| <a id="M-ONL-01"></a>M-ONL-01 | Tiến độ | `completedItems(tại mốc) / totalItems` — dùng log `itemCompletedAt[]` để tính tại mốc bất kỳ. |
| <a id="M-ONL-02"></a>M-ONL-02 | Tiến độ kỳ vọng | `clamp((mốc − startAt) / (dueAt − startAt), 0, 1)`. |
| <a id="M-ONL-03"></a>M-ONL-03 | Đúng tiến độ | Tiến độ ≥ kỳ vọng − 10 điểm % (`online.onTrackTolerancePts`). |
| <a id="M-ONL-04"></a>M-ONL-04 | Trạng thái | Như M-HW-01, theo `completedAt` so với `dueAt`. |
| <a id="M-ONL-05"></a>M-ONL-05 | Tỉ lệ hoàn thành đúng hạn | `ĐÚNG HẠN / (ĐÚNG HẠN + MUỘN + KHÔNG HOÀN THÀNH)` của cặp học sinh–khóa có hạn trong kỳ. |
| <a id="M-ONL-06"></a>M-ONL-06 | Điểm tổng hợp (0–100) | `wTask × tỉ lệ hoàn thành bài tập (%) + wTest × testScore` (mặc định 0,3 / 0,7; ngưỡng 50; theo khóa). Trên UI gọi thành phần đầu là **"Tỉ lệ hoàn thành bài tập"**, không gọi "chuyên cần". |
| <a id="M-ONL-07"></a>M-ONL-07 | Điểm tổng hợp dự kiến | `wTask × min(100, tiến độ / tiến độ kỳ vọng × 100) + wTest × (testScore ?? 0)`. |
| <a id="M-ONL-08"></a>M-ONL-08 | Funnel | Được giao → Đã bắt đầu (≥ 1 mục) → Đang học (≥ 50% nội dung) → Hoàn thành → Đạt ngưỡng điểm tổng hợp. Các bước lồng nhau. |
| <a id="M-ONL-09"></a>M-ONL-09 | Tỉ lệ học sinh đúng tiến độ | Số học sinh M-ONL-03 / số học sinh được giao (khóa đang chạy). |
| <a id="M-ONL-10"></a>M-ONL-10 | Điểm TB khóa trực tuyến | TB M-ONL-06 của học sinh **đã có điểm kiểm tra**, khóa có hạn trong kỳ. |
| <a id="M-ONL-11"></a>M-ONL-11 | Khóa trực tuyến đang diễn ra | Assignment có `startAt ≤ now < dueAt` (đếm theo lớp). |

---

## 5. Chuẩn đầu ra (LO)

| Mã | Chỉ số | Công thức |
|---|---|---|
| <a id="M-LO-01"></a>M-LO-01 | Quy đổi % → cấp | ≥ 90 Rất tốt · 75–<90 Tốt · 60–<75 Trung bình · 40–<60 Cần cải thiện · < 40 Chưa tốt · null → Chưa có thông tin. |
| <a id="M-LO-02"></a>M-LO-02 | Đạt yêu cầu | Cấp ≥ Trung bình (`lo.passLevel`). |
| <a id="M-LO-03"></a>M-LO-03 | Coverage | Học sinh có dữ liệu / sĩ số. |
| <a id="M-LO-04"></a>M-LO-04 | Tỉ lệ đạt | Học sinh đạt / học sinh có dữ liệu. |
| <a id="M-LO-05"></a>M-LO-05 | Màu trạng thái | Xám nếu coverage = 0; Xanh nếu tỉ lệ đạt ≥ 80%; Cam nếu 50% ≤ … < 80%; Đỏ nếu < 50%. Badge **"Dữ liệu mỏng"** nếu 0 < coverage < 30%. Luôn hiển thị số câu hỏi đã thực hiện cạnh tỉ lệ. |
| <a id="M-LO-06"></a>M-LO-06 | Phân bố 6 mức | Mọi cặp (học sinh–lớp) × CĐR của các lớp đang học khóa; chưa có dữ liệu → "Chưa có thông tin". |
| <a id="M-LO-07"></a>M-LO-07 | Số câu hỏi đã thực hiện | Σ `evidenceCount`; TB/học sinh có dữ liệu. |
| <a id="M-LO-08"></a>M-LO-08 | % CĐR Xanh | Số cặp lớp–CĐR Xanh / số cặp lớp–CĐR không Xám. |
| <a id="M-LO-09"></a>M-LO-09 | Diễn giải nguyên nhân | Xem §5.1. |
| <a id="M-LO-10"></a>M-LO-10 | Tỉ lệ đúng theo câu hỏi | `isCorrect / số lượt` theo câu hỏi × lớp (QuestionAttempt). |
| <a id="M-LO-11"></a>M-LO-11 | Xu hướng tỉ lệ đạt | Từ LOSnapshot theo tuần; gộp lớp: `Σ(passRate × withData) / Σ withData`. Ảnh chụp tính bằng ngưỡng **tại thời điểm chụp**. |
| <a id="M-LO-12"></a>M-LO-12 | Thời lượng khóa đã qua | `(t − startAt) / (endAt − startAt)`, cấp khóa = TB các ClassCourse đang hoạt động. |

`LOAchievement.percent` trong mock = tỉ lệ trả lời đúng trên mọi lượt làm câu hỏi của CĐR đó (OQ-43).

<a id="cause"></a>
### 5.1 Diễn giải nguyên nhân (mục 3.6 của spec) — `causeAnalysis(D, courseId, cfg, t)`

1. **Lớp đủ dữ liệu** cho một CĐR: ≥ 10 học sinh có dữ liệu **và** evidence TB ≥ 3 câu/học sinh.
2. **"Nghi vấn chương trình / học liệu / đề đánh giá"** (CĐR): trong các lớp đang học khóa và đủ dữ liệu (cần ≥ 3 lớp), CĐR Đỏ ở ≥ 60% số lớp. Thiếu lớp đủ dữ liệu → "Chưa đủ dữ liệu để kết luận".
3. **"Nghi vấn ở lớp học"** (lớp × CĐR): lớp đủ dữ liệu; có ≥ 2 lớp khác đủ dữ liệu; trung vị tỉ lệ đạt của **các lớp khác** ≥ ngưỡng Cam (50%); tỉ lệ đạt của lớp thấp hơn trung vị đó ≥ 25 điểm %. Lớp không đủ dữ liệu → "Chưa đủ dữ liệu để kết luận".
4. Không gắn nhãn trực tiếp lên giáo viên. Dưới mọi biểu đồ so sánh lớp hiển thị lưu ý: *"Kết quả của lớp còn chịu ảnh hưởng bởi đầu vào học sinh, sĩ số, số buổi đã học và cách ra đề…"*.

Điểm biên đã kiểm thử (tests.html): Đỏ ở đúng 3/5 lớp (60%) → gắn nhãn; chênh đúng 25 điểm với trung vị đúng 50% → gắn nhãn; chênh 24 điểm → không; trung vị < 50% → không; 9 học sinh có dữ liệu hoặc evidence TB 2 → "Chưa đủ dữ liệu".

---

## 6. Tổng hợp & benchmark (BM)

<a id="M-BM-01"></a>
### M-BM-01 — Chỉ số chính của một scope
`keyMetrics(D, scope, from, to, cfg)`: tỉ lệ có mặt (M-ATT-07), tỉ lệ nộp đúng hạn (M-HW-02), điểm TB nhiệm vụ (M-HW-07), tỉ lệ hoàn thành khóa trực tuyến đúng hạn (M-ONL-05), % CĐR Xanh (M-LO-08, lũy kế), tỉ lệ buổi đã báo cáo (M-OPS-04). Benchmark lớp đặt chỉ số của lớp cạnh TB nhóm lớp và TB trường — đều weighted.

<a id="M-BM-02"></a>
### M-BM-02 — Độ lệch so với TB trường
Chỉ số nhóm − chỉ số trường, đơn vị điểm %; điểm thang 10 quy ra × 10 để cùng thang màu.

---

## 7. Kỳ dữ liệu (PER)

<a id="M-PER-01"></a>
| Chế độ | Khoảng | Kỳ liền trước |
|---|---|---|
| Ngày | 00:00 → 24:00 ngày neo | Ngày trước |
| Tuần | Thứ Hai → hết Chủ nhật của tuần chứa ngày neo | Tuần trước |
| Tháng | Ngày 1 → hết tháng dương lịch | Tháng dương lịch trước |
| Khoảng tùy chọn | `from` → hết `to` (bỏ trống `to` = đến hiện tại) | Khoảng cùng số ngày ngay trước |

Nhất quán (đã kiểm thử): Σ số liệu 7 ngày = số liệu tuần; Σ theo ngày trong tháng = số liệu tháng (đếm cộng được vì mọi chỉ số đều cộng gộp tử/mẫu).
