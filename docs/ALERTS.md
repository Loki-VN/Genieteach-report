# ALERTS — Danh mục cảnh báo bất thường

> Nguồn: `assets/js/alerts.js` (rule engine) · tham số mặc định: `assets/js/config.js` → `alerts.rules` · chỉnh ở `hoc-vu/settings.html`.
> Mọi số liệu trong cảnh báo đều lấy từ `metrics.js` (một định nghĩa duy nhất — xem [METRICS.md](METRICS.md)).

## 1. Cấu trúc một cảnh báo

```js
{
  id, key,                 // key = ruleId|scope|entityIds — khóa chống trùng & lưu trạng thái
  ruleId, severity,        // 'HIGH' | 'MEDIUM' | 'LOW' (cấu hình được)
  group,                   // OPS | ATT | HW | ONL | LO | CUR | DATA
  scope,                   // STUDENT | CLASS | GROUP | TEACHER | COURSE | LO | SESSION | TASK
  entityIds,               // id đối tượng (ví dụ [classId, loId])
  title, reason,           // reason luôn có số liệu cụ thể
  suggestedAction, drilldownUrl,
  detectedAt,              // mốc phát hiện (giờ VN)
  status,                  // NEW | IN_PROGRESS | RESOLVED | IGNORED (lưu localStorage)
  classId?, groupId?, courseId?, loId?, studentId?, teacherId?, sessionId?, taskId?, questionId?,
  grouped?, children?      // cảnh báo gộp cấp lớp kèm danh sách học sinh
}
```

Ví dụ `reason` thật từ mock mặc định:
> *"Lớp 10A3 có tỉ lệ đi muộn 7 ngày gần nhất 29,7% (35/118 lượt), cao hơn trung bình trường (7,1%) 22,6 điểm %."*

## 2. Quy tắc chung

| Quy tắc | Nội dung | Tham số |
|---|---|---|
| Thời điểm đánh giá | "Bây giờ" (`config.school.now`). Mỗi rule có cửa sổ riêng, **không phụ thuộc kỳ đang xem** trên trang (OQ-02). | `windowDays`… từng rule |
| Cỡ mẫu tối thiểu | Rule tỉ lệ cấp lớp/nhóm không chạy nếu mẫu số < 30 bản ghi hoặc < 10 học sinh có dữ liệu. Rule CĐR cấp lớp: ≥ 10 học sinh có dữ liệu (OQ-11). Rule cấp buổi (ATT-C04): ≥ 10 học sinh đã điểm danh (OQ-47). Rule cấp học sinh có cỡ mẫu riêng (OQ-15). | `alerts.minDenominator = 30`, `alerts.minStudentsWithData = 10` |
| Gộp | ≥ 5 học sinh cùng lớp vi phạm cùng rule → 1 cảnh báo cấp lớp (`grouped = true`, `children` = danh sách). Học sinh học nhiều lớp được gán vào lớp có nhiều vi phạm nhất (OQ-08). Rule theo khóa trực tuyến/khóa học gộp theo lớp + assignment/khóa. | `alerts.groupMinStudents = 5` |
| Chống trùng | Cùng khóa (rule + đối tượng), cảnh báo cũ chưa xử lý và lần phát hiện mới cách < 7 ngày → không sinh mới (giữ `detectedAt`, trạng thái cũ). Cảnh báo đã xử lý chỉ sinh lần mới khi điều kiện được phát hiện **sau** lúc xử lý (OQ-39). | `alerts.dedupeDays = 7` |
| Sắp xếp | Mức (Cao → Thấp) rồi `detectedAt` mới nhất trước. | |
| Ngôn ngữ | Chỉ mô tả số liệu và hành vi vận hành; dùng "lớp học", "cần xem xét". **Không** câu nào quy kết chất lượng giáo viên. | |
| Nhóm hiển thị (Tổng quan) | Vận hành = OPS + DATA-03 · Chuyên cần = ATT · Học ở nhà = HW + ONL · Chuẩn đầu ra = LO + CUR + DATA-01/02 (OQ-31). | |

## 3. Danh mục rule

Cột "Kịch bản" trỏ tới kịch bản cài sẵn trong `mock-data.js` (K01–K30, xem PLAN.md §3.3). `?debug=1` trên bất kỳ trang nào in bảng đối chiếu kịch bản → rule ra console.

### 3.1 Vận hành (OPS)

