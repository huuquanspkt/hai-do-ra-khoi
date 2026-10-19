// =====================================================================
// NGƯ TRƯỜNG — "Dự báo cá": chỉ số thuận lợi tính từ lưới dự báo
// MÔ HÌNH ĐƠN GIẢN, CHỈ ĐỂ THAM KHẢO. Dựa trên các dấu hiệu ngư dân
// hay dùng: ranh nước nóng/lạnh (front nhiệt), nhiệt mặt biển vừa phải,
// biển êm, dòng chảy vừa. SDFish dùng thêm ảnh vệ tinh (chlorophyll) và
// khí hậu cá theo mùa — bản mẫu không có hai nguồn đó.
// Kết quả: lưới ô 0,5° với muc 0 (thấp) / 1 (trung bình) / 2 (cao) và
// danh sách "điểm nóng" (ô cao nhất, cách nhau > 1°).
// =====================================================================
import { LUOI, giaTriTai } from "./luoi-thoi-tiet.js";

export const BUOC_O = 0.5;

/** Tính chỉ số cho mốc giờ k của gói lưới. Trả về { o: [{lat, lon, diem, muc}], diemNong: [...] } */
export function tinhChiSoCa(goi, k) {
  const co = b => !!goi?.lop?.[b];
  if (!goi || !co("sea_surface_temperature")) return null;
  const o = [];
  for (let lat = LUOI.latMin + BUOC_O / 2; lat < LUOI.latMax; lat += BUOC_O) {
    for (let lon = LUOI.lonMin + BUOC_O / 2; lon < LUOI.lonMax; lon += BUOC_O) {
      const sst = giaTriTai(goi, "sea_surface_temperature", k, lat, lon);
      if (isNaN(sst)) continue; // đất liền
      // 1) Front nhiệt: chênh lệch nhiệt với 4 ô xung quanh (°C / 0,5°)
      const lanCan = [[lat + BUOC_O, lon], [lat - BUOC_O, lon], [lat, lon + BUOC_O], [lat, lon - BUOC_O]]
        .map(p => giaTriTai(goi, "sea_surface_temperature", k, p[0], p[1])).filter(v => !isNaN(v));
      const front = lanCan.length ? Math.max(...lanCan.map(v => Math.abs(v - sst))) : 0;
      const dFront = Math.min(1, front / 0.5);                      // 0,5°C chênh trong 0,5° = front mạnh
      // 2) Nhiệt độ vừa (cá nổi nhiệt đới ưa 26–29°C)
      const dNhiet = sst < 24 || sst > 31 ? 0 : sst >= 26 && sst <= 29 ? 1 : 0.5;
      // 3) Biển êm
      const song = giaTriTai(goi, "wave_height", k, lat, lon);
      const dSong = isNaN(song) ? 0.5 : song < 1 ? 1 : song < 2 ? 0.6 : song < 3 ? 0.25 : 0;
      // 4) Dòng chảy vừa phải (0,2–0,8 m/s thường tụ mồi)
      const dong = giaTriTai(goi, "ocean_current_velocity", k, lat, lon) / 3.6; // km/h → m/s
      const dDong = isNaN(dong) ? 0.5 : dong >= 0.2 && dong <= 0.8 ? 1 : dong < 0.2 ? 0.5 : 0.3;
      const diem = 0.45 * dFront + 0.25 * dNhiet + 0.15 * dSong + 0.15 * dDong;
      o.push({ lat, lon, diem, muc: diem >= 0.62 ? 2 : diem >= 0.42 ? 1 : 0 });
    }
  }
  // Điểm nóng: ô điểm cao nhất, không trùng vùng nhau (cách nhau > 1°)
  const diemNong = [];
  for (const c of [...o].sort((a, b) => b.diem - a.diem)) {
    if (c.muc < 2 || diemNong.length >= 8) break;
    if (diemNong.every(d => Math.abs(d.lat - c.lat) > 1 || Math.abs(d.lon - c.lon) > 1)) diemNong.push(c);
  }
  return { o, diemNong };
}

export const MAU_MUC = ["#43a047", "#f9a825", "#e53935"];
export const TEN_MUC = ["Thấp", "Trung bình", "Cao"];
