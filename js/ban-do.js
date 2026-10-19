// =====================================================================
// BẢN ĐỒ — bọc thư viện Leaflet: lớp nền, lớp phủ, điểm, tuyến, lớp màu
// Mọi vị trí truyền vào là [vĩ độ, kinh độ].
// Nếu thư viện không tải được (mất mạng lần đầu), `coBanDo` = false
// và mọi hàm trở thành không làm gì, để phần còn lại của app vẫn chạy.
// =====================================================================
import { taoLuoi, trungDiem } from "./hang-hai.js";
import { HAI_LY } from "./cau-hinh.js";
import { LUOI } from "./luoi-thoi-tiet.js";
import { BUOC_O, MAU_MUC } from "./ngu-truong.js";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const CHU_THICH = "Nền: © OpenStreetMap · Độ sâu: Esri, GEBCO, NOAA · Phao đèn: © OpenSeaMap · Dự báo: Open-Meteo — Số độ sâu chỉ để THAM KHẢO, KHÔNG thay hải đồ chính thức và Thông báo hàng hải.";

const svg = (w, h, noiDung) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${noiDung}</svg>`;
export const BIEU_TUONG = {
  tau: svg(44, 44, `<g id="tau-xoay" transform="rotate(0 22 22)"><path d="M22 4 L31 34 L22 28 L13 34 Z" fill="#1e8fd6" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></g>`),
  tro: svg(34, 42, `<path d="M17 41S3 25 3 15a14 14 0 0 1 28 0c0 10-14 26-14 26z" fill="#e8632b" stroke="#fff" stroke-width="2"/><circle cx="17" cy="15" r="6" fill="#fff"/><circle cx="17" cy="15" r="2.5" fill="#e8632b"/>`),
  dich: svg(28, 32, `<path d="M5 31V3" stroke="#14324f" stroke-width="3"/><path d="M6 4h18l-5 6 5 6H6z" fill="#c62828" stroke="#fff" stroke-width="1.5"/>`),
  diemLuu: svg(26, 26, `<path d="m13 2 3.1 6.5 7 .9-5.1 4.9 1.3 7L13 18l-6.3 3.3 1.3-7L2.9 9.4l7-.9z" fill="#f9a825" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>`),
  cangNha: svg(26, 26, `<circle cx="13" cy="13" r="11" fill="#14324f" stroke="#fff" stroke-width="2"/><path d="m7 12 6-5 6 5v7H7z" fill="#fff"/>`),
  khuTruBao: svg(26, 26, `<circle cx="13" cy="13" r="11" fill="#f9a825" stroke="#fff" stroke-width="2"/><circle cx="13" cy="7.5" r="1.8" fill="#14324f"/><path d="M13 9v11M8 15a5 5 0 0 0 10 0M6.5 15h3M16.5 15h3" stroke="#14324f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`),
  denBien: svg(22, 26, `<path d="M8 24V9l3-6 3 6v15z" fill="#fff" stroke="#c62828" stroke-width="1.8"/><path d="M5 24h12" stroke="#c62828" stroke-width="2"/><circle cx="11" cy="6" r="2" fill="#f9a825"/>`),
  tram: svg(24, 24, `<rect x="4" y="3" width="16" height="18" rx="3" fill="#fff" stroke="#1565c0" stroke-width="2"/><path d="M7 15q3-3 5 0t5 0M7 10h10" stroke="#1565c0" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  diemNong: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#1b5e20" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#1b5e20" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="#1b5e20"/></svg>`,
  diaDanh: {
    nui: `<path d="M2 13 9 3l7 10z" fill="#0f5b62"/>`, doi: `<path d="M2 13a7 7 0 0 1 14 0z" fill="#0f5b62"/>`,
    "thung-lung": `<path d="M3 3v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" fill="none" stroke="#0f5b62" stroke-width="2.4"/>`,
    hem: `<path d="M3 3v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" fill="none" stroke="#0f5b62" stroke-width="2.4"/>`,
    vach: `<path d="M3 13h5V3h2v10h5" fill="none" stroke="#0f5b62" stroke-width="2.4"/>`,
    bai: `<path d="M2 11q4-5 7 0t7 0" fill="none" stroke="#0f5b62" stroke-width="2.4"/>`,
    da: `<path d="M5 13 3 7l5-4 6 2 1 8z" fill="#0f5b62"/>`,
  },
};
const icon = (html, w, h, ax, ay, cls = "diem-svg") => window.L.divIcon({ className: cls, html, iconSize: [w, h], iconAnchor: [ax, ay] });

