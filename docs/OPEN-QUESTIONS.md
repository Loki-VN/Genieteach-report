# OPEN QUESTIONS — Giả định, sửa spec và câu hỏi mở

> Prototype **không tự bịa quy tắc**. Khi spec im lặng hoặc mâu thuẫn, prototype áp dụng một giả định (ghi ở mục "Áp dụng"), cho phép cấu hình nếu hợp lý, và liệt kê ở đây để team sản phẩm và khách hàng xác nhận.
> Ký hiệu: **[GIẢ ĐỊNH]** · **[SỬA SPEC]** · **[ĐỀ XUẤT]** · **[CÂU HỎI]**.

---

## A. Câu hỏi ngoài phạm vi spec (mục 6), cần khách hàng trả lời

| ID | Câu hỏi | Áp dụng tạm trong prototype |
|---|---|---|
| Q-01 | Ai được quyền chỉnh cấu hình cấp trường? Giáo viên có thấy cấu hình đó không? | Ai mở `settings.html` cũng chỉnh được (không có phân quyền thật). |
| Q-02 | Hệ thống thật có lưu snapshot chuẩn đầu ra theo tuần không? (cần cho mọi biểu đồ xu hướng CĐR) | Mock sinh `LOSnapshot` từ QuestionAttempt lũy kế. Biểu đồ CD-06 gắn nhãn "Cần dữ liệu lịch sử". |
| Q-03 | Chính sách hiển thị báo cáo theo giáo viên của từng trường? | Toggle cấp trường "Hiển thị báo cáo theo giáo viên", mặc định BẬT. |
| Q-04 | Giáo viên có được xem so sánh lớp mình với lớp khác không? | Chưa áp dụng (repo chưa có trang Giáo viên). |
| Q-05 | Định nghĩa "lớp đang hoạt động"? | [GIẢ ĐỊNH] của spec: lớp có ≥ 1 ClassCourse đang trong thời gian diễn ra tại mốc tính. |

## B. [GIẢ ĐỊNH] có sẵn trong spec (cấu hình được ở `settings.html` khi là ngưỡng)

| ID | Nội dung |
|---|---|
| SP-GD-01 | LOAchievement gắn theo cặp học sinh–lớp, vì một học sinh có thể học cùng một khóa ở hai lớp. |
| SP-GD-02 | Nộp khi `completedItems < itemCount` → trạng thái con "Nộp chưa đủ" của ĐÚNG HẠN/MUỘN, hiển thị riêng. |
| SP-GD-03 | Điểm tổng hợp khóa trực tuyến: trọng số 0,3 (tỉ lệ hoàn thành bài tập) / 0,7 (điểm kiểm tra), ngưỡng hoàn thành 50, cấu hình theo khóa. |
| SP-GD-04 | Quy đổi % → 5 cấp: Rất tốt ≥ 90 · Tốt 75–<90 · Trung bình 60–<75 · Cần cải thiện 40–<60 · Chưa tốt < 40 · null → Chưa có thông tin. |
| SP-GD-05 | Học sinh "đạt yêu cầu" một CĐR khi cấp ≥ Trung bình. |
| SP-GD-06 | Điểm biên màu: Xám nếu coverage = 0; Xanh ≥ 80%; Cam 50% ≤ … < 80%; Đỏ < 50%; "Dữ liệu mỏng" khi 0 < coverage < 30%. |
| SP-GD-07 | Điểm danh đúng thời điểm: `attendanceSubmittedAt` trước hoặc trong 15 phút đầu buổi. |
| SP-GD-08 | Cảnh báo: cỡ mẫu tối thiểu (mẫu số ≥ 30, ≥ 10 học sinh có dữ liệu); chống trùng 7 ngày; gộp ≥ 5 học sinh cùng lớp. |
| SP-GD-09 | Lớp có < 30 lượt điểm danh trong kỳ không được xếp hạng; hiển thị cuối bảng kèm ghi chú. |
| SP-GD-10 | Lớp đang hoạt động = có ít nhất một ClassCourse đang trong thời gian diễn ra (= Q-05). |

## C. [SỬA SPEC] có sẵn trong spec

