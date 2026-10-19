// =====================================================================
// APP — nối các phần lại: trạng thái, bản đồ, GPS, thời tiết, giao diện
// Đọc từ trên xuống: TRẠNG THÁI → KHỞI ĐỘNG → VẼ LẠI → GPS → THỜI TIẾT
// → CÁC BẢNG (lớp, đến điểm, điểm lưu, lộ trình, dữ liệu) → DẪN ĐƯỜNG
// =====================================================================
import { CAU_HINH, HAI_LY } from "./cau-hinh.js";
import * as HH from "./hang-hai.js";
import { kho, dinhDangByte, tuoi } from "./kho.js";
import { BanDo } from "./ban-do.js";
import * as GPS from "./dinh-vi.js";
import * as TT from "./thoi-tiet.js";
import * as GN from "./giong-noi.js";
import * as GD from "./giao-dien.js";

const PHIEN_BAN = "2026-10-19 · bản mẫu";

// ---------------------------------------------------------------------
// TRẠNG THÁI (một chỗ duy nhất; mọi thứ hiện trên màn hình suy ra từ đây)
// ---------------------------------------------------------------------
const S = {
  caiDat: { ...CAU_HINH.caiDatMacDinh, ...kho.doc("cai-dat", {}) },
  viTri: null, tocDoMs: null, huong: null, gpsLoi: null,   // tàu
  dich: kho.doc("dich", null),                            // [lat, lon] hoặc null
  diemLuu: kho.doc("diem-luu", []),                       // [{ten, lat, lon, luc}]
  cangNha: kho.doc("cang-nha", null),                     // {ten, lat, lon}
  loTrinh: kho.doc("lo-trinh", []),                       // [[lat, lon], …]
  vet: kho.doc("vet", []), ghiVet: false,
  dangChay: false, bamTheo: true,
  goiTau: kho.doc("goi-tau", null),                       // dự báo tại tàu / tâm bản đồ
  goiDiem: kho.doc("goi-diem", null),                     // dự báo tại điểm người dùng chạm
  diemXem: null,                                          // điểm đang xem (chạm trên bản đồ)
  ngayChon: 0,
  tinBao: kho.doc("tin-bao", null),
  duLieu: {},                                             // các tệp data/*.json
};
/** Ghi một phần trạng thái xuống máy. Khoá trùng với tên trường đã đọc ở trên. */
const LUU = {
  "cai-dat": () => S.caiDat, dich: () => S.dich, "diem-luu": () => S.diemLuu, "cang-nha": () => S.cangNha,
  "lo-trinh": () => S.loTrinh, vet: () => S.vet, "goi-tau": () => S.goiTau, "goi-diem": () => S.goiDiem, "tin-bao": () => S.tinBao,
};
const luu = k => kho.ghi(k, LUU[k]());
const cungDiem = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

const banDo = new BanDo("ban-do", { tam: S.dich || CAU_HINH.tamMacDinh, zoom: CAU_HINH.zoomMacDinh });

// Hàm tiện: định dạng theo cài đặt hiện hành
const fViTri = p => HH.dinhDangViTri(p, S.caiDat.toaDo);
const fViTri1 = p => HH.dinhDangViTriMotDong(p, S.caiDat.toaDo);
const fKc = m => HH.dinhDangKhoangCach(m, S.caiDat.donVi);
const goiHienTai = () => S.goiDiem || S.goiTau;

