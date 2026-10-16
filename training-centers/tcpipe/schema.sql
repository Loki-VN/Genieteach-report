-- Schema SQLite. Danh sách (subjects, source_urls…) lưu dạng JSON text.

CREATE TABLE IF NOT EXISTS centers (
    center_id               TEXT PRIMARY KEY,
    brand_name              TEXT,
    legal_entity_name       TEXT,
    tax_code                TEXT,
    category                TEXT,          -- ngoại ngữ | luyện thi | tin học-STEM | kỹ năng | khác
    subjects                TEXT,          -- JSON list
    delivery_mode           TEXT,          -- online | offline | hybrid | unknown
    delivery_mode_evidence  TEXT,
    province_new            TEXT,
    full_address_hq         TEXT,
    num_branches            INTEGER,
    website                 TEXT,
    fanpage_url             TEXT,
    hotline                 TEXT,
    general_email           TEXT,
    owner_name              TEXT,
    owner_title             TEXT,
    scale_estimate_learners INTEGER,
    scale_bucket            TEXT,          -- XS | S | M | L | XL | XXL | unknown
    scale_evidence          TEXT,
    scale_confidence        TEXT,          -- low | medium | high
    operating_status        TEXT,          -- active | likely_active | suspended | closed | unknown
    status_evidence         TEXT,
    last_activity_date      TEXT,
    license_number          TEXT,
    license_date            TEXT,
    license_issuer          TEXT,
    source_urls             TEXT NOT NULL, -- JSON list, bắt buộc có ít nhất 1 URL
    first_seen_at           TEXT NOT NULL,
    last_verified_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_centers_tax ON centers(tax_code);
CREATE INDEX IF NOT EXISTS idx_centers_province ON centers(province_new);

CREATE TABLE IF NOT EXISTS branches (
    branch_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id           TEXT NOT NULL REFERENCES centers(center_id) ON DELETE CASCADE,
    branch_name         TEXT,
    address_raw         TEXT,
    address_normalized  TEXT,
    province_new        TEXT,
    ward_new            TEXT,
    phone               TEXT,
    place_id            TEXT,              -- Google place_id: được phép lưu lâu dài
    source_url          TEXT
);
CREATE INDEX IF NOT EXISTS idx_branches_center ON branches(center_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_place ON branches(place_id) WHERE place_id IS NOT NULL;

-- Liên hệ cá nhân: tách riêng để lọc/xóa; chỉ từ website trung tâm hoặc ĐKDN công khai.
CREATE TABLE IF NOT EXISTS contacts_personal (
    contact_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id    TEXT NOT NULL REFERENCES centers(center_id) ON DELETE CASCADE,
    person_name  TEXT,
    title        TEXT,
    phone        TEXT,
    email        TEXT,
    source_url   TEXT NOT NULL,
    collected_at TEXT NOT NULL
);

-- Bản ghi thô từ từng nguồn, trước khi gộp (để truy vết và chạy lại khử trùng lặp).
CREATE TABLE IF NOT EXISTS source_records (
    record_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,            -- sgd | registry | places | website
    province     TEXT,
    source_url   TEXT NOT NULL,
    payload      TEXT NOT NULL,            -- JSON
    fetched_at   TEXT NOT NULL,
    center_id    TEXT                      -- gán sau khi khử trùng lặp
);
CREATE INDEX IF NOT EXISTS idx_records_source ON source_records(source, province);

-- Nội dung Google Places (ngoài place_id) chỉ cache tạm, xóa khi quá hạn (config google_places.content_cache_days).
CREATE TABLE IF NOT EXISTS places_cache (
    place_id     TEXT PRIMARY KEY,
    payload      TEXT NOT NULL,
    fetched_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_usage (
    month        TEXT NOT NULL,            -- YYYY-MM
    sku          TEXT NOT NULL,
    requests     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (month, sku)
);

-- Checkpoint theo tỉnh × nguồn để chạy lại từ chỗ dừng.
CREATE TABLE IF NOT EXISTS checkpoints (
    stage        TEXT NOT NULL,
    province     TEXT NOT NULL,
    source       TEXT NOT NULL,
    status       TEXT NOT NULL,            -- pending | running | done | failed | skipped
    detail       TEXT,
    updated_at   TEXT NOT NULL,
    PRIMARY KEY (stage, province, source)
);

-- Nhật ký từng URL nguồn đã thử (để báo cáo coverage và lỗi).
CREATE TABLE IF NOT EXISTS source_log (
    log_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    province     TEXT,
    source       TEXT NOT NULL,
    url          TEXT NOT NULL,
    outcome      TEXT NOT NULL,            -- ok | blocked | robots_disallow | unreachable | no_data
    records      INTEGER,
    detail       TEXT,
    checked_at   TEXT NOT NULL
);