| ID | Nội dung |
|---|---|
| SP-SS-01 | Thẻ lớp ở Tổng quan hiển thị lịch học hôm nay của lớp: giờ, khóa, giáo viên, trạng thái (sắp diễn ra / đang diễn ra / đã điểm danh / chưa điểm danh / đã báo cáo). Xem thêm OQ-34. |
| SP-SS-02 | "Top lớp điểm nhiệm vụ trung bình cao nhất" → popup bảng điểm TB từng lớp + biểu đồ so sánh điểm TB (spec gốc ghi nhầm "tỉ lệ làm bài đúng hạn"). |
| SP-SS-03 | Filter khóa học trong các tab của `class.html` lấy tất cả khóa của lớp (Học vụ không giới hạn theo khóa của một giáo viên). |
| SP-SS-04 | Spec gốc nhắc "tab học trực tuyến" nhưng không định nghĩa → gộp khóa trực tuyến vào tab Bài về nhà, có anchor `#online`. |

---

## D. Giả định phát sinh khi lập plan

### Phạm vi & môi trường

**OQ-01 — Repo chưa có bộ báo cáo Giáo viên** [GIẢ ĐỊNH]
Spec chỉ yêu cầu role switcher và chế độ chỉ đọc cho cấu hình phía Giáo viên *khi repo đã có* bộ báo cáo đó. Repo đang trống → không làm role switcher. `index.html` để vùng "Vai trò" chỉ có Học vụ, kèm ghi chú. `metrics.js`/`alerts.js` vẫn thiết kế để dùng chung.

**OQ-29 — Mốc thời gian và cửa sổ dữ liệu** [GIẢ ĐỊNH]
"Hôm nay" = 08/10/2026 (Thứ Năm), "bây giờ" = 09:40, cấu hình trong `config.js`; toàn bộ mock sinh tương đối theo mốc này. 16 tuần lịch sử tính cả tuần hiện tại → bắt đầu 22/06/2026 (trùng kỳ hè với trường phổ thông; với trung tâm/trường quốc tế có học kỳ hè thì hợp lý). Nghỉ lễ 01–02/09 không có buổi. Thời gian lưu dạng giờ tường Việt Nam (mã hóa UTC) để không lệch múi giờ/DST khi người xem ở nước ngoài.
→ [CÂU HỎI] Có muốn đổi "hôm nay" sang giữa học kỳ 1 (ví dụ 10/12/2026) cho sát lịch năm học phổ thông không? Chỉ cần sửa một dòng trong `config.js`.

**OQ-42 — ECharts khi demo offline** [CÂU HỎI]
Spec yêu cầu CDN pin version → prototype chỉ dùng CDN. Nếu demo ở nơi không có Internet, biểu đồ sẽ không hiện. Có cần thêm bản dự phòng `assets/vendor/echarts-5.5.0.min.js` không?

### Kỳ dữ liệu & cửa sổ tính

**OQ-02 — Cảnh báo không phụ thuộc kỳ đang xem** [GIẢ ĐỊNH]
Spec vừa có kỳ dữ liệu trên từng trang, vừa có rule ghi "trong kỳ"/"trong tháng". Áp dụng: rule engine đánh giá tại "bây giờ", mỗi rule có cửa sổ riêng (cấu hình được). Khối cảnh báo trên từng trang chỉ lọc theo nhóm rule và filter lớp/nhóm/khóa, không theo kỳ đang xem. Lý do: cảnh báo là hàng đợi xử lý, trạng thái phải ổn định khi người dùng đổi kỳ.

**OQ-03 — "Trong tháng" = 30 ngày gần nhất** [GIẢ ĐỊNH]
Áp dụng cho ATT-S01, ATT-S05, HW-S02; "so với tháng trước" (ATT-S04, HW-S03) = 30 ngày trước đó. Lý do: theo tháng dương lịch thì đầu tháng gần như không có dữ liệu (ví dụ 08/10 mới có 8 ngày). Có thể chuyển sang tháng dương lịch trong cấu hình.

**OQ-04 — "Trong kỳ" của rule tỉ lệ cấp lớp/nhóm = 7 ngày gần nhất** [GIẢ ĐỊNH]
Áp dụng cho ATT-C01/02/05, HW-C01. "So với kỳ trước" (ATT-C03) = 7 ngày trước đó. OPS-06 và HW-C02 dùng 30 ngày (cần mẫu lớn hơn để ổn định).

