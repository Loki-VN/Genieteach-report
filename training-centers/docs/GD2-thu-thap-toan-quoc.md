# GĐ2: thu thập toàn quốc (lượt chạy ngày 16/10/2026, từ máy chủ cloud)

## Kết quả

File `data/exports/trung-tam-toan-quoc-2026-10-16.xlsx` có:
- **2.415 trung tâm**, 2.670 cơ sở, 998 liên hệ cá nhân;
- 3.039 dòng thô từ danh sách Sở và 59 website trung tâm;
- 186 dòng nhật ký nguồn.

File chứa dữ liệu cá nhân, nên chỉ để trên máy chạy và không đưa lên git.

Theo loại hình:

| Loại hình | Số trung tâm |
|---|--:|
| Ngoại ngữ | 1.261 |
| Luyện thi (gồm dạy thêm, bồi dưỡng văn hóa) | 937 |
| Kỹ năng | 182 |
| Tin học-STEM | 35 |

Theo tình trạng:

| Tình trạng | Số trung tâm |
|---|--:|
| likely_active | 2.064 |
| unknown | 287 |
| active | 39 |
| closed | 16 |
| suspended | 9 |

Trong 287 trung tâm `unknown` có các trung tâm ở Hải Phòng có giấy phép hoạt động đã hết hạn.

**Tỷ lệ điền (bảng centers):**

| Trường | Tỷ lệ |
|---|--:|
| Tỉnh | 100% |
| Địa chỉ | 84% |
| Hotline | 59% |
| Người đại diện | 47% |
| Số QĐ cấp phép | 24% |
| Email | 21% |

Nhiều danh sách chỉ có tên và địa chỉ: Ninh Bình, Đà Nẵng, Long An.

## Độ phủ theo tỉnh

"Nguồn chặn/lỗi" là số URL nguồn Sở chưa đọc được: bị chặn IP nước ngoài, robots.txt chặn, hoặc tường lửa.
Tỉnh có 0 trung tâm nhưng có vài cơ sở là cơ sở của chuỗi (lấy từ website) đặt tại tỉnh đó.

| Mã | Tỉnh/thành | Trung tâm | Cơ sở | Liên hệ CN | Dòng Sở | Cập nhật | Nguồn chặn/lỗi |
|---|---|--:|--:|--:|--:|---|--:|
| 01 | TP Hà Nội | 23 | 36 | 0 | 0 |  | 7 |
| 04 | Cao Bằng | 0 | 0 | 0 | 0 |  | 1 |
| 08 | Tuyên Quang | 0 | 0 | 0 | 0 |  | 2 |
| 11 | Điện Biên | 21 | 22 | 19 | 24 | 2026-08-31 | 0 |
| 12 | Lai Châu | 0 | 0 | 0 | 0 |  | 1 |
| 14 | Sơn La | 18 | 21 | 23 | 32 | 2024-07-10 | 0 |
| 15 | Lào Cai | 0 | 0 | 0 | 0 |  | 2 |
| 19 | Thái Nguyên | 0 | 2 | 0 | 0 |  | 2 |
| 20 | Lạng Sơn | 0 | 0 | 0 | 0 |  | 1 |
| 22 | Quảng Ninh | 179 | 286 | 129 | 395 | 2024-12-31; 2025-03-07 | 0 |
| 24 | Bắc Ninh | 0 | 3 | 0 | 0 |  | 3 |
| 25 | Phú Thọ | 0 | 2 | 0 | 0 |  | 3 |
| 31 | TP Hải Phòng | 296 | 374 | 0 | 397 | 2024-10-29 | 2 |
| 33 | Hưng Yên | 0 | 2 | 0 | 0 |  | 2 |
| 37 | Ninh Bình | 1201 | 1444 | 773 | 1446 | 2025-11-30; 2026-06-30 | 2 |
| 38 | Thanh Hóa | 0 | 2 | 0 | 0 |  | 1 |
| 40 | Nghệ An | 0 | 1 | 0 | 0 |  | 1 |
| 42 | Hà Tĩnh | 0 | 0 | 0 | 0 |  | 1 |
| 44 | Quảng Trị | 0 | 0 | 0 | 0 |  | 2 |
| 46 | TP Huế | 0 | 2 | 0 | 0 |  | 1 |
| 48 | TP Đà Nẵng | 290 | 13 | 0 | 328 | 2026-10-16 | 1 |
| 51 | Quảng Ngãi | 0 | 0 | 0 | 0 |  | 2 |
| 52 | Gia Lai | 0 | 0 | 0 | 0 |  | 2 |
| 56 | Khánh Hòa | 0 | 0 | 0 | 0 |  | 2 |
| 66 | Đắk Lắk | 97 | 106 | 16 | 106 | 2024-05-31 | 1 |
| 68 | Lâm Đồng | 46 | 58 | 38 | 58 | 2021-02-23 | 2 |
| 75 | Đồng Nai | 0 | 0 | 0 | 0 |  | 2 |
| 79 | TP Hồ Chí Minh | 103 | 139 | 0 | 91 | 2024-04-01 | 3 |
| 80 | Tây Ninh | 136 | 157 | 0 | 162 | 2024-12-25; 2025-01-02 | 1 |
| 82 | Đồng Tháp | 0 | 0 | 0 | 0 |  | 2 |
| 86 | Vĩnh Long | 0 | 0 | 0 | 0 |  | 3 |
| 91 | An Giang | 0 | 0 | 0 | 0 |  | 3 |
| 92 | TP Cần Thơ | 0 | 0 | 0 | 0 |  | 3 |
| 96 | Cà Mau | 0 | 0 | 0 | 0 |  | 2 |

**Nguồn đã đọc được:**

