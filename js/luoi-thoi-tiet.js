// =====================================================================
// LƯỚI THỜI TIẾT CẢ VÙNG BIỂN — hỏi Open-Meteo theo lưới điểm (như SDFish)
// Một lần tải = 3 câu hỏi (gió/mưa/mây/nhiệt/dông/áp · sóng/dòng · nhiệt mặt biển)
// cho LUOI.soDiem × LUOI.soDiem điểm, 8 ngày. Lưu mỗi 3 giờ để nhẹ máy.
// Gói: { luc, hanDung, lat[], lon[], gioMoc[] (ISO), lop: { ten: Float32Array[diem][moc] } }
// =====================================================================
import { CAU_HINH } from "./cau-hinh.js";

export const LUOI = {
  latMin: 5, latMax: 23, lonMin: 101, lonMax: 119, soDiem: 13, // 13×13 = 169 điểm, bước 1,5°
  soNgay: 8, buocGio: 3,
};

/** Danh sách lớp màu vẽ được từ lưới. don: đơn vị; thang: [min,max]; mau: dải màu. */
export const LOP_MAU = {
  "gio":      { ten: "Gió",         moTa: "Theo giờ · cập nhật vài giờ một lần", don: "cấp", nguon: "gio",  bien: "wind_speed_10m",      huong: "wind_direction_10m",     thang: [0, 24],   mau: ["#e3f2fd", "#90caf9", "#42a5f5", "#66bb6a", "#ffee58", "#ffa726", "#ef5350", "#ab47bc"] },
  "song":     { ten: "Sóng",        moTa: "Theo giờ · cập nhật vài giờ một lần", don: "m",   nguon: "song", bien: "wave_height",          huong: "wave_direction",         thang: [0, 5],    mau: ["#e8f5e9", "#a5d6a7", "#ffee58", "#ffa726", "#ef5350", "#6a1b9a"] },
  "dong":     { ten: "Dòng chảy",   moTa: "Theo giờ · dự báo lên tới ~8 ngày",   don: "hl/giờ", nguon: "song", bien: "ocean_current_velocity", huong: "ocean_current_direction", thang: [0, 3.6], mau: ["#f3e5f5", "#ce93d8", "#7e57c2", "#3949ab", "#0d47a1"] },
  "may":      { ten: "Mây",         moTa: "Xám đậm là mây dày; trắng nhạt là mây thưa; chỗ trong là trời quang.", don: "%", nguon: "gio", bien: "cloud_cover", thang: [0, 100], mau: ["rgba(255,255,255,0)", "#eceff1", "#b0bec5", "#78909c", "#455a64"] },
  "mua":      { ten: "Mưa",         moTa: "Chỗ đậm là mưa to; tím là hay có dông — nên né.", don: "mm/giờ", nguon: "gio", bien: "precipitation", thang: [0, 10], mau: ["rgba(255,255,255,0)", "#bbdefb", "#42a5f5", "#1565c0", "#7b1fa2"] },
  "nhiet":    { ten: "Nhiệt không khí", moTa: "Nhiệt độ không khí trên mặt biển theo giờ.", don: "°C", nguon: "gio", bien: "temperature_2m", thang: [20, 36], mau: ["#1e88e5", "#4dd0e1", "#ffee58", "#ff7043", "#b71c1c"] },
  "dong-set": { ten: "Dông",        moTa: "Nguy cơ dông/sét (chỉ số CAPE) — càng đậm càng dễ dông. Là dự báo NGUY CƠ, không phải sét thật.", don: "J/kg", nguon: "gio", bien: "cape", thang: [0, 3000], mau: ["rgba(255,255,255,0)", "#fff59d", "#ffb300", "#e65100", "#4a148c"] },
  "ap-suat":  { ten: "Áp suất",     moTa: "Áp suất mực biển — lam là áp thấp (dễ xấu trời), nâu là áp cao (thường êm).", don: "hPa", nguon: "gio", bien: "pressure_msl", thang: [996, 1020], mau: ["#0d47a1", "#64b5f6", "#f5f5f5", "#bcaaa4", "#5d4037"] },
  "nhiet-bien": { ten: "Nước nóng lạnh", moTa: "Nhiệt độ mặt biển · ranh giới nước nóng/lạnh là chỗ cá hay tụ", don: "°C", nguon: "bien", bien: "sea_surface_temperature", thang: [24, 31], mau: ["#283593", "#29b6f6", "#66bb6a", "#ffee58", "#ff7043", "#b71c1c"] },
};