| ID | Điều kiện mặc định | Mức | Scope | Cửa sổ / tham số | Cỡ mẫu | Kịch bản |
|---|---|---|---|---|---|---|
| OPS-01 | Buổi đã bắt đầu > 15 phút chưa điểm danh | HIGH | SESSION | Các buổi trong hôm nay · `minutes = 15` | – | K05, K06 |
| OPS-02 | Buổi kết thúc > 24h chưa có báo cáo | MEDIUM | SESSION | Buổi kết thúc trong 7 ngày · `hours = 24`, `lookbackDays = 7` | – | K05 |
| OPS-03 | Giáo viên có ≥ 3 buổi chưa điểm danh (sau 15') hoặc chưa báo cáo (sau 24h) | HIGH | TEACHER | `minSessions = 3`, `windowDays = 7` | – | K05 |
| OPS-04 | Nhiệm vụ chấm tay quá hạn > 3 ngày còn bài chưa chấm | MEDIUM | TASK | `daysOverdue = 3`, `lookbackDays = 30` | – | K07 |
| OPS-05 | Lớp có buổi học nhưng không được giao nhiệm vụ nào | LOW | CLASS | `windowDays = 7` | – | K08 |
| OPS-06 | Tỉ lệ bản ghi "chưa điểm danh" của lớp > 10% | MEDIUM | CLASS | `threshold = 10`, `windowDays = 30` | ≥ 30 bản ghi, sĩ số ≥ 10 | K05 |

### 3.2 Chuyên cần — học sinh (ATT-S)

Tính gộp mọi lớp của học sinh (cấp học sinh toàn trường).

| ID | Điều kiện mặc định | Mức | Cửa sổ / tham số | Kịch bản |
|---|---|---|---|---|
| ATT-S01 | Vắng (có phép + không phép) > 3 buổi | HIGH | 30 ngày gần nhất (OQ-03) · `maxAbsences = 3` | K11, K16 |
| ATT-S02 | Vắng không phép ≥ 2 buổi liên tiếp (NOT_TAKEN bỏ qua, trạng thái khác cắt chuỗi) | HIGH | `consecutive = 2`, `windowDays = 30` | K11 |
| ATT-S03 | Đi muộn ≥ 3 lần | MEDIUM | `lateCount = 3`, `windowDays = 14` | K12 |
| ATT-S04 | Tỉ lệ có mặt giảm ≥ 20 điểm % so với 30 ngày trước đó | MEDIUM | `dropPts = 20`, `windowDays = 30`, ≥ 5 buổi mỗi kỳ | K15 |
| ATT-S05 | Vắng có phép ≥ 4 buổi (theo dõi lạm dụng) | LOW | `excusedCount = 4`, `windowDays = 30` | K16 |

### 3.3 Chuyên cần — lớp/nhóm (ATT-C)

| ID | Điều kiện mặc định | Mức | Cửa sổ / tham số | Cỡ mẫu | Kịch bản |
|---|---|---|---|---|---|
| ATT-C01 | Tỉ lệ có mặt của lớp < 85% | MEDIUM | `threshold = 85`, `windowDays = 7` | 30 / 10 | K09, K13 |
| ATT-C02 | Tỉ lệ đi muộn của lớp ≥ TB trường + 10 điểm % | MEDIUM | `gapPts = 10`, `windowDays = 7` | 30 / 10 | K12 |
| ATT-C03 | Tỉ lệ có mặt của lớp giảm ≥ 10 điểm % so với 7 ngày trước đó | MEDIUM | `dropPts = 10`, `windowDays = 7` | 30 / 10 cả hai kỳ | K13 |
| ATT-C04 | Một buổi có tỉ lệ có mặt thấp hơn TB lớp (14 ngày) ≥ 25 điểm % | LOW | `gapPts = 25`, `windowDays = 14` | Lớp 30 / 10; buổi ≥ 10 học sinh | K14 |
| ATT-C05 | Nhóm lớp có tỉ lệ có mặt thấp hơn TB trường ≥ 5 điểm % | MEDIUM | `gapPts = 5`, `windowDays = 7` | 30 / 10 | K09 |

### 3.4 Học ở nhà — nhiệm vụ (HW)

| ID | Điều kiện mặc định | Mức | Cửa sổ / tham số | Cỡ mẫu | Kịch bản |
|---|---|---|---|---|---|
| HW-S01 | Học sinh không hoàn thành ≥ 2 nhiệm vụ liên tiếp (theo lớp–khóa, OQ-07) | HIGH | `consecutive = 2`, `windowDays = 30` | – | K11 |
| HW-S02 | Học sinh không hoàn thành ≥ 30% nhiệm vụ (gộp lớp) | HIGH | `missingShare = 30`, `windowDays = 30` | ≥ 4 nhiệm vụ | K11 |
| HW-S03 | Điểm TB nhiệm vụ giảm ≥ 2 điểm (thang 10) so với 30 ngày trước đó | MEDIUM | `dropPoints = 2`, `windowDays = 30` | ≥ 3 bài có điểm mỗi kỳ | K20 |
| HW-C01 | Tỉ lệ nộp đúng hạn của lớp < 70% | MEDIUM | `threshold = 70`, `windowDays = 7` | 30 / 10 | K17 |
| HW-C02 | Điểm TB nhiệm vụ của lớp thấp hơn TB các lớp **khác** cùng khóa ≥ 1,5 điểm | MEDIUM | `gap = 1,5`, `windowDays = 30` | 30 bài / 10 học sinh; lớp khác ≥ 30 bài | K18 |
| HW-T01 | Nhiệm vụ có tỉ lệ nộp < 60% hoặc điểm TB < 5 → nghi vấn đề bài | MEDIUM | `lookbackDays = 30` | ≥ 10 học sinh được giao; điều kiện điểm cần ≥ 5 bài đã chấm | K19 |

### 3.5 Khóa trực tuyến (ONL)

ONL-S01/S02/S03/C01 chỉ xét khóa **đang chạy** (`startAt ≤ now < dueAt`).

| ID | Điều kiện mặc định | Mức | Tham số | Cỡ mẫu | Kịch bản |
|---|---|---|---|---|---|
| ONL-S01 | Tiến độ học sinh thấp hơn kỳ vọng ≥ 25 điểm % | HIGH | `gapPts = 25` | – | K21 |
| ONL-S02 | Điểm tổng hợp dự kiến < ngưỡng hoàn thành khi còn ≤ 30% thời gian | HIGH | `remainingShare = 30` | – | K22 |
| ONL-S03 | Chưa bắt đầu khóa sau 7 ngày kể từ ngày giao | MEDIUM | `days = 7` | – | K23 |
| ONL-C01 | Tỉ lệ học sinh đúng tiến độ của lớp < 60% | MEDIUM | `threshold = 60` | ≥ 10 học sinh | K21 |
| ONL-C02 | Tỉ lệ hoàn thành đúng hạn thấp hơn TB các lớp khác cùng nội dung ≥ 20 điểm % | MEDIUM | `gapPts = 20`, khóa có hạn trong 30 ngày | ≥ 10 học sinh; lớp khác ≥ 30 | K24 |

### 3.6 Chuẩn đầu ra — học sinh và lớp (LO)

Lũy kế đến "bây giờ"; sĩ số = ghi danh hiệu lực.

| ID | Điều kiện mặc định | Mức | Scope | Cỡ mẫu | Kịch bản |
|---|---|---|---|---|---|
| LO-S01 | Học sinh có > 3 CĐR không đạt (dưới mức "đạt yêu cầu") trong một khóa | HIGH | STUDENT | – | K03 |
| LO-S02 | Hoàn thành ≥ 90% nhiệm vụ của lớp–khóa nhưng ≥ 2 CĐR Chưa tốt (chăm nhưng chưa hiểu) | MEDIUM | STUDENT | ≥ 5 nhiệm vụ | K25 |
| LO-C01 | CĐR Đỏ ở một lớp | HIGH | LO (lớp–CĐR) | ≥ 10 học sinh có dữ liệu | K01, K03 |
| LO-C02 | Lớp có ≥ 30% số CĐR của khóa ở trạng thái Đỏ | HIGH | CLASS | ≥ 10 học sinh có dữ liệu | K03 |
| LO-C03 | "Nghi vấn ở lớp học" (mục 3.6) — 1 cảnh báo cho mỗi lớp–khóa, liệt kê các CĐR | MEDIUM | CLASS | Theo METRICS §5.1 | K03 |

### 3.7 Chương trình / khóa học (CUR)

| ID | Điều kiện mặc định | Mức | Scope | Cỡ mẫu | Kịch bản |
|---|---|---|---|---|---|
| CUR-01 | "Nghi vấn chương trình" — Đỏ ở ≥ 60% số lớp đủ dữ liệu (≥ 3 lớp) | HIGH | LO | Theo METRICS §5.1 | K01 |
| CUR-02 | CĐR có tỉ lệ đạt toàn trường < 50% | HIGH | LO | ≥ 30 học sinh có dữ liệu | K01, K04 |
| CUR-03 | Câu hỏi có tỉ lệ đúng < 30% trên ≥ 3 lớp → nghi vấn câu hỏi | MEDIUM | LO (câu hỏi) | ≥ 10 lượt/lớp | K02 |

### 3.8 Chất lượng dữ liệu (DATA)

| ID | Điều kiện mặc định | Mức | Scope | Ghi chú | Kịch bản |
|---|---|---|---|---|---|
| DATA-01 | CĐR có 0 < coverage < 30% khi khóa đã qua ≥ 50% thời lượng | MEDIUM | LO | Cấp khóa (gộp lớp). Coverage = 0 thuộc DATA-02 (OQ-48). | K26 |
| DATA-02 | CĐR Xám (chưa có dữ liệu) khi khóa đã qua ≥ 70% thời lượng | MEDIUM | LO | Cấp khóa | K27 |
| DATA-03 | Lớp đang hoạt động không có buổi học nào trong 14 ngày | LOW | CLASS | | K28 |

## 4. Kết quả với seed mặc định (08/10/2026 09:40)

- Tổng ≈ 330 cảnh báo (≈ 200 Cao · 120 Trung bình · 10 Thấp). Phần lớn là rule cấp học sinh, đã được gộp thành khoảng 30 cảnh báo cấp lớp.
- **Mọi rule kích hoạt ≥ 1 lần** và **mọi kịch bản K01–K30 khớp** — kiểm thử tự động trong `tests.html`.
- TA-04 (sĩ số 8) **không** có cảnh báo tỉ lệ cấp lớp nào (dưới cỡ mẫu tối thiểu); rule cấp học sinh vẫn chạy và có thể được gộp.