**OQ-05 — "Tuần vừa qua" ở Tổng quan = 7 ngày gần nhất tính đến bây giờ** [GIẢ ĐỊNH]

**OQ-06 — Cửa sổ các thẻ ở Tổng quan** [GIẢ ĐỊNH]
Spec không nêu kỳ cho các bảng Top và chỉ số nhóm lớp ở Tổng quan. Áp dụng: Top lớp = 7 ngày gần nhất; thẻ nhóm lớp, heatmap nhóm × chỉ số = 30 ngày gần nhất (chỉ số CĐR = lũy kế); xu hướng = 8 tuần. Mỗi thẻ ghi rõ cửa sổ.

**OQ-24 — Kỳ liền trước "cùng độ dài"** [GIẢ ĐỊNH]
Ngày → ngày trước; Tuần → tuần trước; Tháng → tháng dương lịch trước (độ dài có thể chênh 1–3 ngày); Khoảng tùy chọn → khoảng cùng số ngày ngay trước. KPI tỉ lệ luôn so sánh được. KPI dạng đếm chỉ hiện chênh lệch khi kỳ hiện tại đã kết thúc; nếu chưa kết thúc, hiện "Kỳ trước: N" để tránh so sánh nửa tuần với cả tuần.

**OQ-30 — Học ở nhà mặc định Tuần** [ĐỀ XUẤT]
Mỗi ngày có ít nhiệm vụ đến hạn → số liệu theo ngày nhiễu, dễ dẫn đến cảnh báo sai.

### Chuyên cần & vận hành

**OQ-07 — Nghĩa của "liên tiếp"** [GIẢ ĐỊNH]
ATT-S02: theo thứ tự thời gian mọi buổi của học sinh (gộp lớp); NOT_TAKEN bỏ qua, mọi trạng thái khác (kể cả vắng có phép) cắt chuỗi. HW-S01: theo thứ tự hạn nộp *trong từng lớp–khóa* (liên tiếp giữa hai môn khác nhau ít ý nghĩa).

**OQ-18 — Ai thuộc diện của một buổi / nhiệm vụ** [GIẢ ĐỊNH]
Buổi học: học sinh có ghi danh hiệu lực tại `Session.start`. Nhiệm vụ: học sinh có ghi danh hiệu lực tại `Task.assignedAt`.

**OQ-26 — Mẫu số các chỉ số vận hành giáo viên** [GIẢ ĐỊNH]
% điểm danh đúng thời điểm: mẫu số = buổi đã bắt đầu ≥ 15 phút. % báo cáo trong 24h: mẫu số = buổi đã kết thúc ≥ 24h. Thời gian chấm TB: `gradedAt − max(submittedAt, dueAt)`, chỉ nhiệm vụ chấm tay.

**OQ-27 — Phạm vi thời gian của rule OPS** [GIẢ ĐỊNH]
OPS-01: các buổi trong hôm nay (kể cả buổi đã kết thúc trong ngày). OPS-02: 7 ngày gần nhất (buổi cũ hơn đã phản ánh ở OPS-03/OPS-06). OPS-04: nhiệm vụ có hạn trong 30 ngày. OPS-05: 7 ngày gần nhất.

**OQ-35 — Heatmap ngày × lớp (lịch học)** [GIẢ ĐỊNH]
Một lớp có thể có nhiều buổi trong ngày → ô hiển thị trạng thái kém nhất, tooltip liệt kê từng buổi.

**OQ-37 — "Link xem báo cáo" buổi học** [GIẢ ĐỊNH]
Session chỉ có `reportSubmittedAt`, không có nội dung → mở popup "Báo cáo buổi học (mô phỏng)" với thông tin buổi.

### Nhiệm vụ & khóa trực tuyến

**OQ-19 — Trạng thái nhiệm vụ tính tại "bây giờ"** [GIẢ ĐỊNH]
Khi xem kỳ trong quá khứ, trạng thái lấy theo dữ liệu mới nhất (bài nộp muộn sau cuối kỳ vẫn tính MUỘN). Nhiệm vụ chưa đến hạn nhưng học sinh đã nộp vẫn xếp ĐANG MỞ (hiển thị thêm "đã nộp x/y"), để tỉ lệ không thiên lệch do chỉ đếm nhóm nộp sớm.