const BIEN_GIO  = ["wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "precipitation", "cloud_cover", "temperature_2m", "cape", "pressure_msl"];
const BIEN_SONG = ["wave_height", "wave_direction", "ocean_current_velocity", "ocean_current_direction"];
const BIEN_BIEN = ["sea_surface_temperature"];

function toaDoLuoi() {
  const lat = [], lon = [];
  for (let i = 0; i < LUOI.soDiem; i++) {
    lat.push(+(LUOI.latMin + (LUOI.latMax - LUOI.latMin) * i / (LUOI.soDiem - 1)).toFixed(2));
    lon.push(+(LUOI.lonMin + (LUOI.lonMax - LUOI.lonMin) * i / (LUOI.soDiem - 1)).toFixed(2));
  }
  return { lat, lon };
}
function thamSoDiem() {
  const { lat, lon } = toaDoLuoi(), la = [], lo = [];
  for (const a of lat) for (const b of lon) { la.push(a); lo.push(b); }
  return `latitude=${la.join(",")}&longitude=${lo.join(",")}&timezone=${encodeURIComponent(CAU_HINH.thoiTiet.muiGio)}&forecast_days=${LUOI.soNgay}`;
}

async function layJson(url, lanThu = 0) {
  let r;
  try { r = await fetch(url); } catch (e) { if (lanThu < 2) { await cho(2000); return layJson(url, lanThu + 1); } throw e; }
  if (r.ok) return r.json();
  if ((r.status === 503 || r.status === 429) && lanThu < 2) { await cho(3000 * (lanThu + 1)); return layJson(url, lanThu + 1); }
  throw new Error(`HTTP ${r.status}`);
}
const cho = ms => new Promise(r => setTimeout(r, ms));

/** Gộp kết quả nhiều điểm thành gói, chỉ giữ mỗi `buocGio` giờ. */
function gop(goi, ketQua, bienList) {
  const ds = Array.isArray(ketQua) ? ketQua : [ketQua];
  if (!goi.gioMoc) {
    goi.gioMoc = ds[0].hourly.time.filter((_, k) => k % LUOI.buocGio === 0);
  }
  for (const b of bienList) {
    const mang = new Array(ds.length);
    for (let d = 0; d < ds.length; d++) {
      const v = ds[d].hourly[b] || [];
      mang[d] = Float32Array.from(v.filter((_, k) => k % LUOI.buocGio === 0).map(x => x == null ? NaN : x));
    }
    goi.lop[b] = mang;
  }
}

/** Tải lưới cả vùng. Mất khoảng 10–30 giây. `onTienDo(chu)` báo tiến độ. */
export async function taiLuoi(onTienDo = () => {}) {
  const q = thamSoDiem();
  const goi = { luc: Date.now(), hanDung: Date.now() + LUOI.soNgay * 86400e3, ...toaDoLuoi(), lop: {} };
  onTienDo("Đang hỏi gió, mưa, mây, nhiệt, áp suất cả vùng…");
  gop(goi, await layJson(`https://api.open-meteo.com/v1/forecast?${q}&wind_speed_unit=ms&hourly=${BIEN_GIO.join(",")}`), BIEN_GIO);
  onTienDo("Đang hỏi sóng và dòng chảy…");
  gop(goi, await layJson(`https://marine-api.open-meteo.com/v1/marine?${q}&models=${CAU_HINH.thoiTiet.moHinhSong}&hourly=${BIEN_SONG.join(",")}`), BIEN_SONG);
  onTienDo("Đang hỏi nhiệt độ mặt biển…");
  try { gop(goi, await layJson(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=${BIEN_BIEN.join(",")}`), BIEN_BIEN); }
  catch { /* không có nhiệt mặt biển cũng không sao */ }
  return goi;
}

/** Gói đọc từ IndexedDB có Float32Array nguyên vẹn; từ JSON thì chuyển lại. */
export function phucHoi(goi) {
  if (!goi?.lop) return goi;
  for (const k of Object.keys(goi.lop)) goi.lop[k] = goi.lop[k].map(a => a instanceof Float32Array ? a : Float32Array.from(Object.values(a)));
  return goi;
}

/** Chỉ số mốc giờ gần nhất với (ngày i, giờ h). */
export function chiSoMoc(goi, ngayIso, gio) {
  const muc = `${ngayIso}T${String(Math.round(gio / LUOI.buocGio) * LUOI.buocGio % 24).padStart(2, "0")}:00`;
  let k = goi.gioMoc.indexOf(muc);
  if (k < 0) k = goi.gioMoc.findIndex(t => t.startsWith(ngayIso));
  return k < 0 ? 0 : k;
}

/** Giá trị nội suy (song tuyến) của một biến tại (lat, lon) ở mốc k. NaN nếu ngoài lưới. */
export function giaTriTai(goi, bien, k, lat, lon) {
  const m = goi.lop[bien]; if (!m) return NaN;
  const n = LUOI.soDiem, dLat = (LUOI.latMax - LUOI.latMin) / (n - 1), dLon = (LUOI.lonMax - LUOI.lonMin) / (n - 1);
  const fi = (lat - LUOI.latMin) / dLat, fj = (lon - LUOI.lonMin) / dLon;
  if (fi < 0 || fj < 0 || fi > n - 1 || fj > n - 1) return NaN;
  const i0 = Math.min(Math.floor(fi), n - 2), j0 = Math.min(Math.floor(fj), n - 2), ti = fi - i0, tj = fj - j0;
  const v = (i, j) => m[i * n + j][k];
  const a = v(i0, j0), b = v(i0, j0 + 1), c = v(i0 + 1, j0), d = v(i0 + 1, j0 + 1);
  // Điểm trên đất liền trả NaN (nhất là sóng); bỏ qua ô NaN khi nội suy
  const ds = [[a, (1 - ti) * (1 - tj)], [b, (1 - ti) * tj], [c, ti * (1 - tj)], [d, ti * tj]].filter(x => !isNaN(x[0]));
  if (!ds.length) return NaN;
  const w = ds.reduce((s, x) => s + x[1], 0);
  return ds.reduce((s, x) => s + x[0] * x[1], 0) / w;
}
