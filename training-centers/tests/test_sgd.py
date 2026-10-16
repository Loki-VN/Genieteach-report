import io

from openpyxl import Workbook

from tcpipe.sources.sgd import find_links, html_tables, parse_license, rows_to_records, xlsx_tables


def test_parse_license():
    assert parse_license("QĐ số 1234/QĐ-SGDĐT ngày 12/3/2024") == ("1234/QĐ-SGDĐT", "2024-03-12")
    assert parse_license("Số 56/GP-SGD&ĐT, 05.11.2023") == ("56/GP-SGD&ĐT", "2023-11-05")


def test_find_links():
    html = ('<a href="/files/copy-of-danh-sach-ttnn-ca.xlsx">Tải về</a>'
            '<a href="/x/1">Danh sách các Trung tâm ngoại ngữ, tin học tính đến tháng 9/2025</a>'
            '<a href="/tin-tuc">Tin tức</a>')
    att, lists = find_links(html, "https://hanoi.edu.vn/a/b")
    assert [(a["url"], a["ext"]) for a in att] == [("https://hanoi.edu.vn/files/copy-of-danh-sach-ttnn-ca.xlsx", "xlsx")]
    assert [l["url"] for l in lists] == ["https://hanoi.edu.vn/x/1"]


def test_xlsx_with_title_rows_and_header_detection():
    wb = Workbook()
    ws = wb.active
    ws.append(["SỞ GIÁO DỤC VÀ ĐÀO TẠO"])
    ws.append(["DANH SÁCH TRUNG TÂM NGOẠI NGỮ, TIN HỌC"])
    ws.append(["STT", "Tên trung tâm", "Đơn vị chủ quản", "Địa chỉ", "Họ tên Giám đốc", "Điện thoại",
               "Số, ngày quyết định cho phép hoạt động"])
    ws.append(["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)"])
    ws.append([1, "Trung tâm Ngoại ngữ ABC", "Công ty TNHH Giáo dục ABC", "Số 5 Láng Hạ, Q. Đống Đa, Hà Nội",
               "Nguyễn Văn A", "024.3851.2345", "1234/QĐ-SGDĐT ngày 12/3/2024"])
    buf = io.BytesIO()
    wb.save(buf)
    (rows,) = xlsx_tables(buf.getvalue())
    recs, meta = rows_to_records(rows, "https://x/file.xlsx", "01", "Sở GD&ĐT Hà Nội")
    assert meta["header_row"] == 2 and len(recs) == 1
    r = recs[0]
    assert (r.center_name, r.legal_entity_name, r.director_name, r.phone) == \
        ("Trung tâm Ngoại ngữ ABC", "Công ty TNHH Giáo dục ABC", "Nguyễn Văn A", "02438512345")
    assert (r.license_number, r.license_date) == ("1234/QĐ-SGDĐT", "2024-03-12")


def test_html_table_columns():
    html = ("<table><tr><th>TT</th><th>Huyện (TX, TP)</th><th>Tên Trung tâm</th><th>Địa chỉ</th>"
            "<th>Công ty chủ quản</th><th>Quyết định cho phép</th></tr>"
            "<tr><td>1</td><td>TP Hạ Long</td><td>TT Anh ngữ XYZ</td><td>12 Lê Thánh Tông</td>"
            "<td>Công ty CP XYZ</td><td>QĐ 88/QĐ-SGDĐT ngày 1/2/2023</td></tr></table>")
    (rows,) = html_tables(html)
    recs, meta = rows_to_records(rows, "u", "22")
    assert recs[0].district == "TP Hạ Long" and recs[0].legal_entity_name == "Công ty CP XYZ"
    assert recs[0].license_number == "88/QĐ-SGDĐT"


def test_find_links_download_query_and_sidebar_ranking():
    page = "https://dienbien.edu.vn/index.php/laws/detail/Thong-bao-528/"
    html = ('<a href="/uploads/lich-tcd-2024.pdf">Lịch tiếp công dân năm 2024</a>'
            '<a href="/index.php/laws/detail/Thong-bao-528/?download=1&amp;id=0"><img></a>'
            '<a href="/index.php/laws/detail/Thong-bao-528/?download=1&amp;id=0">Tải về</a>'
            '<a href="/x"><img></a><a href="/x">Danh sách các ngoại ngữ, tin học tháng 9/2025</a>')
    att, lists = find_links(html, page)
    assert att[0]["url"].endswith("?download=1&id=0") and att[0]["score"] > 0
    assert att[-1]["url"].endswith("lich-tcd-2024.pdf") and att[-1]["score"] < 0
    assert [l["url"] for l in lists] == ["https://dienbien.edu.vn/x"]