**OQ-20 — Khóa trực tuyến dùng entity Course** [GIẢ ĐỊNH]
`OnlineCourseAssignment.courseId` trỏ tới một trong 5 khóa (lấy `passThreshold` và trọng số từ Course). Bổ sung `title` (tên nội dung trực tuyến), `contentKey` (để so sánh cùng nội dung giữa các lớp, ví dụ "Tiến độ thực tế vs kỳ vọng theo lớp") và `totalItems`.

**OQ-21 — Log hoàn thành từng mục của khóa trực tuyến** [GIẢ ĐỊNH]
Để tính "tiến độ tại ngày cuối kỳ" cho kỳ trong quá khứ, `OnlineCourseProgress` thêm `itemCompletedAt[]`. → [CÂU HỎI] Hệ thống thật có log này không? Nếu không, tiến độ chỉ có snapshot hiện tại.

**OQ-22 — Funnel và "đúng tiến độ"** [GIẢ ĐỊNH]
Funnel: "Đã bắt đầu" = hoàn thành ≥ 1 mục; "Đang học" = hoàn thành ≥ 50% nội dung (các bước lồng nhau). "Đúng tiến độ" = tiến độ thực tế ≥ kỳ vọng − 10 điểm % (dung sai cấu hình được).

**OQ-23 — Điểm khóa trực tuyến** [GIẢ ĐỊNH]
`testScore` = điểm TB các bài kiểm tra đã làm (null nếu chưa làm bài nào). Điểm TB khóa trực tuyến = TB điểm tổng hợp của học sinh đã có điểm kiểm tra, khóa đến hạn trong kỳ (giống quy tắc "chỉ tính bài đã có điểm" của nhiệm vụ). Điểm tổng hợp dự kiến (ONL-S02) = wTask × tiến độ dự phóng đến hạn theo tốc độ hiện tại (tối đa 100) + wTest × (testScore, hoặc 0 nếu chưa có).

**OQ-33 — "Tỉ lệ hoàn thành" trên thẻ lớp** [GIẢ ĐỊNH]
Nhiệm vụ đang mở: đã nộp / được giao (tính đến bây giờ). Khóa trực tuyến đang triển khai: tiến độ TB (Σ mục hoàn thành / Σ mục).

**OQ-36 — "Làm đủ" trong Top 5 của tab Bài về nhà** [GIẢ ĐỊNH]
= nộp đủ số bài (`completedItems = itemCount`), đúng hạn hoặc muộn, trên nhiệm vụ đã quá hạn.

**OQ-44 — "Thấp hơn hẳn" trong bảng nhiệm vụ bất thường** [GIẢ ĐỊNH]
Tỉ lệ nộp thấp hơn trung vị các nhiệm vụ cùng khóa ≥ 20 điểm %, hoặc điểm TB thấp hơn ≥ 1,5 điểm. Cấu hình được.

### Chuẩn đầu ra & diễn giải nguyên nhân

**OQ-09 — Mẫu số của nhãn "Nghi vấn chương trình"** [GIẢ ĐỊNH]
Tỉ lệ "Đỏ ở ≥ 60% số lớp" tính trên các lớp đang học khóa **và đủ dữ liệu** (≥ 10 học sinh có dữ liệu, evidence TB ≥ 3); cần tối thiểu 3 lớp đủ dữ liệu, nếu không → "Chưa đủ dữ liệu để kết luận".

**OQ-10 — "Trung vị các lớp khác cùng khóa"** [GIẢ ĐỊNH]
Loại trừ lớp đang xét, chỉ tính lớp đủ dữ liệu, cần ≥ 2 lớp khác.

**OQ-11 — Cỡ mẫu cho rule CĐR cấp lớp** [GIẢ ĐỊNH]
LO-C01/LO-C02/LO-C03 chỉ chạy khi lớp có ≥ 10 học sinh có dữ liệu (áp quy tắc chung). Màu vẫn hiển thị kèm badge "Dữ liệu mỏng" nếu có.

