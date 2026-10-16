# Báo cáo GĐ0 — Khảo sát nguồn dữ liệu

Ngày lập: 16/10/2026 · Phạm vi thử: **Hà Nội** và **Điện Biên** (tỉnh nhỏ, không sáp nhập; dự phòng: Sơn La)

## 0. Tóm tắt

1. **Nguồn chính nên là danh sách trung tâm do Sở GD&ĐT công bố.** Ví dụ: Hà Nội đăng file Excel
   cập nhật đến 10/2025, Điện Biên đăng thông báo đến 5/2025, Sơn La đưa lên cổng dữ liệu mở.
   Nguồn này phủ trung tâm ngoại ngữ - tin học (TT NN-TH) và kỹ năng sống. Nhóm **luyện thi vào 10/đại
   học** không nằm trong danh sách Sở, vì hoạt động theo quy định dạy thêm (TT 29/2024) và chỉ cần
   đăng ký kinh doanh. Với nhóm này và STEM không xin phép, Google Places + website là nguồn khám phá chính.
2. **Quy mô toàn quốc:** Bộ GD&ĐT thống kê năm học 2025-2026 có **8.978 TT NN-TH** và
   **1.312 TT kỹ năng sống**, tức khoảng 10.300 cơ sở được cấp phép. Cộng nhóm luyện thi/STEM ngoài danh sách,
   ước tính **12.000–16.000 địa điểm**. Sau khi gộp theo thương hiệu còn **7.000–11.000 dòng `centers`**,
   trong đó khoảng **3.000–5.000 thương hiệu đạt từ 100 học viên**. Đây là ước tính độ tin cậy thấp,
   sẽ hiệu chỉnh ở GĐ1.
3. **Chi phí Places:** Hà Nội khoảng 1.500 request. Bậc Pro thì 0 USD vì nằm trong hạn mức miễn phí;
   bậc Enterprise khoảng 17 USD. Toàn quốc khoảng 26.000 request: **~510–670 USD (Pro)** hoặc
   **~840–875 USD (Enterprise)**. Khoảng giá tùy chạy trong 1 hay 2 tháng.
4. **Điều khoản Google:** chỉ `place_id` được lưu lâu dài. Tên, địa chỉ, SĐT, website, số đánh giá
   lấy từ Google chỉ được cache tạm. Cần anh/chị chọn cách dùng (mục 9, câu 2).
5. **Đã chạy thật ngày 16/10/2026, sau khi mở mạng** (chi tiết ở mục 1b):
   - Đọc được danh sách Sở của **Điện Biên** (PDF), **Sơn La** (bảng + Excel dữ liệu mở),
     **Quảng Ninh** (PDF 163 dòng), cùng 10/12 website mẫu.
   - Kết quả: **176 trung tâm, 235 cơ sở, 128 liên hệ cá nhân**, đã xuất Excel.
   - **Danh sách Hà Nội chưa lấy được:** mọi file nằm trên `quantrisgd.shieldix.app`, mà robots.txt của host này
     là `Disallow: /`.
   - masothue.com cấm robot trong điều khoản nên đã loại. TP.HCM bị tường lửa chặn. Quảng Trị và Nghệ An
     ngắt kết nối từ phía máy chủ.
   - Chưa chạy Places vì chưa có API key.

## 1. Đã làm / chưa làm

| Hạng mục | Trạng thái |
|---|---|
| Khảo sát cấu trúc nguồn, pháp lý, số liệu toàn quốc, bảng giá + điều khoản Places | Xong (tìm kiếm web + chạy thật) |
| Khung dự án: config, crawler lịch sự, schema SQLite, module từng nguồn, CLI `probe` / `build` / `export` | Xong, 47 test offline đều chạy qua |
| Dữ liệu 34 tỉnh / 3.321 xã + ánh xạ xã cũ → mới | Xong (đóng gói từ dữ liệu mở, giấy phép MIT) |
| Chạy `probe` thật cho Hà Nội, Điện Biên (+ Sơn La, Quảng Ninh, Quảng Trị, Nghệ An, TP.HCM) | Xong — kết quả từng nguồn ở mục 1b |
| Đọc robots.txt / điều khoản thật | Xong cho các host đã thử (mục 1b) |
| Thử Places thật | **Chưa** — thiếu `GOOGLE_PLACES_API_KEY` |

## 1b. Kết quả chạy thật (16/10/2026)

