from datetime import date

from tcpipe.scale import Claim, bucket_of, estimate_scale, extract_claims, extract_founded_year

TEXT = ("Được thành lập năm 2012, Anh ngữ ABC đã đào tạo hơn 50.000 học viên. Hiện hệ thống có 12 cơ sở "
        "với đội ngũ hơn 300 giáo viên. Mỗi năm có trên 8.000 học viên theo học. Cơ sở vật chất hiện đại.")


def test_extract_claim_kinds():
    kinds = {(c.kind, c.value) for c in extract_claims(TEXT, "https://abc.edu.vn")}
    assert ("learners_cumulative", 50000) in kinds
    assert ("learners_annual", 8000) in kinds
    assert ("branches", 12) in kinds and ("teachers", 300) in kinds
    assert extract_founded_year(TEXT) == 2012


def test_number_formats():
    values = {c.value for c in extract_claims("Hơn 1,2 triệu lượt học viên; 5k+ students; 2 500 học sinh")}
    assert {1_200_000, 5000, 2500} <= values


def test_buckets(cfg):
    b = cfg["scale"]["buckets"]
    assert [bucket_of(v, b) for v in (None, 50, 100, 499, 500, 2000, 5000, 20000, 20001)] == \
        ["unknown", "XS", "S", "S", "M", "L", "XL", "XXL", "XXL"]


def test_self_declared_has_priority(cfg):
    r = estimate_scale(extract_claims(TEXT, "u"), cfg["scale"], category="ngoai_ngu", founded_year=2012)
    assert r.method == "self_annual" and r.estimate == 4000 and r.bucket == "L" and r.confidence == "high"


def test_cumulative_uses_years(cfg):
    claims = [Claim("learners_cumulative", 26000, "đã đào tạo 26.000 học viên")]
    r = estimate_scale(claims, cfg["scale"], founded_year=2016, today=date(2026, 6, 1))
    assert r.estimate == round(26000 / 10 * 1.3) and r.confidence == "medium"
    r2 = estimate_scale(claims, cfg["scale"], today=date(2026, 6, 1))
    assert r2.confidence == "low"


def test_branches_need_at_least_two(cfg):
    assert estimate_scale([], cfg["scale"], num_branches=1).bucket == "unknown"
    r = estimate_scale([], cfg["scale"], category="ngoai_ngu", num_branches=6)
    assert (r.estimate, r.bucket, r.confidence) == (2100, "L", "medium")


def test_disagreement_downgrades_confidence(cfg):
    claims = [Claim("learners_current", 300, "hiện có 300 học viên")]
    r = estimate_scale(claims, cfg["scale"], category="ngoai_ngu", num_branches=40)
    assert r.bucket == "S" and r.confidence == "medium" and r.notes


def test_reviews_only_low(cfg):
    r = estimate_scale([], cfg["scale"], google_reviews_total=120)
    assert (r.estimate, r.bucket, r.confidence) == (960, "M", "low")


def test_ignores_hotline_tail_and_teacher_or_class_level_numbers():
    text = ("Bắt đầu học 1800 646448 Student Login. Thầy Rick 4 năm giảng dạy · Đồng hành cùng hơn 1.600 học viên. "
            "Lớp học quy mô lên đến 20 học viên. Cộng đồng 219.364+ học viên")
    assert [c.value for c in extract_claims(text) if c.kind.startswith("learners")] == [219364]