**OQ-12 — Đơn vị cảnh báo LO-C03** [GIẢ ĐỊNH]
1 cảnh báo cho mỗi cặp lớp–khóa, liệt kê các CĐR bị nhãn "Nghi vấn ở lớp học" (tránh hàng chục cảnh báo cho cùng một lớp). LO-C01 vẫn tách theo từng cặp lớp–CĐR.

**OQ-13 — "Không đạt" trong LO-S01** [GIẢ ĐỊNH]
Theo ngưỡng "đạt yêu cầu" trong cấu hình (mặc định: dưới Trung bình = Cần cải thiện hoặc Chưa tốt).

**OQ-14 — "Hoàn thành ≥ 90% bài tập" trong LO-S02** [GIẢ ĐỊNH]
= tỉ lệ nộp nhiệm vụ (đúng hạn + muộn) lũy kế của học sinh trong lớp–khóa đó.

**OQ-16 — CUR-03 cỡ mẫu** [GIẢ ĐỊNH]
Mỗi lớp cần ≥ 10 lượt làm câu hỏi đó mới được tính vào "≥ 3 lớp".

**OQ-17 — Chuyển lớp giữa kỳ** [GIẢ ĐỊNH]
Enrollment thêm `startAt`/`endAt`. Sĩ số = số ghi danh hiệu lực tại mốc tính. CĐR của học sinh ở lớp cũ không tính vào sĩ số/coverage của lớp cũ sau ngày chuyển, nhưng vẫn hiện trong hồ sơ học sinh.

**OQ-25 — Chỉ số tổng hợp CĐR và benchmark** [GIẢ ĐỊNH]
"% chuẩn đầu ra Xanh" = số cặp lớp–CĐR Xanh / số cặp lớp–CĐR không Xám. Benchmark lớp dùng 5 chỉ số: tỉ lệ có mặt, tỉ lệ nộp đúng hạn, điểm TB nhiệm vụ, tỉ lệ hoàn thành khóa trực tuyến đúng hạn, % CĐR Xanh. Heatmap nhóm × chỉ số tô theo độ lệch so với TB trường (điểm %; điểm thang 10 quy ra ×10).

**OQ-28 — DATA-01/DATA-02 tính ở cấp khóa** [GIẢ ĐỊNH]
Coverage gộp mọi lớp đang học khóa; "thời lượng đã qua" = TB các ClassCourse đang hoạt động của khóa.

**OQ-40 — Phạm vi đếm CĐR** [GIẢ ĐỊNH]
"Tổng số CĐR đang diễn ra" = số CĐR phân biệt của các khóa có ≥ 1 ClassCourse đang hoạt động. Phân bố 6 mức đếm mọi cặp (học sinh–lớp) × CĐR của lớp đang học, học sinh chưa có dữ liệu xếp "Chưa có thông tin".

**OQ-43 — Cách tính `percent` của LOAchievement trong mock** [GIẢ ĐỊNH]
= tỉ lệ trả lời đúng trên mọi lượt làm câu hỏi gắn với CĐR đó. → [CÂU HỎI] Hệ thống thật có trọng số theo độ khó/độ mới không?

### Cảnh báo

**OQ-08 — Gộp cảnh báo học sinh học nhiều lớp** [GIẢ ĐỊNH]
Rule chuyên cần cấp học sinh tính gộp mọi lớp; khi gộp thành cảnh báo cấp lớp, học sinh được gán vào lớp có nhiều bản ghi vi phạm nhất.

**OQ-15 — Cỡ mẫu tối thiểu cho rule cấp học sinh** [GIẢ ĐỊNH]
Spec chỉ quy định cỡ mẫu cho rule cấp lớp. Để tránh báo động giả: ATT-S04 cần ≥ 5 buổi đã điểm danh ở mỗi cửa sổ; HW-S02 cần ≥ 4 nhiệm vụ đã quá hạn; HW-S03 cần ≥ 3 bài có điểm ở mỗi cửa sổ. Cấu hình được.