| Nguồn | Kết quả | Ghi chú |
|---|---|---|
| Sở GD&ĐT Hà Nội | **Không lấy được** | robots.txt của `hanoi.edu.vn` cho phép đọc trang bài viết. Nhưng mọi file danh sách (.xlsx 10/2025, 9/2025, 6/2025, NĐ 125, kỹ năng 3/2025; .xls 2018) nằm trên `quantrisgd.shieldix.app`, mà robots.txt của host này là `User-agent: * / Disallow: /`. Trang bài viết không có bảng HTML. |
| Sở GD&ĐT Điện Biên | 15 dòng (13 trong phạm vi) | TB 1458/TB-SGDĐT (21/5/2025). File PDF có bảng nhưng có vài byte rác trước `%PDF`; đã xử lý. Cột: tên TT, họ tên người đứng đầu, giới tính, SĐT, địa chỉ, số QĐ, ngày cấp, nội dung hoạt động. Mỗi trung tâm còn có quyết định riêng dạng PDF scan hoặc .rar, cần OCR/xử lý tay. |
| Sở Sơn La (dữ liệu mở) | 30 dòng (bảng HTML 10 + Excel 20) | Cột: QĐ thành lập, QĐ cấp phép, địa chỉ, giám đốc, SĐT, liên hệ khác, trạng thái. robots cho phép tất cả. |
| Sở Quảng Ninh | 163 dòng | PDF 12/2024. Cột: huyện, tên, địa chỉ, công ty chủ quản, QĐ thành lập, QĐ cấp phép, giám đốc (kèm QĐ công nhận), môn, email, SĐT, ghi chú (dừng hoạt động…). |
| Sở Quảng Trị, Nghệ An | Không truy cập được | Máy chủ ngắt kết nối (reset / SSL EOF), có thể chặn IP nước ngoài. Không crawl khi không đọc được robots.txt. |
| Sở TP.HCM | Bị chặn | Tường lửa (WAF) trả trang "Request Rejected" mang mã HTTP 200; pipeline đã nhận diện và bỏ qua. |
| dangkykinhdoanh.gov.vn | Truy cập được | Không có robots.txt (404 = cho phép). Trang chủ không có CAPTCHA. Điều khoản không cấm truy cập tự động. Chưa thử tra cứu. |
| masothue.com | **Loại** | Điều khoản cấm "robot, nhện máy (spiders) và/hoặc bất kỳ thiết bị tự động nào" và cấm dùng thương mại khi chưa có văn bản cho phép. |
| hosocongty.vn | Không kết nối được | Lỗi chứng chỉ TLS phía máy chủ. |
| 12 website mẫu (chuỗi lớn) | 10 đọc được, 2 bị chặn | ILA, IELTS Fighter dùng Cloudflare challenge nên bỏ qua. teky.edu.vn render bằng JS, cần Playwright. |

Kết quả gộp (`python -m tcpipe export`):

| | Số lượng |
|---|---|
| Trung tâm (thương hiệu) | 176: Quảng Ninh 137, Sơn La 17, Điện Biên 12, website 10 |
| Cơ sở (branches) | 235 (87% ánh xạ được tới xã/phường mới) |
| Liên hệ cá nhân | 128, đều là giám đốc/người đứng đầu có SĐT di động trong danh sách Sở. Website mẫu không công bố SĐT/email cá nhân. |
| Tỷ lệ điền | tỉnh 98%, địa chỉ 96%, người đại diện 95%, số QĐ 91%, hotline 79%, pháp nhân 77%, email 55%, quy mô 24%, website 6% |
| Tình trạng | likely_active 153, closed 15, active 6, suspended 2 |

Lỗi đã gặp trên dữ liệu thật và đã sửa:
- Gộp nhầm các trung tâm khác nhau cùng đuôi địa danh ("… Hạ Long"); nay bỏ địa danh ở cuối tên khi so khớp.
- Đuôi hotline "1800 646448" bị hiểu thành số học viên.
- Số học viên của 1 giáo viên/1 lớp bị coi là số của trung tâm.
- Mã số thuế bị nhận thành SĐT.
- Tên người bắt nhầm ("Apollo English", "Trường Phổ").
- Link bài viết Facebook cá nhân bị coi là fanpage.
- Chữ "khảo sát" khớp thành môn SAT.

## 2. Từng nguồn

### 2.1 Sở GD&ĐT (nguồn 1)

