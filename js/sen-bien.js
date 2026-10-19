// =====================================================================
// SEN BIỂN — trợ lý nói: "nói chỗ muốn tới" (Web Speech API, vi-VN)
// Hiểu: toạ độ ("mười ba độ ba mươi phút, một trăm mười độ ba mươi",
// "13 30 110 30", "13.5 110.5"), tên điểm đã ghim, tên cảng, "về cảng nhà".
// Trả về { loai: "toa-do"|"diem"|"cang-nha"|"khong-hieu", viTri, ten, chu }
// =====================================================================

export const coNghe = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/** Nghe một câu (tối đa ~8 giây). Trả về chuỗi đã nhận dạng. */
export function nghe() {
  return new Promise((ok, loi) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return loi(new Error("Máy không hỗ trợ nhận dạng giọng nói"));
    const r = new SR(); r.lang = "vi-VN"; r.interimResults = false; r.maxAlternatives = 3;
    let xong = false;
    r.onresult = e => { xong = true; ok(Array.from(e.results[0]).map(a => a.transcript).join(" | ")); };
    r.onerror = e => { if (!xong) loi(new Error(e.error === "not-allowed" ? "Máy chưa cho dùng micro" : e.error === "no-speech" ? "Không nghe thấy gì" : e.error)); };
    r.onend = () => { if (!xong) loi(new Error("Không nghe thấy gì")); };
    r.start();
  });
}

// ---------- Đổi số nói bằng chữ → chữ số (0–999) ----------
const DON_VI = { "không": 0, "một": 1, "mốt": 1, "hai": 2, "ba": 3, "bốn": 4, "tư": 4, "năm": 5, "lăm": 5, "nhăm": 5, "sáu": 6, "bảy": 7, "tám": 8, "chín": 9 };
/** "mười ba độ ba mươi phút, một trăm mười độ" → "13 độ 30 phút, 110 độ" */
export function chuSangSo(chuoi) {
  const tu = chuoi.toLowerCase().split(/(\s+|,|;)/), ra = [];
  let so = null, cho = null; // so: số đang gom; cho: "tram" | "chuc" | "donvi" (vị trí vừa đọc)
  const xa = () => { if (so != null) { ra.push(String(so)); so = null; cho = null; } };
  for (const t of tu) {
    if (!t.trim()) { ra.push(t); continue; }
    if (t === "trăm") { so = (so ?? 1) * 100; cho = "tram"; continue; }
    if (t === "mười") { so = (so ?? 0) + 10; cho = "chuc"; continue; }
    if (t === "mươi") { if (so != null) { so = cho === "tram" ? so : so * 10; cho = "chuc"; } continue; }
    if (t === "lẻ" || t === "linh") { cho = "le"; continue; }
    if (t in DON_VI) {
      const v = DON_VI[t];
      if (so == null) { so = v; cho = "donvi"; }
      else if (cho === "tram" || cho === "chuc" || cho === "le") { so += v; cho = "donvi"; }
      else { xa(); so = v; cho = "donvi"; } // hai số liền nhau: "ba hai" → "3 2"
      continue;
    }
    xa(); ra.push(t);
  }
  xa(); return ra.join("");
}

/** Hiểu câu nói. `diemLuu`, `cang`: danh sách {ten, lat, lon}. */
export function hieu(cau, { diemLuu = [], cang = [], cangNha = null } = {}) {
  const c = chuSangSo(cau).replace(/;/g, " ");
  if (/(về|tới|đến)\s+(cảng\s+)?nhà/.test(c) && cangNha) return { loai: "cang-nha", viTri: [cangNha.lat, cangNha.lon], ten: cangNha.ten, chu: `Về cảng nhà ${cangNha.ten}` };
  for (const d of [...diemLuu, ...cang]) {
    const ten = (d.ten || "").toLowerCase().replace(/^cảng\s+/, "").replace(/\s*\(.*?\)/, "");
    if (ten && c.includes(ten)) return { loai: "diem", viTri: [d.lat, d.lon], ten: d.ten, chu: `Đi tới ${d.ten}` };
  }
  const so = (c.match(/\d+(?:[.,]\d+)?/g) || []).map(s => parseFloat(s.replace(",", ".")));
  let lat, lon;
  if (so.length >= 4) { lat = so[0] + so[1] / 60; lon = so[2] + so[3] / 60; }
  else if (so.length === 3) { if (so[2] > 95) { lat = so[0] + so[1] / 60; lon = so[2]; } else { lat = so[0]; lon = so[1] + so[2] / 60; } }
  else if (so.length === 2) { lat = so[0]; lon = so[1]; }
  if (lat > 0 && lat < 25 && lon > 95 && lon < 125) {
    const ph = v => `${Math.floor(v)}°${String(Math.round((v % 1) * 60)).padStart(2, "0")}′`;
    return { loai: "toa-do", viTri: [lat, lon], chu: `Tới toạ độ ${ph(lat)}N, ${ph(lon)}E` };
  }
  return { loai: "khong-hieu", chu: `Chưa hiểu "${cau}". Nói ví dụ: "mười ba độ ba mươi, một trăm mười độ" hoặc tên điểm đã ghim.` };
}