export class BanDo {
  constructor(idPhanTu, { tam, zoom }) {
    this.coBanDo = typeof window.L !== "undefined";
    this.phanTu = document.getElementById(idPhanTu);
    this.lop = {}; this.nen = {}; this.nenHienTai = null; this._cheDo = null; this._diemDo = [];
    if (!this.coBanDo) {
      this.phanTu.innerHTML = `<div class="thong-bao-khong-ban-do">Chưa tải được thư viện bản đồ.<br>Cần có mạng ở lần mở đầu tiên.<br>Các phần khác của app vẫn dùng được.</div>`;
      return;
    }
    const L = window.L;
    this.map = L.map(idPhanTu, { zoomControl: false, attributionControl: false, doubleClickZoom: true }).setView(tam, zoom);
    L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution(CHU_THICH).addTo(this.map);
    L.control.scale({ metric: true, imperial: true, position: "bottomleft" }).addTo(this.map);

    const tile = (url, tuyChon) => L.tileLayer(url, { crossOrigin: true, ...tuyChon });
    this.nen = {
      "hai-do":    { ten: "Hải đồ độ sâu", moTa: "Lớp cố định · Không đổi theo ngày", lop: tile(ESRI + "Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 13, maxZoom: 16 }) },
      "nhiet-bien": { ten: "Nước nóng lạnh", moTa: "Nhiệt độ mặt biển · thay đổi theo ngày · cần tải lưới dự báo", lop: null, lopMau: "nhiet-bien" },
      "ve-tinh":   { ten: "Ảnh vệ tinh", moTa: "Ảnh chụp trước đó, không phải ngay lúc này · Esri", lop: tile(ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 17 }) },
      "duong-pho": { ten: "Đường phố", moTa: "Bờ biển, cảng, đường sá · OpenStreetMap", lop: tile("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }) },
    };
    this.lop = {
      "nhan-bien":    { ten: "Hải đồ chi tiết", moTa: "Tên vịnh, mũi, đảo, độ sâu — tự lộ chi tiết khi phóng to · Esri", nhom: "hai-do", lop: tile(ESRI + "Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 13, maxZoom: 16 }) },
      "phao-den":     { ten: "Báo hiệu & nguy hiểm", moTa: "Phao, đèn, xác tàu, luồng, cáp, vùng cấm · OpenSeaMap · chỉ hiện khi phóng to gần bờ", nhom: "hai-do", lop: tile("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18 }) },
      "dia-danh-ngam":{ ten: "Tên địa danh ngầm", moTa: "Tên núi/đồi/hố ngầm dưới biển — giúp định vị ngư trường", nhom: "hai-do", lop: L.layerGroup() },
      "den-bien":     { ten: "Đèn biển", moTa: "Đèn biển chính dọc bờ · chạm để xem tầm nhìn", nhom: "hai-do", lop: L.layerGroup() },
      "khu-tru-bao":  { ten: "Khu trú bão", moTa: "Khu neo đậu tránh trú bão · QĐ 582/2024", nhom: "hai-do", lop: L.layerGroup() },
      "luoi":         { ten: "Lưới toạ độ", moTa: "Kẻ kinh/vĩ tuyến 1° trên bản đồ · không liên quan đến dự báo cá", nhom: "cai-dat", lop: L.layerGroup() },
      "ranh-gioi":    { ten: "Ranh giới vùng lộng", moTa: "NĐ 26/2019 · tàu 12–<15m · mang tính tham khảo", nhom: "cai-dat", lop: L.layerGroup() },
      "khu-bao-ton":  { ten: "Khu bảo tồn, vùng cấm đánh bắt", moTa: "Khu bảo tồn biển · vùng cấm theo mùa · tham khảo", nhom: "cai-dat", lop: L.layerGroup() },
      "tram-con-nuoc":{ ten: "Trạm con nước", moTa: "11 trạm · chạm vào trạm để xem giờ nước lớn, nước ròng", nhom: "cai-dat", lop: L.layerGroup() },
      "dia-danh-lon": { ten: "Tên vùng biển", moTa: "Biển Đông, Hoàng Sa, Trường Sa…", nhom: "cai-dat", lop: L.layerGroup() },
    };
    this._veLuoi();

    // Lớp động
    this.tau = L.marker(tam, { icon: icon(BIEU_TUONG.tau, 44, 44, 22, 22), keyboard: false, zIndexOffset: 1000 });
    this.tro = L.marker(tam, { icon: icon(BIEU_TUONG.tro, 34, 42, 17, 41), zIndexOffset: 900 });
    this.vungXem = L.circle(tam, { radius: 30 * HAI_LY, color: "#e8632b", weight: 1, opacity: .5, fillColor: "#e8632b", fillOpacity: .12, interactive: false });
    this.dich = L.marker(tam, { icon: icon(BIEU_TUONG.dich, 28, 32, 5, 31), zIndexOffset: 950 });
    this.tuyen = L.polyline([], { color: "#14324f", weight: 2.5, dashArray: "6 6" });
    this.nhanTuyen = L.marker(tam, { icon: L.divIcon({ className: "nhan-tuyen", html: "", iconSize: null }), interactive: false, keyboard: false });
    this.loTrinh = L.layerGroup().addTo(this.map);
    this.vet = L.polyline([], { color: "#e8632b", weight: 3 }).addTo(this.map);
    this.diemLuu = L.layerGroup().addTo(this.map);
    this.doKhoangCach = L.layerGroup().addTo(this.map);
    this.caLop = L.layerGroup();          // ô dự báo cá
    this.caDiemNong = L.layerGroup();     // điểm nóng
  }

  // ---------- Lớp nền và lớp phủ ----------
  datNen(khoa) {
    if (!this.coBanDo || !this.nen[khoa]) return;
    if (this.nenHienTai && this.nen[this.nenHienTai].lop) this.map.removeLayer(this.nen[this.nenHienTai].lop);
    const n = this.nen[khoa];
    // Nền "Nước nóng lạnh" là lớp màu vẽ đè lên hải đồ độ sâu
    (n.lop || this.nen["hai-do"].lop).addTo(this.map).bringToBack();
    this.nenHienTai = khoa;
  }
  datLop(khoa, bat) {
    if (!this.coBanDo || !this.lop[khoa]) return;
    const l = this.lop[khoa].lop;
    if (bat) { if (!this.map.hasLayer(l)) l.addTo(this.map); } else if (this.map.hasLayer(l)) this.map.removeLayer(l);
  }
  lopDangBat(khoa) { return this.coBanDo && !!this.lop[khoa] && this.map.hasLayer(this.lop[khoa].lop); }

  /** Nạp dữ liệu tĩnh (các tệp trong thư mục data/) vào lớp tương ứng. */
  napDuLieu({ ranhGioi, diaDanhNgam, khuTruBao, denBien, diaDanhLon, khuBaoTon, tramConNuoc }, { onTram } = {}) {
    if (!this.coBanDo) return;
    const L = window.L;
    if (ranhGioi) L.geoJSON(ranhGioi, {
      style: f => ({ color: f.properties.color || "#c62828", weight: 3, dashArray: f.properties.style === "solid" ? null : "10 8", fill: false }),
      onEachFeature: (f, l) => l.bindTooltip(`${f.properties.name}<br><small>${f.properties.moTa || ""}</small>`, { sticky: true }),
    }).addTo(this.lop["ranh-gioi"].lop);
    (diaDanhNgam?.danhSach || []).forEach(d => {
      const hinh = BIEU_TUONG.diaDanh[d.loai] || BIEU_TUONG.diaDanh.doi;
      L.marker([d.lat, d.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "nhan-ban-do", iconSize: null, html: `<div class="dia-danh-ngam">${svg(18, 14, hinh)}<span>${d.ten}</span></div>` }) }).addTo(this.lop["dia-danh-ngam"].lop);
    });
    (khuTruBao?.danhSach || []).forEach(k => L.marker([k.lat, k.lon], { icon: icon(BIEU_TUONG.khuTruBao, 26, 26, 13, 13) })
      .bindPopup(`<b>Khu trú bão ${k.ten}</b><br>${k.tinh} · cấp ${k.cap === "vung" ? "vùng" : "tỉnh"}`).addTo(this.lop["khu-tru-bao"].lop));
    (denBien?.danhSach || []).forEach(d => L.marker([d.lat, d.lon], { icon: icon(BIEU_TUONG.denBien, 22, 26, 11, 24) })
      .bindPopup(`<b>${d.ten}</b><br>Tầm nhìn ${d.tamNhinHl} hải lý`).addTo(this.lop["den-bien"].lop));
    (diaDanhLon?.danhSach || []).forEach(d => L.marker([d.lat, d.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "nhan-ban-do", iconSize: null,
      html: `<div class="dia-danh-lon">${d.ten}${d.phu ? `<div style="font-size:11px;letter-spacing:0;font-weight:600;font-style:italic">${d.phu}</div>` : ""}</div>` }) }).addTo(this.lop["dia-danh-lon"].lop));
    (khuBaoTon?.danhSach || []).forEach(k => L.circle([k.lat, k.lon], { radius: k.banKinhKm * 1000, color: "#2e7d32", weight: 2, dashArray: "6 5", fillColor: "#66bb6a", fillOpacity: .15 })
      .bindTooltip(`<b>${k.ten}</b><br><small>${k.tinh} · cấm/hạn chế khai thác · tham khảo</small>`, { sticky: true }).addTo(this.lop["khu-bao-ton"].lop));
    (tramConNuoc?.danhSach || []).forEach(t => {
      L.marker([t.lat, t.lon], { icon: icon(BIEU_TUONG.tram, 24, 24, 12, 12) }).on("click", () => onTram && onTram(t)).addTo(this.lop["tram-con-nuoc"].lop);
      L.marker([t.lat, t.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "nhan-ban-do", iconSize: null, iconAnchor: [-14, 8], html: `<span class="nhan-tram">${t.ten}</span>` }) }).addTo(this.lop["tram-con-nuoc"].lop);
    });
  }
  _veLuoi() {
    const L = window.L;
    taoLuoi(1, [0, 98, 25, 123]).forEach(d => {
      L.polyline(d.toaDo, { color: "#14324f", weight: 1, opacity: .35, interactive: false }).addTo(this.lop.luoi.lop);
      L.marker(d.toaDo[0], { interactive: false, keyboard: false, icon: L.divIcon({ className: "nhan-ban-do", iconSize: null, html: `<span class="nhan-luoi">${d.nhan}</span>` }) }).addTo(this.lop.luoi.lop);
    });
  }

  // ---------- Tàu, trỏ, đích, tuyến ----------
  capNhatTau(viTri, huong) {
    if (!this.coBanDo) return;
    this.tau.setLatLng(viTri); if (!this.map.hasLayer(this.tau)) this.tau.addTo(this.map);
    const g = this.tau.getElement()?.querySelector("#tau-xoay");
    if (g && huong != null) g.setAttribute("transform", `rotate(${huong} 22 22)`);
  }
  datTro(viTri) {
    if (!this.coBanDo) return;
    if (!viTri) { this.map.removeLayer(this.tro); this.map.removeLayer(this.vungXem); return; }
    this.tro.setLatLng(viTri); this.vungXem.setLatLng(viTri);
    if (!this.map.hasLayer(this.tro)) { this.vungXem.addTo(this.map); this.tro.addTo(this.map); }
  }
  datDich(viTri) {
    if (!this.coBanDo) return;
    if (viTri) { this.dich.setLatLng(viTri); if (!this.map.hasLayer(this.dich)) this.dich.addTo(this.map); }
    else { this.map.removeLayer(this.dich); this.veTuyenToiDich(null); }
  }
  veTuyenToiDich(tu, den, nhan) {
    if (!this.coBanDo) return;
    if (!tu || !den) { this.map.removeLayer(this.tuyen); this.map.removeLayer(this.nhanTuyen); return; }
    this.tuyen.setLatLngs([tu, den]); if (!this.map.hasLayer(this.tuyen)) this.tuyen.addTo(this.map);
    this.nhanTuyen.setLatLng(trungDiem(tu, den));
    this.nhanTuyen.setIcon(window.L.divIcon({ className: "nhan-tuyen", html: nhan, iconSize: null }));
    if (!this.map.hasLayer(this.nhanTuyen)) this.nhanTuyen.addTo(this.map);
  }
  /** Vẽ lộ trình tính được: đường xanh đậm + vòng tròn ở mỗi điểm. */
  veLoTrinh(diem) {
    if (!this.coBanDo) return;
    const L = window.L; this.loTrinh.clearLayers();
    if (!diem || diem.length < 2) return;
    L.polyline(diem, { color: "#fff", weight: 7, opacity: .9 }).addTo(this.loTrinh);
    L.polyline(diem, { color: "#1565c0", weight: 4 }).addTo(this.loTrinh);
    diem.forEach((p, i) => L.circleMarker(p, { radius: i === 0 || i === diem.length - 1 ? 8 : 6, color: "#1565c0", weight: 3, fillColor: "#fff", fillOpacity: 1 }).addTo(this.loTrinh));
  }
  veVet(diem) { if (this.coBanDo) this.vet.setLatLngs(diem || []); }
  hienDiemLuu(danhSach, cangNha, onChon) {
    if (!this.coBanDo) return;
    const L = window.L; this.diemLuu.clearLayers();
    danhSach.forEach((d, i) => L.marker([d.lat, d.lon], { icon: icon(BIEU_TUONG.diemLuu, 26, 26, 13, 13) }).bindTooltip(d.ten).on("click", () => onChon(i)).addTo(this.diemLuu));
    if (cangNha) L.marker([cangNha.lat, cangNha.lon], { icon: icon(BIEU_TUONG.cangNha, 26, 26, 13, 13) }).bindTooltip(`Cảng nhà: ${cangNha.ten}`).addTo(this.diemLuu);
  }

  // ---------- Dự báo cá ----------
  veCa(ketQua) {
    if (!this.coBanDo) return;
    const L = window.L; this.caLop.clearLayers(); this.caDiemNong.clearLayers();
    if (!ketQua) { this.map.removeLayer(this.caLop); this.map.removeLayer(this.caDiemNong); return; }
    const h = BUOC_O / 2;
    for (const c of ketQua.o) L.rectangle([[c.lat - h + .02, c.lon - h + .02], [c.lat + h - .02, c.lon + h - .02]], { color: MAU_MUC[c.muc], weight: 1, opacity: .8, fillColor: MAU_MUC[c.muc], fillOpacity: .45, interactive: false }).addTo(this.caLop);
    for (const d of ketQua.diemNong) L.marker([d.lat, d.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "diem-nong", html: `<div>${BIEU_TUONG.diemNong}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(this.caDiemNong);
    if (!this.map.hasLayer(this.caLop)) { this.caLop.addTo(this.map); this.caDiemNong.addTo(this.map); }
  }

  // ---------- Đo khoảng cách ----------
  batDo(onCapNhat) { if (!this.coBanDo) return; this._cheDo = "do"; this._diemDo = []; this.doKhoangCach.clearLayers(); this._onDo = onCapNhat; }
  xoaDo() { if (!this.coBanDo) return; this._diemDo = []; this.doKhoangCach.clearLayers(); this._onDo && this._onDo([]); }
  tatDo() { if (!this.coBanDo) return; this._cheDo = null; this._diemDo = []; this.doKhoangCach.clearLayers(); }
  _themDiemDo(viTri) {
    const L = window.L; this._diemDo.push(viTri);
    L.circleMarker(viTri, { radius: 6, color: "#fff", weight: 2, fillColor: "#e8632b", fillOpacity: 1 }).addTo(this.doKhoangCach);
    if (this._diemDo.length > 1) L.polyline(this._diemDo.slice(-2), { color: "#e8632b", weight: 3, dashArray: "4 6" }).addTo(this.doKhoangCach);
    this._onDo && this._onDo(this._diemDo.slice());
  }

  // ---------- Sự kiện ----------
  onCham(cb) { if (this.coBanDo) this.map.on("click", e => { const p = [e.latlng.lat, e.latlng.lng]; if (this._cheDo === "do") this._themDiemDo(p); else cb(p); }); }
  onGiuTay(cb) { if (this.coBanDo) this.map.on("contextmenu", e => cb([e.latlng.lat, e.latlng.lng])); }
  onKeo(cb) { if (this.coBanDo) this.map.on("dragstart", cb); }

  // ---------- Khung nhìn ----------
  nhinToi(viTri, zoom) { if (this.coBanDo) this.map.setView(viTri, zoom ?? this.map.getZoom(), { animate: true }); }
  truotToi(viTri) { if (this.coBanDo) this.map.panTo(viTri, { animate: true }); }
  vuaKhung(diem) { if (this.coBanDo && diem.length) this.map.fitBounds(window.L.latLngBounds(diem).pad(.3)); }
  tam() { if (!this.coBanDo) return null; const c = this.map.getCenter(); return [c.lat, c.lng]; }
  zoom() { return this.coBanDo ? this.map.getZoom() : 0; }
  capNhatKichThuoc() { if (this.coBanDo) setTimeout(() => this.map.invalidateSize(), 50); }

  /** Danh sách URL ô bản đồ (nền + lớp phủ dạng ô đang bật) trong khung nhìn, từ zMin tới zMax. */
  urlOTrongKhung(zMin, zMax) {
    if (!this.coBanDo) return [];
    const L = window.L, b = this.map.getBounds(), rad = d => d * Math.PI / 180, out = [];
    const nen = this.nen[this.nenHienTai]?.lop || this.nen["hai-do"].lop;
    const lopO = [nen, ...Object.values(this.lop).map(x => x.lop).filter(l => l instanceof L.TileLayer && this.map.hasLayer(l))];
    for (const lop of lopO) for (let z = zMin; z <= Math.min(zMax, lop.options.maxNativeZoom || lop.options.maxZoom || 18); z++) {
      const n = 2 ** z, x = lon => Math.floor((lon + 180) / 360 * n);
      const y = lat => Math.floor((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2 * n);
      for (let tx = x(b.getWest()); tx <= x(b.getEast()); tx++) for (let ty = y(b.getNorth()); ty <= y(b.getSouth()); ty++) out.push(L.Util.template(lop._url, { s: "a", z, x: tx, y: ty }));
    }
    return out;
  }
}
