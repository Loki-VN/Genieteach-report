# Trung tâm đào tạo ngoài nhà trường — pipeline dữ liệu

Thu thập, làm sạch, xác minh dữ liệu các trung tâm ngoại ngữ, luyện thi, tin học/STEM, kỹ năng
tại 34 tỉnh/thành (đơn vị hành chính từ 01/7/2025). Kết quả cuối: SQLite + Excel đã khử trùng lặp;
mỗi bản ghi có URL nguồn.

Trạng thái: **GĐ0 — khảo sát nguồn**. Báo cáo: [`docs/GD0-khao-sat-nguon.md`](docs/GD0-khao-sat-nguon.md).

## Cài đặt và chạy

Yêu cầu Python 3.11+ và máy có Internet ra các website `.gov.vn`, `.edu.vn` và website trung tâm.

```bash
cd training-centers
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # điền GOOGLE_PLACES_API_KEY, CRAWLER_CONTACT_EMAIL

python -m tcpipe init-db                                   # tạo data/centers.sqlite
python -m tcpipe estimate-places --province "Hà Nội"       # ước tính request + chi phí, không gọi API
python -m tcpipe probe --province "Hà Nội"                 # GĐ0: thử từng nguồn cho 1 tỉnh
python -m tcpipe probe --province "Điện Biên" --sources sgd,registry
python -m tcpipe normalize-address "12 Võ Văn Tần, P.5, Q.3, TP.HCM"
python -m tcpipe purge-places-cache                        # xóa nội dung Google quá hạn lưu
python -m tcpipe build                                     # gộp bản ghi nguồn → centers/branches/contacts_personal
python -m tcpipe export                                    # build + xuất data/exports/trung-tam-<ngày>.xlsx
python -m pytest -q                                        # test chạy offline
```

`probe` ghi `reports/gd0/<mã tỉnh>/probe.json` và `summary.md`; log ở `logs/pipeline.log`,
lỗi ở `logs/errors.log`. Tiến độ từng tỉnh × nguồn nằm ở bảng `checkpoints` để chạy lại từ chỗ dừng.

## Cấu trúc

```
config.yaml                 Loại hình + từ khóa, URL nguồn Sở theo tỉnh, tham số Places, công thức quy mô
.env.example                GOOGLE_PLACES_API_KEY, CRAWLER_CONTACT_EMAIL
tcpipe/
  http.py                   Crawl lịch sự: robots.txt, ≥2s/domain, retry backoff, cache thô, phát hiện chặn bot
  db.py, schema.sql         SQLite: centers, branches, contacts_personal, source_records, places_cache, checkpoints
  admin_units.py            34 tỉnh / 3.321 xã; chuẩn hóa địa chỉ cũ → mới (data/admin_units.json.gz)
  normalize.py              SĐT, email, domain, fanpage, khóa tên cho fuzzy match
  classify.py               category/subjects, online/offline/hybrid
  scale.py                  Trích tín hiệu quy mô + quy đổi bucket
  status.py                 Suy ra operating_status
  probe.py                  Khảo sát GĐ0 (lưu bản ghi thô vào source_records, nhật ký vào source_log)
  build.py                  Khử trùng lặp + gộp thương hiệu → centers / branches / contacts_personal
  export.py                 Xuất Excel: centers, branches, contacts_personal + dữ liệu thô + nhật ký nguồn
  sources/
    sgd.py                  Nguồn 1 — danh sách/quyết định Sở GD&ĐT (HTML, Excel, PDF)
    business_registry.py    Nguồn 2 — ĐKDN (GĐ0 chỉ khảo sát robots/CAPTCHA/điều khoản)
    google_places.py        Nguồn 3 — Places API (New): Text Search, Details, đếm chi phí, chặn ngân sách
    websites.py             Nguồn 4+5 — website trung tâm và URL fanpage trên website
tools/build_admin_units.py  Đóng gói dữ liệu ĐVHC từ quangtam/vietnam-address-database (MIT)
tests/                      Test offline (mock HTTP)
```

## Quy tắc tuân thủ

- **Crawl:** tôn trọng robots.txt (RFC 9309: 4xx → được phép, 5xx/không truy cập được → không crawl),
  tối thiểu 2 giây/request/domain (lấy `Crawl-delay` nếu lớn hơn), User-Agent có email liên hệ,
  retry 2s/4s/8s/16s cho lỗi mạng/429/5xx. Gặp CAPTCHA, trang thử thách chống bot, yêu cầu
  đăng nhập → ghi log và bỏ qua; không vượt.
- **Google Places:** chỉ dùng API, không scrape Google Maps. Chỉ `place_id` được lưu lâu dài
  (`branches.place_id`); nội dung khác nằm trong `places_cache` và bị xóa sau
  `google_places.content_cache_days` ngày. Có trần ngân sách tháng (`monthly_budget_usd`).
- **Facebook/Zalo:** không crawl. Chỉ ghi URL fanpage xuất hiện trên website trung tâm.
- **Liên hệ cá nhân** (`contacts_personal`): chỉ khi tên + chức danh + SĐT/email cùng được công bố
  công khai trên website trung tâm (hoặc ĐKDN công khai), bắt buộc `source_url`. Không đoán email
  theo mẫu, không dùng dịch vụ tra cứu/mua bán dữ liệu cá nhân, không lấy từ mạng xã hội cá nhân.
  Email/SĐT gắn với một người cụ thể không bị đưa vào hotline/email chung.

