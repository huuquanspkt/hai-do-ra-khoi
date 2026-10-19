// =====================================================================
// GIỌNG ĐỌC & RUNG — đọc cảnh báo bằng giọng máy (Web Speech API)
// SDFish dùng file mp3 thu sẵn ("Sen Biển"); bản mẫu này dùng giọng
// tổng hợp của hệ điều hành (tiếng Việt có trên Android/iOS mới).
// Mức đọc: "day-du" (đọc mọi thứ) | "it" (chỉ cảnh báo) | "tat"
// =====================================================================

let muc = "day-du";
let rung = true;
let daNoiGanDay = new Map(); // khoá → lúc đọc, để không lặp lại dồn dập

export function datMucGiong(m) { muc = m; }
export function datRung(b) { rung = !!b; }
export const coGiong = () => "speechSynthesis" in window;

/**
 * Đọc một câu. `loai`: "canh-bao" (đọc cả ở mức "it") | "thong-tin" (chỉ mức "day-du").
 * `khoa` + `giayLap`: nếu cùng khoá đã đọc trong khoảng này thì bỏ qua.
 */
export function noi(cau, { loai = "thong-tin", khoa = null, giayLap = 60, rungMs = 0 } = {}) {
  if (khoa) {
    const truoc = daNoiGanDay.get(khoa) || 0;
    if (Date.now() - truoc < giayLap * 1000) return false;
    daNoiGanDay.set(khoa, Date.now());
  }
  if (rungMs && rung && "vibrate" in navigator) { try { navigator.vibrate(rungMs); } catch { /* bỏ qua */ } }
  if (muc === "tat") return false;
  if (muc === "it" && loai !== "canh-bao") return false;
  if (!coGiong()) return false;
  try {
    const u = new SpeechSynthesisUtterance(cau);
    u.lang = "vi-VN"; u.rate = 0.95;
    const giongViet = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("vi"));
    if (giongViet) u.voice = giongViet;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export function imLang() { if (coGiong()) speechSynthesis.cancel(); }

/** Đọc số theo kiểu đi biển: 126 hải lý, hướng một trăm ba mươi tám độ. */
export function docKhoangCachHuong(haiLy, huong) {
  return `còn ${Math.round(haiLy)} hải lý, hướng ${Math.round(huong)} độ`;
}