| Tỉnh | Nguồn |
|---|---|
| Điện Biên | Thông báo của Sở 8/2026 |
| Sơn La | Dữ liệu mở, 7/2024 |
| Quảng Ninh | PDF 12/2024 và Google Sheet do Sở công bố (3/2025) |
| Hải Phòng | Cổng dữ liệu mở, 10/2024 |
| Ninh Bình | TB 50/TB-SGDĐT 11/2025 (gồm Hà Nam, Nam Định cũ) và danh sách cơ sở dạy thêm 6/2026 (52 file của các xã, gói RAR) |
| Đà Nẵng | Danh bạ trực tuyến của Sở (Đà Nẵng cũ) |
| Đắk Lắk | Danh sách 5/2024 (Đắk Lắk cũ) |
| Lâm Đồng | Đắk Nông cũ, 2/2021 |
| TP.HCM | Bình Dương cũ: phụ lục CV 702, 4/2024 |
| Tây Ninh | Long An cũ: cổng dữ liệu mở Tây Ninh, 12/2024–1/2025 |

## Nguồn chưa đọc được và lý do

- **Chặn kết nối từ IP nước ngoài:** đây là nhóm lớn nhất. Đa số website `*.edu.vn` và `sgddt.*.gov.vn` ngắt kết nối ngay khi bắt tay TLS với máy chủ cloud. Theo RFC 9309, không đọc được robots.txt thì không crawl. Danh sách URL nằm trong `config.yaml → sgd_sources`. Khi chạy `run_all` từ máy ở Việt Nam, các URL này sẽ được thử lại.
- **robots.txt chặn:** file danh sách của Hà Nội (`quantrisgd.shieldix.app`) và Hải Phòng (`adminsgd.haiphong.shieldix.app`) không được tải.
  - Với Hà Nội, có nguồn thay thế là danh bạ `danhba.hanoi.edu.vn`, không nằm trên host shieldix. Từ cloud không vào được host này, nhưng có thể vào được từ Việt Nam.
- **Tường lửa/chống bot:**
  - `hcm.edu.vn`, `opendata.hochiminhcity.gov.vn`: trang "Request Rejected".
  - `hue.edu.vn`: thử thách cookie bằng JavaScript.
  - Cổng dữ liệu Đồng Nai: bắt đăng nhập và nhập CAPTCHA.
  - Tất cả đều ghi log và bỏ qua, không tìm cách vượt.
- **Đăng ký doanh nghiệp:**
  - Ô tra cứu của `dangkyquamang.dkkd.gov.vn` gọi API kèm mã phiên chống tự động; trang bố cáo có reCAPTCHA. Không tra cứu tự động.
  - `masothue.com` cấm robot trong điều khoản sử dụng.
- **Google Places:** chưa chạy vì chưa có `GOOGLE_PLACES_API_KEY`.
- **Website trung tâm:** 59 site đọc được, 18 site bị chặn hoặc không truy cập được.
  - Bị Cloudflare chặn: ILA, IELTS Fighter, Language Link, RES.
  - Phần còn lại ghi trong sheet `nhat_ky_nguon`.

## Thay đổi xử lý trong lượt này

- **Định dạng đọc được:**
  - File nén RAR/7z/ZIP: giải nén bằng `unar` hoặc 7-Zip. Chỉ đọc file bảng, không chạy file nào trong gói.
  - Excel đời cũ `.xls`.
  - Google Sheet công khai, tải qua link xuất `.xlsx`.
  - Trang danh sách được đi theo thêm một tầng.
- **Phần trong PDF:** giữ tiêu đề phần (I., II.…). Các phần "tư vấn du học", "hỗ trợ giáo dục hòa nhập" và các nhóm trẻ mầm non được ghi `in_scope = FALSE`.
- **Cột mới:** loại hình, website, ngày hết hạn giấy phép, MST. Các cột chưa nhận diện được vẫn giữ trong `extra.other_columns`.
- **Danh sách dạy thêm:**
  - Bảng ghi "Họ và tên + Đơn vị công tác" (giáo viên đăng ký dạy thêm): cơ sở là chính người dạy.
  - Chức danh của người đứng tên là "Chủ cơ sở/người đăng ký dạy thêm".
- **Khử trùng lặp:**
  - Gộp theo chỉ mục, chạy được cho cả nước.
  - Hộ kinh doanh đứng tên cá nhân chỉ gộp khi trùng tên chính xác. Trước đây tên đệm + tên trùng tên xã, nên "Nguyễn Xuân Thủy" bị cắt thành "Nguyễn".
  - Bỏ các cụm chung khi so tên: hộ kinh doanh, bồi dưỡng kiến thức, KNS…
  - Tỉnh của thương hiệu là tỉnh có nhiều cơ sở nhất.
- **Phân loại:**
  - Theo cột loại hình hoặc tên phần (KNS → kỹ năng, STEM → tin học-STEM, bồi dưỡng kiến thức → luyện thi), sau đó theo loại danh sách.
  - Tên "Ngoại ngữ - Tin học X" được xếp vào ngoại ngữ.
  - Phân biệt Hán ngữ và Hàn ngữ bằng chữ có dấu.
- **Tình trạng:**
  - Giấy phép hết hạn thì không được tính là tín hiệu tích cực.
  - Danh bạ trực tuyến (Đà Nẵng) lấy ngày đọc làm ngày cập nhật.

## Chạy tiếp từ máy ở Việt Nam

Xem README, mục "Chạy toàn bộ trên máy ở Việt Nam":
- **Windows:** nhấp đúp `run_all.bat`.
- **macOS/Linux:** chạy `./run_all.sh`.

Nếu chép kèm `data/centers.sqlite` của lượt này, lệnh chỉ chạy lại các tỉnh còn URL chưa đọc được rồi xuất lại một file Excel đầy đủ.