| Tỉnh | Nguồn tìm thấy | Định dạng | Trường (theo mô tả công khai) | Cập nhật |
|---|---|---|---|---|
| Hà Nội | [Danh sách TT NN-TH đến 10/2025](https://hanoi.edu.vn/trung-tam-ngoai-truong/danh-sach-trung-tam-ngoai-ngu-tin-hoc-tinh-den-thang-102025/ctmb/1099/16600) (đăng 3/11/2025); bản 9/2025; danh sách TT có yếu tố nước ngoài theo NĐ 125 (3/2025); [TT bồi dưỡng kỹ năng (3/2025)](https://hanoi.edu.vn/trung-tam-ngoai-truong/danh-sach-cac-trung-tam-boi-duong-ky-nang-tren-dia-ban-thanh-pho-tinh-den-thang/ct/1099/16114); mục lục [Dịch vụ giáo dục được cấp phép](https://hanoi.edu.vn/dich-vu-giao-duc-duoc-cap-phep/cmb/1120) | Bài viết + **.xlsx** đính kèm | Tên TT, đơn vị chủ quản, địa điểm, giám đốc, SĐT, thời gian cấp phép | 10/2025 (có thể đã có bản 2026) |
| Điện Biên | [Thông báo TT NN-TH, cơ sở GD kỹ năng sống, tư vấn du học được phép hoạt động](http://dienbien.edu.vn/index.php/laws/detail/Thong-bao-cac-trung-tam-ngoai-ngu-tin-hoc-co-so-giao-duc-ky-nang-song-to-chuc-tu-van-du-hoc-duoc-cho-phep-thanh-lap-hoat-dong-tinh-den-thang-5-nam-2025-528/) | Văn bản (chưa rõ PDF hay HTML) | Chưa xem được | 5/2025 |
| Sơn La | [Cổng dữ liệu mở của tỉnh](https://data.sonla.gov.vn/detail_data/du-lieu-danh-sach-cac-trung-tam-dao-tao-ngoai-ngu-tren-dia-ban) | Bảng dữ liệu mở | Số QĐ thành lập, số QĐ cấp phép, địa chỉ, **trạng thái hoạt động** | 10/7/2024 |
| Quảng Ninh | [PDF danh sách](https://www.quangninh.gov.vn/so/sogiaoducdaotao/Lists/TinTuc/Attachments/6164/12.2024%20danh%20sach%20TTNNTH%20(1).pdf) | PDF có lớp chữ | Huyện, tên TT, địa chỉ, công ty chủ quản, QĐ cho phép | 12/2024 |
| Quảng Trị (cũ) | [Danh sách 11/2024](https://quangtri.edu.vn/trang-chu/tu-van-du-hoc/ngoai-ngu-tin-hoc/danh-sach-trung-tam-ngoai-ngu-tin-hoc-11.2024.html) | HTML | Tên, số QĐ, địa chỉ | 11/2024 |
| Nghệ An | [Trang tra cứu](http://nghean.edu.vn/menutop/tra-cuu/danh-sach-trung-tam-ngoai-ngu-tin-hoc) | HTML | Chưa xem được | ? |
| TP.HCM | [hcm.edu.vn](https://hcm.edu.vn/tt-ngoai-ngu-tin-hoc/tin-khan-danh-sach-cac-trung-tam-ngoai-ngu-tin-hoc-duoc-cap-phep-tinh-den-thang/ctmb/41743/62428) (bản tìm được là 5/2019; cần tìm bản mới trong cùng mục) | Bài viết + file | Như Hà Nội | 1.961 TT được cấp phép đến 8/2025 |

Nhận xét:

- **Căn cứ:** Bộ GD&ĐT yêu cầu Sở công khai danh sách TT NN-TH được cấp phép và các quyết định đình chỉ
  trên cổng thông tin. Quy chế TT NN-TH là Thông tư 21/2018/TT-BGDĐT; điều kiện hoạt động theo
  Nghị định 125/2024/NĐ-CP. Nên tỉnh nào cũng có khả năng có danh sách, nhưng định dạng và độ mới
  khác nhau. GĐ2 phải tìm URL cho từng tỉnh; `config.yaml → sgd_sources` đang có 7 tỉnh.
- **Trung tâm không được mở chi nhánh**, nên mỗi cơ sở của một chuỗi (VUS, Apollo…) là một dòng riêng trong
  danh sách Sở. Khi gộp thương hiệu, cần dựa vào đơn vị chủ quản/MST.
- **Sau sáp nhập 1/7/2025**, website Sở của các tỉnh cũ (Quảng Bình, Bắc Giang, Bình Dương…) có thể đã
  chuyển hoặc đóng. Danh sách cũ vẫn dùng được làm nguồn lịch sử. Địa chỉ trong danh sách là địa chỉ cũ,
  nên cần chuẩn hóa (mục 6).
- **Rủi ro kỹ thuật:** PDF scan cần OCR, hiện chỉ ghi nhận để xử lý tay. File `.xls`/`.doc` đời cũ chưa đọc
  tự động; nếu gặp nhiều sẽ bổ sung ở GĐ1. Bảng Excel thường có 2–3 dòng tiêu đề và dòng đánh số cột "(1) (2)…";
  bộ đọc đã xử lý trường hợp này.
- **robots.txt / điều khoản:** chưa đọc được. Đây là cổng thông tin nhà nước công khai; pipeline kiểm tra
  robots.txt trước mỗi domain và sẽ không crawl nếu robots.txt cấm hoặc không truy cập được.

### 2.2 Đăng ký doanh nghiệp (nguồn 2)

- **Cổng quốc gia `dangkykinhdoanh.gov.vn`:** theo NĐ 01/2021 Điều 36, tra cứu miễn phí được tên,
  mã doanh nghiệp (= MST), địa chỉ trụ sở, ngành nghề, **họ tên người đại diện theo pháp luật**, tình trạng
  pháp lý. Cổng chỉ tra từng doanh nghiệp, không có tải hàng loạt. Khoảng 10.000 lượt tra × 2 giây ≈ 6 giờ,
  chấp nhận được nếu được phép. **Chưa kiểm chứng** robots.txt và việc có CAPTCHA hay không. Nếu có CAPTCHA,
  bỏ nguồn này theo quy tắc.
- **Tra cứu của cơ quan thuế (`tracuunnt.gdt.gov.vn`)** có mã xác nhận, nên loại.
- **Trang bên thứ ba** (masothue.com, hosocongty.vn…) chỉ tái xuất bản dữ liệu ĐKDN và thường có chống bot.
  Mặc định đang **tắt** (`enabled: false`). Chỉ bật nếu anh/chị đồng ý và sau khi đã đọc điều khoản.
- **SĐT/email người đại diện** không có trong phần công khai miễn phí. Vì vậy, theo quy tắc của anh/chị,
  liên hệ cá nhân thực tế chỉ đến từ website trung tâm.
- **Mã ngành:** VSIC 2025 (QĐ 36/2025/QĐ-TTg, hiệu lực 15/11/2025) thay VSIC 2018. Mã **8559** "Giáo dục khác
  chưa được phân vào đâu" vẫn giữ. Nhóm 855 có 8551 (thể thao), 8552 (văn hóa nghệ thuật), 8553, 8554 (dự bị
  đại học), 8559. Mã cấp 4 của nhóm 856x (hỗ trợ giáo dục) chưa xác nhận được. Pipeline nhận cả mã cũ lẫn mới.

### 2.3 Google Places API (New) (nguồn 3)

- **Kết nối:** từ môi trường này gọi `places.googleapis.com` được; hiện bị từ chối chỉ vì thiếu key.
- **Text Search:** `POST /v1/places:searchText`, bắt buộc field mask, tối đa 20 kết quả/trang. Phân trang bằng
  `nextPageToken`, và **phải liệt kê `nextPageToken` trong field mask** thì mới nhận được token. Theo tài liệu,
  mỗi truy vấn trả tối đa khoảng 60 kết quả, nên phải quét theo xã/phường; con số này sẽ xác minh ở GĐ1.
  Mỗi truy vấn ghép thêm tên xã/phường + tỉnh, ví dụ `"trung tâm tiếng Anh Phường Cầu Giấy Hà Nội"`,
  nên không cần dữ liệu toạ độ.
- **Lọc theo loại:** `includedType` (Table A) chỉ có `school`, `primary_school`, `secondary_school`,
  `university`, `library`, `preschool`; không có loại riêng cho trung tâm ngoại ngữ. Vì vậy pipeline lọc
  liên quan bằng tên + từ khóa trong `config.yaml`, không lọc theo `type`.
- **Field theo bậc giá** (request tính theo field đắt nhất trong mask):
  - Pro: `id, displayName, formattedAddress, location, types, primaryType, businessStatus, googleMapsUri`
  - Enterprise: thêm `nationalPhoneNumber, websiteUri, rating, userRatingCount`
- **Bảng giá** áp dụng từ 01/03/2025 (bậc 0–100.000 request/tháng). Hạn mức miễn phí tính riêng từng SKU,
  theo tháng. Cần đối chiếu lại trang giá chính thức trước khi chạy toàn quốc.

  | SKU | USD / 1.000 | Miễn phí / tháng |
  |---|---|---|
  | Text Search IDs only | 0 | không giới hạn |
  | Text Search Pro | 32 | 5.000 |
  | Text Search Enterprise | 35 | 1.000 |
  | Place Details Essentials | 5 | 10.000 |
  | Place Details Pro | 17 | 5.000 |
  | Place Details Enterprise | 20 | 1.000 |

- **Điều khoản lưu trữ:**
  - `place_id` được lưu vô thời hạn. Google khuyến nghị làm mới ID cũ hơn 12 tháng; làm mới miễn phí bằng
    Place Details chỉ lấy field `id`.
  - lat/lng được cache tối đa 30 ngày.
  - Nội dung khác không được lưu ngoài cache tạm.

  Pipeline đã làm theo: `branches.place_id` lưu lâu dài; nội dung Places nằm trong `places_cache` có hạn
  30 ngày; lệnh `purge-places-cache` xóa phần quá hạn.

### 2.4 Website trung tâm (nguồn 4) và fanpage (nguồn 5)

- **Trang đọc:** trang chủ, cộng tối đa 7 trang được chấm điểm theo URL/nhãn (Giới thiệu, Liên hệ,
  Hệ thống cơ sở, Tuyển dụng). Footer đã có sẵn trong mỗi trang.
- **Trường lấy được:**
  - hotline (`tel:` + văn bản), email chung, URL fanpage;
  - địa chỉ các cơ sở (dòng "Cơ sở N: …");
  - người đại diện (Giám đốc/Founder… kèm SĐT/email nếu ghi ngay cạnh);
  - câu tự công bố quy mô, năm thành lập;
  - ngày hoạt động gần nhất (meta `article:modified_time`, ngày trên trang);
  - online/offline/hybrid, môn học;
  - website bị park hay chết.
- **Rủi ro:**
  - Site render bằng JS (Wix, SPA) chỉ đọc được khi bật Playwright (`crawl.use_playwright`).
  - Nhiều trung tâm nhỏ chỉ có fanpage, không có website. Dự kiến tỷ lệ có website ở nhóm nhỏ thấp
    (30–50%); con số thật sẽ đo ở GĐ1.
- **Fanpage:** chỉ ghi URL tìm thấy trên website, đã chuẩn hóa và bỏ link chia sẻ/plugin. Không truy cập Facebook/Zalo.

## 3. Trường nào lấy từ nguồn nào

✓ = nguồn chính · ~ = có khi có · (tạm) = chỉ cache ≤ 30 ngày theo điều khoản Google · — = không có

| Trường | Sở GD&ĐT | ĐKDN | Places | Website |
|---|---|---|---|---|
| brand_name | ✓ (tên TT) | — | ✓ (tạm) | ✓ |
| legal_entity_name | ✓ (đơn vị chủ quản) | ✓ | — | ~ (footer) |
| tax_code | ~ | ✓ | — | ~ (footer "MST/GPKD") |
| category, subjects | ~ (loại danh sách) | ~ (mã ngành) | ~ (tên) | ✓ |
| delivery_mode + evidence | — | — | — | ✓ |
| province_new, full_address_hq | ✓ | ✓ (trụ sở pháp nhân) | ✓ (tạm) | ✓ |
| num_branches | ~ (đếm TT cùng chủ quản) | — | ~ (đếm place) | ✓ |
| website | — | — | ✓ (Enterprise) → xác minh bằng crawl | — |
| fanpage_url | — | — | — | ✓ (duy nhất) |
| hotline | ✓ | — | ✓ (tạm, Enterprise) | ✓ |
| general_email | — | — | — | ✓ |
| owner_name, owner_title | ✓ (Giám đốc TT) | ✓ (người đại diện PL) | — | ~ |
| scale_* | ~ (nếu QĐ ghi quy mô) | — | ~ (userRatingCount, tạm) | ✓ (tự công bố, số cơ sở/GV) |
| operating_status + evidence | ✓ (có trong DS mới / đình chỉ) | ✓ | ✓ (businessStatus) | ✓ (HTTP 200, ngày hoạt động) |
| last_activity_date | — | — | — | ✓ |
| license_number/date/issuer | ✓ (duy nhất) | — | — | ~ |
| contacts_personal | — | ~ (chỉ tên) | — | ✓ (công khai trên site) |
| branches.place_id | — | — | ✓ (lưu lâu dài) | — |

## 4. Ước tính tổng số trung tâm toàn quốc

| Số liệu | Giá trị | Nguồn |
|---|---|---|
| TT NN-TH cả nước, năm học 2025-2026 | 8.978 | Bộ GD&ĐT (báo Giáo dục & Thời đại) |
| TT giáo dục kỹ năng sống | 1.312 | như trên |
| Lượt học viên NN-TH | 1.389.828 (~155 lượt/TT) | như trên |
| TP.HCM (sau sáp nhập), TT được cấp phép | 1.961 (158 có vốn nước ngoài), 8/2025 | Sở GD&ĐT TP.HCM qua báo chí |
| Hà Nội | ~1.054 (chưa rõ thời điểm); 947 năm 2020 | báo chí |
| TT NN-TH năm học 2018-2019 | 3.974 | Bộ GD&ĐT |

Ước tính:

- **Địa điểm được cấp phép:** khoảng 10.300 (8.978 + 1.312). TP.HCM + Hà Nội chiếm khoảng 1/3.
- **Ngoài danh sách Sở** (luyện thi theo quy định dạy thêm, STEM/lập trình đăng ký như doanh nghiệp):
  giả định **2.000–5.000** địa điểm có quy mô đáng kể. GĐ1 sẽ đo tỷ lệ "có trên Places nhưng không có
  trong danh sách Sở" tại Hà Nội để hiệu chỉnh.
- **Sau gộp thương hiệu** (hệ số 0,6–0,75 vì mỗi cơ sở của chuỗi là một TT riêng):
  **7.000–11.000 dòng `centers`**, **12.000–16.000 dòng `branches`**.
- **Từ 100 học viên:** trung bình chỉ khoảng 155 lượt học viên/TT/năm (có thể báo cáo thiếu), nên phần lớn TT
  nhỏ. Ước **35–50%** đạt mức S trở lên, tức **3.000–5.000 thương hiệu**. Các bản ghi còn lại vẫn giữ,
  đánh dấu `XS` hoặc `unknown`.
- **Pilot Hà Nội** dự kiến khoảng 1.300–1.800 địa điểm; **Điện Biên** vài chục.

## 5. Ước tính chi phí Places API

Chiến lược quét (`config.yaml → google_places.sweep`):

- 1 lượt cấp tỉnh với đủ 15 truy vấn;
- mỗi **phường** (687 phường toàn quốc) đủ 15 truy vấn;
- mỗi **xã** (2.634 xã) 3 truy vấn chính.

Số trang trung bình mỗi truy vấn là giả định (1,6 ở phường, 1,1 ở xã), sẽ hiệu chỉnh ở GĐ1.
Tính bằng `python -m tcpipe estimate-places`.

| Phạm vi | Truy vấn | Request (ước) | Text Search Pro | Text Search Enterprise |
|---|---|---|---|---|
| Hà Nội (51 phường, 75 xã) | 1.005 | ~1.500 | 0 USD | ~17 USD (0 USD nếu chia 2 tháng) |
| Điện Biên (3 phường, 42 xã) | 186 | ~235 | 0 USD | 0 USD |
| Toàn quốc (687 phường, 2.634 xã) | 18.717 | ~26.000 | ~672 USD (1 tháng) · ~512 USD (2 tháng) | ~875 USD (1 tháng) · ~840 USD (2 tháng) |

- **Đề xuất: dùng Text Search Enterprise.** Giá chỉ hơn Pro 3 USD/1.000 request, nhưng có `websiteUri`,
  là đường chính để tìm website của những trung tâm không có trong danh sách Sở, cùng số đánh giá
  (tín hiệu quy mô) và SĐT.
- Phương án "IDs only (miễn phí) rồi Details từng place" **đắt hơn**: 17–20 USD/1.000 *place*, so với
  35 USD/1.000 *request* trả tới 20 place.
- Có trần ngân sách tháng (`monthly_budget_usd`, mặc định 50 USD). Vượt trần thì dừng gọi API.
- Xác minh lại ở GĐ3: tùy số bản ghi cần làm mới. Làm mới `place_id` thì miễn phí.

## 6. Chuẩn hóa địa chỉ theo đơn vị hành chính mới

- Dữ liệu: 34 tỉnh, 3.321 xã/phường (687 phường), khoảng 11.000 quy tắc xã cũ → xã mới.
  Đã đối chiếu: danh sách tỉnh cũ gộp vào từng tỉnh mới khớp Nghị quyết 202/2025/QH15.
- Thử: `12 Võ Văn Tần, P.5, Q.3, TP.HCM` → `12 Võ Văn Tần, Phường Bàn Cờ, Thành phố Hồ Chí Minh`.
  Địa chỉ ghi theo xã mới thì khớp `exact`. Địa chỉ chỉ có quận cũ thì suy ra được tỉnh.
- **Hạn chế:** bộ ánh xạ ghi một xã mới cho mỗi xã cũ. Với xã cũ bị chia cho nhiều xã mới (ví dụ
  Dịch Vọng Hậu, Cầu Giấy), kết quả chỉ chuẩn hóa đến cấp tỉnh (`province_only`). Cách cải thiện ở GĐ1:
  dùng toạ độ Places *tạm thời* để xác định xã theo ranh giới, rồi không lưu toạ độ.

## 7. Đề xuất công thức quy mô

Chi tiết và tham số ở [README](../README.md#công-thức-quy-mô) và `config.yaml → scale`.

- **Đơn vị đề xuất: số học viên đang theo học tại một thời điểm.** Đây là con số gần với "số chỗ"/số tài khoản
  khi bán giải pháp B2B (LMS), và cũng là đại lượng mà số cơ sở / số giáo viên đo trực tiếp.
- **Thứ tự tín hiệu:**
  1. tự công bố (đang học → giữ nguyên; mỗi năm → × 0,5; tích lũy → ÷ số năm × 1,3);
  2. số cơ sở × K theo loại hình (350 / 250 / 200 / 150) và số GV × 25;
  3. số đánh giá Google × 8;
  4. quy mô trong quyết định cấp phép.
- **Thêm bucket `XS` (< 100)** để không phải loại các trung tâm dưới ngưỡng.
- Độ tin cậy high/medium/low theo loại tín hiệu. Khi các tín hiệu lệch nhau từ 2 bậc trở lên thì hạ độ
  tin cậy một bậc. `scale_evidence` ghi đủ câu trích, URL và phép tính.
- **Hiệu chỉnh ở GĐ1:** lấy các trung tâm Hà Nội có cùng lúc từ 2 tín hiệu, tính trung vị các tỷ lệ
  "học viên / cơ sở", "học viên / GV", "học viên / đánh giá" để thay giá trị K, 25, 8.
  Các hệ số hiện tại là giả định khởi điểm, chưa có dữ liệu chống lưng.

## 8. Điều kiện còn thiếu trước GĐ1

1. **Mạng:** đã mở mức truy cập đầy đủ (16/10/2026); pipeline chạy trực tiếp trong môi trường cloud này.
2. **API key:** chưa có `GOOGLE_PLACES_API_KEY`. Cần key có bật Places API (New), đặt vào biến môi trường của
   môi trường cloud. Nên giới hạn key theo API và đặt cảnh báo ngân sách trong Google Cloud.
3. **Email liên hệ** cho User-Agent: `CRAWLER_CONTACT_EMAIL` (hiện là `not-configured`).
4. **Danh sách Hà Nội:** cần anh/chị quyết định cách lấy (mục 9, câu 1).

## 9. Cần anh/chị quyết định

1. **Danh sách Sở GD&ĐT Hà Nội** (file trên `quantrisgd.shieldix.app`, bị robots.txt chặn toàn bộ):
   - **(A, đề xuất)** Anh/chị tải tay 2–3 file Excel mới nhất từ trang của Sở rồi gửi tôi. Người dùng tải file
     công khai không phải crawler. Tôi sẽ thêm lệnh nhập file cục bộ, ghi `source_url` là trang của Sở.
   - **(B)** Anh/chị cho phép ngoại lệ robots.txt riêng cho host này (vài file, tải một lần). Phương án này đi
     ngược quy tắc anh/chị đặt ra nên tôi không tự làm.
2. **Dữ liệu Google trong kết quả cuối:**
   - **(A, đề xuất)** Google chỉ dùng để *khám phá và xác minh*. DB/Excel lâu dài chỉ giữ `place_id` (kèm link
     Google Maps tạo từ `place_id`) cùng dữ liệu đã xác minh từ Sở/ĐKDN/website.
   - **(B)** Xuất kèm SĐT/địa chỉ/số đánh giá từ Google, ghi rõ "nguồn Google, hết hạn sau 30 ngày", và tự xóa
     sau hạn. Phương án này rủi ro điều khoản cao hơn.
3. **Bậc Places:** Enterprise (~840–875 USD toàn quốc, đề xuất) hay Pro (~510–670 USD, mất website/SĐT/số đánh giá
   từ Google)? Ngân sách tháng tối đa là bao nhiêu?
4. **Định nghĩa quy mô:** "đang theo học tại một thời điểm" (đề xuất) hay "học viên mỗi năm"? Đồng ý thêm bucket `XS` (< 100)?
5. **Trang ĐKDN bên thứ ba:** masothue.com đã bị loại vì điều khoản cấm robot. Có thử tra MST trên cổng quốc gia
   `dangkykinhdoanh.gov.vn` ở GĐ1 không (khoảng 2 giây/lượt; dừng ngay nếu gặp CAPTCHA)?
6. **Tỉnh nhỏ thử nghiệm:** Điện Biên (đề xuất) hay Sơn La (có cổng dữ liệu mở)?
7. **SĐT trong danh sách Sở:** theo yêu cầu (đã thống nhất với pháp chế), file xuất đưa tên + SĐT di động của
   giám đốc vào `contacts_personal` và vẫn dùng làm hotline của trung tâm. Cột `source_type` cho biết liên hệ
   lấy từ danh sách Sở hay từ website.

**Lưu ý pháp lý (không thay tư vấn luật):** Luật Bảo vệ dữ liệu cá nhân 2025 (số 91/2025/QH15, hiệu lực
1/1/2026, thay NĐ 13/2023) cấm mua bán dữ liệu cá nhân. Dùng dữ liệu cá nhân cho tiếp thị phải đáp ứng điều kiện
luật định. Bảng `contacts_personal` đã tách riêng, có `source_url`, xóa được theo trung tâm. Nên hỏi bộ phận pháp
chế trước khi dùng bảng này để tiếp cận khách hàng.

## Nguồn tham khảo

- Sở GD&ĐT Hà Nội: [danh sách TT NN-TH 10/2025](https://hanoi.edu.vn/trung-tam-ngoai-truong/danh-sach-trung-tam-ngoai-ngu-tin-hoc-tinh-den-thang-102025/ctmb/1099/16600), [Dịch vụ giáo dục được cấp phép](https://hanoi.edu.vn/dich-vu-giao-duc-duoc-cap-phep/cmb/1120)
- [Sở GD&ĐT Điện Biên — thông báo 5/2025](http://dienbien.edu.vn/index.php/laws/detail/Thong-bao-cac-trung-tam-ngoai-ngu-tin-hoc-co-so-giao-duc-ky-nang-song-to-chuc-tu-van-du-hoc-duoc-cho-phep-thanh-lap-hoat-dong-tinh-den-thang-5-nam-2025-528/) · [Sơn La — dữ liệu mở](https://data.sonla.gov.vn/detail_data/du-lieu-danh-sach-cac-trung-tam-dao-tao-ngoai-ngu-tren-dia-ban) · [Quảng Ninh — PDF 12/2024](https://www.quangninh.gov.vn/so/sogiaoducdaotao/Lists/TinTuc/Attachments/6164/12.2024%20danh%20sach%20TTNNTH%20(1).pdf) · [Quảng Trị — 11/2024](https://quangtri.edu.vn/trang-chu/tu-van-du-hoc/ngoai-ngu-tin-hoc/danh-sach-trung-tam-ngoai-ngu-tin-hoc-11.2024.html)
- [Website các Sở GD&ĐT phải công khai danh sách TT NN-TH được cấp phép (VietNamNet)](https://vietnamnet.vn/website-cac-so-gddt-phai-cong-khai-danh-sach-trung-tam-ngoai-ngu-tin-hoc-duoc-cap-phep-i36228.html)
- [Số liệu toàn quốc năm học 2025-2026 (Giáo dục & Thời đại)](https://giaoducthoidai.vn/giao-duc-thuong-xuyen-nang-chat-luong-mo-rong-co-hoi-hoc-tap-suot-doi-post787045.html) · [3.974 TT năm 2018-2019](http://anhp.vn/ca-nuoc-tang-1121-trung-tam-ngoai-ngu-tin-hoc-chi-sau-1-nam-d31083.html)
- [TP.HCM gần 2.000 TT NN-TH được cấp phép (Tạp chí Kinh tế - Tài chính)](https://tapchikinhtetaichinh.vn/tp-ho-chi-minh-co-gan-2000-trung-tam-ngoai-ngu-tin-hoc-duoc-cap-phep-63826.html) · [PLO](https://plo.vn/gan-2000-trung-tam-ngoai-ngu-tin-hoc-duoc-cap-phep-mot-so-noi-quang-cao-sai-su-that-post872241.html)
- [Dạy thêm ngoài nhà trường phải đăng ký kinh doanh từ 14/02/2025 (LuatVietnam)](https://luatvietnam.vn/tin-van-ban-moi/day-them-ngoai-nha-truong-phai-dang-ky-kinh-doanh-tu-14-02-2025-186-100584-article.html)
- [Mã ngành cấp 4 lĩnh vực giáo dục từ 15/11/2025 (Thư Viện Pháp Luật)](https://thuvienphapluat.vn/hoi-dap-phap-luat/danh-muc-ma-nganh-cap-4-linh-vuc-giao-duc-va-dao-tao-tu-15112025-the-nao-138065368.html) · [KPMG — QĐ 36/2025](https://assets.kpmg.com/content/dam/kpmg/vn/pdf/2025/11/legal-update-decision-36-en.pdf)
- Google: [thay đổi giá 3/2025](https://developers.google.com/maps/billing-and-pricing/march-2025), [bảng giá](https://developers.google.com/maps/billing-and-pricing/pricing), [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search), [Place Types](https://developers.google.com/maps/documentation/places/web-service/place-types), [chính sách Places](https://developers.google.com/maps/documentation/places/web-service/policies), [Place ID](https://developers.google.com/places/place-id), [Service Specific Terms](https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20250501), [bảng tính bên thứ ba](https://openplacesapi.com/google-places-api-cost-calculator)
- [Luật Bảo vệ dữ liệu cá nhân hiệu lực 1/1/2026 (Cổng TTĐT Hà Tĩnh)](https://hatinh.gov.vn/vi/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-112026)
- [quangtam/vietnam-address-database (MIT)](https://github.com/quangtam/vietnam-address-database)
