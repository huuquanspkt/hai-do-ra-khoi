// =====================================================================
// THỜI TIẾT — lấy dự báo gió, sóng, dòng chảy từ Open-Meteo (miễn phí)
// Trả về một "gói" có thể lưu trong máy để dùng khi mất sóng.
// =====================================================================
import { CAU_HINH } from "./cau-hinh.js";
import { capBeaufort, tenHuong } from "./hang-hai.js";

const TT = CAU_HINH.thoiTiet;

function thamSoChung(viTri) {
  return `latitude=${viTri[0].toFixed(3)}&longitude=${viTri[1].toFixed(3)}` +
         `&timezone=${encodeURIComponent(TT.muiGio)}&forecast_days=${TT.soNgay}`;
}

/**
 * Tải dự báo cho một điểm. Ném lỗi nếu không có mạng hoặc máy chủ từ chối.
 * Gói trả về: { luc, hanDung, viTri, gio, song, dong }
 */
export async function taiDuBao(viTri) {
  const q = thamSoChung(viTri);
  const urlGio = `https://api.open-meteo.com/v1/forecast?${q}&wind_speed_unit=ms` +
    `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code` +
    `&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,weather_code`;
  const urlSong = `https://marine-api.open-meteo.com/v1/marine?${q}&models=${TT.moHinhSong}` +
    `&current=wave_height,wave_period,wave_direction` +
    `&hourly=wave_height,wave_direction,wave_period` +
    `&daily=wave_height_max,wave_direction_dominant,wave_period_max`;
  const urlDong = `https://marine-api.open-meteo.com/v1/marine?${q}` +
    `&current=ocean_current_velocity,ocean_current_direction`;

  // Máy chủ quá tải (503) thì hỏi bản gọn hơn (bỏ phần theo giờ) để vẫn có số liệu
  const urlGioGon = urlGio.replace(/&hourly=[^&]*/, "");
  const urlSongGon = urlSong.replace(/&hourly=[^&]*/, "");
  const [gio, song, dong] = await Promise.all([
    layJson(urlGio).catch(() => layJson(urlGioGon)),
    layJson(urlSong).catch(() => layJson(urlSongGon)),
    layJson(urlDong).catch(() => null),
  ]);
  if (!gio?.daily || !song?.daily) throw new Error("Dữ liệu dự báo thiếu");
  const luc = Date.now();
  return { luc, hanDung: luc + TT.hanGoiNgay * 86400e3, viTri, gio, song, dong };
}

/** Tải JSON, thử lại tối đa 3 lần khi máy chủ bận (503/429) hoặc rớt mạng. */
async function layJson(url, lanThu = 0) {
  let r;
  try { r = await fetch(url); }
  catch (e) { if (lanThu < 2) { await cho(1500 * (lanThu + 1)); return layJson(url, lanThu + 1); } throw e; }
  if (r.ok) return r.json();
  if ((r.status === 503 || r.status === 429) && lanThu < 2) { await cho(2000 * (lanThu + 1)); return layJson(url, lanThu + 1); }
  throw new Error(`HTTP ${r.status}`);
}
const cho = ms => new Promise(r => setTimeout(r, ms));

/** Số ngày có trong gói. */
export function soNgay(goi) { return goi?.gio?.daily?.time?.length || 0; }

