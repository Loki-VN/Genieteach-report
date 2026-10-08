/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * catalog.js — Danh mục mọi biểu đồ / bảng của hệ thống (mục 9) — tài liệu cho đội dev chính thức.
 * Mỗi mục: id, name, page, tab, type, source (entity + trường), metrics (mã M-… trong METRICS.md),
 * question (câu hỏi nghiệp vụ), action (hành động Học vụ), why (lý do chọn loại biểu đồ),
 * tags: SG (spec gốc) · DX (đề xuất) · LS (cần dữ liệu lịch sử) · CH (cần dữ liệu câu hỏi) · FIX (sửa spec),
 * thumb: khóa bản render thu nhỏ trong GT.catalog.THUMBS (dùng chung charts.js với dữ liệu thật).
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const M = GT.metrics, F = GT.fmt, DT = GT.date, L = GT.labels;
  const DAY = DT.DAY;

  const PAGES = {
    overview: 'Tổng quan', attendance: 'Chuyên cần', homework: 'Học ở nhà', courses: 'Khóa học', 'course-detail': 'Phân tích khóa học',
    schedule: 'Lịch học', class: 'Lớp học', teachers: 'Vận hành giáo viên', student: 'Hồ sơ học sinh', alerts: 'Trung tâm cảnh báo', settings: 'Cấu hình'
  };
  const TAGS = { SG: 'Spec gốc', DX: 'Đề xuất', LS: 'Cần dữ liệu lịch sử', CH: 'Cần dữ liệu câu hỏi', FIX: 'Sửa spec' };

  function e(id, page, tab, name, type, source, metrics, question, action, why, tags, thumb) {
    return { id: id, page: page, tab: tab, name: name, type: type, source: source, metrics: metrics, question: question, action: action, why: why, tags: tags, thumb: thumb };
  }
  const ATT = 'AttendanceRecord (status, sessionId, studentId) + Session (start, classId, courseId)';
  const TASK = 'Task (dueAt, itemCount, maxScore, assignedAt) + TaskSubmission (submittedAt, completedItems, score, gradedAt)';
  const ONL = 'OnlineCourseAssignment (startAt, dueAt) + OnlineCourseProgress (itemCompletedAt[], completedAt, testScore)';
  const LO = 'LOAchievement (percent, evidenceCount) + Enrollment (sĩ số tại mốc) + ClassCourse';
  const OPS = 'Session (start, end, attendanceSubmittedAt, reportSubmittedAt, teacherId)';

  const LIST = [
    // ---------------- Tổng quan
    e('OV-K', 'overview', null, 'KPI vận hành hôm nay', 'Stat tile ×4', 'ClassCourse, Session, Task, OnlineCourseAssignment', ['M-OPS-00', 'M-OPS-01', 'M-HW-11', 'M-ONL-11'], 'Quy mô vận hành hôm nay: bao nhiêu lớp, buổi, nhiệm vụ, khóa trực tuyến đang chạy?', 'Mở báo cáo lịch học / học ở nhà tương ứng.', 'Một vài con số tiêu đề → stat tile, không cần biểu đồ.', ['SG'], 'kpi'),
    e('OV-01', 'overview', null, 'Tỉ lệ đi học hôm nay', 'Donut + callout', ATT, ['M-ATT-01', 'M-ATT-07', 'M-ATT-08'], 'Hôm nay học sinh đi học đúng giờ, muộn, vắng ra sao — còn bao nhiêu bản ghi chưa điểm danh?', 'Liên hệ ngay lớp có buổi chưa điểm danh.', 'Part-to-whole 4 phần trong 1 ngày; chưa điểm danh để riêng vì không vào mẫu số.', ['SG'], 'attDonutToday'),
    e('OV-02', 'overview', null, 'Đúng hạn / muộn / không hoàn thành — 7 ngày qua', 'Stacked bar 100% ngang', TASK, ['M-HW-02', 'M-HW-03', 'M-HW-04'], 'Tuần vừa qua học sinh nộp nhiệm vụ đúng hạn đến đâu, nhóm lớp nào kém nhất?', 'Nhắc nhóm lớp có tỉ lệ không hoàn thành cao.', 'So sánh cơ cấu 3 trạng thái giữa toàn trường và các nhóm trên cùng thang 100%.', ['SG'], 'taskStackGroups'),
    e('OV-03', 'overview', null, 'Top lớp đi học đúng giờ nhất (+ Top 5 cao/thấp)', 'Bar ngang xếp hạng (emphasis) + 2 danh sách', ATT, ['M-ATT-03'], 'Lớp nào duy trì đúng giờ tốt nhất, lớp nào kém nhất?', 'Khen lớp tốt; trao đổi với GVCN các lớp có tỉ lệ thấp; mở popup so sánh chi tiết.', 'Xếp hạng nhiều lớp → bar ngang; tô top 5, còn lại xám; mốc TB trường + vạch TB nhóm làm chuẩn so sánh.', ['SG', 'DX'], 'rankAttOnTime'),
    e('OV-04', 'overview', null, 'Top lớp làm bài đúng hạn nhất', 'Bar ngang xếp hạng', TASK, ['M-HW-02'], 'Lớp nào nộp nhiệm vụ đúng hạn tốt nhất?', 'Nhắc lớp có tỉ lệ thấp.', 'Như OV-03; ghi mẫu số để lớp ít lượt không lọt top nhờ may mắn.', ['SG', 'DX'], 'rankTaskOnTime'),
    e('OV-05', 'overview', null, 'Top lớp điểm trung bình cao nhất', 'Bar ngang xếp hạng', TASK, ['M-HW-07'], 'Lớp nào có điểm nhiệm vụ TB cao nhất, thấp nhất?', 'Xem phân bố điểm của lớp thấp ở báo cáo lớp.', 'Như OV-03; kèm lưu ý mục 3.6 vì là kết quả học tập.', ['SG', 'DX'], 'rankTaskScore'),
    e('OV-06', 'overview', null, 'Thẻ nhóm lớp', 'Card + 3 chỉ số tóm tắt + cảnh báo theo mức', 'ClassGroup, keyMetrics 30 ngày, cảnh báo', ['M-BM-01'], 'Nhóm lớp nào đang có vấn đề?', 'Nhấn để mở danh sách lớp của nhóm.', 'Điểm vào điều hướng; số liệu tóm tắt dạng văn bản.', ['SG', 'DX'], 'html'),
    e('OV-07', 'overview', null, 'Thẻ lớp (lịch hôm nay, nhiệm vụ, khóa TT, cảnh báo)', 'Card', 'Class, Enrollment, Session hôm nay, Task, OnlineCourseProgress, cảnh báo', ['M-HW-11', 'M-ONL-01'], 'Hôm nay lớp học gì, đã điểm danh/báo cáo chưa, có cảnh báo gì?', 'Mở báo cáo lớp.', 'Nhiều thuộc tính rời rạc của một đối tượng → thẻ.', ['SG', 'FIX'], 'html'),
    e('OV-08', 'overview', null, 'Bảng vận hành hôm nay', 'Timeline (custom series) + vạch "Bây giờ"', OPS, ['M-OPS-02', 'M-OPS-06'], 'Lúc này có lớp nào đã vào học mà chưa điểm danh không?', 'Gọi giáo viên phụ trách buổi tô đỏ.', 'Buổi học là khoảng thời gian → thanh trên trục giờ; trạng thái bằng màu + ký hiệu ✓/✕ + chú thích.', ['DX'], 'timeline'),
    e('OV-09', 'overview', null, 'Nhóm lớp × chỉ số chính', 'Heatmap phân kỳ (có số trong ô)', 'keyMetrics 30 ngày theo nhóm và trường', ['M-BM-01', 'M-BM-02'], 'Nhóm lớp nào kém hơn TB trường, ở chỉ số nào?', 'Đi sâu vào báo cáo của chỉ số tương ứng.', 'Lưới nhóm × chỉ số, màu = độ lệch so với TB (phân kỳ, tâm xám), giá trị in trong ô.', ['DX'], 'groupHeatmap'),
    e('OV-10', 'overview', null, 'Xu hướng 8 tuần toàn trường', 'Line 2 series, 1 trục', 'AttendanceRecord + TaskSubmission theo tuần', ['M-ATT-07', 'M-HW-02'], 'Chuyên cần và kỷ luật làm bài đang tốt lên hay xấu đi?', 'Phát hiện tuần bất thường (ví dụ tuần có bão).', 'Thay đổi theo thời gian → line; hai tỉ lệ cùng thang % nên 1 trục.', ['DX'], 'trend8w'),
    e('OV-11', 'overview', null, 'Tóm tắt cảnh báo đang mở', 'Ma trận số đếm (bảng)', 'Kết quả rule engine (alerts.js)', [], 'Đang có bao nhiêu vấn đề, thuộc mảng nào, mức nào?', 'Nhấn ô để mở trung tâm cảnh báo đã lọc.', 'Đếm theo 2 chiều nhỏ (4 × 3) → bảng số rõ hơn biểu đồ.', ['DX'], 'html'),
    // ---------------- Chuyên cần
    e('AT-K', 'attendance', null, 'KPI chuyên cần + so sánh kỳ trước', 'Stat tile ×8 kèm delta', ATT, ['M-ATT-03', 'M-ATT-04', 'M-ATT-05', 'M-ATT-06', 'M-ATT-07', 'M-ATT-08', 'M-OPS-01'], 'Kỳ này chuyên cần tốt hay xấu hơn kỳ trước?', 'Đi sâu vào chỉ số đổi xấu.', 'Headline numbers + chênh lệch điểm %.', ['SG'], 'kpi'),
    e('AT-01', 'attendance', null, 'Lịch sử chuyên cần theo ngày (gộp tuần khi > 31 ngày)', 'Stacked bar 100%', ATT, ['M-ATT-01'], 'Tỉ lệ đúng giờ/muộn/vắng thay đổi thế nào từng ngày?', 'Kiểm tra ngày có tỉ lệ vắng nhô cao.', 'Cơ cấu theo thời gian, nhiều mốc → stacked 100%; tự gộp tuần để không quá dày.', ['SG'], 'attByDay'),
    e('AT-02', 'attendance', null, 'Lịch học có / chưa điểm danh', 'Donut 2 phần', OPS, ['M-OPS-03'], 'Bao nhiêu buổi đã bắt đầu mà chưa điểm danh?', 'Mở báo cáo lịch học để xem buổi cụ thể.', 'Spec yêu cầu tỉ lệ; donut 2 phần có số ở giữa.', ['SG'], 'takenDonut'),
    e('AT-03', 'attendance', null, 'Top lớp đúng giờ / đi muộn + popup so sánh', 'Bar ngang + popup (bảng sort + bar có mốc TB)', ATT, ['M-ATT-03', 'M-ATT-04'], 'Lớp nào đúng giờ nhất, đi muộn nhiều nhất?', 'Nhấn lớp → báo cáo lớp tab Chuyên cần.', 'Xếp hạng → bar ngang; popup cho bảng chi tiết có cột chênh lệch so với TB trường.', ['SG'], 'rankAttLate'),
    e('AT-04', 'attendance', null, 'Top nhóm lớp đúng giờ / đi muộn', 'Bar ngang (màu theo nhóm) + popup', ATT, ['M-ATT-03', 'M-ATT-04'], 'Nhóm lớp nào đúng giờ nhất, muộn nhất?', 'Nhấn nhóm → lọc cả trang theo nhóm.', 'Ít hạng mục, màu cố định theo nhóm (màu theo thực thể).', ['SG'], 'groupRankAtt'),
    e('AT-06', 'attendance', null, 'Tỉ lệ có mặt theo ngày — 3 tháng', 'Calendar heatmap', ATT, ['M-ATT-13'], 'Có ngày/tuần nào vắng bất thường (lễ, thời tiết, sự kiện)?', 'Đối chiếu sự kiện; loại trừ khỏi đánh giá lớp nếu là nguyên nhân khách quan.', 'Dữ liệu theo ngày lịch → calendar; tuần tự 1 sắc (tỉ lệ vắng), % có mặt in trong ô.', ['DX'], 'calendar'),
    e('AT-07', 'attendance', null, 'Thứ × khung giờ: đi muộn / vắng', 'Heatmap tuần tự', ATT + ' + Session.slot', ['M-ATT-12'], 'Ca sáng sớm thứ Hai có vấn đề có hệ thống không?', 'Điều chỉnh giờ vào lớp / nhắc nhở theo ca.', 'Hai chiều rời rạc (thứ × ca) → heatmap; giá trị in trong ô.', ['DX'], 'weekdaySlot'),
    e('AT-08', 'attendance', null, 'Học sinh theo số buổi vắng không phép', 'Histogram (bucket 0…5+)', ATT, ['M-ATT-11'], 'Vắng là rải rác hay tập trung ở một nhóm nhỏ vắng triền miên?', 'Tập trung → can thiệp từng học sinh; rải rác → xem lại quy định chung.', 'Phân bố số đếm → histogram; màu thứ bậc nhạt → đậm.', ['DX'], 'absHist'),
    e('AT-09', 'attendance', null, 'Học sinh vắng nhiều nhất toàn trường', 'Bảng + CSV', ATT, ['M-ATT-09', 'M-ATT-10'], 'Học sinh nào cần liên hệ ngay?', 'Mở hồ sơ học sinh; gọi phụ huynh.', 'Danh sách hành động → bảng sort được.', ['DX'], 'table'),
    e('AT-10', 'attendance', null, 'Vắng có phép vs không phép theo tuần', 'Line 2 series', ATT, ['M-ATT-05', 'M-ATT-06'], 'Vắng có phép có đang bị dùng thay cho vắng không phép?', 'Rà quy trình xin phép nếu hai đường đổi chiều nhau.', 'Hai tỉ lệ cùng thang theo thời gian → line, 1 trục.', ['DX'], 'excTrend'),
    e('AT-11', 'attendance', null, 'Tỉ lệ bản ghi "chưa điểm danh" theo lớp', 'Bar ngang + vạch ngưỡng', OPS + ' + AttendanceRecord.status', ['M-ATT-08'], 'Số liệu chuyên cần của lớp nào kém tin cậy?', 'Yêu cầu bổ sung điểm danh trước khi dùng số liệu lớp.', 'Xếp hạng + ngưỡng (OPS-06) → bar có vạch.', ['DX'], 'notTaken'),
    // ---------------- Học ở nhà
    e('HW-K', 'homework', null, 'KPI học ở nhà (7 chỉ số)', 'Stat tile ×7 kèm delta', TASK + '; ' + ONL, ['M-HW-02', 'M-HW-07', 'M-ONL-05', 'M-ONL-10'], 'Kỳ này học sinh làm bài và học trực tuyến ra sao?', 'Đi sâu vào chỉ số đổi xấu.', 'Headline numbers.', ['SG'], 'kpi'),
    e('HW-01', 'homework', null, 'Top lớp nhiệm vụ đúng hạn / muộn + không hoàn thành', 'Bar ngang + popup', TASK, ['M-HW-02', 'M-HW-03', 'M-HW-04'], 'Lớp nào nộp bài tốt nhất, kém nhất?', 'Nhấn lớp → tab Bài về nhà.', 'Xếp hạng có mốc.', ['SG'], 'rankTaskOnTime'),
    e('HW-02', 'homework', null, 'Top lớp điểm nhiệm vụ TB (popup điểm TB)', 'Bar ngang + popup', TASK, ['M-HW-07'], 'Lớp nào có điểm nhiệm vụ cao/thấp nhất?', 'Xem phân bố điểm, nhiệm vụ điểm thấp.', 'Sửa spec: popup hiển thị điểm TB (spec gốc ghi nhầm "tỉ lệ đúng hạn").', ['SG', 'FIX'], 'rankTaskScore'),
    e('HW-03', 'homework', null, 'Top lớp hoàn thành khóa TT đúng hạn / không hoàn thành', 'Bar ngang + popup', ONL, ['M-ONL-04', 'M-ONL-05'], 'Lớp nào hoàn thành khóa trực tuyến tốt/kém nhất?', 'Nhấn lớp → #online.', 'Xếp hạng có mốc.', ['SG'], 'rankOnline'),
    e('HW-04', 'homework', null, 'Top lớp điểm khóa trực tuyến', 'Bar ngang + popup', ONL, ['M-ONL-06', 'M-ONL-10'], 'Lớp nào có điểm tổng hợp khóa TT cao nhất?', 'So sánh với ngưỡng hoàn thành.', 'Xếp hạng.', ['SG'], 'rankOnline'),
    e('HW-06', 'homework', null, 'Phân bố điểm nhiệm vụ theo lớp / nhóm', 'Boxplot', TASK, ['M-HW-08'], 'Hai lớp cùng điểm TB 6,5 — lớp nào đồng đều, lớp nào phân hóa?', 'Lớp phân hóa → phân nhóm hỗ trợ.', 'So sánh phân bố, không chỉ trung bình → boxplot.', ['DX'], 'boxplot'),
    e('HW-07', 'homework', null, 'Lớp: nộp đúng hạn × điểm TB (4 góc phần tư)', 'Scatter', TASK, ['M-HW-02', 'M-HW-07'], 'Lớp nào làm đủ nhưng điểm thấp, lớp nào điểm ổn nhưng không làm bài?', 'Phân loại can thiệp: kiến thức vs kỷ luật.', 'Quan hệ 2 biến theo lớp → scatter; vạch trung vị chia 4 nhóm hành động.', ['DX'], 'scatterClasses'),
    e('HW-08', 'homework', null, 'Xu hướng theo tuần: đúng hạn & điểm TB (trường + nhóm)', 'Line ×2 (không dùng 2 trục)', TASK, ['M-HW-02', 'M-HW-07'], 'Kỷ luật và điểm số đang tốt lên hay xấu đi?', 'Phát hiện nhóm lớp đi xuống.', 'Hai thang khác nhau → 2 biểu đồ riêng thay vì dual-axis; đường trường đậm, nhóm mảnh.', ['DX'], 'hwTrend'),
    e('HW-09', 'homework', null, 'Funnel khóa trực tuyến', 'Funnel (bar ngang thứ bậc)', ONL, ['M-ONL-08'], 'Học sinh rơi rụng ở bước nào?', 'Chưa bắt đầu → kiểm tra tài khoản; bỏ dở → nhắc tiến độ; không đạt → hỗ trợ ôn.', 'Các bước lồng nhau → funnel; màu thứ bậc 1 sắc.', ['DX'], 'funnel'),
    e('HW-10', 'homework', null, 'Tiến độ thực tế vs kỳ vọng theo lớp (khóa TT đang chạy)', 'Bar ngang + vạch kỳ vọng (small multiples)', ONL, ['M-ONL-01', 'M-ONL-02', 'M-ONL-09'], 'Lớp nào sẽ trễ hạn nếu không can thiệp tuần này?', 'Nhắc lớp chậm tiến độ.', 'So với mục tiêu → bar + vạch (bullet đơn giản); mỗi nội dung một biểu đồ nhỏ.', ['DX'], 'progressClasses'),
    e('HW-11', 'homework', null, 'Nhiệm vụ bất thường', 'Bảng', TASK, ['M-HW-10'], 'Vấn đề nằm ở đề bài/học liệu hay ở học sinh?', 'Rà đề bài nếu cùng đề thấp ở nhiều lớp.', 'Danh sách cần xử lý → bảng.', ['DX'], 'table'),
    e('HW-12', 'homework', null, 'Thời điểm nộp so với hạn theo nhóm lớp', 'Stacked bar 100% (thứ bậc)', TASK, ['M-HW-09'], 'Học sinh làm sớm hay dồn sát hạn?', 'Điều chỉnh hạn nộp / khối lượng.', 'Cơ cấu theo bucket thứ bậc → stacked 100%.', ['DX'], 'timing'),
    e('HW-13', 'homework', null, 'Học sinh không hoàn thành nhiều nhất', 'Bảng + CSV', TASK, ['M-HW-04'], 'Học sinh nào bỏ nhiều nhiệm vụ nhất?', 'Mở hồ sơ học sinh.', 'Danh sách hành động.', ['DX'], 'table'),
    // ---------------- Khóa học
    e('CO-01', 'courses', null, 'Phân bố 6 mức chuẩn đầu ra toàn trường', 'Donut 6 phần', LO, ['M-LO-06'], 'Học sinh đang ở mức nào trên các chuẩn đầu ra?', 'Theo dõi tỉ trọng Chưa tốt theo thời gian.', 'Part-to-whole ≤ 6 phần; màu 6 mức theo spec, nhãn chữ đi kèm.', ['SG'], 'levelDonut'),
    e('CO-02', 'courses', null, 'Thẻ từng khóa (6 mức, số CĐR theo màu, nhãn chương trình)', 'Card + thanh 100% HTML', LO, ['M-LO-05', 'M-LO-06', 'M-LO-09'], 'Khóa nào có nhiều chuẩn đầu ra kém?', 'Mở phân tích chi tiết khóa.', 'Thẻ tổng hợp từng khóa.', ['SG', 'DX'], 'html'),
    e('CO-03', 'courses', null, 'So sánh các khóa (sort theo Chưa tốt + Cần cải thiện)', 'Stacked bar 100% ngang', LO, ['M-LO-06'], 'Khóa nào có tỉ trọng mức kém cao nhất?', 'Ưu tiên rà soát khóa đứng đầu.', 'So sánh cơ cấu nhiều khóa trên 1 thang.', ['DX'], 'courseCompare'),
    e('CO-04', 'courses', null, 'Top 10 chuẩn đầu ra yếu nhất toàn trường', 'Bảng', LO + ' + causeAnalysis', ['M-LO-04', 'M-LO-09'], 'Chuẩn đầu ra nào yếu nhất và vấn đề ở lớp hay chương trình?', 'Chuyển tổ bộ môn (chương trình) hoặc dự giờ (lớp).', 'Danh sách có nhãn diễn giải → bảng.', ['DX'], 'table'),
    // ---------------- Phân tích khóa học
    e('CD-K', 'course-detail', null, 'Số CĐR & phân bố 6 mức theo lớp', 'KPI + stacked bar 100%', LO, ['M-LO-06', 'M-LO-12'], 'Học sinh của khóa đang ở mức nào, lớp nào nhiều "Chưa tốt" nhất?', 'Nhấn lớp để lọc.', 'Cơ cấu 6 mức theo lớp.', ['SG'], 'levelStackClasses'),
    e('CD-01', 'course-detail', null, 'Bảng chuẩn đầu ra phân màu + popup học sinh', 'Bảng + popup (accordion, histogram, boxplot)', LO, ['M-LO-03', 'M-LO-04', 'M-LO-05', 'M-LO-07'], 'Chuẩn đầu ra nào Đỏ/Cam, đủ dữ liệu chưa?', 'Mở danh sách học sinh chưa đạt.', 'Nhiều thuộc tính mỗi CĐR → bảng có ô màu + nhãn; drill-down bằng popup.', ['SG', 'DX'], 'table'),
    e('CD-03', 'course-detail', null, 'Lớp × chuẩn đầu ra (biểu đồ trung tâm) + diễn giải nguyên nhân', 'Heatmap trạng thái (ô có % + ký hiệu)', LO + ' + causeAnalysis', ['M-LO-04', 'M-LO-05', 'M-LO-09'], 'Kém trên diện rộng (chương trình) hay chỉ ở một lớp (lớp học)?', 'Cột đỏ → rà chương trình/đề; hàng đỏ / ô đỏ lẻ → dự giờ, trao đổi lớp.', 'Hai chiều lớp × CĐR → heatmap; cột/hàng đỏ hiện ra ngay; nhãn 3.6 tự động bên dưới.', ['DX'], 'loHeatmap'),
    e('CD-04', 'course-detail', null, 'Tỉ lệ đạt từng CĐR (sort tăng) + ngưỡng', 'Bar ngang + vạch ngưỡng', LO, ['M-LO-04', 'M-LO-05'], 'CĐR nào yếu nhất, cách ngưỡng bao xa?', 'Ưu tiên CĐR dưới vạch Đỏ.', 'Xếp hạng + ngưỡng.', ['DX'], 'loBar'),
    e('CD-05', 'course-detail', null, 'Coverage × tỉ lệ đạt theo CĐR', 'Scatter 4 góc phần tư', LO, ['M-LO-03', 'M-LO-04'], 'CĐR nào được đánh giá quá ít để tin kết luận?', 'Bổ sung câu hỏi cho CĐR dữ liệu mỏng.', 'Hai biến → scatter; vạch ngưỡng "dữ liệu mỏng" và ngưỡng Đỏ.', ['DX'], 'loScatter'),
    e('CD-06', 'course-detail', null, 'Xu hướng tỉ lệ đạt theo tuần', 'Line (CĐR chọn vs TB khóa)', 'LOSnapshot (weekStart, passRate, coverage, withData, enrolled)', ['M-LO-11'], 'CĐR Đỏ đang cải thiện dần hay đứng yên?', 'Đứng yên → đổi cách dạy/đề; cải thiện → tiếp tục theo dõi.', 'Thay đổi theo thời gian; emphasis 1 CĐR so với TB.', ['DX', 'LS'], 'loTrend'),
    e('CD-07', 'course-detail', null, 'Phân tích câu hỏi (tỉ lệ đúng < 30% trên nhiều lớp)', 'Bảng', 'QuestionAttempt (questionId, classId, isCorrect) + Question', ['M-LO-10'], 'Kém do học sinh chưa nắm hay do câu hỏi có vấn đề?', 'Kiểm tra đáp án, loại câu sai khỏi tính điểm.', 'Danh sách câu hỏi kèm tỉ lệ theo lớp.', ['DX', 'CH'], 'table'),
    e('CD-08', 'course-detail', null, 'Học ở nhà ↔ chuẩn đầu ra theo lớp', 'Scatter', ONL + '; ' + LO, ['M-ONL-01', 'M-LO-04'], 'Lớp CĐR kém có phải do không làm bài không?', 'Phân biệt vấn đề kỷ luật học và vấn đề dạy/học.', 'Quan hệ 2 biến theo lớp.', ['DX'], 'hwLoScatter'),
    // ---------------- Lịch học
    e('SC-K', 'schedule', null, 'KPI lịch học (tổng, % điểm danh, % báo cáo, đúng thời điểm, 24h)', 'Stat tile ×5', OPS, ['M-OPS-01', 'M-OPS-03', 'M-OPS-04', 'M-OPS-06', 'M-OPS-08'], 'Vận hành lịch học trong kỳ có đầy đủ, đúng lúc không?', 'Đi sâu vào lớp/giáo viên thiếu.', 'Headline numbers.', ['SG', 'DX'], 'kpi'),
    e('SC-01', 'schedule', null, 'Số lịch học theo lớp / nhóm (toggle)', 'Cột nhóm', OPS, ['M-OPS-01'], 'Lịch học phân bổ thế nào; lớp nào không có buổi?', 'Kiểm tra lớp không có lịch.', 'So sánh số đếm giữa hạng mục.', ['SG'], 'sessionsPerClass'),
    e('SC-02', 'schedule', null, 'Tỉ lệ đã điểm danh / đã báo cáo theo lớp / nhóm', 'Cột nhóm 2 series', OPS, ['M-OPS-03', 'M-OPS-04'], 'Lớp nào điểm danh/báo cáo chưa đầy đủ?', 'Nhắc giáo viên phụ trách.', 'Hai tỉ lệ cùng thang → cột nhóm, 1 trục.', ['SG'], 'opsRates'),
    e('SC-03', 'schedule', null, 'Phân loại trạng thái buổi học', 'Stacked bar 100%', OPS, ['M-OPS-05'], 'Bao nhiêu buổi đủ cả hai, thiếu một phần, chưa có gì?', 'Ưu tiên buổi "Chưa có gì".', 'Cơ cấu 5 trạng thái.', ['DX'], 'sessionCats'),
    e('SC-04', 'schedule', null, 'Điểm danh đúng thời điểm theo lớp', 'Bar ngang (emphasis)', OPS, ['M-OPS-06'], 'Giáo viên có điểm danh trong 15 phút đầu không?', 'Nhắc lớp thấp nhất.', 'Xếp hạng; tô cam 5 lớp thấp nhất.', ['DX'], 'attOnTimeOps'),
    e('SC-05', 'schedule', null, 'Độ trễ nộp báo cáo', 'Histogram (bucket thứ bậc)', OPS, ['M-OPS-07'], 'Báo cáo được nộp nhanh hay dồn về sau?', 'Nhắc nộp trong 24 giờ.', 'Phân bố thời gian trễ.', ['DX'], 'latency'),
    e('SC-06', 'schedule', null, 'Trạng thái buổi học theo ngày × lớp', 'Heatmap phân loại (ký hiệu trong ô)', OPS, ['M-OPS-05'], 'Lớp nào thường xuyên thiếu, vào ngày nào?', 'Trao đổi với lớp có nhiều ô đỏ.', 'Hai chiều ngày × lớp; ô = trạng thái kém nhất trong ngày.', ['DX'], 'dayClass'),
    e('SC-07', 'schedule', null, 'Danh sách buổi học đầy đủ', 'Bảng lọc được + CSV + xem báo cáo', OPS + ' + Task', ['M-OPS-05', 'M-OPS-07'], 'Buổi cụ thể nào chưa điểm danh/báo cáo?', 'Liên hệ giáo viên theo từng buổi.', 'Danh sách hành động.', ['DX'], 'table'),
    // ---------------- Lớp học
    e('CL-OV-02', 'class', 'overview', 'Benchmark: lớp vs nhóm lớp vs trường', 'Bullet chart', 'keyMetrics (lớp, nhóm, trường)', ['M-BM-01'], 'Lớp này tốt hay kém so với ai?', 'Chỉ số thấp hơn cả nhóm và trường → ưu tiên.', 'So với mốc → bullet; thang chung 0–100.', ['DX'], 'bullet'),
    e('CL-OV-03', 'class', 'overview', 'Lớp × chỉ số chính (chế độ so sánh)', 'Heatmap phân kỳ + bảng', 'keyMetrics từng lớp', ['M-BM-01', 'M-BM-02'], 'Lớp nào kém hơn TB trường ở chỉ số nào?', 'Nhấn lớp để mở báo cáo lớp.', 'Như OV-09 ở cấp lớp.', ['SG', 'DX'], 'classHeatmap'),
    e('CL-AT-01', 'class', 'attendance', 'Donut 4 trạng thái của lớp (+ chưa điểm danh)', 'Donut', ATT, ['M-ATT-01'], 'Học sinh của lớp đi học ra sao trong kỳ?', '—', 'Part-to-whole.', ['SG'], 'classDonut'),
    e('CL-AT-02', 'class', 'attendance', 'Lịch sử chuyên cần theo tuần/tháng', 'Stacked bar 100%', ATT, ['M-ATT-01'], 'Chuyên cần của lớp thay đổi qua các tuần?', 'Tìm thời điểm bắt đầu đi xuống.', 'Cơ cấu theo thời gian.', ['SG'], 'classHist'),
    e('CL-AT-05', 'class', 'attendance', 'Học sinh × buổi học', 'Heatmap phân loại (Đ/M/P/K/?)', ATT, ['M-ATT-01'], 'Học sinh nào vắng/muộn lặp lại, buổi nào?', 'Liên hệ học sinh có chuỗi vắng.', 'Lưới học sinh × buổi; mã chữ trong ô.', ['DX'], 'stuSession'),
    e('CL-HW-01', 'class', 'homework', 'Nhiệm vụ: đúng hạn / muộn / KHT theo từng nhiệm vụ', 'Stacked bar 100%', TASK, ['M-HW-01'], 'Từng nhiệm vụ được lớp hoàn thành ra sao?', 'Xem nhiệm vụ có nhiều KHT.', 'Cơ cấu theo nhiệm vụ.', ['SG'], 'taskStack'),
    e('CL-HW-02', 'class', 'homework', 'Khóa trực tuyến: đúng hạn / muộn / KHT (#online)', 'Stacked bar 100% ngang', ONL, ['M-ONL-04'], 'Lớp hoàn thành khóa TT đúng hạn đến đâu?', 'Xem tiến độ từng học sinh.', 'Cơ cấu theo khóa.', ['SG', 'FIX'], 'onlineStatus'),
    e('CL-HW-03', 'class', 'homework', 'Điểm TB theo nhiệm vụ', 'Cột + vạch TB lớp', TASK, ['M-HW-07'], 'Nhiệm vụ nào lớp làm điểm thấp bất thường?', 'Rà đề bài nhiệm vụ đó.', 'So sánh giá trị giữa nhiệm vụ.', ['SG'], 'taskScoreCols'),
    e('CL-HW-07', 'class', 'homework', 'Phân bố điểm của lớp', 'Histogram', TASK, ['M-HW-08'], 'Điểm đồng đều hay phân hóa?', 'Phân nhóm hỗ trợ.', 'Phân bố.', ['DX'], 'scoreHist'),
    e('CL-HW-08', 'class', 'homework', 'Học sinh: tỉ lệ hoàn thành × điểm TB', 'Scatter 4 góc phần tư', TASK, ['M-HW-06', 'M-HW-07'], 'Ai làm đủ nhưng điểm thấp, ai bỏ bài?', 'Hỗ trợ kiến thức vs nhắc kỷ luật.', 'Hai biến theo học sinh.', ['DX'], 'scatterStudents'),
    e('CL-HW-09', 'class', 'homework', 'Tiến độ thực tế vs kỳ vọng từng học sinh', 'Bar ngang + vạch kỳ vọng', ONL, ['M-ONL-01', 'M-ONL-02', 'M-ONL-03'], 'Học sinh nào chậm tiến độ khóa TT?', 'Nhắc học sinh tô cam.', 'So với mục tiêu.', ['DX'], 'progressStudents'),
    e('CL-LO-01', 'class', 'learning', 'Bảng CĐR của lớp + mini bar các lớp khác + nhãn 3.6', 'Bảng + sparkbar', LO + ' + causeAnalysis', ['M-LO-04', 'M-LO-05', 'M-LO-09'], 'Lớp Đỏ ở CĐR nào, các lớp khác thì sao?', 'Lớp khác xanh → xem xét tại lớp; mọi lớp đỏ → chương trình.', 'Bảng + mini bar để so sánh ngay trên dòng.', ['SG', 'DX'], 'table'),
    e('CL-LO-02', 'class', 'learning', 'Học sinh × số CĐR theo 6 cấp', 'Bảng (ô màu + số)', LO, ['M-LO-01'], 'Học sinh nào có nhiều CĐR Chưa tốt?', 'Lập kế hoạch ôn tập.', 'Bảng sort được.', ['SG'], 'table'),
    e('CL-LO-05', 'class', 'learning', 'Học sinh × chuẩn đầu ra', 'Heatmap 6 mức (% trong ô)', LO, ['M-LO-01'], 'Lỗ hổng tập trung ở vài học sinh hay trải khắp lớp?', 'Can thiệp cá nhân vs cả lớp.', 'Lưới học sinh × CĐR.', ['DX'], 'stuLo'),
    // ---------------- Giáo viên, học sinh, cảnh báo, cấu hình
    e('TE-01', 'teachers', null, 'Bảng vận hành theo giáo viên + popup', 'Bảng + popup', OPS + ' + Task + TaskSubmission.gradedAt', ['M-OPS-06', 'M-OPS-08', 'M-OPS-09', 'M-OPS-10', 'M-OPS-11'], 'Giáo viên nào cần hỗ trợ về quy trình?', 'Trao đổi quy trình; không dùng để xếp hạng.', 'Chỉ hành vi vận hành; sort mặc định theo tên (không xếp hạng).', ['DX'], 'table'),
    e('ST-02', 'student', null, 'Chuyên cần của học sinh theo lớp', 'Stacked bar 100% + bảng', ATT, ['M-ATT-01', 'M-ATT-07'], 'Học sinh đi học thế nào ở từng lớp?', 'Trao đổi với phụ huynh.', 'Cơ cấu theo lớp + dòng tổng gộp.', ['DX'], 'stuAtt'),
    e('ST-04', 'student', null, 'Khóa trực tuyến: tiến độ & điểm tổng hợp vs ngưỡng', 'Bar + vạch kỳ vọng + bảng', ONL, ['M-ONL-01', 'M-ONL-06', 'M-ONL-07'], 'Học sinh có hoàn thành khóa TT và đạt ngưỡng không?', 'Hỗ trợ trước hạn.', 'So với mục tiêu.', ['DX'], 'stuOnline'),
    e('ST-05', 'student', null, '% đạt từng CĐR vs TB lớp', 'Cột nhóm (học sinh tô theo cấp)', LO, ['M-LO-01', 'M-LO-13'], 'Học sinh ở mức nào so với lớp?', 'Lập kế hoạch ôn tập cá nhân.', 'So sánh 2 giá trị cùng thang theo CĐR.', ['DX'], 'stuLo2'),
    e('AL-02', 'alerts', null, 'Hàng đợi cảnh báo', 'Bảng xử lý (trạng thái, ghi chú, gộp)', 'alerts.js + localStorage', [], 'Cảnh báo nào cần xử lý trước, ai đang xử lý?', 'Nhận xử lý, ghi chú, đóng.', 'Quy trình xử lý → bảng tương tác.', ['DX'], 'table'),
    e('SET-01', 'settings', null, 'Xem trước tác động của ngưỡng mới', 'Bảng so sánh hiện tại → mới', 'config.js + metrics.js + alerts.js', ['M-LO-05', 'M-LO-09'], 'Đổi ngưỡng thì số cảnh báo, số CĐR Đỏ thay đổi ra sao?', 'Lưu hoặc hủy thay đổi.', 'Số đếm trước/sau → bảng.', ['SG'], 'table')
  ];

  // =====================================================================================
  // Bản render thu nhỏ (dữ liệu thật, cùng builder với trang chính)
  // =====================================================================================
  function sctx() {
    const D = GT.D, now = D.meta.now, cfg = GT.config.get();
    const w0 = DT.startOfWeek(now);
    return { D: D, cfg: cfg, now: now, w7: [now - 7 * DAY, now + 1], w30: [now - 30 * DAY, now + 1], wk: [w0, w0 + 7 * DAY], mo: [DT.startOfMonth(now) - 30 * DAY, now + 1], cls: '10A4', course: 'TOAN10' };
  }
  function rank(key, desc, from, to) {
    const x = sctx();
    const m = GT.views.METRICS[key];
    const K = GT.ui.KIND[m.kind];
    const items = x.D.classes.map(function (c) { const r = m.calc(x.D, { classIds: [c.id] }, from || x.w7[0], to || x.w7[1], x.cfg); return { id: c.id, name: c.name, value: r.value === null ? null : r.value * K.scale, n: r.n }; })
      .filter(function (i) { return i.value !== null && i.n >= x.cfg.ranking.minSample; }).sort(function (a, b) { return desc ? b.value - a.value : a.value - b.value; }).slice(0, 8);
    items.forEach(function (i, k) { i.emph = k < 3; });
    return GT.charts.rankBar({ items: items, fmt: function (v) { return K.fmt(v / K.scale); }, axisFmt: K.axisFmt });
  }
  const T = {};
  T.rankAttOnTime = function () { return rank('attOnTime', true); };
  T.rankAttLate = function () { return rank('attLate', true); };
  T.rankTaskOnTime = function () { return rank('taskOnTime', true); };
  T.rankTaskScore = function () { return rank('taskScore', true); };
  T.rankOnline = function () { const x = sctx(); return rank('onlineOnTime', true, x.mo[0], x.mo[1]); };
  T.attDonutToday = function () {
    const x = sctx(), d0 = DT.startOfDay(x.now);
    const c = M.attendanceCounts(x.D, {}, d0, d0 + DAY);
    return GT.charts.donut({ items: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], value: c[k], color: GT.colors.att[k] }; }), center: { value: F.pct(M.attendanceRates(c).present, 0), label: 'có mặt' }, legend: false });
  };
  T.classDonut = function () {
    const x = sctx();
    const c = M.attendanceCounts(x.D, { classIds: ['10A3'] }, x.mo[0], x.mo[1]);
    return GT.charts.donut({ items: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], value: c[k], color: GT.colors.att[k] }; }), center: { value: F.pct(M.attendanceRates(c).present, 0), label: '10A3' }, legend: false });
  };
  T.takenDonut = function () {
    const x = sctx();
    const o = M.opsSummary(M.sessionsIn(x.D, {}, x.wk[0], x.wk[1]), x.now, x.cfg);
    return GT.charts.donut({ items: [{ name: 'Đã điểm danh', value: o.taken, color: GT.colors.status.GREEN }, { name: 'Chưa điểm danh', value: o.started - o.taken, color: GT.colors.status.RED }], center: { value: F.pct(o.takenRate, 0), label: 'đã điểm danh' }, legend: false, unit: 'buổi' });
  };
  T.taskStackGroups = function () {
    const x = sctx();
    const cs = [M.taskCounts(x.D, {}, x.w7[0], x.w7[1])].concat(x.D.groups.map(function (g) { return M.taskCounts(x.D, { groupIds: [g.id] }, x.w7[0], x.w7[1]); }));
    return GT.charts.stack({ categories: ['Trường'].concat(x.D.groups.map(function (g) { return g.name.replace('Lớp tiếng Anh tăng cường', 'TA'); })), horizontal: true, series: ['ON_TIME', 'LATE', 'MISSING'].map(function (k) { return { name: L.task[k], color: GT.colors.task[k], data: cs.map(function (c) { return c[k]; }) }; }) });
  };
  T.attByDay = function () {
    const x = sctx();
    const b = GT.period.buckets(x.mo[0], x.mo[1], 'day').filter(function (d) { return DT.weekday(d.from) < 6; }).slice(-14);
    const cs = b.map(function (d) { return M.attendanceCounts(x.D, {}, d.from, d.to); });
    return GT.charts.stack({ categories: b.map(function (d) { return DT.fmtDayMonth(d.from); }), series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: GT.colors.att[k], data: cs.map(function (c) { return c[k]; }) }; }) });
  };
  T.classHist = function () {
    const x = sctx();
    const b = GT.period.buckets(x.D.meta.dataStart, x.now + 1, 'week');
    const cs = b.map(function (d) { return M.attendanceCounts(x.D, { classIds: ['11A5'] }, d.from, d.to); });
    return GT.charts.stack({ categories: b.map(function (d) { return d.label; }), series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: GT.colors.att[k], data: cs.map(function (c) { return c[k]; }) }; }) });
  };
  T.groupRankAtt = function () {
    const x = sctx();
    const items = x.D.groups.map(function (g) { const c = M.attendanceCounts(x.D, { groupIds: [g.id] }, x.w30[0], x.w30[1]); return { id: g.id, name: g.name, value: M.attendanceRates(c).onTime * 100, n: c.taken, color: GT.colors.group[g.id] }; }).sort(function (a, b) { return b.value - a.value; });
    return GT.charts.rankBar({ items: items, fmt: function (v) { return F.num(v, 1) + '%'; }, labelWidth: 150 });
  };
  T.calendar = function () {
    const x = sctx();
    const from = DT.addMonths(DT.startOfMonth(x.now), -1), to = DT.startOfDay(x.now) + DAY;
    const days = [];
    M.attendanceByDay(x.D, {}, from, to).forEach(function (c, k) { if (c.taken) { const a = (c.EXCUSED + c.UNEXCUSED) / c.taken; days.push({ day: k, value: a, label: F.num((1 - a) * 100, 0), tip: k }); } });
    return GT.charts.calendar({ from: from, to: to, days: days, min: 0, max: 0.3 });
  };
  T.weekdaySlot = function () {
    const x = sctx();
    const g = M.weekdaySlotMatrix(x.D, {}, x.now - 56 * DAY, x.now + 1);
    const slots = x.D.meta.slots.filter(Boolean);
    const data = [];
    for (let w = 0; w < 6; w++) slots.forEach(function (s, si) { const c = g[w][s.id]; if (c.taken) data.push([w, si, c.LATE / c.taken * 100, F.num(c.LATE / c.taken * 100, 0)]); });
    return GT.charts.heatmap({ xCats: DT.WEEKDAYS_SHORT.slice(0, 6), yCats: slots.map(function (s) { return s.start; }), data: data, scale: { min: 0, max: 15 }, yLabelWidth: 40 });
  };
  T.absHist = function () {
    const x = sctx();
    return GT.charts.histogram({ bins: ['0', '1', '2', '3', '4', '5+'], counts: M.absenceHistogram(M.attendanceByStudent(x.D, {}, x.w30[0], x.w30[1])), colors: ['#B7E0C7', '#F5C451', '#F08C3A', '#E5484D', '#C2363B', '#8F1D22'] });
  };
  T.excTrend = function () {
    const x = sctx();
    const b = GT.period.buckets(x.D.meta.dataStart, x.now + 1, 'week');
    const cs = b.map(function (d) { return M.attendanceCounts(x.D, {}, d.from, d.to); });
    return GT.charts.line({ categories: b.map(function (d) { return d.label; }), endLabels: false, series: [{ name: 'Có phép', color: GT.colors.series[0], data: cs.map(function (c) { return c.EXCUSED / c.taken * 100; }) }, { name: 'Không phép', color: GT.colors.series[1], data: cs.map(function (c) { return c.UNEXCUSED / c.taken * 100; }) }], fmt: function (v) { return F.num(v, 1) + '%'; } });
  };
  T.notTaken = function () {
    const x = sctx();
    const items = x.D.classes.map(function (c) { const a = M.attendanceCounts(x.D, { classIds: [c.id] }, x.w30[0], x.w30[1]); return { id: c.id, name: c.name, value: a.total ? a.NOT_TAKEN / a.total * 100 : null, n: a.total }; }).filter(function (i) { return i.value !== null; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8);
    items.forEach(function (i) { i.color = i.value > 10 ? GT.colors.status.RED : GT.colors.deemph; });
    return GT.charts.rankBar({ items: items, fmt: function (v) { return F.num(v, 1) + '%'; }, marks: [{ value: 10, label: 'Ngưỡng 10%', color: GT.colors.status.RED }] });
  };
  T.trend8w = function () {
    const x = sctx(), w0 = DT.startOfWeek(x.now);
    const ws = []; for (let i = 7; i >= 0; i--) ws.push(w0 - i * 7 * DAY);
    return GT.charts.line({ categories: ws.map(DT.fmtDayMonth), min: 50, max: 100, endLabels: false, fmt: function (v) { return F.num(v, 1) + '%'; },
      series: [{ name: 'Có mặt', color: GT.colors.series[0], data: ws.map(function (w) { return M.attendanceRates(M.attendanceCounts(x.D, {}, w, w + 7 * DAY)).present * 100; }) },
        { name: 'Đúng hạn', color: GT.colors.series[1], data: ws.map(function (w) { const c = M.taskCounts(x.D, {}, w, Math.min(w + 7 * DAY, x.now + 1)); return c.overdue ? M.taskRates(c).onTime * 100 : null; }) }] });
  };
  T.hwTrend = function () {
    const x = sctx();
    const b = GT.period.buckets(x.D.meta.dataStart, x.now + 1, 'week');
    return GT.charts.line({ categories: b.map(function (d) { return d.label; }), endLabels: false, fmt: function (v) { return F.num(v, 1) + '%'; },
      series: [{ name: 'Trường', color: '#3F4452', width: 3, data: b.map(function (d) { const c = M.taskCounts(x.D, {}, d.from, Math.min(d.to, x.now + 1)); return c.overdue ? M.taskRates(c).onTime * 100 : null; }) }].concat(x.D.groups.map(function (g) {
        return { name: g.name, color: GT.colors.group[g.id], width: 1.5, data: b.map(function (d) { const c = M.taskCounts(x.D, { groupIds: [g.id] }, d.from, Math.min(d.to, x.now + 1)); return c.overdue ? M.taskRates(c).onTime * 100 : null; }) };
      })) });
  };
  T.groupHeatmap = function () {
    const x = sctx();
    const s = M.keyMetrics(x.D, {}, x.w30[0], x.w30[1], x.cfg);
    const data = [];
    x.D.groups.forEach(function (g, yi) { const k = M.keyMetrics(x.D, { groupIds: [g.id] }, x.w30[0], x.w30[1], x.cfg); M.KEY_METRICS.forEach(function (m, xi) { const v = k[m.key].value; data.push([xi, yi, M.deviationPts(m.kind, v, s[m.key].value), v === null ? '–' : m.kind === 'score' ? F.score(v) : F.pct(v, 0)]); }); });
    return GT.charts.heatmap({ xCats: M.KEY_METRICS.map(function (m) { return m.short; }), yCats: x.D.groups.map(function (g) { return g.name.replace('Lớp tiếng Anh tăng cường', 'TA'); }), data: data, scale: { diverging: true, maxAbs: 10 }, xTop: true, yLabelWidth: 60, xLabelWidth: 60, labelSize: 10 });
  };
  T.classHeatmap = function () {
    const x = sctx();
    const s = M.keyMetrics(x.D, {}, x.w30[0], x.w30[1], x.cfg);
    const ids = ['10A1', '10A3', '10A4', '11A4', '11A5', '12A5'];
    const data = [];
    ids.forEach(function (c, yi) { const k = M.keyMetrics(x.D, { classIds: [c] }, x.w30[0], x.w30[1], x.cfg); M.KEY_METRICS.forEach(function (m, xi) { const v = k[m.key].value; data.push([xi, yi, M.deviationPts(m.kind, v, s[m.key].value), v === null ? '–' : m.kind === 'score' ? F.score(v) : F.pct(v, 0)]); }); });
    return GT.charts.heatmap({ xCats: M.KEY_METRICS.map(function (m) { return m.short; }), yCats: ids, data: data, scale: { diverging: true, maxAbs: 10 }, xTop: true, yLabelWidth: 40, xLabelWidth: 60, labelSize: 10 });
  };
  T.timeline = function () {
    const x = sctx(), d0 = DT.startOfDay(x.now);
    const ss = M.sessionsIn(x.D, {}, d0, d0 + DAY);
    const rows = []; const seen = new Set();
    ss.forEach(function (s) { if (!seen.has(s.classId)) { seen.add(s.classId); rows.push({ id: s.classId, label: x.D.classById.get(s.classId).name }); } });
    return GT.charts.timeline({ rows: rows, from: d0 + 6.5 * DT.HOUR, to: d0 + 20 * DT.HOUR, now: x.now, items: ss.map(function (s) { const st = GT.views.sessionState(s, x.now, x.cfg); return { row: s.classId, start: s.start, end: s.end, color: st.color, text: '', tip: st.label }; }) });
  };
  T.boxplot = function () {
    const x = sctx();
    const sc = x.D.groups.map(function (g) { return M.taskScores(x.D, { groupIds: [g.id] }, x.w30[0], x.w30[1]); });
    return GT.charts.boxplot({ categories: x.D.groups.map(function (g) { return g.name.replace('Lớp tiếng Anh tăng cường', 'TA'); }), boxes: sc.map(GT.stats.boxplot) });
  };
  T.scatterClasses = function () {
    const x = sctx();
    const pts = x.D.classes.map(function (c) { const k = M.taskCounts(x.D, { classIds: [c.id] }, x.w30[0], x.w30[1]); return { name: c.name, x: k.overdue ? M.taskRates(k).onTime * 100 : null, y: M.taskRates(k).avgScore, color: GT.colors.group[c.groupId] }; });
    return GT.charts.scatter({ points: pts, xName: '% đúng hạn', yName: 'Điểm TB', labels: false, xMid: 80, yMid: 7 });
  };
  T.funnel = function () {
    const x = sctx();
    const f = M.onlineFunnel(x.D, {}, x.w30[0], x.w30[1], x.now, x.cfg);
    return GT.charts.funnel({ stages: [{ name: 'Được giao', value: f.assigned }, { name: 'Đã bắt đầu', value: f.started }, { name: 'Đang học', value: f.active }, { name: 'Hoàn thành', value: f.completed }, { name: 'Đạt ngưỡng', value: f.passed }] });
  };
  T.progressClasses = function () {
    const x = sctx();
    const run = M.onlineRunning(x.D, { courseIds: ['TOAN10'] }, x.now, x.cfg);
    return GT.charts.progress({ items: run.map(function (r) { return { name: x.D.classById.get(r.assignment.classId).name, actual: r.avgProgress, expected: r.expected }; }), tolerance: x.cfg.online.onTrackTolerancePts, labelWidth: 50 });
  };
  T.progressStudents = function () {
    const x = sctx();
    const r = M.onlineRunning(x.D, { classIds: ['10A6'] }, x.now, x.cfg)[0];
    if (!r) return null;
    return GT.charts.progress({ items: r.students.slice(0, 8).map(function (s) { return { name: x.D.studentById.get(s.studentId).fullName, actual: s.progress || 0, expected: r.expected }; }), tolerance: x.cfg.online.onTrackTolerancePts, labelWidth: 100 });
  };
  T.timing = function () {
    const x = sctx();
    const b = [M.submissionTiming(x.D, {}, x.w30[0], x.w30[1])].concat(x.D.groups.map(function (g) { return M.submissionTiming(x.D, { groupIds: [g.id] }, x.w30[0], x.w30[1]); }));
    return GT.charts.stack({ categories: ['Trường'].concat(x.D.groups.map(function (g) { return g.name.replace('Lớp tiếng Anh tăng cường', 'TA'); })), horizontal: true, series: M.TIMING_BUCKETS.map(function (k) { return { name: L.timing[k], color: GT.colors.timing[k], data: b.map(function (y) { return y[k]; }) }; }) });
  };
  T.levelDonut = function () {
    const x = sctx();
    const d = M.levelDistribution(x.D, {}, x.cfg, x.now);
    return GT.charts.donut({ items: M.LEVELS.map(function (l) { return { name: M.LEVEL_META[l].label, value: d.levels[l], color: GT.colors.level[l] }; }), legend: false, center: { value: F.pct(d.passRate, 0), label: 'đạt' } });
  };
  T.courseCompare = function () {
    const x = sctx();
    const ts = x.D.courses.map(function (c) { return M.loMatrix(x.D, c.id, null, x.cfg, x.now).total; });
    return GT.charts.stack({ categories: x.D.courses.map(function (c) { return c.shortName; }), horizontal: true, series: ['POOR', 'NEEDS_IMPROVEMENT', 'AVERAGE', 'GOOD', 'EXCELLENT', 'NO_DATA'].map(function (l) { return { name: M.LEVEL_META[l].label, color: GT.colors.level[l], data: ts.map(function (t) { return t.levels[l]; }) }; }) });
  };
  T.levelStackClasses = function () {
    const x = sctx();
    const mx = M.loMatrix(x.D, 'TOAN10', null, x.cfg, x.now);
    return GT.charts.stack({ categories: mx.classIds, horizontal: true, series: M.LEVELS.map(function (l) { return { name: M.LEVEL_META[l].label, color: GT.colors.level[l], data: mx.classIds.map(function (c) { return mx.classTotals.get(c).levels[l]; }) }; }) });
  };
  T.loHeatmap = function () {
    const x = sctx();
    const mx = M.loMatrix(x.D, 'TOAN10', null, x.cfg, x.now);
    const data = [];
    mx.los.forEach(function (lo, xi) { mx.classIds.forEach(function (c, yi) { const s = mx.cells.get(c + '|' + lo.id); data.push([xi, yi, s.passRate * 100, GT.views.loCellLabel(s).replace('%', ''), M.COLOR_META[s.color].color]); }); });
    return GT.charts.heatmap({ xCats: mx.los.map(function (l) { return l.code.replace('T10.', ''); }), yCats: mx.classIds, data: data, xTop: true, labelSize: 8, yLabelWidth: 40 });
  };
  T.loBar = function () {
    const x = sctx();
    const mx = M.loMatrix(x.D, 'TOAN10', null, x.cfg, x.now);
    const items = mx.los.map(function (lo) { const s = mx.loTotals.get(lo.id); return { name: lo.code, value: s.passRate * 100, color: M.COLOR_META[s.color].color }; }).sort(function (a, b) { return a.value - b.value; });
    return GT.charts.rankBar({ items: items, fmt: function (v) { return F.num(v, 0) + '%'; }, max: 100, labelWidth: 50, marks: [{ value: 80, label: 'Xanh', color: GT.colors.status.GREEN }, { value: 50, label: 'Đỏ', color: GT.colors.status.RED }] });
  };
  T.loScatter = function () {
    const x = sctx();
    const mx = M.loMatrix(x.D, 'HOA12', null, x.cfg, x.now);
    return GT.charts.scatter({ points: mx.los.map(function (lo) { const s = mx.loTotals.get(lo.id); return { name: lo.code, x: s.coverage * 100, y: s.passRate === null ? null : s.passRate * 100, color: M.COLOR_META[s.color].color }; }), xName: 'Coverage', yName: 'Tỉ lệ đạt', xMin: 0, xMax: 100, yMin: 0, yMax: 100, xMid: 30, yMid: 50 });
  };
  T.loTrend = function () {
    const x = sctx();
    const cls = M.courseClassIds(x.D, 'TOAN10', x.now);
    const t = M.loTrend(x.D, 'TOAN10-LO08', cls), t2 = M.loTrend(x.D, 'TOAN10-LO03', cls);
    return GT.charts.line({ categories: t.map(function (w) { return DT.fmtDayMonth(w.weekStart); }), min: 0, max: 100, endLabels: false, fmt: function (v) { return F.num(v, 0) + '%'; },
      series: [{ name: 'T10.8', color: GT.colors.accent, data: t.map(function (w) { return w.passRate === null ? null : w.passRate * 100; }) }, { name: 'T10.3', color: '#9AA0AC', data: t2.map(function (w) { return w.passRate === null ? null : w.passRate * 100; }) }] });
  };
  T.hwLoScatter = function () {
    const x = sctx();
    const mx = M.loMatrix(x.D, 'TOAN10', null, x.cfg, x.now);
    return GT.charts.scatter({ points: mx.classIds.map(function (c) { let d = 0, t = 0; (x.D.idx.assignByClass.get(c) || []).filter(function (a) { return a.courseId === 'TOAN10'; }).forEach(function (a) { (x.D.idx.progByAssignment.get(a.id) || []).forEach(function (p) { d += M.completedItemsAt(p, x.now); t += p.totalItems; }); }); return { name: c, x: t ? d / t * 100 : null, y: mx.classTotals.get(c).passRate * 100 }; }), xName: 'Tiến độ TT', yName: 'Tỉ lệ đạt' });
  };
  T.sessionsPerClass = function () {
    const x = sctx();
    const ids = x.D.classes.slice(0, 10).map(function (c) { return c.id; });
    return GT.charts.columns({ categories: ids, integer: true, interval: 0, rotate: 45, series: [{ name: 'Buổi', color: GT.colors.series[0], data: ids.map(function (c) { return M.sessionsIn(x.D, { classIds: [c] }, x.wk[0], x.wk[1]).length; }) }] });
  };
  T.opsRates = function () {
    const x = sctx();
    const ids = x.D.classes.slice(10, 20).map(function (c) { return c.id; });
    const os = ids.map(function (c) { return M.opsCounts(x.D, { classIds: [c] }, x.w30[0], x.w30[1], x.cfg); });
    return GT.charts.columns({ categories: ids, interval: 0, rotate: 45, max: 100, series: [{ name: 'Điểm danh', color: GT.colors.series[0], data: os.map(function (o) { return o.takenRate * 100; }) }, { name: 'Báo cáo', color: GT.colors.series[1], data: os.map(function (o) { return o.reportedRate * 100; }) }], fmt: function (v) { return F.num(v, 0) + '%'; } });
  };
  T.sessionCats = function () {
    const x = sctx();
    const ids = ['12A1', '12A2', '12A3', '12A4', '12A5'];
    const os = ids.map(function (c) { return M.opsCounts(x.D, { classIds: [c] }, x.w30[0], x.w30[1], x.cfg); });
    return GT.charts.stack({ categories: ids, horizontal: true, series: M.SESSION_CATEGORIES.map(function (k) { return { name: L.session[k], color: GT.colors.session[k], data: os.map(function (o) { return o.cat[k]; }) }; }) });
  };
  T.attOnTimeOps = function () {
    const x = sctx();
    const items = x.D.classes.map(function (c) { const o = M.opsCounts(x.D, { classIds: [c.id] }, x.w30[0], x.w30[1], x.cfg); return { name: c.name, value: o.attOnTimeRate === null ? null : o.attOnTimeRate * 100 }; }).filter(function (i) { return i.value !== null; }).sort(function (a, b) { return a.value - b.value; }).slice(0, 8);
    items.forEach(function (i, k) { i.emph = k < 3; });
    return GT.charts.rankBar({ items: items, fmt: function (v) { return F.num(v, 0) + '%'; }, max: 100, accent: GT.colors.status.ORANGE });
  };
  T.latency = function () {
    const x = sctx();
    const o = M.opsCounts(x.D, {}, x.w30[0], x.w30[1], x.cfg);
    return GT.charts.histogram({ bins: M.LATENCY_BUCKETS.map(function (k) { return L.latency[k]; }), counts: M.LATENCY_BUCKETS.map(function (k) { return o.latency[k]; }), colors: M.LATENCY_BUCKETS.map(function (k) { return GT.colors.latency[k]; }) });
  };
  T.dayClass = function () {
    const x = sctx();
    const ids = ['12A1', '12A2', '12A3', '12A4', '12A5'];
    const days = GT.period.buckets(x.now - 13 * DAY, x.now + 1, 'day');
    const cells = [];
    ids.forEach(function (c, yi) { days.forEach(function (d, xi) { const ss = M.sessionsIn(x.D, { classIds: [c] }, d.from, d.to); if (!ss.length) return; const k = M.sessionCategory(ss[0], x.now); cells.push({ x: xi, y: yi, color: GT.colors.session[k], text: L.sessionCode[k], tip: L.session[k] }); }); });
    return GT.charts.catHeatmap({ xCats: days.map(function (d) { return DT.fmtDayMonth(d.from); }), yCats: ids, cells: cells, rotate: 45, yLabelWidth: 40 });
  };
  T.bullet = function () {
    const x = sctx();
    const k = M.keyMetrics(x.D, { classIds: ['10A4'] }, x.w30[0], x.w30[1], x.cfg), g = M.keyMetrics(x.D, { groupIds: ['G10'] }, x.w30[0], x.w30[1], x.cfg), s = M.keyMetrics(x.D, {}, x.w30[0], x.w30[1], x.cfg);
    return GT.charts.bullet({ names: ['10A4', 'TB Khối 10', 'TB trường'], metrics: M.KEY_METRICS.slice(0, 5).map(function (m) { return { label: m.short, kind: m.kind, value: k[m.key].value, group: g[m.key].value, school: s[m.key].value }; }) });
  };
  T.stuSession = function () {
    const x = sctx();
    const ss = M.sessionsIn(x.D, { classIds: ['12A5'] }, x.now - 14 * DAY, x.now + 1).filter(function (s) { return s.start <= x.now; });
    const roster = M.roster(x.D, '12A5', x.now).slice(0, 10);
    const cells = [];
    roster.forEach(function (sid, yi) { ss.forEach(function (s, xi) { const r = (x.D.idx.attBySession.get(s.id) || []).filter(function (a) { return a.studentId === sid; })[0]; if (r) cells.push({ x: xi, y: yi, color: GT.colors.att[r.status], text: L.attCode[r.status], tip: L.att[r.status] }); }); });
    return GT.charts.catHeatmap({ xCats: ss.map(function (s) { return DT.fmtDayMonth(s.start); }), yCats: roster.map(function (s) { return x.D.studentById.get(s).fullName; }), cells: cells, rotate: 0, yLabelWidth: 100, rowHeight: 16, labelSize: 9 });
  };
  T.taskStack = function () {
    const x = sctx();
    const ts = M.tasksIn(x.D, { classIds: ['12A5'] }, x.w30[0], x.w30[1]).slice(-8);
    const st = ts.map(function (t) { return M.taskStats(x.D, t); });
    return GT.charts.stack({ categories: ts.map(function (t) { return DT.fmtDayMonth(t.dueAt); }), series: ['ON_TIME', 'LATE', 'MISSING'].map(function (k) { return { name: L.task[k], color: GT.colors.task[k], data: st.map(function (s) { return s[k]; }) }; }) });
  };
  T.onlineStatus = function () {
    const x = sctx();
    const as = M.assignmentsIn(x.D, { classIds: ['12A5', '12A1'] });
    const cs = as.map(function (a) { const c = { ON_TIME: 0, LATE: 0, MISSING: 0, OPEN: 0 }; (x.D.idx.progByAssignment.get(a.id) || []).forEach(function (p) { c[M.onlineStatus(a, p, x.now)]++; }); return c; });
    return GT.charts.stack({ categories: as.map(function (a) { return x.D.classById.get(a.classId).name; }), horizontal: true, series: ['ON_TIME', 'LATE', 'MISSING', 'OPEN'].map(function (k) { return { name: L.task[k], color: GT.colors.task[k], data: cs.map(function (c) { return c[k]; }) }; }) });
  };
  T.taskScoreCols = function () {
    const x = sctx();
    const ts = M.tasksIn(x.D, { classIds: ['11A2'], courseIds: ['LY11'] }, x.w30[0], x.w30[1]).slice(-8);
    return GT.charts.columns({ categories: ts.map(function (t) { return DT.fmtDayMonth(t.dueAt); }), max: 10, series: [{ name: 'Điểm TB', color: GT.colors.accent, data: ts.map(function (t) { const s = M.taskStats(x.D, t); return s.avgScore === null ? null : +s.avgScore.toFixed(1); }) }], fmt: function (v) { return F.num(v, 1); } });
  };
  T.scoreHist = function () {
    const x = sctx();
    const sc = M.taskScores(x.D, { classIds: ['11A2'] }, x.w30[0], x.w30[1]);
    const counts = []; for (let i = 0; i < 10; i++) counts.push(sc.filter(function (v) { return i === 9 ? v >= 9 : v >= i && v < i + 1; }).length);
    return GT.charts.histogram({ bins: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], counts: counts });
  };
  T.scatterStudents = function () {
    const x = sctx();
    const m = M.taskByStudent(x.D, { classIds: ['12A5'] }, x.w30[0], x.w30[1]);
    const pts = []; m.forEach(function (g, sid) { if (g.overdue && g.graded) pts.push({ name: sid, x: (g.ON_TIME + g.LATE) / g.overdue * 100, y: g.scoreSum / g.graded }); });
    return GT.charts.scatter({ points: pts, xName: '% nộp', yName: 'Điểm TB', labels: false, xMid: 80, yMid: 6.5 });
  };
  T.stuLo = function () {
    const x = sctx();
    const los = x.D.idx.losByCourse.get('TOAN10');
    const roster = M.roster(x.D, '10A4', x.now).slice(0, 10);
    const cells = [];
    roster.forEach(function (sid, yi) { M.studentLoProfile(x.D, sid, '10A4', 'TOAN10', x.cfg).items.forEach(function (it) { cells.push({ x: los.indexOf(it.lo), y: yi, color: GT.colors.level[it.level], text: M.LEVEL_META[it.level].short, tip: M.LEVEL_META[it.level].label }); }); });
    return GT.charts.catHeatmap({ xCats: los.map(function (l) { return l.code.replace('T10.', ''); }), yCats: roster.map(function (s) { return x.D.studentById.get(s).fullName; }), cells: cells, rotate: 0, yLabelWidth: 100, rowHeight: 16, labelSize: 8 });
  };
  T.stuAtt = function () {
    const x = sctx();
    const sid = x.D.meta.special.transferStudent;
    const cls = (x.D.idx.enrollByStudent.get(sid) || []).map(function (e) { return e.classId; });
    const cs = cls.map(function (c) { return M.attendanceCounts(x.D, { studentIds: [sid], classIds: [c] }, x.D.meta.dataStart, x.now + 1); });
    return GT.charts.stack({ categories: cls, horizontal: true, unit: 'buổi', series: ['ON_TIME', 'LATE', 'EXCUSED', 'UNEXCUSED'].map(function (k) { return { name: L.att[k], color: GT.colors.att[k], data: cs.map(function (c) { return c[k]; }) }; }) });
  };
  T.stuOnline = function () {
    const x = sctx();
    const sid = x.D.meta.special.transferStudent;
    const ps = (x.D.idx.progByStudent.get(sid) || []);
    return GT.charts.progress({ items: ps.map(function (p) { const a = x.D.assignmentById.get(p.assignmentId); return { name: a.title.replace('Ôn tập trực tuyến: ', ''), actual: M.progressAt(p, x.now) || 0, expected: M.expectedProgress(a, x.now) }; }), labelWidth: 110, tolerance: 10 });
  };
  T.stuLo2 = function () {
    const x = sctx();
    const sid = x.D.meta.special.diligentPoor;
    const p = M.studentLoProfile(x.D, sid, '11A1', 'LY11', x.cfg);
    return GT.charts.columns({ categories: p.items.map(function (it) { return it.lo.code.replace('L11.', ''); }), max: 100, interval: 0,
      series: [{ name: 'Học sinh', color: GT.colors.accent, data: p.items.map(function (it) { return it.ach.percent; }), colors: p.items.map(function (it) { return GT.colors.level[it.level]; }) }, { name: 'TB lớp', color: '#C9C3D3', data: p.items.map(function (it) { return M.loMeanPercent(x.D, '11A1', it.lo.id, x.now); }) }], fmt: function (v) { return F.num(v, 0); } });
  };

  GT.catalog = { LIST: LIST, PAGES: PAGES, TAGS: TAGS, THUMBS: T };
})(window.GT);
