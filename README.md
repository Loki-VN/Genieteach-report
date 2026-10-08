# GenieTeach — Báo cáo Học vụ (prototype)

Prototype tĩnh cho mảng báo cáo **Học vụ** của GenieTeach: HTML5 + CSS + JavaScript thuần, không framework, không bước build.
Dữ liệu là mock sinh tất định theo seed; mọi số liệu, cảnh báo và biểu đồ đều tính từ dữ liệu đó.

## Mở prototype

1. Clone repo (hoặc tải zip) và mở **`index.html`** bằng trình duyệt (Chrome/Edge/Firefox bản mới). Mở trực tiếp qua `file://` được, không cần web server.
2. Cần Internet để nạp ECharts 5.5.0 từ CDN (`cdn.jsdelivr.net`, phiên bản cố định). Khi offline, các trang vẫn chạy: biểu đồ hiện thông báo "Không tải được thư viện biểu đồ", số liệu xem ở chế độ **Bảng**.
3. Từ trang chủ chọn vai trò **Học vụ**. Công tắc "Hiện hạng mục Đề xuất" ẩn/hiện mọi trang, biểu đồ và chỉ số gắn nhãn **Đề xuất** (lưu trong trình duyệt).

"Hôm nay" cố định là **Thứ Năm 08/10/2026, 09:40** để dữ liệu nằm giữa kỳ học.

## Các trang

| Trang | File | Ghi chú |
|---|---|---|
| Tổng quan | `hoc-vu/overview.html` | KPI vận hành hôm nay, chuyên cần, học ở nhà, cảnh báo nổi bật |
| Chuyên cần | `hoc-vu/attendance.html` | Theo kỳ; xếp hạng lớp/nhóm, phân bố vắng, ma trận thứ × giờ |
| Học ở nhà | `hoc-vu/homework.html` | Nhiệm vụ sau buổi học + khóa trực tuyến, theo hạn nộp |
| Khóa học | `hoc-vu/courses.html` | Danh sách khóa, tỉ lệ CĐR Xanh, diễn giải nguyên nhân |
| Chi tiết khóa | `hoc-vu/course-detail.html?courseId=…` | Heatmap lớp × CĐR, câu hỏi, xu hướng |
| Lịch học | `hoc-vu/schedule.html` | Lịch theo ngày/tuần, trạng thái điểm danh và báo cáo |
| Lớp học | `hoc-vu/class.html?classId=…` | 4 tab: Tổng quan, Chuyên cần, Bài về nhà, Chuẩn đầu ra |
| Vận hành giáo viên | `hoc-vu/teachers.html` | **Đề xuất**. Chỉ đo hành vi vận hành; tắt được trong Cấu hình |
| Hồ sơ học sinh | `hoc-vu/student.html?studentId=…` | **Đề xuất**. Có bản in |
| Trung tâm cảnh báo | `hoc-vu/alerts.html` | **Đề xuất**. Lọc, nhóm, đổi trạng thái (lưu trong trình duyệt) |
| Cấu hình | `hoc-vu/settings.html` | Ngưỡng CĐR, màu, rule cảnh báo, hiển thị; "Khôi phục mặc định" |
| Danh mục biểu đồ | `hoc-vu/chart-catalog.html` | Mỗi biểu đồ: bản thu nhỏ, nguồn dữ liệu, công thức, câu hỏi nghiệp vụ |

Bộ lọc kỳ (Ngày / Tuần / Tháng / Khoảng tùy chọn), nhóm lớp, lớp, khóa được giữ trên URL nên link chia sẻ và điều hướng giữa các trang giữ nguyên ngữ cảnh. Mọi bảng xuất được CSV (UTF-8, dấu thập phân là dấu phẩy).

## Cấu trúc

