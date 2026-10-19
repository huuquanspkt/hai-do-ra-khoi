// =====================================================================
// LỚP MÀU — vẽ một biến của lưới thời tiết thành ảnh phủ lên bản đồ
// (tô màu nội suy + mũi tên hướng), kèm thang màu chú giải.
// Ảnh vẽ theo phép chiếu Mercator để khớp với nền bản đồ.
// =====================================================================
import { LUOI, LOP_MAU, giaTriTai } from "./luoi-thoi-tiet.js";
import { capBeaufort } from "./hang-hai.js";
import { HAI_LY } from "./cau-hinh.js";

const RONG = 520, CAO = 560; // kích thước ảnh (px)
const rad = d => d * Math.PI / 180;
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
const latTuMercY = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;

/** Đổi chuỗi màu CSS → [r,g,b,a]. */
function docMau(s) {
  const c = docMau.cache || (docMau.cache = {});
  if (c[s]) return c[s];
  const ctx = docMau.ctx || (docMau.ctx = document.createElement("canvas").getContext("2d"));
  ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = s; ctx.fillRect(0, 0, 1, 1);
  return (c[s] = Array.from(ctx.getImageData(0, 0, 1, 1).data));
}
/** Màu tại giá trị v theo thang của lớp (nội suy tuyến tính giữa các mốc màu). */
export function mauCua(lop, v) {
  const [min, max] = lop.thang, mocs = lop.mau.map(docMau);
  let t = (v - min) / (max - min); t = Math.max(0, Math.min(1, t));
  const p = t * (mocs.length - 1), i = Math.min(Math.floor(p), mocs.length - 2), f = p - i;
  return mocs[i].map((a, k) => a + (mocs[i + 1][k] - a) * f);
}

export class LopMau {
  constructor(banDo) {
    this.banDo = banDo; this.L = window.L;
    this.canvas = document.createElement("canvas"); this.canvas.width = RONG; this.canvas.height = CAO;
    this.anh = null; this.khoa = null; this.goi = null; this.k = 0;
  }
  /** Vẽ lớp `khoa` của gói `goi` tại mốc giờ k. khoa = null để tắt. */
  ve(goi, khoa, k) {
    this.goi = goi; this.khoa = khoa; this.k = k;
    if (!khoa || !goi?.lop?.[LOP_MAU[khoa].bien]) { this.tat(); return; }
    const lop = LOP_MAU[khoa], ctx = this.canvas.getContext("2d");
    const img = ctx.createImageData(RONG, CAO), d = img.data;
    const y0 = mercY(LUOI.latMin), y1 = mercY(LUOI.latMax);
    const heSo = khoa === "dong" ? 3600 / HAI_LY / 3.6 : 1; // dòng chảy API trả km/h → hải lý/giờ
    for (let py = 0; py < CAO; py++) {
      const lat = latTuMercY(y1 - (y1 - y0) * (py + .5) / CAO);
      for (let px = 0; px < RONG; px++) {
        const lon = LUOI.lonMin + (LUOI.lonMax - LUOI.lonMin) * (px + .5) / RONG;
        let v = giaTriTai(goi, lop.bien, k, lat, lon);
        const o = (py * RONG + px) * 4;
        if (isNaN(v)) { d[o + 3] = 0; continue; }
        v *= heSo;
        const [r, g, b, a] = mauCua(lop, v);
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(a * .72);
      }
    }
    ctx.putImageData(img, 0, 0);
    if (lop.huong) this._veMuiTen(ctx, lop, y0, y1, heSo);
    const url = this.canvas.toDataURL("image/png");
    const khung = [[LUOI.latMin, LUOI.lonMin], [LUOI.latMax, LUOI.lonMax]];
    if (!this.anh) { this.anh = this.L.imageOverlay(url, khung, { opacity: 1, interactive: false, zIndex: 250 }).addTo(this.banDo.map); }
    else { this.anh.setUrl(url); if (!this.banDo.map.hasLayer(this.anh)) this.anh.addTo(this.banDo.map); }
  }
  _veMuiTen(ctx, lop, y0, y1, heSo) {
    const n = LUOI.soDiem;
    ctx.strokeStyle = "rgba(20,50,79,.85)"; ctx.fillStyle = "rgba(20,50,79,.85)"; ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const lat = this.goi.lat[i], lon = this.goi.lon[j];
      const v = this.goi.lop[lop.bien][i * n + j][this.k], h = this.goi.lop[lop.huong][i * n + j][this.k];
      if (isNaN(v) || isNaN(h)) continue;
      const px = (lon - LUOI.lonMin) / (LUOI.lonMax - LUOI.lonMin) * RONG;
      const py = (y1 - mercY(lat)) / (y1 - y0) * CAO;
      // Gió/sóng: hướng API là hướng TỪ ĐÓ TỚI → mũi tên chỉ chiều thổi/đi. Dòng chảy: hướng ĐI TỚI.
      const goc = rad(lop.bien.startsWith("ocean") ? h : h + 180);
      const dai = 6 + Math.min(10, v * heSo * (lop.bien === "wave_height" ? 3 : lop.bien.startsWith("ocean") ? 4 : .6));
      const dx = Math.sin(goc) * dai, dy = -Math.cos(goc) * dai;
      ctx.beginPath(); ctx.moveTo(px - dx / 2, py - dy / 2); ctx.lineTo(px + dx / 2, py + dy / 2); ctx.stroke();
      const ax = px + dx / 2, ay = py + dy / 2, g2 = goc + Math.PI;
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.sin(g2 + .5) * 5, ay - Math.cos(g2 + .5) * 5);
      ctx.lineTo(ax + Math.sin(g2 - .5) * 5, ay - Math.cos(g2 - .5) * 5); ctx.closePath(); ctx.fill();
    }
  }
  tat() { if (this.anh && this.banDo.map.hasLayer(this.anh)) this.banDo.map.removeLayer(this.anh); this.khoa = null; }

  /** HTML thang màu chú giải cho lớp đang bật. */
  htmlChuGiai() {
    if (!this.khoa) return "";
    const lop = LOP_MAU[this.khoa], [min, max] = lop.thang;
    const dai = lop.mau.map(m => m.startsWith("rgba(255,255,255,0") ? "rgba(255,255,255,0)" : m).join(",");
    const nhan = this.khoa === "gio" ? `cấp ${capBeaufort(min)} → cấp ${capBeaufort(max)}` : `${min} → ${max} ${lop.don}`;
    return `<div class="chu-giai"><b>${lop.ten}</b><span class="dai" style="background:linear-gradient(to right,${dai})"></span><span>${nhan}</span></div>`;
  }
  /** Giá trị của lớp đang bật tại một điểm, đã đổi đơn vị hiển thị. */
  giaTri(lat, lon) {
    if (!this.khoa || !this.goi) return null;
    const lop = LOP_MAU[this.khoa]; let v = giaTriTai(this.goi, lop.bien, this.k, lat, lon);
    if (isNaN(v)) return null;
    if (this.khoa === "dong") v = v / 3.6 * 3600 / HAI_LY;
    if (this.khoa === "gio") return `Gió cấp ${capBeaufort(v)} (${v.toFixed(1)} m/s)`;
    return `${lop.ten}: ${v.toFixed(lop.don === "hPa" || lop.don === "%" || lop.don === "J/kg" ? 0 : 1)} ${lop.don}`;
  }
}
