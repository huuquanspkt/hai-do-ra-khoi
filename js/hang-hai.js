// =====================================================================
// TÍNH TOÁN HÀNG HẢI — hàm thuần, không đụng tới giao diện
// Mọi vị trí là mảng [vĩ độ, kinh độ] (độ thập phân, Bắc/Đông dương).
// =====================================================================
import { HAI_LY } from "./cau-hinh.js";

const R_TRAI_DAT = 6371008.8; // mét
export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;

/** Khoảng cách vòng lớn giữa hai điểm (mét), công thức haversine. */
export function khoangCach(a, b) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TRAI_DAT * Math.asin(Math.sqrt(h));
}

/** Hướng thật ban đầu từ a tới b (độ, 0 = Bắc, 90 = Đông). */
export function huongDi(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) -
            Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Điểm đến khi đi từ `a` theo hướng `huong` (độ) một quãng `met`. */
export function diemToi(a, huong, met) {
  const d = met / R_TRAI_DAT, h = rad(huong);
  const lat1 = rad(a[0]), lon1 = rad(a[1]);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(h));
  const lon2 = lon1 + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(lat1),
                                 Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [deg(lat2), ((deg(lon2) + 540) % 360) - 180];
}

/** Trung điểm (gần đúng) của đoạn a–b, dùng để đặt nhãn trên tuyến. */
export function trungDiem(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Khoảng cách ngắn nhất (mét) từ điểm p tới một đường gấp khúc.
 * `toaDo` theo GeoJSON: mảng các [kinh độ, vĩ độ].
 * Dùng phép chiếu phẳng quanh p — đủ chính xác trong vài trăm hải lý.
 */
export function khoangCachToiDuong(p, toaDo) {
  const k = Math.cos(rad(p[0])), M = 111320; // mét cho mỗi độ
  const xy = c => [(c[0] - p[1]) * k * M, (c[1] - p[0]) * M];
  let tot = Infinity;
  for (let i = 0; i < toaDo.length - 1; i++) {
    const [x1, y1] = xy(toaDo[i]), [x2, y2] = xy(toaDo[i + 1]);
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    let t = L ? -(x1 * dx + y1 * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x1 + t * dx, y1 + t * dy);
    if (d < tot) tot = d;
  }
  return tot;
}

/** Tổng chiều dài (mét) của một dãy điểm [lat, lon]. */
export function chieuDaiTuyen(diem) {
  let s = 0;
  for (let i = 1; i < diem.length; i++) s += khoangCach(diem[i - 1], diem[i]);
  return s;
}

/** Cấp gió Beaufort từ tốc độ gió m/s. */
export function capBeaufort(ms) {
  const nguong = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let cap = 0;
  while (cap < nguong.length && ms >= nguong[cap]) cap++;
  return cap;
}

const TEN_HUONG = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
/** Tên hướng (8 hướng) từ góc độ. */
export function tenHuong(doGoc) {
  return TEN_HUONG[Math.round((((doGoc % 360) + 360) % 360) / 45) % 8];
}

// ---------- Định dạng ----------

/** Độ thập phân → chuỗi độ-phút-giây, ví dụ 14°34′07″N. */
export function dms(v, duong, am) {
  const chu = v >= 0 ? duong : am;
  v = Math.abs(v);
  let d = Math.floor(v), mF = (v - d) * 60, m = Math.floor(mF), s = Math.round((mF - m) * 60);
  if (s === 60) { s = 0; m++; }
  if (m === 60) { m = 0; d++; }
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″${chu}`;
}

/** Độ thập phân → chuỗi 14,57°N. */
export function thapPhan(v, duong, am) {
  return `${Math.abs(v).toFixed(2).replace(".", ",")}°${v >= 0 ? duong : am}`;
}

/** Vị trí → hai dòng toạ độ theo kiểu đã chọn ("dms" | "thap-phan"). */
export function dinhDangViTri(p, kieu = "dms") {
  const f = kieu === "thap-phan" ? thapPhan : dms;
  return `${f(p[0], "N", "S")}\n${f(p[1], "E", "W")}`;
}

/** Vị trí → một dòng, cách nhau bằng dấu chấm giữa. */
export function dinhDangViTriMotDong(p, kieu = "dms") {
  return dinhDangViTri(p, kieu).replace("\n", " · ");
}

/** Khoảng cách (mét) → "126 hải lý" hoặc "233 km" tuỳ đơn vị. */
export function dinhDangKhoangCach(met, donVi = "hl") {
  if (donVi === "km") {
    const km = met / 1000;
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  }
  const hl = met / HAI_LY;
  return `${hl < 10 ? hl.toFixed(1) : Math.round(hl)} hải lý`;
}

/** Tốc độ (m/s) → "7,0 hl/giờ" hoặc "13 km/giờ". */
export function dinhDangTocDo(ms, donVi = "hl") {
  if (donVi === "km") return `${(ms * 3.6).toFixed(ms * 3.6 < 10 ? 1 : 0)} km/giờ`;
  return `${(ms * 3600 / HAI_LY).toFixed(1)} hl/giờ`;
}

/** Thời gian (giờ) → "45 phút" / "2,3 giờ" / "1 ngày 4 giờ". */
export function dinhDangThoiGian(gio) {
  if (!isFinite(gio)) return "—";
  if (gio < 1) return `${Math.max(1, Math.round(gio * 60))} phút`;
  if (gio < 24) return `${gio.toFixed(1).replace(".", ",")} giờ`;
  return `${Math.floor(gio / 24)} ngày ${Math.round(gio % 24)} giờ`;
}

/**
 * Đọc toạ độ người dùng gõ: "14.57", "14 34 07", "14°34′07″N", "-109 30".
 * Trả về số thập phân hoặc NaN. Chữ S/W (hoa) làm giá trị âm.
 */
export function docToaDo(chuoi) {
  if (!chuoi) return NaN;
  const am = /[SW]/.test(chuoi) || /^\s*-/.test(chuoi);
  const so = (chuoi.replace(",", ".").match(/\d+(\.\d+)?/g) || []).map(Number);
  if (!so.length) return NaN;
  const v = so[0] + (so[1] || 0) / 60 + (so[2] || 0) / 3600;
  return am ? -v : v;
}

/** Tạo lưới kinh/vĩ tuyến mỗi `buoc` độ trong khung [latMin, lonMin, latMax, lonMax]. */
export function taoLuoi(buoc, khung) {
  const [latMin, lonMin, latMax, lonMax] = khung, duong = [];
  const nhan = (v, duong, am) => `${Math.abs(v)}°${v >= 0 ? duong : am}`;
  for (let lat = Math.ceil(latMin / buoc) * buoc; lat <= latMax; lat += buoc)
    duong.push({ nhan: nhan(lat, "N", "S"), toaDo: [[lat, lonMin], [lat, lonMax]] });
  for (let lon = Math.ceil(lonMin / buoc) * buoc; lon <= lonMax; lon += buoc)
    duong.push({ nhan: nhan(lon, "E", "W"), toaDo: [[latMin, lon], [latMax, lon]] });
  return duong;
}