```
index.html              Trang chủ: chọn vai trò, công tắc Đề xuất, link tài liệu
tests.html              Kiểm thử công thức và rule (chạy trong trình duyệt)
hoc-vu/*.html           Các trang báo cáo (chỉ khai báo script, nội dung do JS dựng)
assets/css/base.css     Token màu, layout, responsive (≥1280 và 768), bản in
assets/js/
  config.js             GT.config: mặc định, đọc/ghi localStorage, ngưỡng, rule; GT.debug
  util.js               Định dạng VN (ngày, giờ, %), thống kê, RNG có seed, CSV, memo
  mock-data.js          Sinh dữ liệu mock + kịch bản K01–K30 (mỗi rule cảnh báo đều xảy ra)
  data-index.js         Index tra cứu nhanh (theo lớp, học sinh, buổi, khóa…)
  metrics.js            Hàm tính thuần, có JSDoc công thức (mã M-… trong docs/METRICS.md)
  alerts.js             Rule engine đọc cấu hình, gộp cảnh báo, chống trùng 7 ngày
  period.js             Kỳ dữ liệu: khoảng [from, to), kỳ trước, bucket ngày/tuần/tháng
  charts.js             Builder ECharts dùng chung + bảng màu, nhãn
  ui.js                 Khung trang, bộ lọc, KPI, card, bảng, popup, CSV
  views.js              Thành phần dùng lại giữa các trang (xếp hạng, heatmap CĐR…)
  catalog.js            Dữ liệu cho danh mục biểu đồ
  pages/*.js            Mỗi trang một file, chỉ gọi metrics/alerts rồi render
docs/
  PLAN.md               Kế hoạch đã duyệt
  METRICS.md            Định nghĩa và công thức từng chỉ số
  ALERTS.md             Danh mục rule: điều kiện, cửa sổ, cỡ mẫu tối thiểu, kịch bản mock
  OPEN-QUESTIONS.md     Câu hỏi mở và các [GIẢ ĐỊNH] / [SỬA SPEC] đã áp dụng
```

Luồng dữ liệu một chiều: `mock-data → data-index → metrics → alerts → charts/ui`. Trang không tự tính số liệu; mọi công thức nằm trong `metrics.js`.

## Đổi "hôm nay" và seed

Sửa `assets/js/config.js`, mục `DEFAULTS.school`:

```js
school: {
  today: '2026-10-08',  // yyyy-MM-dd, ngày "hôm nay"
  now: '09:40',         // HH:mm, giờ "bây giờ"
  seed: 20261008        // seed RNG của mock
}
```

Dữ liệu mock sinh tương đối theo `today` (16 tuần quanh hôm nay), nên đổi ngày vẫn có dữ liệu đầy đủ. Các kịch bản K01–K30 được tinh chỉnh với seed mặc định; seed khác vẫn chạy nhưng có thể có rule không phát sinh cảnh báo. Kiểm tra bằng `tests.html` hoặc chế độ debug.

Cấu hình người dùng chỉnh ở trang Cấu hình lưu trong `localStorage` (`gt.hocvu.config.v1`); trạng thái cảnh báo lưu ở `gt.hocvu.alertState.v1`. Nút "Khôi phục mặc định" xóa cấu hình đã lưu.

## Chế độ debug

Thêm `?debug=1` vào URL của bất kỳ trang nào (hoặc đặt `GT.debug = true` trong `config.js`). Console sẽ in:

- bảng đối chiếu **kịch bản → rule**: mỗi kịch bản mock mong đợi rule nào, có phát sinh không, và các rule không được phép phát sinh;
- bảng từng rule: bật/tắt, số cảnh báo, thời gian chạy.

Thời gian sinh dữ liệu, dựng index và render luôn hiện ở chân mỗi trang.

Trong console có thể dùng trực tiếp `GT.D` (dữ liệu đã index), `GT.metrics`, `GT.alerts.run(GT.D, GT.config.get())`.

## Kiểm thử

Mở `tests.html`. Trang chạy các ca kiểm tra công thức (biên khoảng thời gian, loại "chưa điểm danh" khỏi mẫu số, học sinh học nhiều lớp, gộp có trọng số, cỡ mẫu tối thiểu, diễn giải nguyên nhân, gộp và chống trùng cảnh báo, nhất quán giữa các kỳ, mọi rule đều phát sinh, hiệu năng) và hiện kết quả đạt/không đạt.

## Ngoài phạm vi

Không có backend, đăng nhập, API, gửi thông báo hay nhận xét AI. Báo cáo cho vai trò Giáo viên chưa làm (nút trên trang chủ để trạng thái "chưa có").