**OQ-31 — Nhóm cảnh báo ở Tổng quan** [GIẢ ĐỊNH]
Spec liệt kê 4 nhóm hiển thị nhưng có 7 nhóm rule. Ánh xạ: Vận hành = OPS + DATA-03; Chuyên cần = ATT; Học ở nhà = HW + ONL; Chuẩn đầu ra = LO + CUR + DATA-01/02.

**OQ-39 — Chống trùng trong prototype tĩnh** [GIẢ ĐỊNH]
"Bây giờ" cố định nên không có chuỗi lần chạy theo thời gian. Áp dụng: khóa cảnh báo = rule + đối tượng; trạng thái xử lý lưu `localStorage` theo khóa. Hàm chống trùng 7 ngày là pure function, kiểm thử bằng dữ liệu lịch sử giả lập trong `tests.html`.

**OQ-41 — `detectedAt`** [GIẢ ĐỊNH]
Rule có mốc tự nhiên dùng mốc đó (OPS-01: bắt đầu + 15'; OPS-02: kết thúc + 24h; ATT-S01: buổi vắng thứ 4; …). Rule tổng hợp theo cửa sổ dùng thời điểm đánh giá ("bây giờ").

### Giao diện

**OQ-32 — Ngưỡng xếp hạng cho các bảng Top khác** [GIẢ ĐỊNH]
Spec quy định < 30 lượt điểm danh thì không xếp hạng. Áp dụng tương tự: Top nhiệm vụ cần ≥ 30 cặp học sinh–nhiệm vụ đã quá hạn; Top điểm cần ≥ 30 bài có điểm; Top khóa trực tuyến cần ≥ 30 cặp học sinh–khóa (hoặc ≥ 10 học sinh). Lớp chưa đủ hiển thị cuối bảng, có ghi chú.

**OQ-34 — Trạng thái lịch học hôm nay trên thẻ lớp** [GIẢ ĐỊNH]
5 trạng thái spec liệt kê trộn hai chiều (thời gian và dữ liệu) → hiển thị 2 nhãn: thời gian (Sắp diễn ra / Đang diễn ra / Đã kết thúc) + dữ liệu (Chưa điểm danh / Đã điểm danh / Đã báo cáo).

**OQ-38 — Định dạng CSV** [GIẢ ĐỊNH]
UTF-8 có BOM (Excel đọc đúng tiếng Việt), phân tách bằng dấu phẩy, số thập phân dùng dấu phẩy và đặt trong ngoặc kép, ngày `dd/MM/yyyy`.

**OQ-45 — Chế độ so sánh của `class.html`** [GIẢ ĐỊNH]
Khi chọn "Tất cả" hoặc một nhóm lớp: các biểu đồ cấp học sinh được thay bằng biểu đồ cùng chỉ số theo từng lớp (bar/stacked theo lớp, có mốc TB trường và TB nhóm); heatmap học sinh × buổi / học sinh × CĐR ẩn, gợi ý chọn một lớp.

### Phát sinh khi code Phase 1

**OQ-46 — LOSnapshot thêm cỡ mẫu** [GIẢ ĐỊNH]
Entity spec chỉ có `passRate`, `coverage`. Để gộp xu hướng nhiều lớp có trọng số (cấp khóa/toàn trường), snapshot thêm `withData` và `enrolled`. Ảnh chụp tuần tính bằng ngưỡng **tại thời điểm chụp**; đổi cấu hình không làm thay đổi các tuần đã chụp (chỉ đổi đường ngưỡng trên biểu đồ). → [CÂU HỎI] Hệ thống thật có muốn tính lại lịch sử khi đổi ngưỡng không?

**OQ-47 — Cỡ mẫu cấp buổi (ATT-C04)** [GIẢ ĐỊNH]
Một buổi hiếm khi có ≥ 30 bản ghi. Áp dụng: lớp phải đủ cỡ mẫu chung (30 bản ghi / 10 học sinh trong cửa sổ) và buổi phải có ≥ 10 học sinh đã điểm danh.

**OQ-48 — DATA-01 không tính CĐR coverage = 0** [GIẢ ĐỊNH]
Coverage = 0 là trạng thái Xám, thuộc DATA-02 (khi khóa ≥ 70% thời lượng). DATA-01 chỉ xét 0 < coverage < 30% (khớp định nghĩa badge "Dữ liệu mỏng"), tránh một CĐR sinh 2 cảnh báo.

**OQ-49 — "Chưa báo cáo" trong OPS-03** [GIẢ ĐỊNH]
Một buổi được tính "chưa báo cáo" khi đã kết thúc quá 24 giờ (cùng ngưỡng OPS-02); "chưa điểm danh" khi đã bắt đầu quá 15 phút (cùng ngưỡng OPS-01).

**OQ-50 — Mốc so sánh của bảng nhiệm vụ bất thường** [GIẢ ĐỊNH]
So với trung vị của mọi nhiệm vụ đã quá hạn cùng khóa từ đầu khóa (ổn định hơn so với chỉ trong kỳ đang xem).

**OQ-51 — Mẫu số của LO-C02** [GIẢ ĐỊNH]
"≥ 30% số chuẩn đầu ra của khóa" = trên tổng số CĐR của khóa (kể cả CĐR chưa có dữ liệu), đúng nghĩa đen của spec.

**OQ-52 — Cỡ mẫu CUR-02, HW-T01** [GIẢ ĐỊNH]
CUR-02 cần ≥ 30 học sinh có dữ liệu toàn trường. HW-T01 cần ≥ 10 học sinh được giao; điều kiện "điểm TB < 5" cần ≥ 5 bài đã chấm.

**OQ-53 — Rule cấp học sinh ở lớp sĩ số nhỏ** [GIẢ ĐỊNH]
Cỡ mẫu tối thiểu của spec áp cho rule tỉ lệ cấp lớp. Rule cấp học sinh vẫn chạy ở lớp nhỏ (TA-04), và nếu ≥ 5 học sinh vi phạm thì vẫn gộp thành cảnh báo cấp lớp (gộp không phải phép tính tỉ lệ cấp lớp).

**OQ-54 — Rule ONL-S chỉ xét khóa đang chạy** [GIẢ ĐỊNH]
ONL-S01/S02/S03 và ONL-C01 chỉ áp dụng cho khóa trực tuyến chưa đến hạn; khóa đã đóng được phản ánh qua tỉ lệ hoàn thành đúng hạn (ONL-C02, báo cáo Học ở nhà).

## E. Giả định phát sinh ở Phase 4

**OQ-55 — Kỳ mặc định của Hồ sơ học sinh** [GIẢ ĐỊNH]
Hồ sơ học sinh mặc định xem kỳ "Khoảng" từ ngày đầu dữ liệu (22/06/2026) đến hôm nay, vì hồ sơ dùng cho họp phụ huynh/hội đồng cần cả quá trình; người dùng vẫn đổi được sang Ngày/Tuần/Tháng.

**OQ-56 — Mốc "TB lớp" trong hồ sơ học sinh** [GIẢ ĐỊNH]
So sánh % đạt CĐR của học sinh với TB không trọng số của % đạt các học sinh cùng lớp có dữ liệu (M-LO-13), có tính cả học sinh đang xem. Không dùng tỉ lệ đạt của lớp vì hồ sơ đặt cạnh nhau hai đại lượng cùng đơn vị (%).

**OQ-57 — Phạm vi báo cáo vận hành giáo viên** [GIẢ ĐỊNH]
Chỉ gồm hành vi giáo viên kiểm soát được: điểm danh đúng thời điểm, nộp báo cáo, giao và chấm nhiệm vụ. Kết quả học tập của lớp chỉ hiện để tham chiếu kèm lưu ý mục 3.6, không xếp hạng, không dùng từ đánh giá năng lực. Tắt toggle "Hiển thị báo cáo theo giáo viên" trong Cấu hình thì trang chỉ còn thông báo và menu vẫn giữ mục để người dùng biết vì sao bị ẩn.

**OQ-58 — Danh mục biểu đồ** [GIẢ ĐỊNH]
Bản thu nhỏ trong `chart-catalog.html` dựng lại bằng cùng builder của `charts.js` với dữ liệu mock thật, nhưng phạm vi rút gọn (ví dụ một lớp/khóa tiêu biểu) để trang vẫn dưới 1 giây. Ô chỉ số, bảng và thẻ HTML không có bản thu nhỏ biểu đồ.