// ---------------------------------------------------------------------
// KHỞI ĐỘNG
// ---------------------------------------------------------------------
async function khoiDong() {
  GN.datMucGiong(S.caiDat.giong); GN.datRung(S.caiDat.rung);
  banDo.datNen(S.caiDat.nen);
  await napDuLieu();
  Object.keys(banDo.lop).forEach(k => banDo.datLop(k, S.caiDat.lopBat.includes(k)));
  banDo.veVet(S.vet);
  banDo.hienDiemLuu(S.diemLuu, S.cangNha, i => moBangDiem([S.diemLuu[i].lat, S.diemLuu[i].lon], S.diemLuu[i].ten));
  banDo.onCham(chamBanDo);
  banDo.onGiuTay(p => moBangDiem(p));
  banDo.onKeo(() => { S.bamTheo = false; });
  noiNut();
  veLai();
  hienThoiTiet();
  capNhatThoiTiet();
  window.addEventListener("online", () => capNhatThoiTiet(true));
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function napDuLieu() {
  const tep = { ranhGioi: "ranh-gioi", diaDanhNgam: "dia-danh-ngam", khuTruBao: "khu-tru-bao", denBien: "den-bien", diaDanhLon: "dia-danh-lon", cang: "cang" };
  await Promise.all(Object.entries(tep).map(async ([k, ten]) => {
    try { S.duLieu[k] = await (await fetch(`data/${ten}.json`)).json(); } catch { S.duLieu[k] = null; }
  }));
  banDo.napDuLieu(S.duLieu);
}

// ---------------------------------------------------------------------
// VẼ LẠI — gọi mỗi khi trạng thái đổi
// ---------------------------------------------------------------------
function veLai() {
  // Thẻ vị trí
  let tau = "Chưa bật GPS", phu = 'Chạm "Bật GPS" để bắt đầu';
  if (S.viTri) {
    tau = fViTri(S.viTri);
    const p = [];
    if (S.tocDoMs != null) p.push(HH.dinhDangTocDo(S.tocDoMs, S.caiDat.donVi));
    if (S.huong != null) p.push(`hướng ${Math.round(S.huong)}°`);
    if (S.dich) {
      const m = HH.khoangCach(S.viTri, S.dich);
      p.push(`${fKc(m)} · ${Math.round(HH.huongDi(S.viTri, S.dich))}°`);
      if (S.tocDoMs > 0.3) p.push(HH.dinhDangThoiGian(m / S.tocDoMs / 3600));
    }
    phu = p.join(" · ") || (GPS.dangThu ? "Chế độ thử" : "Đang chờ vệ tinh…");
  } else if (S.gpsLoi) { tau = "Định vị bị chặn"; phu = "Cài đặt › Vị trí"; }
  GD.theViTri({ tau, dich: S.dich ? fViTri(S.dich) : "Chưa chọn", phu });

  // Bản đồ: đích, tuyến, lộ trình
  banDo.datDich(S.dich);
  if (S.viTri && S.dich) {
    const m = HH.khoangCach(S.viTri, S.dich);
    banDo.veTuyenToiDich(S.viTri, S.dich, `${fKc(m)} · ${Math.round(HH.huongDi(S.viTri, S.dich))}°`);
  } else banDo.veTuyenToiDich(null);
  banDo.veLoTrinh(S.loTrinh);

  // Nhãn ranh giới (tính từ tàu; chưa có GPS thì từ đích để vẫn có số tham khảo)
  const goc = S.viTri || S.dich;
  const rg = goc ? ranhGioiGanNhat(goc) : null;
  if (rg) GD.nhanRanhGioi(`${fKc(rg.met)} tới ${rg.ten}`, rg.met / HAI_LY < CAU_HINH.nguong.ranhGioiHaiLy);
  else GD.nhanRanhGioi(null);

  // Nút
  GD.nutBat("nut-gps", !!S.viTri, S.viTri ? "Vị trí" : "Bật GPS");
  GD.nutBat("nut-chay", S.dangChay, S.dangChay ? "Đang chạy" : "Bắt đầu chạy");

  // Gói ngoại tuyến
  const g = S.goiTau;
  if (!g) GD.goiNgoaiTuyen("Chưa có dự báo — chạm để tải", true);
  else {
    const han = new Date(g.hanDung), hetHan = Date.now() > g.hanDung;
    GD.goiNgoaiTuyen(hetHan ? "Dự báo đã cũ — chạm tải mới" : `Đã lưu đủ dự báo — tới ngày ${han.getDate()}/${han.getMonth() + 1}`, hetHan);
  }
}

/** Ranh giới (is_border) gần nhất tính từ một điểm → { ten, met } hoặc null. */
function ranhGioiGanNhat(p) {
  const rg = S.duLieu.ranhGioi; if (!rg) return null;
  let tot = null;
  for (const f of rg.features) {
    if (!f.properties.is_border) continue;
    const g = f.geometry;
    const duong = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : g.type === "Polygon" ? g.coordinates : [];
    for (const d of duong) { const m = HH.khoangCachToiDuong(p, d); if (!tot || m < tot.met) tot = { ten: f.properties.name, met: m }; }
  }
  return tot;
}

// ---------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------
function coViTriMoi({ viTri, tocDoMs, huong }) {
  S.viTri = viTri; S.gpsLoi = null;
  if (tocDoMs != null) S.tocDoMs = tocDoMs;
  if (huong != null) S.huong = huong;
  banDo.capNhatTau(viTri, S.huong);
  if (S.bamTheo) banDo.truotToi(viTri);
  if (S.ghiVet) {
    const cuoi = S.vet[S.vet.length - 1];
    if (!cuoi || HH.khoangCach(cuoi, viTri) > 30) { S.vet.push(viTri); banDo.veVet(S.vet); luu("vet"); }
  }
  veLai();
  if (S.dangChay) kiemTraCanhBao();
  capNhatThoiTiet();
}
function batGPS() {
  S.bamTheo = true;
  if (S.viTri) banDo.nhinToi(S.viTri, Math.max(banDo.zoom(), 10));
  GPS.batDinhVi(coViTriMoi, loi => {
    S.gpsLoi = loi; veLai();
    GD.thanhBao("canh-bao", loi.chu + " Giữ nút GPS 1 giây để chạy thử.");
  });
}

// ---------------------------------------------------------------------
// THỜI TIẾT
// ---------------------------------------------------------------------
let dangTaiTT = false;
/** Tải dự báo tại tàu (hoặc tâm bản đồ) nếu gói cũ, tàu đi xa, hoặc `ep` = true. */
async function capNhatThoiTiet(ep = false) {
  if (dangTaiTT || !navigator.onLine) return;
  const tai = S.viTri || banDo.tam() || CAU_HINH.tamMacDinh;
  const g = S.goiTau, tt = CAU_HINH.thoiTiet;
  const cu = !g || Date.now() - g.luc > tt.lamMoiSauGio * 3600e3;
  const xa = g && HH.khoangCach(g.viTri, tai) > tt.lamMoiKhiDiXaHaiLy * HAI_LY;
  if (!ep && !cu && !xa) return;
  dangTaiTT = true;
  try {
    S.goiTau = await TT.taiDuBao(tai); luu("goi-tau");
    S.tinBao = (await TT.hoiTinBao()) || { tuDuBao: true, luc: Date.now() }; luu("tin-bao");
  } catch { if (!g) GD.thanhBao("canh-bao", "Chưa tải được dự báo. Cần có mạng ở lần đầu."); }
  dangTaiTT = false;
  hienThoiTiet(); veLai();
}

/** Tải dự báo tại một điểm người dùng chạm (để "hỏi gió sóng ngay chỗ đó"). */
async function hoiGioSongTai(p) {
  S.diemXem = p; banDo.hienDiemTam(p);
  if (!navigator.onLine) { S.goiDiem = (S.goiDiem && HH.khoangCach(S.goiDiem.viTri, p) < 30 * HAI_LY) ? S.goiDiem : null; hienThoiTiet(); return; }
  GD.songGio("Đang hỏi gió sóng tại điểm…");
  try { S.goiDiem = await TT.taiDuBao(p); luu("goi-diem"); }
  catch { S.goiDiem = null; }
  hienThoiTiet();
}

function hienThoiTiet() {
  const g = goiHienTai();
  // Thanh tin bão
  if (S.tinBao && !S.tinBao.tuDuBao) {
    const t = S.tinBao;
    GD.thanhBao(t.coBao ? "nguy-hiem" : "tot", t.coBao ? `BÃO ${t.ten || ""}: ${t.moTa || "xem bản tin"}` : `Không có tin bão — ${t.moTa || "nguồn riêng"}`);
  } else if (S.goiTau) {
    const d = new Date(S.goiTau.luc), gioHoi = `hỏi lúc ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ngày ${d.getDate()}/${d.getMonth() + 1}`;
    const dg = TT.danhGiaBienDong(S.goiTau);
    if (dg.muc === "nguy-hiem") GD.thanhBao("nguy-hiem", `Gió giật cấp ${dg.capGiat}, sóng ${dg.songM.toFixed(1)} m trong 2 ngày tới — cân nhắc vào bờ (${gioHoi})`);
    else if (dg.muc === "canh-bao") GD.thanhBao("canh-bao", `Biển động: gió giật cấp ${dg.capGiat}, sóng ${dg.songM.toFixed(1)} m (${gioHoi})`);
    else GD.thanhBao("tot", `Không có tin bão — ${gioHoi}`);
  } else GD.thanhBao("canh-bao", "Chưa có tin bão trong máy — cần mạng để hỏi");

  // Tab ngày + dải sóng gió
  if (!g) { GD.tabNgay([], 0, () => {}); GD.songGio("Chưa có dữ liệu sóng gió"); return; }
  const n = TT.soNgay(g);
  if (S.ngayChon >= n) S.ngayChon = 0;
  GD.tabNgay(Array.from({ length: n }, (_, i) => TT.nhanNgay(g, i)), S.ngayChon, i => { S.ngayChon = i; hienThoiTiet(); });
  const tt = TT.tomTatNgay(g, S.ngayChon);
  GD.songGio(TT.dongTomTat(tt) + (S.goiDiem ? " · tại điểm" : ""), tt.gioHuong);
}

// ---------------------------------------------------------------------
// NÚT & SỰ KIỆN
// ---------------------------------------------------------------------
function noiNut() {
  // Bật GPS: chạm = GPS thật; giữ 1 giây = chế độ thử
  let bamGiu = null;
  const nutGps = GD.$("nut-gps");
  nutGps.addEventListener("pointerdown", () => { bamGiu = setTimeout(() => { bamGiu = "giu"; batCheDoThu(); }, 900); });
  nutGps.addEventListener("pointerup", () => { if (bamGiu === "giu") { bamGiu = null; return; } clearTimeout(bamGiu); batGPS(); });
  nutGps.addEventListener("pointerleave", () => { if (bamGiu !== "giu") clearTimeout(bamGiu); });

  GD.$("nut-lop").onclick = () => moBangLop("hai-do");
  GD.$("nut-chay").onclick = batTatDanDuong;
  GD.$("nut-den-diem").onclick = moBangDenDiem;
  GD.$("nut-diem-luu").onclick = moBangDiemLuu;
  GD.$("nut-lo-trinh").onclick = moBangLoTrinh;
  GD.$("goi-ngoai-tuyen").onclick = moBangDuLieu;
  GD.$("song-gio").onclick = moBangSongGio;
  document.querySelectorAll(".thanh-tab button").forEach(b => b.onclick = () => chonTabChinh(b.dataset.tab));
  document.addEventListener("keydown", e => { if (e.key === "Escape") GD.dongBang(); });
}

function batCheDoThu() {
  GPS.batCheDoThu(S.viTri || S.dich || banDo.tam() || CAU_HINH.tamMacDinh, coViTriMoi);
  S.bamTheo = true;
  GD.thanhBao("canh-bao", "Đang chạy thử bằng GPS giả lập — chạm Bật GPS để dùng GPS thật");
}

/** Chạm bản đồ: hỏi gió sóng tại chỗ đó (như SDFish). */
function chamBanDo(p) {
  if (GD.bangDangMo()) { GD.dongBang(); return; }
  hoiGioSongTai(p);
}

function datDich(p) { S.dich = p; luu("dich"); veLai(); }

function chonTabChinh(khoa) {
  GD.tabChinh(khoa);
  if (khoa === "ra-khoi") { GD.dongBang(); return; }
  const moTa = {
    "trang-chu": ["Trang chủ", "Chào bà con. Bản mẫu này chỉ làm phần <b>Ra khơi</b> (hải đồ, định vị, sóng gió, dẫn đường)."],
    "tau-ca": ["Tàu cá", "Giấy tờ tàu, đăng kiểm, dịch vụ sửa chữa, đồ nghề. Chưa làm trong bản mẫu."],
    "ban-thuyen": ["Bạn thuyền", "Hồ sơ thuyền viên, giấy tờ, tra cảnh báo. Chưa làm trong bản mẫu."],
    "giao-dich": ["Giao dịch", "Giá cá, giá dầu, tin mua bán, chỗ bán. Chưa làm trong bản mẫu."],
  }[khoa];
  GD.moBang(moTa[0], `<p class="ghi-chu">${moTa[1]}</p>`, null, { onDong: () => GD.tabChinh("ra-khoi") });
}

// ---------------------------------------------------------------------
// BẢNG: LỚP BẢN ĐỒ (Hải đồ · Ngư trường · Thời tiết · Công cụ · Cài đặt)
// ---------------------------------------------------------------------
function moBangLop(nhom) {
  const nhomList = [["hai-do", "Hải đồ"], ["ngu-truong", "Ngư trường"], ["thoi-tiet", "Thời tiết"], ["cong-cu", "Công cụ"], ["cai-dat", "Cài đặt"]];
  const thanh = `<div class="hang" style="margin-top:0">${nhomList.map(([k, t]) =>
    `<button class="nut ${k === nhom ? "" : "phu"}" data-nhom="${k}" style="flex:1 1 auto;padding:9px 6px;font-size:13px">${t}</button>`).join("")}</div>`;
  const noiDung = { "hai-do": htmlHaiDo, "ngu-truong": htmlNguTruong, "thoi-tiet": htmlThoiTiet, "cong-cu": htmlCongCu, "cai-dat": htmlCaiDat }[nhom]();
  GD.moBang("Lớp bản đồ", thanh + noiDung, b => {
    b.querySelectorAll("[data-nhom]").forEach(x => x.onclick = () => moBangLop(x.dataset.nhom));
    // Nền (radio) và lớp phủ (checkbox) dùng chung một cách nối
    b.querySelectorAll("input[name=nen]").forEach(r => r.onchange = () => { S.caiDat.nen = r.value; banDo.datNen(r.value); luu("cai-dat"); });
    b.querySelectorAll("input[data-lop]").forEach(c => c.onchange = () => {
      banDo.datLop(c.dataset.lop, c.checked);
      S.caiDat.lopBat = Object.keys(banDo.lop).filter(k => banDo.lopDangBat(k)); luu("cai-dat");
    });
    b.querySelectorAll("input[name=donVi]").forEach(r => r.onchange = () => { S.caiDat.donVi = r.value; luu("cai-dat"); veLai(); });
    b.querySelectorAll("input[name=toaDo]").forEach(r => r.onchange = () => { S.caiDat.toaDo = r.value; luu("cai-dat"); veLai(); });
    b.querySelectorAll("input[name=giong]").forEach(r => r.onchange = () => { S.caiDat.giong = r.value; GN.datMucGiong(r.value); luu("cai-dat"); });
    const rung = b.querySelector("#o-rung"); if (rung) rung.onchange = () => { S.caiDat.rung = rung.checked; GN.datRung(rung.checked); luu("cai-dat"); };
    const nghe = b.querySelector("#nghe-thu"); if (nghe) nghe.onclick = () => GN.noi("Sen Biển xin chào. Còn 126 hải lý, hướng 138 độ. Sóng 0,8 mét, gió cấp 3 Đông Bắc.", { loai: "canh-bao", rungMs: 200 }) || GD.thanhBao("canh-bao", "Máy không có giọng đọc tiếng Việt, hoặc đang Tắt giọng");
    const kyHieu = b.querySelector("#ky-hieu"); if (kyHieu) kyHieu.onclick = moBangKyHieu;
    const doKc = b.querySelector("#do-kc"); if (doKc) doKc.onclick = batDoKhoangCach;
    const taiBd = b.querySelector("#tai-ban-do"); if (taiBd) taiBd.onclick = moBangTaiBanDo;
    const taiTT = b.querySelector("#tai-tt"); if (taiTT) taiTT.onclick = () => { GD.dongBang(); capNhatThoiTiet(true); };
  });
}
const lopTheoNhom = nhom => Object.entries(banDo.lop).filter(([, l]) => l.nhom === nhom)
  .map(([k, l]) => GD.htmlTuyChon("checkbox", "lop", k, l.ten, l.moTa, banDo.lopDangBat(k))).join("")
  .replace(/name="lop" value="([^"]+)"/g, 'name="lop" value="$1" data-lop="$1"');