## Công thức quy mô

Đơn vị: **số học viên đang theo học tại một thời điểm** (đề xuất, chờ xác nhận ở GĐ0).
Tham số ở `config.yaml → scale`; sẽ hiệu chỉnh trên dữ liệu pilot ở GĐ1.

| Bucket | Học viên |
|---|---|
| XS | < 100 (dưới ngưỡng mục tiêu, vẫn giữ để lọc) |
| S | 100 – 499 |
| M | 500 – 1.999 |
| L | 2.000 – 4.999 |
| XL | 5.000 – 19.999 |
| XXL | ≥ 20.000 |
| unknown | chưa có tín hiệu — **không loại bản ghi** |

Chọn tín hiệu đầu tiên có được theo thứ tự ưu tiên:

1. **Tự công bố** (trích câu + URL):
   - "đang theo học / hiện có X học viên" → `X` — tin cậy *high*
   - "X học viên mỗi năm" → `X × 0,5` — *high*
   - "đã đào tạo X học viên" hoặc không rõ ngữ cảnh (coi là tích lũy) →
     `X ÷ số năm hoạt động × 1,3` — *medium*; không biết năm thành lập thì chia 8 năm — *low*
2. **Số cơ sở, số giáo viên:**
   - cơ sở (chỉ khi ≥ 2): `số cơ sở × K`, K = 350 (ngoại ngữ), 250 (luyện thi), 200 (tin học-STEM), 150 (kỹ năng/khác)
   - giáo viên: `số GV × 25`
   - có cả hai: trung bình nhân `√(cơ sở×K × GV×25)` — *medium*; chỉ cơ sở: *medium* nếu ≥ 5 cơ sở, ngược lại *low*; chỉ GV: *low*
3. **Đánh giá Google:** `tổng userRatingCount các cơ sở × 8` — *low*
4. **Quyết định cấp phép:** quy mô ghi trong quyết định — *low*

Kiểm tra chéo: nếu một tín hiệu khác cho bucket lệch ≥ 2 bậc so với tín hiệu chính thì hạ độ tin
cậy một bậc và ghi cảnh báo vào `scale_evidence`. `scale_evidence` luôn ghi phép tính, ví dụ:
`Tự công bố/năm: «…Mỗi năm có trên 8.000 học viên…» (https://…) × 0.5 → 4.000 → L`.

## Tình trạng hoạt động

1. ĐKDN giải thể / đóng MST, hoặc Sở thu hồi → `closed`; ĐKDN tạm ngừng hoặc Sở đình chỉ → `suspended`.
2. Places `CLOSED_PERMANENTLY` / `CLOSED_TEMPORARILY` mà không có tín hiệu tích cực gần đây khác → `closed` / `suspended`.
3. ≥ 2 tín hiệu tích cực độc lập, trong đó ≥ 1 trong 12 tháng gần nhất → `active`
   (Places OPERATIONAL, có trong danh sách Sở cập nhật ≤ 12 tháng, ĐKDN đang hoạt động,
   website HTTP 200 không bị park, hoạt động gần nhất ≤ 12 tháng).
4. ≥ 1 tín hiệu tích cực → `likely_active`; còn lại → `unknown`. `status_evidence` luôn liệt kê các tín hiệu.

## Khử trùng lặp

Khóa khớp theo thứ tự (`tcpipe/build.py`):
1. MST;
2. domain website (bỏ `www.`, bỏ host mạng xã hội/host dùng chung);
3. SĐT đã chuẩn hóa **kèm** tên tương tự ≥ 60. SĐT trong danh sách Sở thường là số của giám đốc, mà một người
   có thể đứng tên nhiều trung tâm;
4. tên thương hiệu trong cùng tỉnh, so khớp `rapidfuzz` ≥ 92.

Tên thương hiệu được chuẩn hóa trước khi so: bỏ từ chung ("trung tâm", "ngoại ngữ", "công ty TNHH"…), bỏ phần
"chi nhánh …/cơ sở …", bỏ địa danh và số thứ tự ở cuối ("Shelton Hạ Long" → "shelton"), và lấy tên mới khi Sở
ghi "đổi tên thành". Các cơ sở của cùng thương hiệu gộp về một dòng `centers`, danh sách cơ sở ở `branches`.
Lưu ý: theo quy chế TT NN-TH, mỗi cơ sở của một chuỗi thường được cấp phép như một trung tâm riêng,
nên danh sách Sở cần gộp theo đơn vị chủ quản/MST.

## Dữ liệu đơn vị hành chính

`tcpipe/data/admin_units.json.gz` đóng gói từ
[quangtam/vietnam-address-database](https://github.com/quangtam/vietnam-address-database) (MIT):
34 tỉnh, 3.321 xã/phường, ~11.000 quy tắc xã cũ → xã mới. Bộ ánh xạ ghi một xã mới cho mỗi xã cũ;
xã cũ bị chia cho nhiều xã mới thì kết quả chỉ đến cấp tỉnh (`confidence = province_only`).
