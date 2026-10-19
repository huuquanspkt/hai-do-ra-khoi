// =====================================================================
// CON NƯỚC — giờ nước lớn, nước ròng tại trạm (Open-Meteo sea_level_height_msl)
// Trả về { luc, tram, gio[], mucM[], dinh: [{gio, mucM, loai:"lon"|"rong"}] }
// =====================================================================
import { CAU_HINH } from "./cau-hinh.js";

export async function taiConNuoc(tram, soNgay = 3) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${tram.lat}&longitude=${tram.lon}` +
    `&timezone=${encodeURIComponent(CAU_HINH.thoiTiet.muiGio)}&forecast_days=${soNgay}&hourly=sea_level_height_msl`;
  const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const gio = j.hourly.time, muc = j.hourly.sea_level_height_msl;
  if (!muc || muc.every(v => v == null)) throw new Error("Không có số mực nước tại trạm này");
  return { luc: Date.now(), tram: tram.ten, gio, mucM: muc, dinh: timDinh(gio, muc) };
}

/** Tìm cực đại (nước lớn) và cực tiểu (nước ròng) trong chuỗi theo giờ. */
function timDinh(gio, muc) {
  const out = [];
  for (let i = 1; i < muc.length - 1; i++) {
    if (muc[i] == null || muc[i - 1] == null || muc[i + 1] == null) continue;
    if (muc[i] > muc[i - 1] && muc[i] >= muc[i + 1]) out.push({ gio: gio[i], mucM: muc[i], loai: "lon" });
    else if (muc[i] < muc[i - 1] && muc[i] <= muc[i + 1]) out.push({ gio: gio[i], mucM: muc[i], loai: "rong" });
  }
  return out;
}

/** Vẽ đường mực nước 3 ngày lên canvas (rộng w, cao h). */
export function veDuong(canvas, cn, w = 340, h = 120) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"), m = cn.mucM.map(v => v ?? NaN);
  const min = Math.min(...m.filter(v => !isNaN(v))), max = Math.max(...m.filter(v => !isNaN(v)));
  const x = i => 30 + (w - 40) * i / (m.length - 1), y = v => 10 + (h - 30) * (1 - (v - min) / (max - min || 1));
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d7e2ec"; ctx.lineWidth = 1;
  for (let i = 0; i < m.length; i += 24) { ctx.beginPath(); ctx.moveTo(x(i), 10); ctx.lineTo(x(i), h - 20); ctx.stroke();
    ctx.fillStyle = "#5b7088"; ctx.font = "11px sans-serif"; ctx.fillText(cn.gio[i].slice(8, 10) + "/" + cn.gio[i].slice(5, 7), x(i) + 3, h - 6); }
  const bayGio = new Date(); const iNow = cn.gio.findIndex(t => new Date(t) > bayGio);
  if (iNow > 0) { ctx.strokeStyle = "#e8632b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(iNow - 1), 10); ctx.lineTo(x(iNow - 1), h - 20); ctx.stroke(); }
  ctx.strokeStyle = "#1e8fd6"; ctx.lineWidth = 2.5; ctx.beginPath();
  m.forEach((v, i) => { if (isNaN(v)) return; i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)); }); ctx.stroke();
  ctx.fillStyle = "#5b7088"; ctx.font = "11px sans-serif";
  ctx.fillText(`${max.toFixed(1)} m`, 2, 14); ctx.fillText(`${min.toFixed(1)} m`, 2, h - 22);
}