/** Nhãn tab ngày: "Hôm nay", "Ngày mai", "Th 4 21/10", "CN 25/10". */
export function nhanNgay(goi, i) {
  if (i === 0) return "Hôm nay";
  if (i === 1) return "Ngày mai";
  const d = new Date(goi.gio.daily.time[i] + "T00:00:00");
  const thu = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"][d.getDay()];
  return `${thu} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Tóm tắt một ngày: sóng cao nhất, gió mạnh nhất, giật, hướng, mưa. Ngày 0 lấy số hiện tại. */
export function tomTatNgay(goi, i) {
  const g = goi.gio, s = goi.song;
  const hienTai = i === 0 && g.current && s.current;
  const gioMs   = hienTai ? g.current.wind_speed_10m  : g.daily.wind_speed_10m_max[i];
  const giatMs  = hienTai ? g.current.wind_gusts_10m  : g.daily.wind_gusts_10m_max[i];
  const gioHuong= hienTai ? g.current.wind_direction_10m : g.daily.wind_direction_10m_dominant[i];
  const songM   = hienTai ? s.current.wave_height     : s.daily.wave_height_max[i];
  const songHuong = hienTai ? s.current.wave_direction : s.daily.wave_direction_dominant?.[i];
  const chuKy   = hienTai ? s.current.wave_period     : s.daily.wave_period_max?.[i];
  const maTT    = hienTai ? g.current.weather_code    : g.daily.weather_code?.[i];
  return {
    ngay: g.daily.time[i], hienTai,
    gioMs, giatMs, gioHuong, capGio: capBeaufort(gioMs), capGiat: capBeaufort(giatMs),
    tenHuongGio: tenHuong(gioHuong),
    songM, songHuong, chuKy,
    muaMm: g.daily.precipitation_sum?.[i], maTT, moTaTroi: moTaThoiTiet(maTT),
  };
}

/** Dòng chảy hiện tại (nếu có): { tocDoMs, huong }. */
export function dongChayHienTai(goi) {
  const c = goi?.dong?.current;
  if (!c || c.ocean_current_velocity == null) return null;
  return { tocDoMs: c.ocean_current_velocity / 3.6, huong: c.ocean_current_direction }; // API trả km/h
}

/** Dự báo theo giờ của một ngày (24 dòng), dùng trong bảng chi tiết. */
export function theoGio(goi, i) {
  const g = goi.gio.hourly, s = goi.song.hourly, out = [];
  if (!g?.time) return out; // gói gọn (máy chủ bận) không có số theo giờ
  const ngay = goi.gio.daily.time[i];
  for (let k = 0; k < g.time.length; k++) {
    if (!g.time[k].startsWith(ngay)) continue;
    out.push({
      gio: g.time[k].slice(11, 16),
      gioMs: g.wind_speed_10m[k], giatMs: g.wind_gusts_10m[k], gioHuong: g.wind_direction_10m[k],
      capGio: capBeaufort(g.wind_speed_10m[k]),
      songM: s?.wave_height?.[k], songHuong: s?.wave_direction?.[k],
    });
  }
  return out;
}

/**
 * Đánh giá biển động trong 2 ngày tới → { muc, capGiat, songM }
 * muc: "tot" | "canh-bao" | "nguy-hiem"
 */
export function danhGiaBienDong(goi) {
  const ng = CAU_HINH.nguong;
  const giat = Math.max(...goi.gio.daily.wind_gusts_10m_max.slice(0, 2).map(capBeaufort));
  const song = Math.max(...goi.song.daily.wave_height_max.slice(0, 2).filter(v => v != null));
  let muc = "tot";
  if (giat >= ng.nguyHiem.gioCap || song >= ng.nguyHiem.songMet) muc = "nguy-hiem";
  else if (giat >= ng.bienDong.gioCap || song >= ng.bienDong.songMet) muc = "canh-bao";
  return { muc, capGiat: giat, songM: song };
}

/** Hỏi nguồn tin bão riêng (nếu cấu hình). Trả về null khi không có. */
export async function hoiTinBao() {
  if (!CAU_HINH.nguonTinBao) return null;
  try {
    const r = await fetch(CAU_HINH.nguonTinBao, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/** Mã thời tiết WMO → mô tả ngắn tiếng Việt. */
export function moTaThoiTiet(ma) {
  if (ma == null) return "";
  if (ma === 0) return "Trời quang";
  if (ma <= 2) return "Ít mây";
  if (ma === 3) return "Nhiều mây";
  if (ma <= 49) return "Sương mù";
  if (ma <= 59) return "Mưa phùn";
  if (ma <= 69) return "Mưa";
  if (ma <= 79) return "Mưa tuyết";
  if (ma <= 84) return "Mưa rào";
  if (ma <= 94) return "Mưa to";
  return "Dông, sét";
}

/** Chuỗi ngắn cho dải dưới: "Sóng 0,8 m · Gió cấp 3 Đông Bắc, giật cấp 5". */
export function dongTomTat(tt, donViSong = "m") {
  const song = tt.songM != null ? `Sóng ${tt.songM.toFixed(1).replace(".", ",")} ${donViSong}` : "Sóng —";
  const giat = tt.capGiat > tt.capGio ? `, giật cấp ${tt.capGiat}` : "";
  return `${song} · Gió cấp ${tt.capGio} ${tt.tenHuongGio}${giat}`;
}