function htmlHaiDo() {
  return GD.htmlTieuDeNhom("LỚP NỀN BẢN ĐỒ · CHỌN 1") +
    Object.entries(banDo.nen).map(([k, n]) => GD.htmlTuyChon("radio", "nen", k, n.ten, n.moTa, k === S.caiDat.nen)).join("") +
    `<p class="ghi-chu">Ảnh vệ tinh chụp trước đó, không phải ngay lúc này. Phao báo hiệu chỉ hiện khi phóng to gần bờ.</p>` +
    GD.htmlTieuDeNhom("HẢI ĐỒ CHI TIẾT") + lopTheoNhom("hai-do") +
    `<div class="hang"><button class="nut phu" id="ky-hieu">Ký hiệu là gì?</button></div>`;
}
function htmlNguTruong() {
  return `<p class="ghi-chu"><b>Dự báo cá (vùng có khả năng tập trung)</b> — theo ngày, từ ảnh vệ tinh.</p>
    <p class="ghi-chu">Bản mẫu chưa có lớp này. Cách SDFish làm: kết hợp <b>khí hậu cá theo mùa</b> (fish-climatology) với
    <b>nhiệt độ mặt biển, màu nước (chlorophyll)</b> từ ảnh vệ tinh NASA/Copernicus để tô vùng "nước nóng lạnh" và "vùng nhiều mồi".
    Dữ liệu vệ tinh miễn phí có ở NASA OceanColor và Copernicus Marine; cần máy chủ xử lý rồi phát ảnh ô bản đồ (tile) cho app.</p>`;
}
function htmlThoiTiet() {
  const g = goiHienTai();
  const bao = S.tinBao && !S.tinBao.tuDuBao ? (S.tinBao.coBao ? `<b style="color:var(--nguy-hiem)">Đang có bão.</b> ${GD.esc(S.tinBao.moTa || "")}` : "Không có tin bão trên Biển Đông (nguồn riêng).")
    : S.goiTau ? `Không có nguồn tin bão riêng — app suy ra từ dự báo gió giật tại tàu (${GD.esc(GD.$("thanh-bao-chu").textContent)}).` : "Chưa hỏi được.";
  const dong = g && TT.dongChayHienTai(g);
  return GD.htmlTieuDeNhom("CẢNH BÁO BÃO · ƯU TIÊN CAO NHẤT") + `<p class="ghi-chu">${bao}</p>
    <p class="ghi-chu">Muốn có tin bão chính thức, nối <b>CAU_HINH.nguonTinBao</b> tới máy chủ lấy bản tin của Trung tâm Dự báo KTTV quốc gia.</p>` +
    GD.htmlTieuDeNhom("GIÓ SÓNG TẠI ĐIỂM ĐANG XEM") +
    (g ? `<table class="bang-thong-tin">
      <tr><td>Tại</td><td>${GD.esc(fViTri1(g.viTri))}${S.goiDiem ? " (điểm chạm)" : " (tàu)"}</td></tr>
      <tr><td>Dòng chảy</td><td>${dong ? `${(dong.tocDoMs * 3600 / HAI_LY).toFixed(1)} hl/giờ về hướng ${HH.tenHuong(dong.huong)}` : "—"}</td></tr>
      <tr><td>Lấy lúc</td><td>${GD.esc(tuoi(g.luc))}</td></tr></table>` : `<p class="ghi-chu">Chưa có dữ liệu.</p>`) +
    `<p class="ghi-chu">Muốn biết gió, sóng ngay chỗ nào thì <b>chạm vào chỗ đó trên bản đồ</b>. Các lớp màu (mây, mưa, dông, áp suất, độ mặn) SDFish lấy từ Open-Meteo và Copernicus — bản mẫu chưa vẽ.</p>
    <div class="hang"><button class="nut" id="tai-tt">Tải lại dự báo tại tàu</button></div>`;
}
function htmlCongCu() {
  return `<p class="ghi-chu"><b>Đo khoảng cách</b> — chạm 2 điểm (hoặc nhiều điểm) trên bản đồ.</p>
    <div class="hang"><button class="nut" id="do-kc">Bắt đầu đo</button></div>
    <p class="ghi-chu" style="margin-top:16px"><b>Tải bản đồ dùng khi mất sóng</b> — lưu các ô bản đồ của vùng đang xem vào máy.</p>
    <div class="hang"><button class="nut phu" id="tai-ban-do">Tải vùng đang xem</button></div>`;
}
function htmlCaiDat() {
  const c = S.caiDat;
  return GD.htmlTieuDeNhom("ĐƠN VỊ KHOẢNG CÁCH") +
    GD.htmlTuyChon("radio", "donVi", "hl", "Hải lý", "nm · đơn vị chuẩn đi biển", c.donVi === "hl") +
    GD.htmlTuyChon("radio", "donVi", "km", "Ki-lô-mét", "km", c.donVi === "km") +
    GD.htmlTieuDeNhom("HỆ TOẠ ĐỘ") +
    GD.htmlTuyChon("radio", "toaDo", "dms", "Độ – phút – giây", "vd 8°30′00″N · 109°18′00″E", c.toaDo === "dms") +
    GD.htmlTuyChon("radio", "toaDo", "thap-phan", "Độ thập phân", "vd 8,50°N · 109,30°E", c.toaDo === "thap-phan") +
    GD.htmlTieuDeNhom("GIỌNG ĐỌC KHI CHẠY") +
    GD.htmlTuyChon("radio", "giong", "day-du", "Đọc đầy đủ", "cảnh báo, sóng gió, khoảng cách tới đích", c.giong === "day-du") +
    GD.htmlTuyChon("radio", "giong", "it", "Đọc ít", "chỉ cảnh báo ranh giới, bão, sắp tới đích", c.giong === "it") +
    GD.htmlTuyChon("radio", "giong", "tat", "Tắt giọng", "chỉ rung và chữ trên màn hình", c.giong === "tat") +
    `<label class="tuy-chon"><input type="checkbox" id="o-rung" ${c.rung ? "checked" : ""}><span><b>Rung khi có cảnh báo</b></span></label>
     <div class="hang"><button class="nut phu" id="nghe-thu">Nghe thử</button></div>
     <p class="ghi-chu">Đổi ở đây thì toạ độ, khoảng cách, dẫn đường và công cụ đo đều đổi theo.</p>` +
    GD.htmlTieuDeNhom("LỚP BẢN ĐỒ") + lopTheoNhom("cai-dat") +
    `<p class="ghi-chu">Ranh giới trong bản mẫu là toạ độ MẪU (xem data/ranh-gioi.json). Ranh chính thức tra Chi cục Thủy sản.</p>` +
    GD.htmlTieuDeNhom("PHIÊN BẢN") + `<p class="ghi-chu">${PHIEN_BAN}</p>`;
}
function moBangKyHieu() {
  const dong = (hinh, ten, moTa) => `<li><span style="flex:0 0 30px;display:grid;place-items:center">${hinh}</span><div class="noi-dung"><b>${ten}</b><span>${moTa}</span></div></li>`;
  const svg = h => `<svg viewBox="0 0 18 14" width="26" height="20">${h}</svg>`;
  GD.moBang("Ký hiệu trên hải đồ", `<ul class="danh-sach">
    ${dong(svg('<path d="M2 13 9 3l7 10z" fill="#0f5b62"/>'), "Núi ngầm", "đỉnh nhô cao dưới biển, cá hay tụ")}
    ${dong(svg('<path d="M2 13a7 7 0 0 1 14 0z" fill="#0f5b62"/>'), "Đồi ngầm", "gò thấp hơn núi")}
    ${dong(svg('<path d="M3 3v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" fill="none" stroke="#0f5b62" stroke-width="2.4"/>'), "Thung lũng / hẻm núi ngầm", "rãnh sâu dưới đáy")}
    ${dong(svg('<path d="M2 11q4-5 7 0t7 0" fill="none" stroke="#0f5b62" stroke-width="2.4"/>'), "Bãi ngầm, bãi cạn", "nước nông, có thể mắc cạn")}
    ${dong('<span style="color:#c62828;font-weight:800">– –</span>', "Nét đứt đỏ", "ranh giới ngoài vùng được phép đánh bắt")}
    ${dong('<span style="color:#ef6c00;font-weight:800">– –</span>', "Nét đứt cam", "tuyến bờ, tuyến lộng")}
    ${dong('<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#f9a825;border:2px solid #fff;box-shadow:0 0 0 1px #999"></span>', "Vòng vàng (mỏ neo)", "khu neo đậu tránh trú bão")}
    ${dong('<span style="display:inline-block;width:10px;height:16px;background:#fff;border:2px solid #c62828"></span>', "Tháp đỏ trắng", "đèn biển")}
    ${dong('<span style="color:#f9a825;font-size:20px">★</span>', "Sao vàng", "điểm bà con đã ghim")}
  </ul><p class="ghi-chu">Phao, đèn, xác tàu, cáp ngầm vẽ theo chuẩn OpenSeaMap khi phóng to gần bờ.</p>`);
}

