/**
 * GenieTeach — Báo cáo Học vụ (prototype)
 * mock-data.js — Sinh BẢN GHI THÔ (raw records) có seed, tái lập được.
 *
 * - Không tính metric ở đây. Chỉ mô phỏng những gì hệ thống thật sẽ lưu.
 * - Mọi mốc thời gian sinh TƯƠNG ĐỐI theo "hôm nay"/"bây giờ" trong config.js.
 * - Kịch bản mục 7 (K01–K30) được "cấy" đè lên mô hình nền; danh sách kịch bản trả về trong
 *   raw.scenarios để GT.debug đối chiếu kịch bản → rule kích hoạt.
 *
 * Mô hình nền: mỗi học sinh có thuộc tính ẩn (năng lực za, độ chăm zd, độ đúng giờ zp, xu hướng vắng zx,
 * xu hướng xin phép exc). Mỗi lớp có hiệu ứng lớp; mỗi chuẩn đầu ra / câu hỏi có độ khó.
 */
window.GT = window.GT || {};
(function (GT) {
  'use strict';
  const DT = GT.date;
  const U = GT.util;
  const MIN = DT.MIN, HOUR = DT.HOUR, DAY = DT.DAY, WEEK = DT.WEEK;

  // =====================================================================================
  // Danh mục tĩnh
  // =====================================================================================
  const GROUPS = [
    { id: 'G10', name: 'Khối 10' },
    { id: 'G11', name: 'Khối 11' },
    { id: 'G12', name: 'Khối 12' },
    { id: 'GTA', name: 'Lớp tiếng Anh tăng cường' }
  ];

  const TEACHERS = [
    ['T01', 'Nguyễn Thị Lan', 'Toán'], ['T02', 'Trần Văn Hải', 'Toán'], ['T03', 'Lê Thị Thu Trang', 'Toán'],
    ['T04', 'Phạm Quốc Bảo', 'Toán'], ['T05', 'Hoàng Minh Đức', 'Vật lý'], ['T06', 'Vũ Thị Hồng Nhung', 'Vật lý'],
    ['T07', 'Đặng Văn Toàn', 'Vật lý'], ['T08', 'Bùi Thị Ngọc Ánh', 'Hóa học'], ['T09', 'Đỗ Minh Quân', 'Hóa học'],
    ['T10', 'Ngô Thị Thanh Hương', 'Hóa học'], ['T11', 'Phan Thị Mai Phương', 'Tiếng Anh'], ['T12', 'Trương Gia Huy', 'Tiếng Anh'],
    ['T13', 'Lý Thu Hà', 'Tiếng Anh'], ['T14', 'Dương Quang Minh', 'Tiếng Anh'], ['T15', 'Hồ Đức Thắng', 'Tin học'],
    ['T16', 'Đinh Thị Kim Oanh', 'Tin học'], ['T17', 'Mai Xuân Trường', 'Tin học'], ['T18', 'Nguyễn Thị Bích Ngọc', 'Ngữ văn'],
    ['T19', 'Trần Quốc Việt', 'Lịch sử'], ['T20', 'Lê Thị Hoài Thu', 'Địa lý'], ['T21', 'Phạm Văn Long', 'Sinh học'],
    ['T22', 'Võ Thị Diệu Linh', 'Ngữ văn'], ['T23', 'Huỳnh Văn Phúc', 'GDCD'], ['T24', 'Nguyễn Hữu Tài', 'Giáo dục thể chất'],
    ['T25', 'Trần Thị Mỹ Dung', 'Công nghệ']
  ];

  /** Khóa học + chuẩn đầu ra (mô tả thực tế theo chương trình GDPT 2018 / IELTS / Python). */
  const COURSES = [
    {
      id: 'TOAN10', name: 'Toán 10', short: 'Toán 10', manualShare: 0.12, maxScore: 10, dueDays: 2,
      los: [
        ['Mệnh đề và tập hợp', 'Xác định tính đúng sai của mệnh đề; thực hiện các phép toán giao, hợp, hiệu trên tập hợp.'],
        ['Bất phương trình bậc nhất hai ẩn', 'Biểu diễn miền nghiệm của hệ bất phương trình bậc nhất hai ẩn và giải bài toán tối ưu đơn giản.'],
        ['Hàm số bậc hai', 'Lập bảng biến thiên, vẽ đồ thị hàm số bậc hai; xác định đỉnh và trục đối xứng.'],
        ['Dấu của tam thức bậc hai', 'Xét dấu tam thức bậc hai và giải bất phương trình bậc hai một ẩn.'],
        ['Phương trình quy về bậc hai', 'Giải phương trình chứa căn thức quy về phương trình bậc hai.'],
        ['Hệ thức lượng trong tam giác', 'Áp dụng định lí côsin, định lí sin và công thức diện tích để giải tam giác.'],
        ['Vectơ', 'Thực hiện phép cộng, trừ vectơ và tích của vectơ với một số; chứng minh đẳng thức vectơ.'],
        ['Tích vô hướng của hai vectơ', 'Tính tích vô hướng của hai vectơ và vận dụng để tính góc, độ dài, chứng minh vuông góc.'],
        ['Phương trình đường thẳng', 'Viết phương trình tham số, phương trình tổng quát của đường thẳng; xét vị trí tương đối.'],
        ['Đường tròn trong mặt phẳng tọa độ', 'Lập phương trình đường tròn và phương trình tiếp tuyến của đường tròn.'],
        ['Thống kê', 'Tính các số đặc trưng đo xu thế trung tâm và độ phân tán của mẫu số liệu không ghép nhóm.'],
        ['Xác suất cổ điển', 'Tính xác suất của biến cố bằng định nghĩa cổ điển, sơ đồ hình cây và quy tắc đếm.']
      ]
    },
    {
      id: 'LY11', name: 'Vật lý 11', short: 'Vật lý 11', manualShare: 0.12, maxScore: 10, dueDays: 2,
      los: [
        ['Dao động điều hòa', 'Mô tả các đại lượng đặc trưng và viết phương trình của dao động điều hòa.'],
        ['Năng lượng dao động, cộng hưởng', 'Giải thích sự chuyển hóa năng lượng; phân biệt dao động tắt dần, cưỡng bức và hiện tượng cộng hưởng.'],
        ['Sóng cơ', 'Mô tả sự truyền sóng; tính bước sóng, chu kì, tần số và tốc độ truyền sóng.'],
        ['Giao thoa và sóng dừng', 'Xác định vị trí cực đại, cực tiểu giao thoa; số nút, số bụng của sóng dừng.'],
        ['Định luật Coulomb', 'Tính lực tương tác giữa các điện tích điểm và tổng hợp lực điện.'],
        ['Điện trường', 'Xác định vectơ cường độ điện trường của điện tích điểm và hệ điện tích; vẽ đường sức.'],
        ['Điện thế và hiệu điện thế', 'Tính công của lực điện, thế năng điện và hiệu điện thế giữa hai điểm.'],
        ['Tụ điện', 'Tính điện dung, điện tích của bộ tụ ghép và năng lượng điện trường trong tụ.'],
        ['Dòng điện không đổi', 'Vận dụng định luật Ohm cho toàn mạch để tính cường độ dòng điện và hiệu điện thế.'],
        ['Năng lượng và công suất điện', 'Tính điện năng tiêu thụ, công suất và hiệu suất của nguồn điện.']
      ]
    },
    {
      id: 'HOA12', name: 'Hóa học 12', short: 'Hóa 12', manualShare: 0.3, maxScore: 10, dueDays: 2,
      los: [
        ['Este – lipit', 'Gọi tên este; viết phương trình thủy phân và phản ứng xà phòng hóa chất béo.'],
        ['Cacbohiđrat', 'Phân biệt glucozơ, saccarozơ, tinh bột, xenlulozơ bằng tính chất hóa học đặc trưng.'],
        ['Amin, amino axit, protein', 'Giải thích tính bazơ của amin, tính lưỡng tính của amino axit và phản ứng màu biure.'],
        ['Polime và vật liệu polime', 'Phân loại polime; viết phương trình phản ứng trùng hợp và trùng ngưng.'],
        ['Đại cương kim loại', 'Vận dụng dãy điện hóa để so sánh tính khử của kim loại và dự đoán phản ứng.'],
        ['Điện phân', 'Viết quá trình ở các điện cực và tính lượng chất theo định luật Faraday.'],
        ['Ăn mòn kim loại', 'Phân biệt ăn mòn hóa học và ăn mòn điện hóa; đề xuất biện pháp chống ăn mòn.'],
        ['Kim loại kiềm, kiềm thổ, nhôm', 'Trình bày tính chất, ứng dụng và phương pháp điều chế kim loại kiềm, kiềm thổ, nhôm.'],
        ['Sắt, crom và hợp chất', 'Viết phương trình phản ứng oxi hóa – khử của sắt, crom và hợp chất.']
      ]
    },
    {
      id: 'IELTS', name: 'IELTS Foundation (Tiếng Anh tăng cường)', short: 'IELTS Foundation', manualShare: 0.5, maxScore: 100, dueDays: 3,
      los: [
        ['Listening – thông tin chi tiết', 'Nghe hiểu thông tin chi tiết (số liệu, tên riêng, thời gian) trong hội thoại hằng ngày.'],
        ['Listening – ý chính', 'Nhận diện ý chính và quan điểm của người nói trong bài độc thoại ngắn.'],
        ['Reading – skimming & scanning', 'Đọc lướt và đọc quét để tìm thông tin trong văn bản 600–800 từ.'],
        ['Reading – True/False/Not Given', 'Xử lý chính xác dạng bài True/False/Not Given.'],
        ['Writing Task 1', 'Mô tả biểu đồ đường, biểu đồ cột với từ vựng chỉ xu hướng phù hợp.'],
        ['Writing Task 2', 'Lập dàn ý và viết đoạn thân bài có luận điểm, giải thích và dẫn chứng.'],
        ['Speaking Part 1', 'Trả lời trôi chảy các câu hỏi về bản thân, gia đình, sở thích.'],
        ['Speaking Part 2', 'Nói liên tục 1–2 phút theo cue card với bố cục rõ ràng.'],
        ['Từ vựng học thuật', 'Sử dụng đúng 300 từ thuộc Academic Word List (sublist 1–3) trong ngữ cảnh.'],
        ['Ngữ pháp câu phức', 'Sử dụng chính xác câu phức, mệnh đề quan hệ và câu điều kiện.']
      ]
    },
    {
      id: 'PY', name: 'Lập trình Python cơ bản', short: 'Python cơ bản', manualShare: 0.12, maxScore: 100, dueDays: 5,
      los: [
        ['Biến và kiểu dữ liệu', 'Khai báo biến, sử dụng và chuyển đổi các kiểu dữ liệu cơ bản (int, float, str, bool).'],
        ['Câu lệnh rẽ nhánh', 'Viết chương trình sử dụng if/elif/else và biểu thức logic.'],
        ['Vòng lặp', 'Sử dụng vòng lặp for/while để giải bài toán lặp và tính tổng, đếm.'],
        ['Danh sách và chuỗi', 'Duyệt, cắt, sắp xếp và xử lý danh sách, chuỗi ký tự.'],
        ['Hàm', 'Định nghĩa hàm có tham số, giá trị trả về và tách chương trình thành các hàm nhỏ.'],
        ['Từ điển và tập hợp', 'Lưu trữ và tra cứu dữ liệu theo khóa bằng dict, loại trùng bằng set.'],
        ['Xử lý tệp', 'Đọc và ghi tệp văn bản, tệp CSV.'],
        ['Gỡ lỗi và kiểm thử', 'Đọc thông báo lỗi, gỡ lỗi từng bước và viết kiểm thử đơn giản.']
      ]
    }
  ];

  // id, tên, nhóm, sĩ số (ban đầu), GVCN
  const CLASSES = [
    ['10A1', '10A1', 'G10', 40, 'T01'], ['10A2', '10A2', 'G10', 38, 'T18'], ['10A3', '10A3', 'G10', 40, 'T02'],
    ['10A4', '10A4', 'G10', 36, 'T19'], ['10A5', '10A5', 'G10', 39, 'T03'], ['10A6', '10A6', 'G10', 37, 'T20'],
    ['11A1', '11A1', 'G11', 39, 'T05'], ['11A2', '11A2', 'G11', 38, 'T21'], ['11A3', '11A3', 'G11', 36, 'T06'],
    ['11A4', '11A4', 'G11', 40, 'T22'], ['11A5', '11A5', 'G11', 35, 'T07'],
    ['12A1', '12A1', 'G12', 38, 'T08'], ['12A2', '12A2', 'G12', 36, 'T23'], ['12A3', '12A3', 'G12', 40, 'T24'],
    ['12A4', '12A4', 'G12', 37, 'T25'], ['12A5', '12A5', 'G12', 34, 'T10'],
    ['TA01', 'TA-01', 'GTA', 20, null], ['TA02', 'TA-02', 'GTA', 18, null], ['TA03', 'TA-03', 'GTA', 16, null],
    ['TA04', 'TA-04', 'GTA', 8, null]
  ];

  /** Thời khóa biểu: classId → [[courseId, teacherId | [gv thứ 3, gv thứ 5], [[thứ (0=T2), ca], …]]]. */
  const TIMETABLE = {
    '10A1': [['TOAN10', 'T01', [[0, 1], [2, 2], [4, 3]]], ['PY', 'T15', [[1, 4]]]],
    '10A2': [['TOAN10', 'T01', [[0, 2], [2, 3], [4, 1]]], ['PY', 'T15', [[3, 4]]]],
    '10A3': [['TOAN10', 'T02', [[0, 1], [3, 1], [5, 2]]]],
    '10A4': [['TOAN10', 'T02', [[1, 2], [3, 2], [5, 1]]]],
    '10A5': [['TOAN10', 'T03', [[1, 1], [3, 1], [4, 2]]]],
    '10A6': [['TOAN10', 'T04', [[0, 3], [2, 1], [3, 3]]]],
    '11A1': [['LY11', 'T05', [[0, 1], [2, 1], [4, 2]]], ['PY', 'T16', [[1, 4]]]],
    '11A2': [['LY11', 'T05', [[1, 1], [3, 2], [5, 1]]], ['PY', 'T16', [[2, 5]]]],
    '11A3': [['LY11', 'T06', [[0, 2], [2, 2], [4, 1]]], ['PY', 'T16', [[3, 4]]]],
    '11A4': [['LY11', 'T06', [[1, 3], [3, 1], [5, 2]]]],
    '11A5': [['LY11', 'T07', [[0, 4], [2, 4], [4, 4]]]],
    '12A1': [['HOA12', 'T08', [[0, 1], [2, 3], [4, 1]]], ['PY', 'T17', [[0, 5]]]],
    '12A2': [['HOA12', 'T08', [[1, 2], [3, 3], [5, 3]]], ['PY', 'T17', [[1, 5]]]],
    '12A3': [['HOA12', 'T09', [[0, 2], [3, 2], [4, 3]]], ['PY', 'T17', [[3, 5]]]],
    '12A4': [['HOA12', 'T09', [[1, 1], [2, 2], [5, 1]]]],
    '12A5': [['HOA12', 'T10', [[0, 3], [2, 4], [4, 2]]]],
    'TA01': [['IELTS', ['T11', 'T14'], [[1, 6], [3, 6]]]],
    'TA02': [['IELTS', 'T12', [[0, 6], [2, 6]]]],
    'TA03': [['IELTS', 'T13', [[1, 6], [4, 6]]]],
    'TA04': [['IELTS', 'T12', [[4, 6], [5, 4]]]]
  };

  /** Khung giờ (ca). */
  const SLOTS = [
    null,
    { id: 1, label: 'Ca 1', start: '07:00', end: '08:30' },
    { id: 2, label: 'Ca 2', start: '08:45', end: '10:15' },
    { id: 3, label: 'Ca 3', start: '10:30', end: '12:00' },
    { id: 4, label: 'Ca 4', start: '13:30', end: '15:00' },
    { id: 5, label: 'Ca 5', start: '15:15', end: '16:45' },
    { id: 6, label: 'Ca 6 (tối)', start: '18:00', end: '19:30' }
  ];

  /** Hiệu ứng lớp (kịch bản). */
  const CLASS_FX = {
    '10A1': { ability: 0.3 },
    '10A3': { lateBase: 0.17 },                                   // K12
    '11A5': { flu: true },                                         // K13
    '12A1': { ability: 0.25 },
    '12A5': { dilig: -0.9, lateHw: 2.4, absMult: 1.15 },           // K17
    'TA01': { absMult: 3.8 }, 'TA02': { absMult: 3.8 }, 'TA03': { absMult: 3.8 }, // K09
    'TA04': { absMult: 5.5, lo: -1.4 }                             // K29
  };
  /** Hiệu ứng điểm nhiệm vụ theo (lớp, khóa). */
  const SCORE_FX = { '11A2|LY11': -1.8 };                          // K18

  // ---- Họ tên tiếng Việt ----
  const SURNAMES = [['Nguyễn', 31], ['Trần', 11], ['Lê', 9], ['Phạm', 7], ['Hoàng', 4], ['Huỳnh', 4], ['Vũ', 4], ['Võ', 4],
    ['Phan', 4], ['Trương', 2], ['Bùi', 3], ['Đặng', 3], ['Đỗ', 3], ['Ngô', 2], ['Hồ', 2], ['Dương', 2], ['Lý', 1],
    ['Đinh', 2], ['Mai', 1], ['Tô', 1], ['Lương', 1], ['Trịnh', 1], ['Đào', 1], ['Cao', 1], ['Lâm', 1]];
  const MID_M = ['Văn', 'Minh', 'Đức', 'Quốc', 'Gia', 'Hoàng', 'Thành', 'Anh', 'Tuấn', 'Hữu', 'Công', 'Bảo', 'Đăng', 'Nhật', 'Trung', 'Văn', 'Minh'];
  const MID_F = ['Thị', 'Ngọc', 'Thu', 'Thanh', 'Minh', 'Khánh', 'Bảo', 'Phương', 'Mai', 'Hồng', 'Gia', 'Diệu', 'Hải', 'Quỳnh', 'Thị', 'Thị'];
  const MID_F2 = ['Thu', 'Ngọc', 'Thanh', 'Minh', 'Phương', 'Kim', 'Bích', 'Mỹ', 'Hoài'];
  const GIVEN_M = ['An', 'Bình', 'Cường', 'Dũng', 'Duy', 'Đạt', 'Hiếu', 'Hùng', 'Huy', 'Khang', 'Khoa', 'Kiên', 'Long', 'Minh',
    'Nam', 'Nghĩa', 'Phát', 'Phong', 'Phúc', 'Quân', 'Quang', 'Sơn', 'Tài', 'Thắng', 'Thịnh', 'Toàn', 'Trí', 'Trung', 'Tùng',
    'Việt', 'Vinh', 'Bảo', 'Hoàng', 'Lâm', 'Nhân', 'Tâm', 'Khôi', 'Đức', 'Tuấn', 'Hải', 'Kiệt', 'Thành'];
  const GIVEN_F = ['Anh', 'Châu', 'Chi', 'Dung', 'Giang', 'Hà', 'Hân', 'Hạnh', 'Hằng', 'Hiền', 'Hoa', 'Hương', 'Huyền', 'Lan',
    'Linh', 'Ly', 'Mai', 'My', 'Nga', 'Ngân', 'Ngọc', 'Nhi', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Thư', 'Trang',
    'Trâm', 'Uyên', 'Vy', 'Yến', 'Diệp', 'Khuê', 'An', 'Tâm', 'Vân', 'Thy'];

  const QUESTION_LEVELS = ['nhận biết', 'thông hiểu', 'vận dụng', 'vận dụng', 'thông hiểu', 'vận dụng cao', 'nhận biết', 'vận dụng'];

  // =====================================================================================
  // Sinh dữ liệu
  // =====================================================================================
  function generate(opt) {
    const NOW = DT.parseDate(opt.today) + DT.parseTime(opt.now);
    const TODAY = DT.startOfDay(NOW);
    const W0 = DT.startOfWeek(TODAY);
    const START = W0 - 15 * WEEK;               // 16 tuần lịch sử (gồm tuần hiện tại)
    const END = W0 + 5 * WEEK - MIN;            // hết Chủ nhật của tuần tương lai thứ 4
    const rel = function (d) { return TODAY + d * DAY; };
    const eod = function (t) { return DT.startOfDay(t) + DAY - MIN; };
    const seed = (opt.seed >>> 0) || 1;

    const rNames = U.rng(seed ^ 0x9e3779b1);
    const rAtt = U.rng(seed ^ 0x2545f491);
    const rOps = U.rng(seed ^ 0x6c8e9cf5);
    const rTask = U.rng(seed ^ 0x1b873593);
    const rOnl = U.rng(seed ^ 0x5bd1e995);
    const rLo = U.rng(seed ^ 0x27d4eb2f);

    const STORM_DAY = rel(-21);                 // K10
    const COURSE_WINDOW = {
      TOAN10: [START, END], LY11: [START, END], HOA12: [START, END],
      IELTS: [START + 2 * WEEK, START + 26 * WEEK - MIN],
      PY: [START + 6 * WEEK, START + 27 * WEEK - MIN]
    };

    function isHoliday(day) {
      const d = new Date(day), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
      return (m === 9 && (dd === 1 || dd === 2)) || (m === 1 && dd === 1) || (m === 4 && dd === 30) || (m === 5 && dd === 1);
    }

    // ------------------------------------------------------------ Danh mục
    const groups = GROUPS.map(function (g) { return { id: g.id, name: g.name }; });
    const teachers = TEACHERS.map(function (t) { return { id: t[0], name: t[1], subject: t[2] }; });
    const classes = CLASSES.map(function (c) { return { id: c[0], name: c[1], groupId: c[2], homeroomTeacherId: c[4] }; });

    const courses = [], los = [], questions = [];
    const loBias = new Map();       // loId → độ khó nền
    const loLearn = new Map();      // loId → hệ số tiến bộ theo thời gian
    const qDiff = new Map();        // questionId → độ khó câu hỏi
    COURSES.forEach(function (c) {
      courses.push({ id: c.id, name: c.name, shortName: c.short, passThreshold: 50, weightTaskCompletion: 0.3, weightTestScore: 0.7 });
      c.los.forEach(function (l, i) {
        const order = i + 1;
        const id = c.id + '-LO' + (order < 10 ? '0' : '') + order;
        const prefix = { TOAN10: 'T10', LY11: 'L11', HOA12: 'H12', IELTS: 'IE', PY: 'PY' }[c.id];
        los.push({ id: id, courseId: c.id, code: prefix + '.' + order, name: l[0], description: l[1], order: order });
        loBias.set(id, rLo.normal(0, 0.45));
        loLearn.set(id, 0.5);
        const nQ = rLo.int(6, 8);
        for (let k = 1; k <= nQ; k++) {
          const qid = id + '-Q0' + k;
          const lvl = QUESTION_LEVELS[(k - 1) % QUESTION_LEVELS.length];
          questions.push({ id: qid, courseId: c.id, loId: id, code: 'Câu ' + k, order: k, text: 'Câu ' + k + ' (' + lvl + '): ' + l[0].toLowerCase() });
          qDiff.set(qid, rLo.normal(0, 0.35) - (lvl === 'vận dụng cao' ? 0.5 : 0));
        }
      });
    });
    // Kịch bản CĐR
    const LO_CUR = 'TOAN10-LO08';            // K01
    const Q_BAD = 'TOAN10-LO08-Q04';         // K02
    const LO_CUR2 = 'LY11-LO08';             // K04
    const LO_THIN = 'HOA12-LO04';            // K26
    const LO_GRAY = 'HOA12-LO07';            // K27
    loBias.set(LO_CUR, -1.95); loLearn.set(LO_CUR, 0);
    loBias.set(LO_CUR2, -1.15); loLearn.set(LO_CUR2, 0.2);
    qDiff.set(Q_BAD, -3.2);
    questions.forEach(function (q) {
      if (q.id === Q_BAD) q.text = 'Câu 4 (thông hiểu): Cho tam giác ABC đều cạnh a. Tính tích vô hướng AB→·BC→. (Đáp án chuẩn trong ngân hàng: a²/2)';
    });
    const LO_CLASS_FX = {};                  // 'classId|loId' → hiệu ứng
    ['TOAN10-LO02', 'TOAN10-LO03', 'TOAN10-LO05', 'TOAN10-LO06', 'TOAN10-LO07'].forEach(function (l) { LO_CLASS_FX['10A4|' + l] = -2.6; }); // K03
    LO_CLASS_FX['11A3|' + LO_CUR2] = -1.7; LO_CLASS_FX['11A5|' + LO_CUR2] = -1.7;                                                    // K04

    const losByCourse = U.groupBy(los, function (l) { return l.courseId; });
    const qByLo = U.groupBy(questions, function (q) { return q.loId; });
    const courseMeta = {};
    COURSES.forEach(function (c) { courseMeta[c.id] = c; });

    function loIntro(lo) {
      const w = COURSE_WINDOW[lo.courseId];
      const n = losByCourse.get(lo.courseId).length;
      return w[0] + (lo.order - 1) / n * 0.65 * (w[1] - w[0]);
    }
    function currentTopic(courseId, t) {
      const arr = losByCourse.get(courseId);
      let cur = arr[0];
      for (let i = 0; i < arr.length; i++) if (loIntro(arr[i]) <= t) cur = arr[i];
      return cur.name;
    }

    // ------------------------------------------------------------ Lớp – khóa
    const classCourses = [];
    Object.keys(TIMETABLE).forEach(function (classId) {
      TIMETABLE[classId].forEach(function (e) {
        const w = COURSE_WINDOW[e[0]];
        classCourses.push({ classId: classId, courseId: e[0], teacherIds: Array.isArray(e[1]) ? e[1].slice() : [e[1]], startAt: w[0], endAt: w[1] });
      });
    });

    // ------------------------------------------------------------ Học sinh & ghi danh
    const students = [], enrollments = [];
    const traits = new Map();
    let sn = 0;
    function makeName(female) {
      const sur = rNames.weighted(SURNAMES.map(function (s) { return s[0]; }), SURNAMES.map(function (s) { return s[1]; }));
      if (female) {
        const mid = rNames.chance(0.22) ? 'Thị ' + rNames.pick(MID_F2) : rNames.pick(MID_F);
        return sur + ' ' + mid + ' ' + rNames.pick(GIVEN_F);
      }
      return sur + ' ' + rNames.pick(MID_M) + ' ' + rNames.pick(GIVEN_M);
    }
    function newStudent(classId) {
      sn++;
      const id = 'S' + String(sn).padStart(4, '0');
      students.push({ id: id, fullName: makeName(rNames.chance(0.52)), code: 'HS26' + String(sn).padStart(4, '0') });
      const fx = CLASS_FX[classId] || {};
      const za = rNames.normal(fx.ability || 0, 1);
      traits.set(id, {
        za: za,
        zd: 0.45 * za + 0.89 * rNames.normal(0, 1),
        zp: rNames.normal(0, 1),
        zx: rNames.normal(0, 1),
        exc: rNames.uniform(0.4, 0.75)
      });
      return id;
    }
    const rosterInit = {};
    CLASSES.forEach(function (c) {
      if (c[2] === 'GTA') return;
      rosterInit[c[0]] = [];
      for (let i = 0; i < c[3]; i++) {
        const sid = newStudent(c[0]);
        rosterInit[c[0]].push(sid);
        enrollments.push({ studentId: sid, classId: c[0], startAt: START, endAt: null });
      }
    });
    const stuById = new Map(students.map(function (s) { return [s.id, s]; }));
    function pickFrom(classId, k, exclude) {
      const pool = rosterInit[classId].filter(function (s) { return !exclude.has(s); });
      U.rng(seed + classId.charCodeAt(0) * 31 + classId.charCodeAt(classId.length - 1) * 7 + k).shuffle(pool);
      const out = pool.slice(0, k);
      out.forEach(function (s) { exclude.add(s); });
      return out;
    }
    const special = new Set();
    const chronic = new Set(pickFrom('12A5', 7, special).concat(pickFrom('11A4', 2, special)));   // K11
    const dropStudent = pickFrom('10A2', 1, special)[0];                                         // K15
    const excusedStudents = new Set(pickFrom('11A1', 1, special).concat(pickFrom('12A2', 1, special))); // K16
    const scoreDropStudent = pickFrom('10A6', 1, special)[0];                                     // K20
    const diligentPoor = pickFrom('11A1', 1, special)[0];                                         // K25
    const transferStudent = pickFrom('10A2', 1, special)[0];                                      // K30
    const slowOnline = new Set(pickFrom('11A4', 3, special));                                     // K22
    const neverStart = new Set(pickFrom('10A2', 2, special));                                     // K23 (khóa Vectơ)

    // Chuyển lớp 10A2 → 10A5 (K30)
    const TRANSFER_DAY = rel(-38);
    enrollments.forEach(function (e) {
      if (e.studentId === transferStudent && e.classId === '10A2') e.endAt = TRANSFER_DAY - MIN;
    });
    enrollments.push({ studentId: transferStudent, classId: '10A5', startAt: TRANSFER_DAY, endAt: null });

    // Lớp tiếng Anh tăng cường: học sinh đồng thời học lớp chính quy (~10% học 2 lớp)
    const taStart = COURSE_WINDOW.IELTS[0];
    const taMembers = {};
    function pickPool(classIds, k) {
      let pool = [];
      classIds.forEach(function (c) { pool = pool.concat(rosterInit[c]); });
      pool = pool.filter(function (s) { return !special.has(s); });
      rNames.shuffle(pool);
      const out = pool.slice(0, k);
      out.forEach(function (s) { special.add(s); });
      return out;
    }
    taMembers.TA01 = pickPool(['10A1', '10A2', '10A3', '10A4', '10A5', '10A6'], 20);
    taMembers.TA02 = pickPool(['11A1', '11A2', '11A3', '11A4', '11A5'], 18);
    taMembers.TA03 = pickPool(['12A1', '12A2', '12A3', '12A4', '12A5'], 16);
    taMembers.TA04 = pickPool(['10A1', '10A3', '11A2', '11A5', '12A1', '12A4'], 8);
    Object.keys(taMembers).forEach(function (cid) {
      taMembers[cid].forEach(function (sid) { enrollments.push({ studentId: sid, classId: cid, startAt: taStart, endAt: null }); });
    });
    const neverStartTA = new Set(taMembers.TA02.slice(0, 2));                                     // K23 (khóa Từ vựng)

    // Trùng họ tên (K30)
    function setName(classId, idx, name) { stuById.get(rosterInit[classId][idx]).fullName = name; }
    setName('10A1', 5, 'Nguyễn Văn An'); setName('11A3', 7, 'Nguyễn Văn An');
    setName('10A5', 3, 'Trần Thị Thu Hà'); setName('12A2', 10, 'Trần Thị Thu Hà');
    setName('11A1', 12, 'Lê Hoàng Nam'); setName('12A4', 2, 'Lê Hoàng Nam');

    const enrollByClass = U.groupBy(enrollments, function (e) { return e.classId; });
    function rosterAt(classId, t) {
      const arr = enrollByClass.get(classId) || [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        if (e.startAt <= t && (e.endAt === null || t <= e.endAt)) out.push(e.studentId);
      }
      return out;
    }

    // ------------------------------------------------------------ Buổi học
    const sessions = [];
    for (let w = START; w <= END; w += WEEK) {
      CLASSES.forEach(function (c) {
        const classId = c[0];
        TIMETABLE[classId].forEach(function (e) {
          const win = COURSE_WINDOW[e[0]];
          e[2].forEach(function (ws) {
            const day = w + ws[0] * DAY;
            if (day < DT.startOfDay(win[0]) || day > win[1]) return;
            if (isHoliday(day)) return;
            if (classId === 'TA03' && day > rel(-18)) return;        // K28: lớp tạm dừng
            const slot = SLOTS[ws[1]];
            const teacherId = Array.isArray(e[1]) ? (ws[0] === 1 ? e[1][0] : e[1][1]) : e[1];
            sessions.push({
              id: null, classId: classId, courseId: e[0], teacherId: teacherId,
              start: day + DT.parseTime(slot.start), end: day + DT.parseTime(slot.end), slot: ws[1],
              attendanceSubmittedAt: null, reportSubmittedAt: null
            });
          });
        });
      });
    }
    sessions.sort(function (a, b) { return a.start - b.start || (a.classId < b.classId ? -1 : 1); });
    sessions.forEach(function (s, i) { s.id = 'SS' + String(i + 1).padStart(5, '0'); });

    function findSession(classId, day, slot) {
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (s.classId === classId && DT.startOfDay(s.start) === day && (slot === undefined || s.slot === slot)) return s;
      }
      return null;
    }
    const forcedNoAttendance = new Set(), forcedNoReport = new Set();
    const sK06 = findSession('10A5', TODAY, 1); if (sK06) forcedNoAttendance.add(sK06.id);       // K06
    const sK05 = findSession('12A3', TODAY, 2); if (sK05) forcedNoAttendance.add(sK05.id);       // K05
    const sK05b = findSession('12A4', rel(-2)); if (sK05b) forcedNoAttendance.add(sK05b.id);
    const sK05c = findSession('12A3', rel(-3)); if (sK05c) forcedNoReport.add(sK05c.id);
    const sK05d = findSession('12A3', rel(-6)); if (sK05d) forcedNoReport.add(sK05d.id);
    const sEvent = findSession('11A4', rel(-2), 3);                                               // K14

    // Hành vi vận hành của giáo viên (phút sau khi bắt đầu / kết thúc buổi)
    function attendanceDelay(bad) {
      const u = rOps.next();
      if (bad) {
        if (u < 0.30) return rOps.uniform(-5, 10);
        if (u < 0.55) return rOps.uniform(16, 60);
        if (u < 0.75) return rOps.uniform(120, 600);
        return null;
      }
      if (u < 0.86) return rOps.uniform(-5, 12);
      if (u < 0.955) return rOps.uniform(16, 60);
      if (u < 0.994) return rOps.uniform(90, 480);
      return null;
    }
    function reportDelay(bad) {
      const u = rOps.next();
      const p = bad ? [0.2, 0.4, 0.55, 0.65] : [0.7, 0.9, 0.96, 0.98];
      if (u < p[0]) return rOps.uniform(10, 120);
      if (u < p[1]) return rOps.uniform(120, 24 * 60);
      if (u < p[2]) return rOps.uniform(24 * 60, 72 * 60);
      if (u < p[3]) return rOps.uniform(72 * 60, 120 * 60);
      return null;
    }
    const BAD_TEACHER = 'T09';
    sessions.forEach(function (s) {
      if (s.start > NOW) return;
      const bad = s.teacherId === BAD_TEACHER;
      const a = attendanceDelay(bad);
      if (a !== null && !forcedNoAttendance.has(s.id)) {
        const t = Math.round(s.start + a * MIN);
        s.attendanceSubmittedAt = t <= NOW ? t : null;
      }
      if (s.end <= NOW) {
        const r = reportDelay(bad);
        if (r !== null && !forcedNoReport.has(s.id)) {
          const t = Math.round(s.end + r * MIN);
          s.reportSubmittedAt = t <= NOW ? t : null;
        }
      }
    });

    // ------------------------------------------------------------ Điểm danh
    const attendance = [];
    sessions.forEach(function (s) {
      if (s.start > NOW) return;
      const roster = rosterAt(s.classId, s.start);
      const taken = s.attendanceSubmittedAt !== null;
      const fx = CLASS_FX[s.classId] || {};
      const wd = DT.weekday(s.start);
      const storm = DT.startOfDay(s.start) === STORM_DAY;
      const partial = s.teacherId === BAD_TEACHER ? 0.04 : 0.004;
      for (let i = 0; i < roster.length; i++) {
        const sid = roster[i];
        if (!taken || rAtt.chance(partial)) {
          attendance.push({ sessionId: s.id, studentId: sid, status: 'NOT_TAKEN', markedAt: null });
          continue;
        }
        const tr = traits.get(sid);
        let pAbs = 0.05 * (fx.absMult || 1) * Math.exp(0.45 * tr.zx);
        let exc = tr.exc;
        if (chronic.has(sid)) { pAbs = 0.42; exc = 0.15; }
        if (fx.flu && s.start >= rel(-7)) { pAbs = Math.max(pAbs, 0.3); exc = 0.85; }
        if (sEvent && s.id === sEvent.id) { pAbs = 0.45; exc = 0.6; }
        if (storm) { pAbs = Math.max(pAbs, 0.42); exc = 0.7; }
        if (sid === dropStudent) { if (s.start >= rel(-30)) { pAbs = 0.45; exc = 0.3; } else pAbs = 0.02; }
        if (excusedStudents.has(sid) && s.start >= rel(-30)) { pAbs = 0.55; exc = 1; }
        pAbs = U.clamp(pAbs, 0, 0.95);
        let pLate = (fx.lateBase || 0.042) * Math.exp(0.5 * tr.zp);
        if (wd === 0 && s.slot === 1) pLate *= 2.4;
        if (s.slot === 6) pLate *= 1.4;
        if (storm) pLate *= 2.5;
        pLate = U.clamp(pLate, 0, 0.6);
        const u = rAtt.next();
        let status;
        if (u < pAbs) status = rAtt.next() < exc ? 'EXCUSED' : 'UNEXCUSED';
        else if (u < pAbs + (1 - pAbs) * pLate) status = 'LATE';
        else status = 'ON_TIME';
        attendance.push({ sessionId: s.id, studentId: sid, status: status, markedAt: s.attendanceSubmittedAt });
      }
    });

    // ------------------------------------------------------------ Nhiệm vụ & bài nộp
    const tasks = [], submissions = [];
    const titleInfo = new Map();
    const weekCounter = new Map();
    let taskSeq = 0;
    let lowSubmitTaskId = null, ungradedTaskId = null;
    sessions.forEach(function (s) {
      if (s.end > NOW) return;
      const ws = DT.startOfWeek(s.start);
      const ck = s.classId + '|' + s.courseId + '|' + ws;
      const k = (weekCounter.get(ck) || 0) + 1;
      weekCounter.set(ck, k);
      if (s.classId === '11A3' && s.end >= NOW - 7 * DAY) return;                // K08: không giao nhiệm vụ
      const key = s.courseId + '|' + ws + '|' + k;
      let info = titleInfo.get(key);
      const cm = courseMeta[s.courseId];
      if (!info) {
        const weekNo = Math.round((ws - START) / WEEK) + 1;
        info = {
          title: 'Phiếu ' + weekNo + '.' + k + ': ' + currentTopic(s.courseId, s.start),
          itemCount: rTask.int(3, 10),
          manual: rTask.chance(cm.manualShare),
          diff: rTask.normal(0, 0.5)
        };
        if (s.courseId === 'LY11' && ws === W0 - 2 * WEEK && k === 2) {      // K19
          info.title = 'Bài tập nâng cao: Điện trường của hệ điện tích';
          info.diff = -2.6;
        }
        titleInfo.set(key, info);
      }
      taskSeq++;
      const assignedAt = s.end + rTask.int(0, 20) * MIN;
      const task = {
        id: 'TK' + String(taskSeq).padStart(5, '0'), classId: s.classId, courseId: s.courseId, sessionId: s.id,
        title: info.title, assignedAt: assignedAt, dueAt: eod(assignedAt + cm.dueDays * DAY),
        itemCount: info.itemCount, requiresManualGrading: info.manual, maxScore: cm.maxScore
      };
      if (s.classId === '12A2' && s.courseId === 'PY' && ws === W0 - WEEK) lowSubmitTaskId = task.id;          // K19
      if (!ungradedTaskId && s.classId === '12A5' && s.courseId === 'HOA12' && task.dueAt >= rel(-7) && task.dueAt < rel(-5)) {
        ungradedTaskId = task.id; task.requiresManualGrading = true;                                              // K07
      }
      tasks.push(task);
      task._diff = info.diff;
      task._teacher = s.teacherId;
    });
    tasks.forEach(function (task) {
      const roster = rosterAt(task.classId, task.assignedAt);
      const fx = CLASS_FX[task.classId] || {};
      const scoreFx = SCORE_FX[task.classId + '|' + task.courseId] || 0;
      const slowGrader = task._teacher === 'T09' || task._teacher === 'T10';
      for (let i = 0; i < roster.length; i++) {
        const sid = roster[i];
        const tr = traits.get(sid);
        let pSub = U.sigmoid(2.7 + 0.9 * tr.zd + (fx.dilig || 0));
        if (chronic.has(sid)) pSub = 0.33;
        if (sid === diligentPoor) pSub = 1;
        if (task.id === lowSubmitTaskId) pSub *= 0.55;
        if (!rTask.chance(pSub)) continue;
        const pLate = sid === diligentPoor ? 0 : U.clamp(0.09 * Math.exp(-0.6 * tr.zd) * (fx.lateHw || 1), 0, 0.7);
        let submittedAt;
        if (rTask.chance(pLate)) submittedAt = task.dueAt + rTask.uniform(0.5, 72) * HOUR;
        else {
          const b = rTask.weighted([0, 1, 2, 3], [0.12, 0.28, 0.32, 0.28]);
          const range = [[72, 120], [24, 72], [6, 24], [0.2, 6]][b];
          submittedAt = task.dueAt - rTask.uniform(range[0], range[1]) * HOUR;
          if (submittedAt < task.assignedAt + 10 * MIN) {
            submittedAt = task.assignedAt + rTask.uniform(10 * MIN, Math.max(20 * MIN, (task.dueAt - task.assignedAt) * 0.6));
          }
        }
        submittedAt = Math.round(submittedAt);
        if (submittedAt > NOW) continue;
        const completed = (task.itemCount > 1 && sid !== diligentPoor && rTask.chance(0.08)) ? rTask.int(1, task.itemCount - 1) : task.itemCount;
        let s10 = rTask.normal(6.9 + 1.15 * tr.za + scoreFx + task._diff, 1.0);
        if (sid === scoreDropStudent && task.dueAt >= rel(-30)) s10 -= 2.8;                       // K20
        s10 = U.clamp(s10 * (0.55 + 0.45 * completed / task.itemCount), 0, 10);
        let gradedAt;
        if (!task.requiresManualGrading) gradedAt = submittedAt + MIN;
        else gradedAt = Math.round(Math.max(submittedAt, task.dueAt) + rTask.uniform(slowGrader ? 12 : 6, slowGrader ? 70 : 60) * HOUR);
        if (task.id === ungradedTaskId) gradedAt = null;
        if (gradedAt !== null && gradedAt > NOW) gradedAt = null;
        const score = gradedAt === null ? null :
          (task.maxScore === 10 ? Math.round(s10 * 10) / 10 : Math.round(s10 * task.maxScore / 10));
        submissions.push({ taskId: task.id, studentId: sid, completedItems: completed, submittedAt: submittedAt, score: score, gradedAt: gradedAt });
      }
    });
    tasks.forEach(function (t) { delete t._diff; delete t._teacher; });

    // ------------------------------------------------------------ Khóa trực tuyến
    const ONLINE = [
      { key: 'T10-HAMSO', courseId: 'TOAN10', title: 'Ôn tập trực tuyến: Hàm số và đồ thị', classes: ['10A1', '10A2', '10A3', '10A4', '10A5', '10A6'], start: rel(-59), due: eod(rel(-18)), items: 24 },
      { key: 'T10-VECTO', courseId: 'TOAN10', title: 'Ôn tập trực tuyến: Vectơ và tích vô hướng', classes: ['10A1', '10A2', '10A3', '10A4', '10A5', '10A6'], start: rel(-17), due: eod(rel(17)), items: 20 },
      { key: 'L11-DIENTRUONG', courseId: 'LY11', title: 'Thí nghiệm ảo: Điện trường', classes: ['11A1', '11A2', '11A3', '11A4', '11A5'], start: rel(-31), due: eod(rel(3)), items: 16 },
      { key: 'H12-ESTE', courseId: 'HOA12', title: 'Luyện đề trực tuyến: Este – Lipit', classes: ['12A1', '12A2', '12A3', '12A4', '12A5'], start: rel(-52), due: eod(rel(-11)), items: 30 },
      { key: 'IE-TUVUNG', courseId: 'IELTS', title: 'Từ vựng học thuật IELTS (trực tuyến)', classes: ['TA01', 'TA02', 'TA03', 'TA04'], start: rel(-37), due: eod(rel(38)), items: 40 },
      { key: 'PY-CODE', courseId: 'PY', title: 'Python trên GenieTeach Code', classes: ['11A1', '11A2', '11A3', '12A1', '12A2', '12A3'], start: rel(-24), due: eod(rel(-4)), items: 15 }
    ];
    const PACE_FX = { '10A6|T10-VECTO': -0.6, '12A5|H12-ESTE': -0.45 };   // K21, K24
    const onlineAssignments = [], onlineProgress = [];
    let oaSeq = 0;
    ONLINE.forEach(function (o) {
      o.classes.forEach(function (classId) {
        oaSeq++;
        const startAt = o.start + 7 * HOUR;
        const a = { id: 'OA' + String(oaSeq).padStart(3, '0'), classId: classId, courseId: o.courseId, title: o.title, contentKey: o.key, startAt: startAt, dueAt: o.due, totalItems: o.items };
        onlineAssignments.push(a);
        const dur = a.dueAt - a.startAt;
        const fx = CLASS_FX[classId] || {};
        rosterAt(classId, startAt).forEach(function (sid) {
          const tr = traits.get(sid);
          let pace = U.clamp(rOnl.normal(1.2 + 0.25 * tr.zd + (PACE_FX[classId + '|' + o.key] || 0) + (fx.dilig || 0) * 0.3, 0.25), 0.15, 2.0);
          if (slowOnline.has(sid) && o.key === 'L11-DIENTRUONG') pace = 0.3;
          if (chronic.has(sid)) pace = Math.min(pace, 0.6);
          const delay = rOnl.chance(0.85) ? rOnl.uniform(0, 3) : rOnl.uniform(3, 9);
          const never = (neverStart.has(sid) && o.key === 'T10-VECTO') || (neverStartTA.has(sid) && o.key === 'IE-TUVUNG') || rOnl.chance(0.01);
          const times = [];
          if (!never) {
            let t = startAt + delay * DAY;
            const gap = dur * 0.92 / pace / a.totalItems;
            for (let i = 0; i < a.totalItems; i++) {
              t += gap * rOnl.uniform(0.4, 1.6);
              if (t > a.dueAt + 14 * DAY) break;
              times.push(Math.round(t));
            }
          }
          const done = times.filter(function (t) { return t <= NOW; });
          const completedAt = (times.length === a.totalItems && times[times.length - 1] <= NOW) ? times[times.length - 1] : null;
          const testScore = done.length >= a.totalItems * 0.5 ? Math.round(U.clamp(rOnl.normal(72 + 11 * tr.za + (fx.lo || 0) * 6, 9), 5, 100)) : null;
          onlineProgress.push({
            assignmentId: a.id, studentId: sid, completedItems: done.length, totalItems: a.totalItems,
            completedAt: completedAt, testScore: testScore, itemCompletedAt: done
          });
        });
      });
    });

    // ------------------------------------------------------------ Câu hỏi & chuẩn đầu ra
    const attempts = [];
    const ccByClass = U.groupBy(classCourses, function (cc) { return cc.classId; });
    const STU_LO_FX = {};
    ['LY11-LO03', 'LY11-LO05', 'LY11-LO06'].forEach(function (l) { STU_LO_FX[diligentPoor + '|' + l] = -3.5; });   // K25
    enrollments.forEach(function (e) {
      const tr = traits.get(e.studentId);
      const fx = CLASS_FX[e.classId] || {};
      (ccByClass.get(e.classId) || []).forEach(function (cc) {
        losByCourse.get(cc.courseId).forEach(function (lo) {
          if (lo.id === LO_GRAY) return;
          const intro = loIntro(lo);
          const ws = Math.max(intro, e.startAt);
          const we = Math.min(NOW, e.endAt === null ? Infinity : e.endAt);
          if (ws >= we) return;
          if (lo.id === LO_THIN && !rLo.chance(0.2)) return;
          const n = rLo.int(3, 7);
          const qs = qByLo.get(lo.id);
          let t = ws + rLo.uniform(0, 6) * DAY;
          for (let k = 0; k < n; k++) {
            if (t > we) break;
            const q = qs[Math.floor(rLo.next() * qs.length)];
            const learn = loLearn.get(lo.id) * Math.min(1, (t - intro) / (35 * DAY));
            const logit = 1.75 + 1.0 * tr.za + loBias.get(lo.id) + (LO_CLASS_FX[e.classId + '|' + lo.id] || 0) +
              (STU_LO_FX[e.studentId + '|' + lo.id] || 0) + qDiff.get(q.id) + learn + (fx.lo || 0);
            attempts.push({
              studentId: e.studentId, classId: e.classId, courseId: cc.courseId, loId: lo.id, questionId: q.id,
              isCorrect: rLo.next() < U.sigmoid(logit), attemptedAt: Math.round(t)
            });
            t += rLo.uniform(1, 12) * DAY;
          }
        });
      });
    });
    attempts.sort(function (a, b) { return a.attemptedAt - b.attemptedAt; });

    // LOAchievement: gộp từ QuestionAttempt theo (học sinh, lớp, CĐR) — percent = tỉ lệ trả lời đúng (OQ-43)
    const agg = new Map();
    attempts.forEach(function (a) {
      const k = a.studentId + '|' + a.classId + '|' + a.loId;
      let g = agg.get(k);
      if (!g) { g = { n: 0, c: 0, last: 0 }; agg.set(k, g); }
      g.n++; if (a.isCorrect) g.c++; g.last = a.attemptedAt;
    });
    const loAchievements = [];
    enrollments.forEach(function (e) {
      (ccByClass.get(e.classId) || []).forEach(function (cc) {
        losByCourse.get(cc.courseId).forEach(function (lo) {
          const g = agg.get(e.studentId + '|' + e.classId + '|' + lo.id);
          loAchievements.push({
            studentId: e.studentId, classId: e.classId, courseId: cc.courseId, loId: lo.id,
            percent: g ? Math.round(g.c / g.n * 1000) / 10 : null,
            evidenceCount: g ? g.n : 0,
            updatedAt: g ? g.last : null
          });
        });
      });
    });

    // LOSnapshot [ĐỀ XUẤT]: "job hằng tuần" chụp tỉ lệ đạt & coverage lũy kế đến cuối tuần,
    // tính bằng ngưỡng mặc định tại thời điểm chụp (đạt khi % ≥ 60).
    const loSnapshots = [];
    const attByClassLo = U.groupBy(attempts, function (a) { return a.classId + '|' + a.loId; });
    classCourses.forEach(function (cc) {
      losByCourse.get(cc.courseId).forEach(function (lo) {
        const arr = attByClassLo.get(cc.classId + '|' + lo.id) || [];
        const cnt = new Map();
        let p = 0;
        for (let ws = START; ws <= W0; ws += WEEK) {
          const we = Math.min(ws + WEEK, NOW);
          if (we < cc.startAt) continue;
          while (p < arr.length && arr[p].attemptedAt < we) {
            const a = arr[p++];
            let g = cnt.get(a.studentId);
            if (!g) { g = { n: 0, c: 0 }; cnt.set(a.studentId, g); }
            g.n++; if (a.isCorrect) g.c++;
          }
          const roster = rosterAt(cc.classId, we);
          let withData = 0, pass = 0;
          roster.forEach(function (sid) {
            const g = cnt.get(sid);
            if (g && g.n > 0) { withData++; if (g.c / g.n * 100 >= 60 - 1e-9) pass++; }
          });
          loSnapshots.push({
            weekStart: ws, classId: cc.classId, courseId: cc.courseId, loId: lo.id,
            passRate: withData ? pass / withData : null,
            coverage: roster.length ? withData / roster.length : null,
            withData: withData, enrolled: roster.length   // [GIẢ ĐỊNH] thêm cỡ mẫu để gộp có trọng số (OQ-46)
          });
        }
      });
    });

    // ------------------------------------------------------------ Kịch bản (đối chiếu GT.debug)
    function nm(sid) { return stuById.get(sid).fullName + ' (' + sid + ')'; }
    const chronicArr = Array.from(chronic);
    const scenarios = [
      { id: 'K01', title: 'CĐR "Tích vô hướng" Toán 10 Đỏ ở hầu hết các lớp', expect: [{ rule: 'CUR-01', loId: LO_CUR }, { rule: 'CUR-02', loId: LO_CUR }, { rule: 'LO-C01', loId: LO_CUR }] },
      { id: 'K02', title: 'Câu hỏi ' + Q_BAD + ' đúng rất thấp ở mọi lớp', expect: [{ rule: 'CUR-03', questionId: Q_BAD }] },
      { id: 'K03', title: '10A4 Đỏ ở nhiều CĐR Toán 10, lớp khác Xanh', expect: [{ rule: 'LO-C03', classId: '10A4' }, { rule: 'LO-C02', classId: '10A4' }, { rule: 'LO-C01', classId: '10A4' }, { rule: 'LO-S01', classId: '10A4' }] },
      { id: 'K04', title: 'CĐR "Tụ điện" Vật lý 11: tỉ lệ đạt toàn trường < 50% nhưng không Đỏ diện rộng', expect: [{ rule: 'CUR-02', loId: LO_CUR2 }] },
      { id: 'K05', title: 'GV ' + BAD_TEACHER + ' thường điểm danh muộn/quên báo cáo (12A3, 12A4)', expect: [{ rule: 'OPS-01', classId: '12A3' }, { rule: 'OPS-02', teacherId: BAD_TEACHER }, { rule: 'OPS-03', teacherId: BAD_TEACHER }, { rule: 'OPS-06', classId: '12A3' }] },
      { id: 'K06', title: 'Buổi Ca 1 hôm nay của 10A5 chưa điểm danh', expect: [{ rule: 'OPS-01', classId: '10A5' }] },
      { id: 'K07', title: 'Nhiệm vụ Hóa 12A5 chấm tay quá hạn còn bài chưa chấm', expect: [{ rule: 'OPS-04', taskId: ungradedTaskId }] },
      { id: 'K08', title: '11A3 có buổi học 7 ngày qua nhưng không có nhiệm vụ', expect: [{ rule: 'OPS-05', classId: '11A3' }] },
      { id: 'K09', title: 'Nhóm Lớp tiếng Anh tăng cường chuyên cần kém', expect: [{ rule: 'ATT-C05', groupId: 'GTA' }, { rule: 'ATT-C01', groupId: 'GTA' }] },
      { id: 'K10', title: 'Ngày ' + DT.fmtDate(STORM_DAY) + ' cả trường vắng bất thường (bão)', expect: [] },
      { id: 'K11', title: 'Nhóm học sinh vắng triền miên (7 em 12A5, 2 em 11A4)', expect: [{ rule: 'ATT-S01', classId: '12A5' }, { rule: 'ATT-S02', studentId: chronicArr[0] }, { rule: 'HW-S01', studentId: chronicArr[0] }, { rule: 'HW-S02', studentId: chronicArr[0] }] },
      { id: 'K12', title: '10A3 đi muộn nhiều; ca 07:00 Thứ Hai đi muộn cao', expect: [{ rule: 'ATT-C02', classId: '10A3' }, { rule: 'ATT-S03', classId: '10A3' }] },
      { id: 'K13', title: '11A5 dịch cúm 7 ngày gần nhất', expect: [{ rule: 'ATT-C03', classId: '11A5' }, { rule: 'ATT-C01', classId: '11A5' }] },
      { id: 'K14', title: 'Buổi 11A4 ngày ' + DT.fmtDate(rel(-2)) + ' trùng sự kiện', expect: [{ rule: 'ATT-C04', classId: '11A4' }] },
      { id: 'K15', title: 'Học sinh ' + nm(dropStudent) + ' có tỉ lệ có mặt giảm mạnh', expect: [{ rule: 'ATT-S04', studentId: dropStudent }] },
      { id: 'K16', title: '2 học sinh đội tuyển vắng có phép nhiều', expect: [{ rule: 'ATT-S05', studentId: Array.from(excusedStudents)[0] }] },
      { id: 'K17', title: '12A5 nộp đúng hạn thấp', expect: [{ rule: 'HW-C01', classId: '12A5' }] },
      { id: 'K18', title: '11A2 điểm Vật lý thấp hơn các lớp cùng khóa', expect: [{ rule: 'HW-C02', classId: '11A2' }] },
      { id: 'K19', title: 'Nhiệm vụ nghi vấn đề bài (Vật lý nâng cao; Python hạn cuối tuần)', expect: [{ rule: 'HW-T01', courseId: 'LY11' }, { rule: 'HW-T01', taskId: lowSubmitTaskId }] },
      { id: 'K20', title: 'Học sinh ' + nm(scoreDropStudent) + ' điểm nhiệm vụ giảm mạnh', expect: [{ rule: 'HW-S03', studentId: scoreDropStudent }] },
      { id: 'K21', title: '10A6 chậm tiến độ khóa "Vectơ"', expect: [{ rule: 'ONL-C01', classId: '10A6' }, { rule: 'ONL-S01', classId: '10A6' }] },
      { id: 'K22', title: 'Khóa "Điện trường" sắp hạn, học sinh có điểm tổng hợp dự kiến thấp', expect: [{ rule: 'ONL-S02', classId: '11A4' }] },
      { id: 'K23', title: 'Học sinh chưa bắt đầu khóa trực tuyến sau 7 ngày', expect: [{ rule: 'ONL-S03', studentId: Array.from(neverStart)[0] }, { rule: 'ONL-S03', studentId: Array.from(neverStartTA)[0] }] },
      { id: 'K24', title: '12A5 hoàn thành đúng hạn khóa "Este – Lipit" thấp', expect: [{ rule: 'ONL-C02', classId: '12A5' }] },
      { id: 'K25', title: 'Học sinh ' + nm(diligentPoor) + ' chăm nhưng CĐR Vật lý kém', expect: [{ rule: 'LO-S02', studentId: diligentPoor }] },
      { id: 'K26', title: 'CĐR "Polime" Hóa 12 dữ liệu mỏng', expect: [{ rule: 'DATA-01', loId: LO_THIN }] },
      { id: 'K27', title: 'CĐR "Ăn mòn kim loại" Hóa 12 chưa có dữ liệu', expect: [{ rule: 'DATA-02', loId: LO_GRAY }] },
      { id: 'K28', title: 'TA-03 tạm dừng, không có buổi học > 14 ngày', expect: [{ rule: 'DATA-03', classId: 'TA03' }] },
      { id: 'K29', title: 'TA-04 sĩ số 8 — rule tỉ lệ cấp lớp không chạy (dưới cỡ mẫu)', expect: [], forbid: [{ classId: 'TA04', scopes: ['CLASS', 'LO', 'SESSION'], rules: ['OPS-06', 'ATT-C01', 'ATT-C02', 'ATT-C03', 'ATT-C04', 'HW-C01', 'HW-C02', 'HW-T01', 'ONL-C01', 'ONL-C02', 'LO-C01', 'LO-C02', 'LO-C03'] }] },
      { id: 'K30', title: 'Chuyển lớp ' + nm(transferStudent) + ' 10A2 → 10A5; ~10% học 2 lớp; trùng họ tên', expect: [] }
    ];

    return {
      meta: {
        now: NOW, today: TODAY, weekStart: W0, dataStart: START, dataEnd: END,
        slots: SLOTS, stormDay: STORM_DAY, seed: seed,
        special: {
          chronic: chronicArr, dropStudent: dropStudent, excused: Array.from(excusedStudents), scoreDropStudent: scoreDropStudent,
          diligentPoor: diligentPoor, transferStudent: transferStudent, badTeacher: BAD_TEACHER,
          loCurriculum: LO_CUR, questionBad: Q_BAD, loCur2: LO_CUR2, loThin: LO_THIN, loGray: LO_GRAY,
          eventSession: sEvent ? sEvent.id : null, ungradedTask: ungradedTaskId, lowSubmitTask: lowSubmitTaskId
        }
      },
      groups: groups, classes: classes, students: students, enrollments: enrollments, teachers: teachers,
      courses: courses, classCourses: classCourses, los: los, questions: questions,
      sessions: sessions, attendance: attendance, tasks: tasks, submissions: submissions,
      onlineAssignments: onlineAssignments, onlineProgress: onlineProgress,
      attempts: attempts, loAchievements: loAchievements, loSnapshots: loSnapshots,
      scenarios: scenarios
    };
  }

  GT.mock = { generate: generate, SLOTS: SLOTS };
})(window.GT);