// ---------------------------------------------------------------------
// BẢNG: ĐIỂM (chạm/giữ trên bản đồ), ĐẾN ĐIỂM, ĐIỂM ĐÃ LƯU
// ---------------------------------------------------------------------
function moBangDiem(p, ten) {
  const kc = S.viTri ? `<tr><td>Từ tàu</td><td>${GD.esc(fKc(HH.khoangCach(S.viTri, p)))} · ${Math.round(HH.huongDi(S.viTri, p))}°</td></tr>` : "";
  GD.moBang(ten || "Điểm vừa chọn", `<p class="so-lon">${GD.esc(fViTri(p))}</p><table class="bang-thong-tin">${kc}</table>
    <div class="hang"><button class="nut cam" id="d-den">Đến điểm này</button><button class="nut phu" id="d-ghim">Ghim điểm này</button></div>
    <div class="hang"><button class="nut phu" id="d-gio">Hỏi gió sóng ở đây</button><button class="nut phu" id="d-lt">Thêm vào lộ trình</button></div>`,
    b => {
      b.querySelector("#d-den").onclick = () => { datDich(p); GD.dongBang(); if (S.viTri) banDo.vuaKhung([S.viTri, p]); };
      b.querySelector("#d-ghim").onclick = () => ghimDiem(p, ten);
      b.querySelector("#d-gio").onclick = () => { GD.dongBang(); hoiGioSongTai(p); };
      b.querySelector("#d-lt").onclick = () => { S.loTrinh.push(p); luu("lo-trinh"); veLai(); moBangLoTrinh(); };
    });
}
function ghimDiem(p, tenGoiY) {
  GD.moBang("Ghim điểm", `<label class="o-nhap">Tên điểm (rạn, bãi mực, nhà giàn…)<input id="g-ten" value="${GD.esc(tenGoiY || `Điểm ${S.diemLuu.length + 1}`)}"></label>
    <p class="so-lon" style="font-size:14px">${GD.esc(fViTri1(p))}</p><div class="hang"><button class="nut" id="g-ok">Lưu</button></div>`,
    b => { b.querySelector("#g-ten").focus(); b.querySelector("#g-ok").onclick = () => {
      S.diemLuu.push({ ten: b.querySelector("#g-ten").value.trim() || `Điểm ${S.diemLuu.length + 1}`, lat: p[0], lon: p[1], luc: Date.now() });
      luu("diem-luu"); banDo.hienDiemLuu(S.diemLuu, S.cangNha, i => moBangDiem([S.diemLuu[i].lat, S.diemLuu[i].lon], S.diemLuu[i].ten)); GD.dongBang(); }; });
}
function moBangDenDiem() {
  const c = S.dich || S.viTri || banDo.tam() || CAU_HINH.tamMacDinh;
  const f = v => S.caiDat.toaDo === "dms" ? HH.dms(v, "", "").replace(/[°′″]/g, " ").trim() : Math.abs(v).toFixed(4);
  GD.moBang("Đến điểm — nhập toạ độ", `<p class="ghi-chu">Gõ độ, phút, giây cách nhau bằng dấu cách (vd <b>8 30</b> = 8°30′) hoặc số thập phân (vd <b>8.5</b>).</p>
    <div class="hang"><label class="o-nhap">Vĩ độ (N)<input id="dd-lat" inputmode="decimal" placeholder="vd 8 30" value="${f(c[0])}" aria-label="Vĩ độ"></label>
    <label class="o-nhap">Kinh độ (E)<input id="dd-lon" inputmode="decimal" placeholder="vd 109 18" value="${f(c[1])}" aria-label="Kinh độ"></label></div>
    <div class="hang"><button class="nut cam" id="dd-di">Đến điểm</button><button class="nut phu" id="dd-ghim">Ghim điểm này</button>${S.dich ? `<button class="nut do" id="dd-bo">Bỏ đích</button>` : ""}</div>
    <p class="ghi-chu" id="dd-loi"></p>
    <p class="ghi-chu">Hoặc đóng bảng này rồi <b>giữ tay lên bản đồ</b> để chọn điểm.</p>`,
    b => {
      const doc = () => { const p = [HH.docToaDo(b.querySelector("#dd-lat").value), HH.docToaDo(b.querySelector("#dd-lon").value)];
        if (!(Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) { b.querySelector("#dd-loi").textContent = "Toạ độ chưa đúng. Ví dụ: 13 00 00 và 110 30 00."; return null; } return p; };
      b.querySelector("#dd-di").onclick = () => { const p = doc(); if (p) { datDich(p); GD.dongBang(); banDo.vuaKhung(S.viTri ? [S.viTri, p] : [p]); } };
      b.querySelector("#dd-ghim").onclick = () => { const p = doc(); if (p) ghimDiem(p); };
      const bo = b.querySelector("#dd-bo"); if (bo) bo.onclick = () => { datDich(null); GD.dongBang(); };
    });
}
function moBangDiemLuu() {
  const ds = S.diemLuu.map((d, i) => `<li><div class="noi-dung"><b>${GD.esc(d.ten)}</b><span>${GD.esc(fViTri1([d.lat, d.lon]))}${S.viTri ? ` · ${GD.esc(fKc(HH.khoangCach(S.viTri, [d.lat, d.lon])))}` : ""}</span></div>
      <button class="nut phu" data-den="${i}">Đến</button><button class="nut do" data-xoa="${i}">Xoá</button></li>`).join("");
  GD.moBang("Điểm đã lưu", (S.diemLuu.length ? `<ul class="danh-sach">${ds}</ul>` :
    `<p class="ghi-chu">Chưa ghim chỗ nào. Chạm vào chỗ hay đánh trên bản đồ rồi bấm <b>Ghim điểm này</b> — lần sau mở một chạm là tới.</p>`) +
    `<div class="hang"><button class="nut" id="dl-them">Thêm điểm (chỗ đang xem)</button></div>` +
    GD.htmlTieuDeNhom("CẢNG NHÀ") + `<p class="ghi-chu">${S.cangNha ? `<b>${GD.esc(S.cangNha.ten)}</b> · ${GD.esc(fViTri1([S.cangNha.lat, S.cangNha.lon]))}` : "Cảng nhà: chưa đặt"}</p>
    <div class="hang"><select id="dl-cang" class="o-nhap" style="padding:11px;border:1px solid #c5d3e0;border-radius:10px;font-family:var(--f-ui)">
      <option value="">— chọn cảng —</option>${(S.duLieu.cang?.danhSach || []).map((c, i) => `<option value="${i}">${GD.esc(c.ten)}</option>`).join("")}</select>
      <button class="nut phu" id="dl-cang-ok">Đặt làm cảng nhà</button></div>`,
    b => {
      b.querySelectorAll("[data-den]").forEach(x => x.onclick = () => { const d = S.diemLuu[+x.dataset.den]; datDich([d.lat, d.lon]); GD.dongBang(); banDo.nhinToi([d.lat, d.lon]); });
      b.querySelectorAll("[data-xoa]").forEach(x => x.onclick = () => { S.diemLuu.splice(+x.dataset.xoa, 1); luu("diem-luu"); banDo.hienDiemLuu(S.diemLuu, S.cangNha, i => moBangDiem([S.diemLuu[i].lat, S.diemLuu[i].lon], S.diemLuu[i].ten)); moBangDiemLuu(); });
      b.querySelector("#dl-them").onclick = () => ghimDiem(S.diemXem || S.viTri || banDo.tam() || CAU_HINH.tamMacDinh);
      b.querySelector("#dl-cang-ok").onclick = () => { const i = b.querySelector("#dl-cang").value; if (i === "") return;
        S.cangNha = S.duLieu.cang.danhSach[+i]; luu("cang-nha"); banDo.hienDiemLuu(S.diemLuu, S.cangNha, j => moBangDiem([S.diemLuu[j].lat, S.diemLuu[j].lon], S.diemLuu[j].ten)); moBangDiemLuu(); };
    });
}

// ---------------------------------------------------------------------
// BẢNG: LỘ TRÌNH
// ---------------------------------------------------------------------
function moBangLoTrinh() {
  const xuatPhat = S.viTri ? { ten: "Vị trí tàu (GPS)", p: S.viTri } : S.cangNha ? { ten: `Cảng nhà: ${S.cangNha.ten}`, p: [S.cangNha.lat, S.cangNha.lon] } : cangGanNhat(S.loTrinh[0] || S.dich);
  const diem = xuatPhat ? [xuatPhat.p, ...S.loTrinh] : S.loTrinh.slice();
  const tong = HH.chieuDaiTuyen(diem);
  const tocDo = kho.doc("toc-do-lo-trinh", 7);
  const ds = S.loTrinh.map((p, i) => `<li><div class="noi-dung"><b>Điểm ${i + 1}</b><span>${GD.esc(fViTri1(p))}${i > 0 || xuatPhat ? ` · ${GD.esc(fKc(HH.khoangCach(diem[i], p)))} từ điểm trước` : ""}</span></div>
      <button class="nut do" data-bo="${i}">Bỏ</button></li>`).join("");
  GD.moBang("Lộ trình", `<p class="ghi-chu"><b>Điểm xuất phát:</b> ${xuatPhat ? `${GD.esc(xuatPhat.ten)}<br>${GD.esc(fViTri1(xuatPhat.p))}` : "chưa có (bật GPS hoặc đặt cảng nhà)"}</p>
    ${S.loTrinh.length ? `<ul class="danh-sach">${ds}</ul>` : `<p class="ghi-chu">Chưa có điểm nào. Giữ tay lên bản đồ rồi chọn <b>Thêm vào lộ trình</b>, hoặc bấm nút dưới để thêm chỗ đang xem / đích.</p>`}
    <div class="hang"><button class="nut phu" id="lt-them">Thêm chỗ đang xem</button>${S.dich ? `<button class="nut phu" id="lt-them-dich">Thêm đích</button>` : ""}</div>
    <table class="bang-thong-tin"><tr><td>Tổng quãng</td><td>${diem.length > 1 ? GD.esc(fKc(tong)) : "—"}</td></tr>
      <tr><td>Tốc độ</td><td><input id="lt-toc-do" inputmode="decimal" value="${tocDo}" style="width:70px;font-family:var(--f-so);padding:6px;border:1px solid #c5d3e0;border-radius:8px"> hải lý/giờ</td></tr>
      <tr><td>Thời gian</td><td id="lt-tg">${diem.length > 1 ? HH.dinhDangThoiGian(tong / HAI_LY / tocDo) : "—"}</td></tr></table>
    <div class="hang"><button class="nut cam" id="lt-dan" ${S.loTrinh.length ? "" : "disabled"}>Dẫn đường tới điểm 1</button><button class="nut do" id="lt-xoa" ${S.loTrinh.length ? "" : "disabled"}>Xoá lộ trình</button></div>
    <p class="ghi-chu">Khi tới điểm 1 (dưới ${CAU_HINH.nguong.sapToiDichHaiLy} hải lý), app tự chuyển đích sang điểm kế tiếp.</p>`,
    b => {
      b.querySelectorAll("[data-bo]").forEach(x => x.onclick = () => { S.loTrinh.splice(+x.dataset.bo, 1); luu("lo-trinh"); veLai(); moBangLoTrinh(); });
      b.querySelector("#lt-them").onclick = () => { S.loTrinh.push(S.diemXem || banDo.tam() || CAU_HINH.tamMacDinh); luu("lo-trinh"); veLai(); moBangLoTrinh(); };
      const td = b.querySelector("#lt-them-dich"); if (td) td.onclick = () => { S.loTrinh.push(S.dich); luu("lo-trinh"); veLai(); moBangLoTrinh(); };
      b.querySelector("#lt-toc-do").oninput = e => { const v = parseFloat(e.target.value.replace(",", ".")); if (v > 0) { kho.ghi("toc-do-lo-trinh", v); b.querySelector("#lt-tg").textContent = diem.length > 1 ? HH.dinhDangThoiGian(tong / HAI_LY / v) : "—"; } };
      b.querySelector("#lt-dan").onclick = () => { datDich(S.loTrinh[0]); GD.dongBang(); banDo.vuaKhung(diem); if (!S.dangChay) batTatDanDuong(); };
      b.querySelector("#lt-xoa").onclick = () => { S.loTrinh = []; luu("lo-trinh"); veLai(); moBangLoTrinh(); };
    });
}
function cangGanNhat(p) {
  const ds = S.duLieu.cang?.danhSach; if (!ds || !p) return null;
  let tot = null;
  for (const c of ds) { const m = HH.khoangCach(p, [c.lat, c.lon]); if (!tot || m < tot.m) tot = { m, ten: `${c.ten} — gần điểm đến nhất`, p: [c.lat, c.lon] }; }
  return tot;
}

// ---------------------------------------------------------------------
// BẢNG: SÓNG GIÓ CHI TIẾT, DỮ LIỆU ĐÃ LƯU, TẢI BẢN ĐỒ, ĐO KHOẢNG CÁCH
// ---------------------------------------------------------------------
function moBangSongGio() {
  const g = goiHienTai();
  if (!g) { GD.moBang("Gió sóng", `<p class="ghi-chu">Chưa có dự báo. Cần mạng để tải lần đầu.</p><div class="hang"><button class="nut" id="sg-tai">Tải ngay</button></div>`, b => b.querySelector("#sg-tai").onclick = () => { GD.dongBang(); capNhatThoiTiet(true); }); return; }
  const tt = TT.tomTatNgay(g, S.ngayChon), dong = TT.dongChayHienTai(g);
  const gioRows = TT.theoGio(g, S.ngayChon).filter((_, i) => i % 3 === 0).map(h =>
    `<tr><td>${h.gio}</td><td>cấp ${h.capGio} ${HH.tenHuong(h.gioHuong)}${h.giatMs > h.gioMs + 3 ? `, giật ${HH.capBeaufort(h.giatMs)}` : ""} · sóng ${h.songM != null ? h.songM.toFixed(1).replace(".", ",") : "—"} m</td></tr>`).join("");
  GD.moBang(`Gió sóng · ${TT.nhanNgay(g, S.ngayChon)}`, `<table class="bang-thong-tin">
    <tr><td>Tại</td><td>${GD.esc(fViTri1(g.viTri))}${S.goiDiem ? " · điểm chạm" : " · tàu"}</td></tr>
    <tr><td>Sóng ${tt.hienTai ? "lúc này" : "cao nhất"}</td><td>${tt.songM != null ? tt.songM.toFixed(1).replace(".", ",") : "—"} m${tt.songHuong != null ? ` từ ${HH.tenHuong(tt.songHuong)}` : ""}${tt.chuKy ? ` · chu kỳ ${Math.round(tt.chuKy)} s` : ""}</td></tr>
    <tr><td>Gió ${tt.hienTai ? "lúc này" : "mạnh nhất"}</td><td>cấp ${tt.capGio} (${Math.round(tt.gioMs * 3600 / HAI_LY)} hl/giờ) ${tt.tenHuongGio}</td></tr>
    <tr><td>Gió giật</td><td>cấp ${tt.capGiat}</td></tr>
    ${tt.muaMm != null ? `<tr><td>Mưa</td><td>${tt.muaMm.toFixed(1).replace(".", ",")} mm${tt.moTaTroi ? ` · ${tt.moTaTroi}` : ""}</td></tr>` : ""}
    ${dong && S.ngayChon === 0 ? `<tr><td>Dòng chảy</td><td>${(dong.tocDoMs * 3600 / HAI_LY).toFixed(1)} hl/giờ về ${HH.tenHuong(dong.huong)}</td></tr>` : ""}
    <tr><td>Lấy lúc</td><td>${GD.esc(tuoi(g.luc))}</td></tr></table>
    ${gioRows ? GD.htmlTieuDeNhom("THEO GIỜ (MỖI 3 GIỜ)") + `<table class="bang-thong-tin">${gioRows}</table>` : ""}
    <p class="ghi-chu">Nguồn: Open-Meteo (gió GFS/ICON, sóng GFS Wave 0,25°). Mũi tên ở dải dưới chỉ hướng gió <b>thổi tới</b>. Cấp gió theo thang Beaufort.</p>
    ${S.goiDiem ? `<div class="hang"><button class="nut phu" id="sg-tau">Về dự báo tại tàu</button></div>` : ""}`,
    b => { const t = b.querySelector("#sg-tau"); if (t) t.onclick = () => { S.goiDiem = null; luu("goi-diem"); S.diemXem = null; banDo.hienDiemTam(null); hienThoiTiet(); GD.dongBang(); }; });
}

async function moBangDuLieu() {
  const soO = await demOBanDo();
  const dong = (ten, moTa, luc, byte, moi) => `<li><div class="noi-dung"><b>${ten}</b><span>${moTa} · lưu ${tuoi(luc)}${byte ? ` · ${dinhDangByte(byte)}` : ""}</span></div><span style="color:${moi ? "var(--tot)" : "var(--nguy-hiem)"};font-weight:700;white-space:nowrap">${moi ? "✓ còn mới" : "✗ cũ"}</span></li>`;
  const g = S.goiTau, d = S.goiDiem;
  GD.moBang("Dữ liệu đã lưu để đi biển", `<p class="ghi-chu">Mỗi lớp cần tải sẵn lúc còn sóng để xem được khi ra khơi mất sóng. Dòng nào cũ thì chạm <b>Tải lại</b>.</p>
    <ul class="danh-sach">
      ${dong("Tin bão Biển Đông", S.tinBao?.tuDuBao ? "suy từ dự báo gió" : "nguồn riêng", S.tinBao?.luc, kho.kichThuoc("tin-bao"), S.tinBao && Date.now() - S.tinBao.luc < 12 * 3600e3)}
      ${dong("Gió sóng tại tàu", g ? `${CAU_HINH.thoiTiet.soNgay} ngày · tới ${new Date(g.hanDung).getDate()}/${new Date(g.hanDung).getMonth() + 1}` : "chưa có", g?.luc, kho.kichThuoc("goi-tau"), g && Date.now() < g.hanDung)}
      ${dong("Gió sóng điểm chạm", d ? `1 điểm · ${CAU_HINH.thoiTiet.soNgay} ngày` : "chưa có", d?.luc, kho.kichThuoc("goi-diem"), d && Date.now() < d.hanDung)}
      ${dong("Ô bản đồ", soO == null ? "không đếm được" : `${soO} ô đã lưu`, soO ? Date.now() : null, 0, !!soO)}
    </ul>
    <p class="ghi-chu">Tổng trong máy: ~${dinhDangByte(["goi-tau", "goi-diem", "tin-bao", "vet", "diem-luu"].reduce((s, k) => s + kho.kichThuoc(k), 0))} (chưa tính ô bản đồ).</p>
    <div class="hang"><button class="nut" id="dl-tai">Tải lại dự báo</button><button class="nut phu" id="dl-bd">Tải ô bản đồ</button></div>
    <p class="ghi-chu">Cần có sóng (mạng) để tải. Ngoài khơi mất sóng thì chỉ xem lại được thứ đã tải sẵn.</p>`,
    b => { b.querySelector("#dl-tai").onclick = () => { GD.dongBang(); capNhatThoiTiet(true); }; b.querySelector("#dl-bd").onclick = moBangTaiBanDo; });
}
async function demOBanDo() {
  try { if (!("caches" in window)) return null; const c = await caches.open("haido-o-ban-do-v1"); return (await c.keys()).length; } catch { return null; }
}

function moBangTaiBanDo() {
  const z = banDo.zoom(), nt = CAU_HINH.ngoaiTuyen;
  const zMin = Math.max(z - 1, 3), zMax = Math.min(z + nt.zoomThemKhiTai, nt.zoomToiDa);
  const urls = banDo.urlOTrongKhung(zMin, zMax);
  const nhieu = urls.length > nt.gioiHanOMoiLan;
  GD.moBang("Tải bản đồ dùng khi mất sóng", `<p class="ghi-chu">Vùng đang xem, mức phóng ${zMin}–${zMax}: <b>${urls.length}</b> ô bản đồ.${nhieu ? ` Quá giới hạn ${nt.gioiHanOMoiLan} ô — phóng to vào vùng nhỏ hơn rồi tải nhiều lần.` : ""}</p>
    <p class="ghi-chu">Ô bản đồ đã xem khi có mạng cũng được tự lưu lại.</p>
    <div class="tien-trinh"><div id="tb-tien"></div></div>
    <div class="hang"><button class="nut" id="tb-tai" ${nhieu || !urls.length ? "disabled" : ""}>Tải ${urls.length} ô</button></div><p class="ghi-chu" id="tb-chu"></p>`,
    b => { b.querySelector("#tb-tai").onclick = async () => {
      if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) { b.querySelector("#tb-chu").textContent = "Cần mở app qua địa chỉ https:// (không mở trực tiếp tệp) để lưu được bản đồ."; return; }
      b.querySelector("#tb-tai").disabled = true; let ok = 0, loi = 0;
      for (let i = 0; i < urls.length; i += 6) {
        await Promise.all(urls.slice(i, i + 6).map(u => fetch(u, { mode: "cors", credentials: "omit" }).then(() => ok++, () => loi++)));
        b.querySelector("#tb-tien").style.width = `${(ok + loi) / urls.length * 100}%`;
        b.querySelector("#tb-chu").textContent = `Đã tải ${ok}/${urls.length}${loi ? ` · lỗi ${loi}` : ""}`;
      }
      b.querySelector("#tb-chu").textContent += " · Xong. Có thể xem vùng này khi mất sóng.";
    }; });
}

function batDoKhoangCach() {
  GD.dongBang();
  GD.$("nut-lop").classList.add("chon-tren-ban-do");
  GD.thanhBao("canh-bao", "Đo khoảng cách: chạm các điểm trên bản đồ · chạm Lớp bản đồ để kết thúc");
  banDo.batDo(diem => {
    const tong = HH.chieuDaiTuyen(diem);
    const cuoi = diem.length > 1 ? ` · đoạn cuối ${Math.round(HH.huongDi(diem[diem.length - 2], diem[diem.length - 1]))}°` : "";
    GD.thanhBao("canh-bao", diem.length > 1 ? `Đo: ${fKc(tong)}${cuoi} · chạm Lớp bản đồ để kết thúc` : "Chạm điểm thứ hai…");
  });
  const nut = GD.$("nut-lop");
  const ketThuc = () => { banDo.tatDo(); nut.classList.remove("chon-tren-ban-do"); nut.onclick = () => moBangLop("hai-do"); hienThoiTiet(); };
  nut.onclick = ketThuc;
}

// ---------------------------------------------------------------------
// DẪN ĐƯỜNG ("Bắt đầu chạy"): bám theo tàu, đọc cảnh báo, chuyển điểm lộ trình
// ---------------------------------------------------------------------
let nhipDocDich = null;
function batTatDanDuong() {
  if (S.dangChay) {
    S.dangChay = false; clearInterval(nhipDocDich); nhipDocDich = null;
    GN.noi("Đã dừng dẫn đường.", { loai: "canh-bao" }); veLai(); return;
  }
  S.dangChay = true; S.bamTheo = true;
  if (!S.viTri && !GPS.dangThu) batGPS();
  const g = S.goiTau;
  const mo = g ? ` ${TT.dongTomTat(TT.tomTatNgay(g, 0)).replace("·", ",")}.` : "";
  GN.noi(`Bắt đầu dẫn đường.${S.dich && S.viTri ? " " + GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich)) + "." : ""}${mo}`, { loai: "canh-bao", rungMs: 150 });
  nhipDocDich = setInterval(() => {
    if (S.viTri && S.dich) GN.noi(GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich)), { loai: "thong-tin" });
  }, 10 * 60 * 1000);
  veLai();
}
function kiemTraCanhBao() {
  const ng = CAU_HINH.nguong;
  const rg = ranhGioiGanNhat(S.viTri);
  if (rg && rg.met / HAI_LY < ng.ranhGioiHaiLy)
    GN.noi(`Chú ý. Còn ${Math.round(rg.met / HAI_LY)} hải lý tới ${rg.ten}.`, { loai: "canh-bao", khoa: "ranh-gioi", giayLap: 300, rungMs: 600 });
  if (S.dich) {
    const hl = HH.khoangCach(S.viTri, S.dich) / HAI_LY;
    if (hl < ng.sapToiDichHaiLy) {
      if (S.loTrinh.length && cungDiem(S.loTrinh[0], S.dich)) {
        S.loTrinh.shift(); luu("lo-trinh");
        if (S.loTrinh.length) { datDich(S.loTrinh[0]); GN.noi(`Đã tới điểm. Chuyển sang điểm kế tiếp, ${GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich))}.`, { loai: "canh-bao", rungMs: 300 }); return; }
      }
      GN.noi("Sắp tới điểm đích.", { loai: "canh-bao", khoa: "toi-dich", giayLap: 600, rungMs: 300 });
    }
  }
}

khoiDong();
