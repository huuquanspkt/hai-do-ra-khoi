// =====================================================================
// APP — nối các phần lại: trạng thái, bản đồ, GPS, thời tiết, lớp màu,
// dự báo cá, con nước, dẫn đường, Sen Biển, các trang và bảng trượt.
// Đọc từ trên xuống: TRẠNG THÁI → KHỞI ĐỘNG → VẼ LẠI → GPS → THỜI TIẾT
// → LƯỚI & LỚP MÀU → DẪN ĐƯỜNG → SEN BIỂN → BẢNG → TAB
// =====================================================================
import { CAU_HINH, HAI_LY } from "./cau-hinh.js";
import * as HH from "./hang-hai.js";
import { kho, dinhDangByte, tuoi } from "./kho.js";
import { khoLon } from "./kho-lon.js";
import { BanDo } from "./ban-do.js";
import * as GPS from "./dinh-vi.js";
import * as TT from "./thoi-tiet.js";
import * as GN from "./giong-noi.js";
import * as GD from "./giao-dien.js";
import * as LTT from "./luoi-thoi-tiet.js";
import { LopMau } from "./lop-mau.js";
import { tinhChiSoCa } from "./ngu-truong.js";
import * as CN from "./con-nuoc.js";
import * as SB from "./sen-bien.js";
import * as TR from "./trang.js";

const PHIEN_BAN = "2026-10-19 · bản mẫu 2.1";
const $ = GD.$, esc = GD.esc;

// ---------------------------------------------------------------------
// TRẠNG THÁI
// ---------------------------------------------------------------------
const S = {
  caiDat: { tuDongChay: false, soDienThoai: "", tocDoTau: 7, dauGio: 20, monNuoc: "", ...CAU_HINH.caiDatMacDinh, ...kho.doc("cai-dat", {}) },
  viTri: null, tocDoMs: null, huong: null, gpsLoi: null,
  tro: kho.doc("tro", null),            // điểm đang xem [lat, lon]
  dich: kho.doc("dich", null),          // điểm đang dẫn đường tới
  diemLuu: kho.doc("diem-luu", []), cangNha: kho.doc("cang-nha", null),
  loTrinh: kho.doc("lo-trinh", []),     // các điểm trung gian do bà con thêm
  loTrinhVe: null,                      // lộ trình đã tính (mảng điểm) để vẽ
  vet: kho.doc("vet", []), ghiVet: false,
  dangChay: false, bamTheo: true, bangChayAn: false,
  goiTau: kho.doc("goi-tau", null), goiTro: kho.doc("goi-tro", null),
  ngayChon: 0, tinBao: kho.doc("tin-bao", null),
  luoi: null, lopMau: null, mocK: 0, caBat: false, nhomLop: null, tab: "ra-khoi",
  duLieu: {},
};
const LUU = { "cai-dat": () => S.caiDat, tro: () => S.tro, dich: () => S.dich, "diem-luu": () => S.diemLuu, "cang-nha": () => S.cangNha, "lo-trinh": () => S.loTrinh, vet: () => S.vet, "goi-tau": () => S.goiTau, "goi-tro": () => S.goiTro, "tin-bao": () => S.tinBao };
const luu = k => kho.ghi(k, LUU[k]());
const cungDiem = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

const banDo = new BanDo("ban-do", { tam: S.tro || CAU_HINH.tamMacDinh, zoom: CAU_HINH.zoomMacDinh });
const lopMau = banDo.coBanDo ? new LopMau(banDo) : null;

const fViTri = p => HH.dinhDangViTri(p, S.caiDat.toaDo);
const fViTri1 = p => HH.dinhDangViTriMotDong(p, S.caiDat.toaDo);
const fKc = m => HH.dinhDangKhoangCach(m, S.caiDat.donVi);
const goiHienTai = () => S.goiTro || S.goiTau;

// ---------------------------------------------------------------------
// KHỞI ĐỘNG
// ---------------------------------------------------------------------
async function khoiDong() {
  GN.datMucGiong(S.caiDat.giong); GN.datRung(S.caiDat.rung);
  await napDuLieu();
  banDo.datNen(S.caiDat.nen);
  Object.keys(banDo.lop).forEach(k => banDo.datLop(k, S.caiDat.lopBat.includes(k)));
  banDo.veVet(S.vet);
  veDiemLuu();
  banDo.onCham(chamBanDo); banDo.onGiuTay(p => moBangDiem(p)); banDo.onKeo(() => { S.bamTheo = false; });
  TR.khoiTaoTrang({ duLieu: S.duLieu, chuyenTab });
  noiNut();
  if (S.tro) banDo.datTro(S.tro);
  veLai(); hienThoiTiet();
  S.luoi = LTT.phucHoi(await khoLon.doc("luoi")) || null;
  if (S.caiDat.nen === "nhiet-bien") capNhatLopMau();
  capNhatThoiTiet();
  window.addEventListener("online", () => capNhatThoiTiet(true));
  setInterval(() => { if (!S.goiTau) capNhatThoiTiet(true); }, 2 * 60 * 1000);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (S.caiDat.tuDongChay) batTatDanDuong(true);
}
async function napDuLieu() {
  const tep = { ranhGioi: "ranh-gioi", diaDanhNgam: "dia-danh-ngam", khuTruBao: "khu-tru-bao", denBien: "den-bien", diaDanhLon: "dia-danh-lon", cang: "cang", khuBaoTon: "khu-bao-ton", tramConNuoc: "tram-con-nuoc", giaCa: "gia-ca", vua: "vua", cuaHang: "cua-hang" };
  await Promise.all(Object.entries(tep).map(async ([k, ten]) => { try { S.duLieu[k] = await (await fetch(`data/${ten}.json`)).json(); } catch { S.duLieu[k] = null; } }));
  banDo.napDuLieu(S.duLieu, { onTram: moBangConNuoc });
}
function veDiemLuu() { banDo.hienDiemLuu(S.diemLuu, S.cangNha, i => moBangDiem([S.diemLuu[i].lat, S.diemLuu[i].lon], S.diemLuu[i].ten)); }

// ---------------------------------------------------------------------
// VẼ LẠI — mọi thứ trên màn "Ra khơi" suy ra từ trạng thái
// ---------------------------------------------------------------------
function veLai() {
  // Thẻ TÀU / TRỎ
  const tauEl = $("the-tau"); tauEl.classList.toggle("loi", !!S.gpsLoi && !S.viTri);
  $("vi-tri-tau").innerHTML = S.viTri ? esc(fViTri(S.viTri)) : S.gpsLoi ? `Định vị bị chặn<small>Cài đặt › Vị trí</small>` : "Bật định vị";
  $("vi-tri-tro").textContent = S.tro ? fViTri(S.tro) : "Chạm vào bản đồ";

  // Bản đồ: trỏ, đích, tuyến
  banDo.datTro(S.tro);
  banDo.datDich(S.dich && !cungDiem(S.dich, S.tro) ? S.dich : null);
  if (S.viTri && S.dich) {
    const m = HH.khoangCach(S.viTri, S.dich);
    banDo.veTuyenToiDich(S.viTri, S.dich, `${fKc(m)} · ${Math.round(HH.huongDi(S.viTri, S.dich))}°`);
  } else banDo.veTuyenToiDich(null);

  // Nhãn ranh giới: tính từ tàu khi đang chạy, không thì từ điểm đang xem
  const goc = (S.dangChay && S.viTri) ? S.viTri : (S.tro || S.viTri);
  const rg = goc ? ranhGioiGanNhat(goc) : null;
  if (rg) GD.nhanRanhGioi(`${fKc(rg.met)} tới ranh giới`, rg.met / HAI_LY < CAU_HINH.nguong.ranhGioiHaiLy); else GD.nhanRanhGioi(null);

  // Nút
  GD.nutBat("nut-gps", !!S.viTri, S.viTri ? "Vị trí" : "Bật GPS");
  $("nut-gps").classList.toggle("vang", !S.viTri && !GPS.dangThu);
  GD.nutBat("nut-chay", S.dangChay, S.dangChay ? "Đang chạy" : "Bắt đầu chạy");
  $("nut-chay").classList.toggle("co-cham", S.dangChay);
  $("cot-nut").classList.toggle("dang-chay", S.dangChay);
  $("nhom-lop").hidden = !S.nhomLop || S.dangChay;
  $("nut-lop-chu").textContent = S.nhomLop && !S.dangChay ? "Ẩn" : "Lớp bản đồ";
  $("nhom-lop").querySelectorAll("button").forEach(b => b.classList.toggle("bat", b.dataset.nhom === S.nhomLop));

  // Bảng dẫn đường
  $("bang-chay").hidden = !S.dangChay || S.bangChayAn;
  $("bang-chay-thu").hidden = !S.dangChay || !S.bangChayAn;
  $("the-vi-tri").classList.toggle("day-xuong", S.dangChay && !S.bangChayAn);
  $("bang-chay-tieu-de").textContent = S.dich ? "Đang dẫn đường" : "Đang chạy";
  $("bang-chay-giong").textContent = `🔊 Giọng: ${{ "day-du": "đầy đủ", it: "ít", tat: "tắt" }[S.caiDat.giong]}`;
  $("bang-chay-rung").textContent = `Báo rung: ${S.caiDat.rung ? "đang bật" : "đang tắt"}`;
  const cb = $("bang-chay-canh-bao"); cb.hidden = !!S.viTri;
  $("bang-chay-canh-bao-chu").textContent = S.gpsLoi ? "Định vị bị chặn. Vào Cài đặt › Vị trí của máy, cho phép rồi mở lại để dẫn đường." : "Máy chưa bật định vị. Bật định vị (GPS) rồi mở lại để dẫn đường.";

  // Dải dưới: thu gọn khi đang chạy hoặc đang bật lớp màu
  $("dai-duoi").classList.toggle("gon", S.dangChay);
  const coLopMau = !!S.lopMau || (S.caiDat.nen === "nhiet-bien" && !!S.luoi); // lớp màu hoặc nền nước nóng lạnh
  $("bang-song-gio").hidden = S.dangChay || coLopMau;
  $("thanh-thoi-gian").hidden = !coLopMau || S.dangChay;
  $("chu-giai-ca").hidden = !S.caBat;

  // Gói ngoại tuyến
  const g = S.goiTau;
  if (!g) GD.goiNgoaiTuyen("Chưa có dự báo — chạm để tải", true);
  else { const han = new Date(g.hanDung), hetHan = Date.now() > g.hanDung; GD.goiNgoaiTuyen(hetHan ? "Dự báo đã cũ — chạm tải mới" : `Đã lưu đủ dự báo — tới ngày ${han.getDate()}/${han.getMonth() + 1}`, hetHan); }
}
function ranhGioiGanNhat(p) {
  const rg = S.duLieu.ranhGioi; if (!rg) return null;
  let tot = null;
  for (const f of rg.features) {
    if (!f.properties.is_border) continue;
    const g = f.geometry, duong = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : g.type === "Polygon" ? g.coordinates : [];
    for (const d of duong) { const m = HH.khoangCachToiDuong(p, d); if (!tot || m < tot.met) tot = { ten: f.properties.name, met: m }; }
  }
  return tot;
}

// ---------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------
function coViTriMoi({ viTri, tocDoMs, huong }) {
  const lanDau = !S.viTri;
  S.viTri = viTri; S.gpsLoi = null;
  if (tocDoMs != null) S.tocDoMs = tocDoMs;
  if (huong != null) S.huong = huong;
  banDo.capNhatTau(viTri, S.huong);
  if (S.bamTheo) banDo.truotToi(viTri);
  if (S.ghiVet) { const cuoi = S.vet[S.vet.length - 1]; if (!cuoi || HH.khoangCach(cuoi, viTri) > 30) { S.vet.push(viTri); banDo.veVet(S.vet); luu("vet"); } }
  if (lanDau && !S.tro) { S.tro = viTri; luu("tro"); hoiGioSongTai(viTri); }
  veLai();
  if (S.dangChay) kiemTraCanhBao(lanDau);
  capNhatThoiTiet();
}
function batGPS() {
  S.bamTheo = true;
  if (S.viTri) banDo.nhinToi(S.viTri, Math.max(banDo.zoom(), 10));
  GPS.batDinhVi(coViTriMoi, loi => { S.gpsLoi = loi; veLai(); GD.thanhBao("canh-bao", loi.chu + " Giữ nút GPS 1 giây để chạy thử."); });
}
function batCheDoThu() {
  GPS.batCheDoThu(S.viTri || S.tro || banDo.tam() || CAU_HINH.tamMacDinh, coViTriMoi);
  S.bamTheo = true; GD.thanhBao("canh-bao", "Đang chạy thử bằng GPS giả lập — chạm Bật GPS để dùng GPS thật");
}

// ---------------------------------------------------------------------
// THỜI TIẾT TẠI ĐIỂM (tàu / điểm đang xem)
// ---------------------------------------------------------------------
let dangTaiTT = false;
async function capNhatThoiTiet(ep = false) {
  if (dangTaiTT || !navigator.onLine) return;
  const tai = S.viTri || S.tro || banDo.tam() || CAU_HINH.tamMacDinh;
  const g = S.goiTau, tt = CAU_HINH.thoiTiet;
  const cu = !g || Date.now() - g.luc > tt.lamMoiSauGio * 3600e3;
  const xa = g && HH.khoangCach(g.viTri, tai) > tt.lamMoiKhiDiXaHaiLy * HAI_LY;
  if (!ep && !cu && !xa) return;
  dangTaiTT = true;
  try {
    S.goiTau = await TT.taiDuBao(tai); luu("goi-tau");
    S.tinBao = (await TT.hoiTinBao()) || { tuDuBao: true, luc: Date.now() }; luu("tin-bao");
    const dg = TT.danhGiaBienDong(S.goiTau);
    if (dg.muc !== "tot") TR.themThongBao(dg.muc, dg.muc === "nguy-hiem" ? "Biển động mạnh 2 ngày tới" : "Biển động 2 ngày tới", `Gió giật cấp ${dg.capGiat}, sóng ${dg.songM.toFixed(1)} m quanh ${fViTri1(tai)}. Nghe đài duyên hải trước khi ra khơi.`);
  } catch { dangTaiTT = false; if (!g) { GD.thanhBao("canh-bao", "Máy chủ dự báo đang bận — 2 phút nữa app tự hỏi lại"); veLai(); } return; }
  dangTaiTT = false; hienThoiTiet(); veLai();
}
async function hoiGioSongTai(p) {
  if (!navigator.onLine) { S.goiTro = (S.goiTro && HH.khoangCach(S.goiTro.viTri, p) < 30 * HAI_LY) ? S.goiTro : null; hienThoiTiet(); return; }
  if (S.goiTro && HH.khoangCach(S.goiTro.viTri, p) < 5 * HAI_LY && Date.now() - S.goiTro.luc < 3 * 3600e3) { hienThoiTiet(); return; }
  $("sg-trang-thai-chu").textContent = "Đang hỏi gió sóng…";
  try { S.goiTro = await TT.taiDuBao(p); luu("goi-tro"); } catch { S.goiTro = null; }
  hienThoiTiet();
}
function hienThoiTiet() {
  const g = goiHienTai();
  // Thanh tin bão
  if (S.tinBao && !S.tinBao.tuDuBao) { const t = S.tinBao; GD.thanhBao(t.coBao ? "nguy-hiem" : "tot", t.coBao ? `BÃO ${t.ten || ""}: ${t.moTa || "xem bản tin"}` : `Không có tin bão — ${t.moTa || "nguồn riêng"}`); }
  else if (S.goiTau) {
    const d = new Date(S.goiTau.luc), gioHoi = `hỏi lúc ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ngày ${d.getDate()}/${d.getMonth() + 1}`;
    const dg = TT.danhGiaBienDong(S.goiTau);
    if (dg.muc === "nguy-hiem") GD.thanhBao("nguy-hiem", `Gió giật cấp ${dg.capGiat}, sóng ${dg.songM.toFixed(1)} m trong 2 ngày tới — cân nhắc vào bờ (${gioHoi})`);
    else if (dg.muc === "canh-bao") GD.thanhBao("canh-bao", `Biển động: gió giật cấp ${dg.capGiat}, sóng ${dg.songM.toFixed(1)} m (${gioHoi})`);
    else GD.thanhBao("tot", `Không có tin bão — ${gioHoi}`);
  } else GD.thanhBao("canh-bao", navigator.onLine ? "Đang hỏi tin bão và dự báo…" : "Chưa có tin bão trong máy — cần mạng để hỏi");

  // Bảng gió sóng tại điểm
  const tt0 = $("sg-trang-thai");
  if (!g) { GD.tabNgay([], 0, () => {}); GD.songGio("Chưa có dữ liệu sóng gió"); $("sg-trang-thai-chu").textContent = navigator.onLine ? "Đang tải…" : "Mất sóng"; $("sg-toa-do").textContent = ""; return; }
  const n = TT.soNgay(g); if (S.ngayChon >= n) S.ngayChon = 0;
  GD.tabNgay(Array.from({ length: n }, (_, i) => TT.nhanNgay(g, i)), S.ngayChon, i => { S.ngayChon = i; hienThoiTiet(); if (S.caBat) veCa(); });
  const tt = TT.tomTatNgay(g, S.ngayChon);
  GD.songGio(TT.dongTomTat(tt), tt.gioHuong);
  const muc = tt.capGiat >= 8 || tt.songM >= 4 ? "nguy-hiem" : tt.capGiat >= 6 || tt.songM >= 2.5 ? "canh-bao" : "tot";
  tt0.className = "trang-thai " + muc; $("sg-trang-thai-chu").textContent = { tot: "Biển êm", "canh-bao": "Biển động", "nguy-hiem": "Biển động mạnh" }[muc];
  const rg = ranhGioiGanNhat(g.viTri);
  $("sg-toa-do").textContent = `${fViTri1(g.viTri)}${rg ? `\nCách ranh giới ${fKc(rg.met)}` : ""}${S.goiTro ? "" : "\n(tại tàu)"}`;
}

// ---------------------------------------------------------------------
// LƯỚI CẢ VÙNG · LỚP MÀU · DỰ BÁO CÁ
// ---------------------------------------------------------------------
let dangTaiLuoi = false;
/** Bảo đảm có lưới (tải nếu chưa có / quá cũ). Trả về true khi sẵn sàng. */
async function dambaoLuoi(ep = false) {
  const cu = !S.luoi || Date.now() - S.luoi.luc > 6 * 3600e3;
  if (!cu && !ep) return true;
  if (!navigator.onLine) { if (S.luoi) return true; GD.thanhBao("canh-bao", "Mất sóng — chưa có lưới dự báo cả vùng trong máy"); return false; }
  if (dangTaiLuoi) return false;
  dangTaiLuoi = true;
  // Bảng tiến trình thay chỗ bảng lớp → khi đóng phải trả lại trạng thái "đang mở nhóm lớp"
  const khiDong = { onDong: () => { if (S.nhomLop) { S.nhomLop = null; veLai(); } } };
  GD.moBang("Tải gió sóng cả vùng biển", `<p class="ghi-chu">Hỏi ${LTT.LUOI.soDiem * LTT.LUOI.soDiem} điểm trên Biển Đông, ${LTT.LUOI.soNgay} ngày. Mất khoảng 10–30 giây, tốn 2–4 MB.</p><div class="tien-trinh"><div id="luoi-tien" style="width:15%"></div></div><p class="ghi-chu" id="luoi-chu">Đang hỏi…</p>`, null, khiDong);
  try {
    let buoc = 0;
    const goi = await LTT.taiLuoi(chu => { buoc++; const c = $("luoi-chu"), t = $("luoi-tien"); if (c) c.textContent = chu; if (t) t.style.width = `${15 + buoc * 28}%`; });
    S.luoi = goi; await khoLon.ghi("luoi", goi);
    GD.dongBang(); dangTaiLuoi = false; return true;
  } catch (e) {
    dangTaiLuoi = false;
    GD.moBang("Chưa tải được", `<p class="ghi-chu">Máy chủ dự báo bận hoặc mất sóng (${esc(e.message)}). Thử lại sau ít phút.</p>`, null, khiDong);
    return !!S.luoi;
  }
}
/** Bật/tắt một lớp màu (khoa trong LOP_MAU, hoặc null). */
async function batLopMau(khoa) {
  if (khoa && !(await dambaoLuoi())) return;
  S.lopMau = khoa; S.mocK = Math.min(S.mocK, (S.luoi?.gioMoc?.length || 1) - 1);
  if (!khoa && S.caiDat.nen === "nhiet-bien") { /* nền nước nóng lạnh vẫn giữ */ }
  capNhatLopMau(); veLai();
}
function capNhatLopMau() {
  if (!lopMau || !S.luoi) return;
  const khoa = S.lopMau || (S.caiDat.nen === "nhiet-bien" ? "nhiet-bien" : null);
  if (!S.mocK && S.luoi.gioMoc) { // mốc mặc định: giờ hiện tại
    const now = new Date(); const muc = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(Math.floor(now.getHours() / LTT.LUOI.buocGio) * LTT.LUOI.buocGio).padStart(2, "0")}:00`;
    const k = S.luoi.gioMoc.indexOf(muc); if (k > 0) S.mocK = k;
  }
  lopMau.ve(S.luoi, khoa, S.mocK);
  // Thanh thời gian
  const moc = S.luoi.gioMoc, k = S.mocK, t = moc[k] || "";
  const d = new Date(t + ":00"), homNay = new Date();
  const nhanNgay = d.toDateString() === homNay.toDateString() ? "Hôm nay" : d.toDateString() === new Date(homNay.getTime() + 86400e3).toDateString() ? "Mai" : `${["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  $("ttg-tieu-de").textContent = `${khoa ? LTT.LOP_MAU[khoa].ten : ""} · ${nhanNgay} · ${d.getHours()}h`;
  const truot = $("ttg-truot"); truot.max = moc.length - 1; truot.value = k;
  const ngay = $("ttg-ngay"); if (!ngay.dataset.xong) { ngay.innerHTML = ""; const soMocNgay = 24 / LTT.LUOI.buocGio; for (let i = 0; i < moc.length; i += soMocNgay) { const dd = new Date(moc[i] + ":00"); const s = document.createElement("span"); s.textContent = i === 0 ? "Nay" : i === soMocNgay ? "Mai" : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dd.getDay()]; s.title = `${dd.getDate()}/${dd.getMonth() + 1}`; s.dataset.ngay = `${dd.getDate()}/${dd.getMonth() + 1}`; ngay.appendChild(s); } ngay.dataset.xong = "1"; }
  $("ttg-chu-giai").innerHTML = lopMau.htmlChuGiai();
}
async function batCa(bat) {
  if (bat && !(await dambaoLuoi())) return;
  S.caBat = bat; veCa(); veLai();
}
function veCa() {
  if (!S.caBat || !S.luoi) { banDo.veCa(null); return; }
  const g = goiHienTai(); const ngay = g ? g.gio.daily.time[S.ngayChon] : S.luoi.gioMoc[0].slice(0, 10);
  banDo.veCa(tinhChiSoCa(S.luoi, LTT.chiSoMoc(S.luoi, ngay, 12)));
}

// ---------------------------------------------------------------------
// NÚT & SỰ KIỆN
// ---------------------------------------------------------------------
function noiNut() {
  let bamGiu = null;
  const nutGps = $("nut-gps");
  nutGps.addEventListener("pointerdown", () => { bamGiu = setTimeout(() => { bamGiu = "giu"; batCheDoThu(); }, 900); });
  nutGps.addEventListener("pointerup", () => { if (bamGiu === "giu") { bamGiu = null; return; } clearTimeout(bamGiu); batGPS(); });
  nutGps.addEventListener("pointerleave", () => { if (bamGiu !== "giu") clearTimeout(bamGiu); });
  $("nut-lop").onclick = () => { S.nhomLop = S.nhomLop ? null : "hai-do"; veLai(); if (S.nhomLop) moBangLop(S.nhomLop); else GD.dongBang(); };
  $("nhom-lop").querySelectorAll("button").forEach(b => b.onclick = () => { S.nhomLop = b.dataset.nhom; veLai(); moBangLop(b.dataset.nhom); });
  $("nut-chay").onclick = () => batTatDanDuong();
  $("bang-chay-dung").onclick = () => batTatDanDuong();
  $("bang-chay-an").onclick = () => { S.bangChayAn = true; veLai(); };
  $("bang-chay-thu").onclick = () => { S.bangChayAn = false; veLai(); };
  $("bang-chay-giong").onclick = () => { S.caiDat.giong = { "day-du": "it", it: "tat", tat: "day-du" }[S.caiDat.giong]; GN.datMucGiong(S.caiDat.giong); luu("cai-dat"); veLai(); };
  $("bang-chay-rung").onclick = () => { S.caiDat.rung = !S.caiDat.rung; GN.datRung(S.caiDat.rung); luu("cai-dat"); veLai(); };
  keoBangChay();
  $("nut-den-diem").onclick = moBangDenDiem;
  $("nut-diem-luu").onclick = moBangDiemLuu;
  $("nut-lo-trinh").onclick = moBangLoTrinh;
  $("goi-ngoai-tuyen").onclick = moBangDuLieu;
  $("song-gio").onclick = moBangSongGio;
  $("the-tau").onclick = () => { if (S.viTri) { S.bamTheo = true; banDo.nhinToi(S.viTri, Math.max(banDo.zoom(), 9)); } else batGPS(); };
  $("the-tro").onclick = () => { if (S.tro) banDo.nhinToi(S.tro); else moBangDenDiem(); };
  $("nut-thong-tin").onclick = moBangThongTin;
  $("ttg-truot").oninput = e => { S.mocK = +e.target.value; capNhatLopMau(); };
  $("ttg-tat").onclick = () => {
    if (S.lopMau) batLopMau(null);
    else if (S.caiDat.nen === "nhiet-bien") { S.caiDat.nen = "hai-do"; banDo.datNen("hai-do"); luu("cai-dat"); lopMau && lopMau.tat(); veLai(); }
  };
  $("thanh-do-xoa").onclick = () => banDo.xoaDo();
  $("thanh-do-xong").onclick = tatDoKhoangCach;
  $("sen-bien-nut").onclick = senBienNghe;
  $("sen-bien-chu-nut").onclick = () => { $("sen-bien-form").hidden = false; $("sen-bien-nhap").focus(); };
  $("sen-bien-form").onsubmit = e => { e.preventDefault(); senBienHieu($("sen-bien-nhap").value); $("sen-bien-nhap").value = ""; };
  document.querySelectorAll(".thanh-tab button").forEach(b => b.onclick = () => chuyenTab(b.dataset.tab));
  document.addEventListener("keydown", e => { if (e.key === "Escape") GD.dongBang(); });
}
function keoBangChay() {
  const bang = $("bang-chay"), tay = $("bang-chay-keo"); let goc = null;
  tay.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; goc = { x: e.clientX, y: e.clientY, top: bang.offsetTop, left: bang.offsetLeft }; tay.setPointerCapture(e.pointerId); });
  tay.addEventListener("pointermove", e => { if (!goc) return; bang.style.top = `${Math.max(8, goc.top + e.clientY - goc.y)}px`; bang.style.left = `${goc.left + e.clientX - goc.x}px`; bang.style.right = "auto"; bang.style.width = `calc(100% - 20px)`; });
  tay.addEventListener("pointerup", () => { goc = null; });
}
/** Chạm bản đồ: đặt điểm đang xem và hỏi gió sóng tại đó (như SDFish). */
function chamBanDo(p) {
  if (GD.bangDangMo()) { GD.dongBang(); return; }
  if (S.nhomLop) { S.nhomLop = null; }
  datTro(p);
}
function datTro(p) { S.tro = p; luu("tro"); S.goiTro = null; veLai(); hoiGioSongTai(p); }
function datDich(p) { S.dich = p; luu("dich"); veLai(); }

function chuyenTab(khoa) {
  S.tab = khoa; GD.tabChinh(khoa); GD.dongBang();
  const trang = $("man-trang"), raKhoi = $("lop-ra-khoi");
  if (khoa === "ra-khoi") { trang.hidden = true; raKhoi.hidden = false; banDo.capNhatKichThuoc(); return; }
  raKhoi.hidden = true; trang.hidden = false; TR.veTrang(khoa); trang.scrollTop = 0;
}

// ---------------------------------------------------------------------
// DẪN ĐƯỜNG ("Bắt đầu chạy")
// ---------------------------------------------------------------------
let nhipDocDich = null;
function batTatDanDuong(tuDong = false) {
  if (S.dangChay) {
    S.dangChay = false; clearInterval(nhipDocDich); nhipDocDich = null; S.nhomLop = null;
    GN.noi("Đã dừng dẫn đường.", { loai: "canh-bao" }); veLai(); return;
  }
  S.dangChay = true; S.bamTheo = true; S.bangChayAn = false; S.nhomLop = null;
  if (!S.viTri && !GPS.dangThu && !tuDong) batGPS();
  const g = S.goiTau;
  const mo = g ? ` ${TT.dongTomTat(TT.tomTatNgay(g, 0)).replace("·", ",")}.` : "";
  const cau = S.viTri ? `Bắt đầu dẫn đường.${S.dich ? " " + GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich)) + "." : ""}${mo}` : "Máy chưa bật định vị. Bật định vị rồi mở lại.";
  noiVaGhi(cau, { loai: "canh-bao", rungMs: 150 });
  nhipDocDich = setInterval(() => { if (S.viTri && S.dich) noiVaGhi(GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich)) + ".", { loai: "thong-tin" }); }, 10 * 60 * 1000);
  veLai();
}
function noiVaGhi(cau, tuyChon) { $("bang-chay-noi-chu").textContent = cau; GN.noi(cau, tuyChon); }
function kiemTraCanhBao(lanDau) {
  const ng = CAU_HINH.nguong, rg = ranhGioiGanNhat(S.viTri);
  if (lanDau) noiVaGhi(`Đã bắt được vệ tinh.${S.dich ? " " + GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich)) + "." : ""}`, { loai: "canh-bao" });
  if (rg && rg.met / HAI_LY < ng.ranhGioiHaiLy) noiVaGhi(`Chú ý. Còn ${Math.round(rg.met / HAI_LY)} hải lý tới ${rg.ten}.`, { loai: "canh-bao", khoa: "ranh-gioi", giayLap: 300, rungMs: 600 });
  const kbt = S.duLieu.khuBaoTon?.danhSach?.find(k => HH.khoangCach(S.viTri, [k.lat, k.lon]) < k.banKinhKm * 1000 + 2 * HAI_LY);
  if (kbt) noiVaGhi(`Chú ý. Đang gần ${kbt.ten}, vùng cấm hoặc hạn chế khai thác.`, { loai: "canh-bao", khoa: "kbt", giayLap: 600, rungMs: 400 });
  if (S.dich) {
    const hl = HH.khoangCach(S.viTri, S.dich) / HAI_LY;
    if (hl < ng.sapToiDichHaiLy) {
      if (S.loTrinh.length && cungDiem(S.loTrinh[0], S.dich)) { S.loTrinh.shift(); luu("lo-trinh");
        if (S.loTrinh.length) { datDich(S.loTrinh[0]); noiVaGhi(`Đã tới điểm. Chuyển sang điểm kế tiếp, ${GN.docKhoangCachHuong(HH.khoangCach(S.viTri, S.dich) / HAI_LY, HH.huongDi(S.viTri, S.dich))}.`, { loai: "canh-bao", rungMs: 300 }); return; } }
      noiVaGhi("Sắp tới điểm đích.", { loai: "canh-bao", khoa: "toi-dich", giayLap: 600, rungMs: 300 });
    }
  }
}

// ---------------------------------------------------------------------
// SEN BIỂN
// ---------------------------------------------------------------------
function senBienBong(chu, { form = false, nutDan = null } = {}) {
  $("sen-bien-bong").hidden = false; $("sen-bien-bong-chu").innerHTML = chu; $("sen-bien-form").hidden = !form;
  const cu = $("sen-bien-bong").querySelector(".hang-nut-sb"); if (cu) cu.remove();
  if (nutDan) { const d = document.createElement("div"); d.className = "hang-nut-sb"; d.style.cssText = "display:flex;gap:6px"; d.innerHTML = `<button class="nut-nho cam" id="sb-dan">Dẫn đường</button><button class="nut-nho" id="sb-thoi">Thôi</button>`; $("sen-bien-bong").appendChild(d);
    d.querySelector("#sb-dan").onclick = () => { datDich(nutDan); if (!S.dangChay) batTatDanDuong(); $("sen-bien-bong").hidden = true; }; d.querySelector("#sb-thoi").onclick = () => { $("sen-bien-bong").hidden = true; }; }
  else if (!form) setTimeout(() => { if ($("sen-bien-bong-chu").innerHTML === chu) $("sen-bien-bong").hidden = true; }, 8000);
}
async function senBienNghe() {
  if (!$("sen-bien-bong").hidden && !$("sen-bien-form").hidden) { $("sen-bien-bong").hidden = true; return; }
  if (!SB.coNghe()) { senBienBong("Máy chưa cho dùng micro. Bà con chạm ô chat để gõ.", { form: true }); return; }
  senBienBong("Sen Biển nghe đây… nói chỗ muốn tới (ví dụ: <i>mười ba độ ba mươi, một trăm mười độ</i>, hoặc tên điểm đã ghim).");
  try { const cau = await SB.nghe(); senBienHieu(cau.split(" | ")[0]); }
  catch (e) { senBienBong(`${esc(e.message)}. Bà con chạm ô chat để gõ.`, { form: true }); }
}
function senBienHieu(cau) {
  const kq = SB.hieu(cau, { diemLuu: S.diemLuu, cang: S.duLieu.cang?.danhSach || [], cangNha: S.cangNha });
  if (kq.loai === "khong-hieu") { senBienBong(esc(kq.chu), { form: true }); return; }
  datTro(kq.viTri); banDo.nhinToi(kq.viTri);
  const kc = S.viTri ? ` Cách tàu ${fKc(HH.khoangCach(S.viTri, kq.viTri))}, hướng ${Math.round(HH.huongDi(S.viTri, kq.viTri))}°.` : "";
  GN.noi(kq.chu + kc, { loai: "canh-bao" });
  senBienBong(`${esc(kq.chu)}.${esc(kc)} Dẫn đường tới đó không?`, { nutDan: kq.viTri });
}

// ---------------------------------------------------------------------
// BẢNG: LỚP BẢN ĐỒ (Hải đồ · Ngư trường · Thời tiết · Công cụ · Cài đặt)
// ---------------------------------------------------------------------
const congTac = (khoa, ten, moTa, bat, extra = "") => `<label class="cong-tac"><span><b>${esc(ten)}</b><small>${esc(moTa)}</small></span><input type="checkbox" ${extra} ${bat ? "checked" : ""} data-ct="${khoa}"></label>`;
function moBangLop(nhom) {
  const tieuDe = { "hai-do": "Hải đồ — Lớp nền", "ngu-truong": "Ngư trường — Phân bố cá", "thoi-tiet": "Thời tiết — gió, sóng, bão", "cong-cu": "Công cụ — đo khoảng cách", "cai-dat": "Cài đặt — đơn vị & toạ độ" }[nhom];
  const noiDung = { "hai-do": htmlHaiDo, "ngu-truong": htmlNguTruong, "thoi-tiet": htmlThoiTiet, "cong-cu": htmlCongCu, "cai-dat": htmlCaiDat }[nhom]();
  const thanh = `<div class="tab-phu" style="margin:0 0 6px">${[["hai-do", "Hải đồ"], ["ngu-truong", "Ngư trường"], ["thoi-tiet", "Thời tiết"], ["cong-cu", "Công cụ"], ["cai-dat", "Cài đặt"]].map(([k, t]) => `<button data-nhom-bang="${k}" class="${k === nhom ? "bat" : ""}">${t}</button>`).join("")}</div>`;
  S.nhomLop = nhom; veLai();
  GD.moBang(tieuDe, thanh + noiDung, b => {
    b.querySelectorAll("[data-nhom-bang]").forEach(x => x.onclick = () => moBangLop(x.dataset.nhomBang));
    b.querySelectorAll("input[name=nen]").forEach(r => r.onchange = () => { S.caiDat.nen = r.value; banDo.datNen(r.value); luu("cai-dat"); if (r.value === "nhiet-bien") { dambaoLuoi().then(ok => { if (ok) { capNhatLopMau(); veLai(); } }); } else { if (lopMau && !S.lopMau) lopMau.tat(); veLai(); } });
    b.querySelectorAll("input[data-lop]").forEach(c => c.onchange = () => { banDo.datLop(c.dataset.lop, c.checked); S.caiDat.lopBat = Object.keys(banDo.lop).filter(k => banDo.lopDangBat(k)); luu("cai-dat"); });
    b.querySelectorAll("input[data-mau]").forEach(c => c.onchange = () => { b.querySelectorAll("input[data-mau]").forEach(x => { if (x !== c) x.checked = false; }); batLopMau(c.checked ? c.dataset.mau : null); });
    const ca = b.querySelector("[data-ct=ca]"); if (ca) ca.onchange = () => batCa(ca.checked);
    b.querySelectorAll("input[name=donVi]").forEach(r => r.onchange = () => { S.caiDat.donVi = r.value; luu("cai-dat"); veLai(); hienThoiTiet(); });
    b.querySelectorAll("input[name=toaDo]").forEach(r => r.onchange = () => { S.caiDat.toaDo = r.value; luu("cai-dat"); veLai(); hienThoiTiet(); });
    b.querySelectorAll("input[name=giong]").forEach(r => r.onchange = () => { S.caiDat.giong = r.value; GN.datMucGiong(r.value); luu("cai-dat"); veLai(); });
    const tdc = b.querySelector("[data-ct=tuDongChay]"); if (tdc) tdc.onchange = () => { S.caiDat.tuDongChay = tdc.checked; luu("cai-dat"); };
    const rung = b.querySelector("[data-ct=rung]"); if (rung) rung.onchange = () => { S.caiDat.rung = rung.checked; GN.datRung(rung.checked); luu("cai-dat"); veLai(); };
    const nghe = b.querySelector("#nghe-thu"); if (nghe) nghe.onclick = () => GN.noi("Sen Biển xin chào. Còn 126 hải lý, hướng 138 độ. Sóng 0,8 mét, gió cấp 3 Đông Bắc.", { loai: "canh-bao", rungMs: 200 }) || GD.thanhBao("canh-bao", "Máy không có giọng đọc tiếng Việt, hoặc đang Tắt giọng");
    const sdt = b.querySelector("#o-sdt"); if (sdt) sdt.onchange = () => { S.caiDat.soDienThoai = sdt.value.trim(); luu("cai-dat"); };
    ["tocDoTau", "dauGio", "monNuoc"].forEach(k => { const o = b.querySelector(`#o-${k}`); if (o) o.onchange = () => { S.caiDat[k] = o.value.replace(",", "."); luu("cai-dat"); }; });
    const kyHieu = b.querySelector("#ky-hieu"); if (kyHieu) kyHieu.onclick = moBangKyHieu;
    const doKc = b.querySelector("#do-kc"); if (doKc) doKc.onclick = batDoKhoangCach;
    const taiBd = b.querySelector("#tai-ban-do"); if (taiBd) taiBd.onclick = moBangTaiBanDo;
    const taiTT = b.querySelector("#tai-tt"); if (taiTT) taiTT.onclick = () => { GD.dongBang(); capNhatThoiTiet(true); dambaoLuoi(true).then(() => { capNhatLopMau(); if (S.caBat) veCa(); }); };
    const xuat = b.querySelector("#xuat-du-lieu"); if (xuat) xuat.onclick = xuatDuLieu;
    const nhap = b.querySelector("#nhap-du-lieu"); if (nhap) nhap.onchange = e => nhapDuLieu(e.target.files[0]);
  }, { onDong: () => { S.nhomLop = null; veLai(); } });
}
const lopTheoNhom = nhom => Object.entries(banDo.lop).filter(([, l]) => l.nhom === nhom).map(([k, l]) => congTac(k, l.ten, l.moTa, banDo.lopDangBat(k), `data-lop="${k}"`)).join("");
function htmlHaiDo() {
  return `<p class="tieu-de-nhom">LỚP NỀN BẢN ĐỒ · CHỌN 1</p>` +
    Object.entries(banDo.nen).map(([k, n]) => GD.htmlTuyChon("radio", "nen", k, n.ten, n.moTa, k === S.caiDat.nen)).join("") +
    `<p class="ghi-chu">Ảnh vệ tinh chụp trước đó, không phải ngay lúc này. Phao báo hiệu chỉ hiện khi phóng to gần bờ.</p>
     <p class="tieu-de-nhom">HẢI ĐỒ CHI TIẾT</p>` + lopTheoNhom("hai-do") +
    `<div class="hang"><button class="nut phu" id="ky-hieu">Ký hiệu là gì?</button></div><p class="ghi-chu">Xem hình phao, đèn, xác tàu, cáp… và nghĩa của từng hình.</p>`;
}
function htmlNguTruong() {
  return congTac("ca", "Dự báo cá (vùng có khả năng tập trung)", "Theo ngày · tính từ nhiệt mặt biển, sóng, dòng chảy", S.caBat) +
    `<p class="ghi-chu">Ô <b style="color:#e53935">đỏ</b> = thuận lợi, <b style="color:#f9a825">vàng</b> = trung bình, <b style="color:#43a047">xanh</b> = thấp. Vòng tròn ◎ là điểm nóng. Chọn ngày ở dải dưới để xem ngày khác.</p>
     <p class="ghi-chu"><b>Mô hình đơn giản, chỉ để tham khảo:</b> dựa trên ranh nước nóng/lạnh, nhiệt mặt biển 26–29°C, biển êm, dòng chảy vừa. SDFish còn dùng ảnh vệ tinh màu nước (chlorophyll) và khí hậu cá theo mùa — bản mẫu chưa có.</p>`;
}
function htmlThoiTiet() {
  const bao = S.tinBao && !S.tinBao.tuDuBao ? (S.tinBao.coBao ? `<b style="color:var(--nguy-hiem)">Đang có bão.</b> ${esc(S.tinBao.moTa || "")}` : "Không có tin bão trên Biển Đông (nguồn riêng).")
    : S.goiTau ? `Không có nguồn tin bão riêng — app suy ra từ dự báo gió giật tại tàu (${esc($("thanh-bao-chu").textContent)}).` : "Chưa hỏi được.";
  const lopMauHtml = Object.entries(LTT.LOP_MAU).filter(([k]) => k !== "nhiet-bien").map(([k, l]) => congTac(k, l.ten, l.moTa, S.lopMau === k, `data-mau="${k}"`)).join("");
  return `<p class="tieu-de-nhom">CẢNH BÁO BÃO · ƯU TIÊN CAO NHẤT</p><p class="hop-tt ${S.tinBao?.coBao ? "nguy-hiem" : "tot"}">${bao}</p>
    <p class="tieu-de-nhom">LỚP THỜI TIẾT KHÁC</p>${lopMauHtml}
    <p class="ghi-chu">Mấy lớp này cần tải "gió sóng cả vùng" một lần (2–4 MB), sau đó xem được khi mất sóng. Muốn biết gió, sóng ngay chỗ nào thì <b>chạm vào chỗ đó trên bản đồ</b>. Độ mặn, nước dâng/xoáy (Copernicus Marine) bản mẫu chưa có.</p>
    <div class="hang"><button class="nut" id="tai-tt">Tải lại dự báo</button></div>`;
}
function htmlCongCu() {
  return `<p><b>Đo khoảng cách</b> — chạm 2 điểm (hoặc nhiều điểm) trên bản đồ.</p><div class="hang"><button class="nut" id="do-kc">Bắt đầu đo</button></div>
    <p style="margin-top:16px"><b>Tải bản đồ dùng khi mất sóng</b> — lưu các ô bản đồ của vùng đang xem vào máy.</p><div class="hang"><button class="nut phu" id="tai-ban-do">Tải vùng đang xem</button></div>`;
}
function htmlCaiDat() {
  const c = S.caiDat;
  return `<p class="tieu-de-nhom">ĐƠN VỊ KHOẢNG CÁCH</p>` +
    GD.htmlTuyChon("radio", "donVi", "hl", "Hải lý", "nm · đơn vị chuẩn đi biển", c.donVi === "hl") + GD.htmlTuyChon("radio", "donVi", "km", "Ki-lô-mét", "km", c.donVi === "km") +
    `<p class="tieu-de-nhom">HỆ TOẠ ĐỘ</p>` +
    GD.htmlTuyChon("radio", "toaDo", "dms", "Độ – phút – giây", "vd 8°30′00″N · 109°18′00″E", c.toaDo === "dms") + GD.htmlTuyChon("radio", "toaDo", "thap-phan", "Độ thập phân", "vd 8,50°N · 109,30°E", c.toaDo === "thap-phan") +
    `<p class="tieu-de-nhom">GIỌNG ĐỌC KHI CHẠY</p>` + congTac("tuDongChay", "Mở bản đồ là tự đọc cảnh báo", "Bật = vừa mở app đã vào chế độ Đang chạy", c.tuDongChay) +
    GD.htmlTuyChon("radio", "giong", "day-du", "Đọc đầy đủ", "cảnh báo, sóng gió, khoảng cách tới đích, điểm tin 10 phút", c.giong === "day-du") +
    GD.htmlTuyChon("radio", "giong", "it", "Đọc ít", "chỉ cảnh báo ranh giới, khu cấm, bão, sắp tới đích", c.giong === "it") +
    GD.htmlTuyChon("radio", "giong", "tat", "Tắt giọng", "chỉ rung và chữ trên màn hình", c.giong === "tat") +
    congTac("rung", "Rung khi có cảnh báo", "", c.rung) +
    `<div class="hang"><button class="nut phu" id="nghe-thu">Nghe thử</button></div><p class="ghi-chu">Đổi ở đây thì toạ độ, khoảng cách, dẫn đường và công cụ đo đều đổi theo.</p>
     <p class="tieu-de-nhom">TUỲ CHỌN TÀU (DÙNG KHI TÍNH LỘ TRÌNH)</p>
     <div class="hang"><label class="o-nhap">Tàu chạy (hải lý/giờ)<input id="o-tocDoTau" class="so" inputmode="decimal" value="${esc(c.tocDoTau)}"></label><label class="o-nhap">Máy ăn dầu (lít/giờ)<input id="o-dauGio" class="so" inputmode="decimal" value="${esc(c.dauGio)}"></label></div>
     <div class="hang"><label class="o-nhap">Mớn nước (m) — trống nếu chưa rõ<input id="o-monNuoc" class="so" inputmode="decimal" placeholder="vd 1,8" value="${esc(c.monNuoc)}"></label><label class="o-nhap">Số điện thoại (hiện ở Trang chủ)<input id="o-sdt" class="so" inputmode="tel" value="${esc(c.soDienThoai)}"></label></div>
     <p class="tieu-de-nhom">LỚP BẢN ĐỒ</p>` + lopTheoNhom("cai-dat") +
    `<p class="ghi-chu">Ranh giới trong bản mẫu là toạ độ MẪU (data/ranh-gioi.json). Ranh chính thức tra Chi cục Thủy sản.</p>
     <p class="tieu-de-nhom">CHUYỂN SANG MÁY MỚI</p><div class="hang"><button class="nut phu" id="xuat-du-lieu">Lưu tệp dữ liệu</button><label class="nut phu" style="text-align:center">Phục hồi từ tệp<input type="file" id="nhap-du-lieu" accept=".json" hidden></label></div>
     <p class="ghi-chu">Tệp gồm điểm đã ghim, giấy tờ, sổ thuyền viên, giá tự ghi, cài đặt. Không gồm dự báo (tải lại được).</p>
     <p class="tieu-de-nhom">PHIÊN BẢN</p><p class="ghi-chu">${PHIEN_BAN}</p>`;
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
    ${dong('<span style="color:#2e7d32;font-weight:800">◌</span>', "Vòng xanh lá nét đứt", "khu bảo tồn biển, vùng cấm/hạn chế khai thác")}
    ${dong('<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#f9a825;border:2px solid #fff;box-shadow:0 0 0 1px #999"></span>', "Vòng vàng (mỏ neo)", "khu neo đậu tránh trú bão")}
    ${dong('<span style="display:inline-block;width:10px;height:16px;background:#fff;border:2px solid #c62828"></span>', "Tháp đỏ trắng", "đèn biển")}
    ${dong('<span style="display:inline-block;width:16px;height:16px;border:2px solid #1565c0;border-radius:3px"></span>', "Ô xanh dương", "trạm con nước — chạm xem giờ nước lớn, ròng")}
    ${dong('<span style="color:#f9a825;font-size:20px">★</span>', "Sao vàng", "điểm bà con đã ghim")}
    ${dong('<span style="color:#e8632b;font-size:20px">📍</span>', "Ghim cam", "điểm đang xem (TRỎ)")}
    ${dong('<span style="color:#c62828;font-size:18px">⚑</span>', "Cờ đỏ", "điểm đang dẫn đường tới")}
  </ul><p class="ghi-chu">Phao, đèn, xác tàu, cáp ngầm vẽ theo chuẩn OpenSeaMap khi phóng to gần bờ.</p>`);
}

// ---------------------------------------------------------------------
// BẢNG: ĐIỂM, ĐẾN ĐIỂM, ĐIỂM ĐÃ LƯU, LỘ TRÌNH
// ---------------------------------------------------------------------
function moBangDiem(p, ten) {
  const kc = S.viTri ? `<tr><td>Từ tàu</td><td>${esc(fKc(HH.khoangCach(S.viTri, p)))} · ${Math.round(HH.huongDi(S.viTri, p))}°</td></tr>` : "";
  const rg = ranhGioiGanNhat(p);
  GD.moBang(ten || "Điểm vừa chọn", `<p class="so-lon">${esc(fViTri(p))}</p><table class="bang-thong-tin">${kc}${rg ? `<tr><td>Tới ranh giới</td><td>${esc(fKc(rg.met))}</td></tr>` : ""}</table>
    <div class="hang"><button class="nut cam" id="d-dan">Dẫn đường tới đây</button><button class="nut phu" id="d-ghim">Ghim điểm này</button></div>
    <div class="hang"><button class="nut phu" id="d-xem">Xem gió sóng ở đây</button><button class="nut phu" id="d-lt">Thêm vào lộ trình</button></div>`,
    b => {
      b.querySelector("#d-dan").onclick = () => { datTro(p); datDich(p); GD.dongBang(); if (!S.dangChay) batTatDanDuong(); if (S.viTri) banDo.vuaKhung([S.viTri, p]); };
      b.querySelector("#d-ghim").onclick = () => ghimDiem(p, ten);
      b.querySelector("#d-xem").onclick = () => { GD.dongBang(); datTro(p); };
      b.querySelector("#d-lt").onclick = () => { S.loTrinh.push(p); luu("lo-trinh"); moBangLoTrinh(); };
    });
}
function ghimDiem(p, tenGoiY) {
  GD.moBang("Ghim điểm", `<label class="o-nhap">Tên điểm (rạn, bãi mực, nhà giàn…)<input id="g-ten" value="${esc(tenGoiY || `Điểm ${S.diemLuu.length + 1}`)}"></label><p class="so-lon" style="font-size:14px">${esc(fViTri1(p))}</p><div class="hang"><button class="nut cam" id="g-ok">Lưu</button></div>`,
    b => { b.querySelector("#g-ten").focus(); b.querySelector("#g-ok").onclick = () => { S.diemLuu.push({ ten: b.querySelector("#g-ten").value.trim() || `Điểm ${S.diemLuu.length + 1}`, lat: p[0], lon: p[1], luc: Date.now() }); luu("diem-luu"); veDiemLuu(); GD.dongBang(); }; });
}
function moBangDenDiem() {
  const c = S.tro || S.viTri || banDo.tam() || CAU_HINH.tamMacDinh;
  const f = v => S.caiDat.toaDo === "dms" ? HH.dms(v, "", "").replace(/[°′″]/g, " ").trim() : Math.abs(v).toFixed(4);
  GD.moBang("Đến điểm — nhập toạ độ", `<p class="ghi-chu">Gõ độ, phút (giây) cách nhau bằng dấu cách, vd <b>8 30</b> = 8°30′; hoặc số thập phân vd <b>8.5</b>.</p>
    <div class="hang"><label class="o-nhap">Vĩ độ (N)<input id="dd-lat" class="so" inputmode="decimal" placeholder="vd 8 30" value="${f(c[0])}" aria-label="Vĩ độ"></label><label class="o-nhap">Kinh độ (E)<input id="dd-lon" class="so" inputmode="decimal" placeholder="vd 109 18" value="${f(c[1])}" aria-label="Kinh độ"></label></div>
    <div class="hang"><button class="nut cam" id="dd-di">Đến điểm</button><button class="nut phu" id="dd-ghim">Ghim điểm này</button></div><p class="ghi-chu" id="dd-loi"></p>
    <p class="ghi-chu">"Đến điểm" đặt điểm đang xem và hiện gió sóng ở đó. Muốn máy dẫn đường, mở <b>Lộ trình</b> rồi bấm <b>Dẫn đường tới điểm đang xem</b>. Hoặc đóng bảng này rồi <b>giữ tay lên bản đồ</b>.</p>`,
    b => {
      const doc = () => { const p = [HH.docToaDo(b.querySelector("#dd-lat").value), HH.docToaDo(b.querySelector("#dd-lon").value)]; if (!(Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) { b.querySelector("#dd-loi").textContent = "Toạ độ chưa đúng. Ví dụ: 13 00 00 và 110 30 00."; return null; } return p; };
      b.querySelector("#dd-di").onclick = () => { const p = doc(); if (p) { datTro(p); GD.dongBang(); banDo.nhinToi(p, Math.max(banDo.zoom(), 8)); } };
      b.querySelector("#dd-ghim").onclick = () => { const p = doc(); if (p) ghimDiem(p); };
    });
}
function moBangDiemLuu() {
  const ds = S.diemLuu.map((d, i) => `<li><div class="noi-dung"><b>${esc(d.ten)}</b><span>${esc(fViTri1([d.lat, d.lon]))}${S.viTri ? ` · ${esc(fKc(HH.khoangCach(S.viTri, [d.lat, d.lon])))}` : ""}</span></div><button class="nut phu" data-den="${i}">Tới</button><button class="nut do" data-xoa="${i}">Xoá</button></li>`).join("");
  GD.moBang("Điểm đã lưu", (S.diemLuu.length ? `<ul class="danh-sach">${ds}</ul>` : `<p class="ghi-chu">Chưa ghim chỗ nào. Chạm vào chỗ hay đánh trên bản đồ rồi bấm <b>Ghim điểm này</b> — lần sau mở một chạm là tới.</p>`) +
    `<div class="hang"><button class="nut cam" id="dl-them">Thêm điểm (chỗ đang xem)</button></div><p class="tieu-de-nhom">CẢNG NHÀ</p><p class="ghi-chu">${S.cangNha ? `<b>${esc(S.cangNha.ten)}</b> · ${esc(fViTri1([S.cangNha.lat, S.cangNha.lon]))}` : "Cảng nhà: chưa đặt"}</p>
    <div class="hang"><select id="dl-cang" class="o-nhap" style="padding:11px;border:1px solid #c5d3e0;border-radius:10px;font-family:var(--f-ui)"><option value="">— chọn cảng —</option>${(S.duLieu.cang?.danhSach || []).map((c, i) => `<option value="${i}">${esc(c.ten)}</option>`).join("")}</select><button class="nut phu" id="dl-cang-ok">Đặt làm cảng nhà</button></div>`,
    b => {
      b.querySelectorAll("[data-den]").forEach(x => x.onclick = () => { const d = S.diemLuu[+x.dataset.den]; datTro([d.lat, d.lon]); GD.dongBang(); banDo.nhinToi([d.lat, d.lon]); moBangDiem([d.lat, d.lon], d.ten); });
      b.querySelectorAll("[data-xoa]").forEach(x => x.onclick = () => { S.diemLuu.splice(+x.dataset.xoa, 1); luu("diem-luu"); veDiemLuu(); moBangDiemLuu(); });
      b.querySelector("#dl-them").onclick = () => ghimDiem(S.tro || S.viTri || banDo.tam() || CAU_HINH.tamMacDinh);
      b.querySelector("#dl-cang-ok").onclick = () => { const i = b.querySelector("#dl-cang").value; if (i === "") return; S.cangNha = S.duLieu.cang.danhSach[+i]; luu("cang-nha"); veDiemLuu(); moBangDiemLuu(); };
    });
}
function cangGanNhat(p) {
  const ds = S.duLieu.cang?.danhSach; if (!ds || !p) return null; let tot = null;
  for (const c of ds) { const m = HH.khoangCach(p, [c.lat, c.lon]); if (!tot || m < tot.m) tot = { m, ten: `${c.ten} — gần điểm đến nhất`, p: [c.lat, c.lon] }; }
  return tot;
}
function moBangLoTrinh() {
  const dich = S.tro;
  const xuatPhat = S.viTri ? { ten: "Vị trí tàu (GPS)", p: S.viTri } : S.cangNha ? { ten: `Cảng nhà: ${S.cangNha.ten}`, p: [S.cangNha.lat, S.cangNha.lon] } : cangGanNhat(S.loTrinh[0] || dich);
  const diem = [xuatPhat?.p, ...S.loTrinh, dich].filter(Boolean);
  const tong = HH.chieuDaiTuyen(diem), c = S.caiDat, tocDo = parseFloat(c.tocDoTau) || 7, dau = parseFloat(c.dauGio) || 0;
  const gio = tong / HAI_LY / tocDo;
  S.loTrinhVe = diem.length > 1 ? diem : null; banDo.veLoTrinh(S.loTrinhVe);
  const ds = S.loTrinh.map((p, i) => `<li><div class="noi-dung"><b>Điểm trung gian ${i + 1}</b><span>${esc(fViTri1(p))}</span></div><button class="nut do" data-bo="${i}">Bỏ</button></li>`).join("");
  GD.moBang("Lộ trình", `
    ${dich ? `<div class="hang" style="margin-top:0"><button class="nut cam" id="lt-dan">Dẫn đường tới điểm đang xem</button></div>` : `<p class="hop-tt canh-bao">Chưa có điểm đến. Chạm vào bản đồ hoặc dùng "Đến điểm" để chọn chỗ muốn tới.</p>`}
    <table class="bang-thong-tin">
      <tr><td>Điểm xuất phát</td><td>${xuatPhat ? `${esc(xuatPhat.ten)}<br>${esc(fViTri1(xuatPhat.p))}` : "chưa có (bật GPS hoặc đặt cảng nhà)"}</td></tr>
      <tr><td>Điểm đến</td><td>${dich ? `Chỗ đang xem<br>${esc(fViTri1(dich))}` : "—"}</td></tr>
      <tr><td>Quãng đường</td><td>${diem.length > 1 ? esc(fKc(tong)) : "—"}</td></tr>
      <tr><td>Thời gian</td><td>${diem.length > 1 ? `${HH.dinhDangThoiGian(gio)} (${tocDo} hl/giờ)` : "—"}</td></tr>
      <tr><td>Dầu ước tính</td><td>${diem.length > 1 && dau ? `${Math.round(gio * dau).toLocaleString("vi-VN")} lít (${dau} lít/giờ)` : "—"}</td></tr>
      ${c.monNuoc ? `<tr><td>Mớn nước</td><td>${esc(c.monNuoc)} m · app chưa kiểm tra độ sâu dọc tuyến, bà con xem hải đồ</td></tr>` : ""}
    </table>
    ${S.loTrinh.length ? `<p class="tieu-de-nhom">ĐIỂM TRUNG GIAN</p><ul class="danh-sach">${ds}</ul>` : ""}
    <div class="hang"><button class="nut phu" id="lt-them">Thêm chỗ đang xem làm điểm trung gian</button><button class="nut phu" id="lt-tuy-chon">Tuỳ chọn tàu</button>${S.loTrinh.length || S.dich ? `<button class="nut do" id="lt-xoa">Xoá lộ trình</button>` : ""}</div>
    <p class="ghi-chu">Lộ trình là đường thẳng qua các điểm (chưa tránh đảo, bãi cạn). Khi tới điểm trung gian (dưới ${CAU_HINH.nguong.sapToiDichHaiLy} hải lý), app tự chuyển sang điểm kế tiếp.</p>`,
    b => {
      const dan = b.querySelector("#lt-dan"); if (dan) dan.onclick = () => { datDich(S.loTrinh[0] || dich); if (!S.loTrinh.length || !cungDiem(S.loTrinh[S.loTrinh.length - 1], dich)) { if (S.loTrinh.length) { S.loTrinh.push(dich); luu("lo-trinh"); } } GD.dongBang(); banDo.vuaKhung(diem); if (!S.dangChay) batTatDanDuong(); };
      b.querySelectorAll("[data-bo]").forEach(x => x.onclick = () => { S.loTrinh.splice(+x.dataset.bo, 1); luu("lo-trinh"); moBangLoTrinh(); });
      b.querySelector("#lt-them").onclick = () => { if (dich) { S.loTrinh.push(dich); luu("lo-trinh"); moBangLoTrinh(); } };
      b.querySelector("#lt-tuy-chon").onclick = () => { S.nhomLop = "cai-dat"; moBangLop("cai-dat"); };
      const xoa = b.querySelector("#lt-xoa"); if (xoa) xoa.onclick = () => { S.loTrinh = []; luu("lo-trinh"); datDich(null); S.loTrinhVe = null; banDo.veLoTrinh(null); moBangLoTrinh(); };
    }, { onDong: () => { if (!S.dich) { S.loTrinhVe = null; banDo.veLoTrinh(null); } } });
}

// ---------------------------------------------------------------------
// BẢNG: SÓNG GIÓ CHI TIẾT · CON NƯỚC · DỮ LIỆU · TẢI BẢN ĐỒ · ĐO · THÔNG TIN
// ---------------------------------------------------------------------
function moBangSongGio() {
  const g = goiHienTai();
  if (!g) { GD.moBang("Gió sóng", `<p class="ghi-chu">Chưa có dự báo. Cần mạng để tải lần đầu.</p><div class="hang"><button class="nut" id="sg-tai">Tải ngay</button></div>`, b => b.querySelector("#sg-tai").onclick = () => { GD.dongBang(); capNhatThoiTiet(true); }); return; }
  const tt = TT.tomTatNgay(g, S.ngayChon), dong = TT.dongChayHienTai(g);
  const gioRows = TT.theoGio(g, S.ngayChon).filter((_, i) => i % 3 === 0).map(h => `<tr><td>${h.gio}</td><td>cấp ${h.capGio} ${HH.tenHuong(h.gioHuong)}${h.giatMs > h.gioMs + 3 ? `, giật ${HH.capBeaufort(h.giatMs)}` : ""} · sóng ${h.songM != null ? h.songM.toFixed(1).replace(".", ",") : "—"} m</td></tr>`).join("");
  GD.moBang(`Gió sóng · ${TT.nhanNgay(g, S.ngayChon)}`, `<table class="bang-thong-tin">
    <tr><td>Tại</td><td>${esc(fViTri1(g.viTri))}${S.goiTro ? " · điểm đang xem" : " · tàu"}</td></tr>
    <tr><td>Sóng ${tt.hienTai ? "lúc này" : "cao nhất"}</td><td>${tt.songM != null ? tt.songM.toFixed(1).replace(".", ",") : "—"} m${tt.songHuong != null ? ` từ ${HH.tenHuong(tt.songHuong)}` : ""}${tt.chuKy ? ` · chu kỳ ${Math.round(tt.chuKy)} s` : ""}</td></tr>
    <tr><td>Gió ${tt.hienTai ? "lúc này" : "mạnh nhất"}</td><td>cấp ${tt.capGio} (${Math.round(tt.gioMs * 3.6)} km/giờ) ${tt.tenHuongGio}</td></tr>
    <tr><td>Gió giật</td><td>cấp ${tt.capGiat}</td></tr>
    ${tt.muaMm != null ? `<tr><td>Mưa</td><td>${tt.muaMm.toFixed(1).replace(".", ",")} mm${tt.moTaTroi ? ` · ${tt.moTaTroi}` : ""}</td></tr>` : ""}
    ${dong && S.ngayChon === 0 ? `<tr><td>Dòng chảy</td><td>${(dong.tocDoMs * 3600 / HAI_LY).toFixed(1)} hl/giờ về ${HH.tenHuong(dong.huong)}</td></tr>` : ""}
    <tr><td>Lấy lúc</td><td>${esc(tuoi(g.luc))}</td></tr></table>
    ${gioRows ? `<p class="tieu-de-nhom">THEO GIỜ (MỖI 3 GIỜ)</p><table class="bang-thong-tin">${gioRows}</table>` : ""}
    <p class="ghi-chu">Nguồn: Open-Meteo (gió GFS/ICON, sóng GFS Wave 0,25°). Mũi tên ở dải dưới chỉ hướng gió <b>thổi tới</b>. Cấp gió theo thang Beaufort.</p>
    ${S.goiTro ? `<div class="hang"><button class="nut phu" id="sg-tau">Về dự báo tại tàu</button></div>` : ""}`,
    b => { const t = b.querySelector("#sg-tau"); if (t) t.onclick = () => { S.goiTro = null; luu("goi-tro"); hienThoiTiet(); GD.dongBang(); }; });
}
async function moBangConNuoc(tram) {
  GD.moBang(`Con nước · ${tram.ten}`, `<p class="ghi-chu">Đang hỏi mực nước…</p>`);
  let cn = kho.doc("con-nuoc." + tram.ten, null);
  if (!cn || Date.now() - cn.luc > 12 * 3600e3) {
    try { cn = await CN.taiConNuoc(tram); kho.ghi("con-nuoc." + tram.ten, cn); }
    catch (e) { if (!cn) { GD.moBang(`Con nước · ${tram.ten}`, `<p class="hop-tt canh-bao">Chưa lấy được (${esc(e.message)}). Cần mạng lần đầu.</p>`); return; } }
  }
  const homNay = new Date().toISOString().slice(0, 10);
  const dinh = cn.dinh.map(d => `<tr><td>${d.gio.slice(0, 10) === homNay ? "Hôm nay" : d.gio.slice(8, 10) + "/" + d.gio.slice(5, 7)} ${d.gio.slice(11, 16)}</td><td>${d.loai === "lon" ? "Nước lớn" : "Nước ròng"} · ${d.mucM.toFixed(2).replace(".", ",")} m</td></tr>`).join("");
  GD.moBang(`Con nước · ${tram.ten}`, `<p class="ghi-chu">${esc(tram.tinh)} · ${esc(fViTri1([tram.lat, tram.lon]))} · lấy ${esc(tuoi(cn.luc))}</p><canvas class="do-thi" id="cn-canvas"></canvas>
    <p class="tieu-de-nhom">GIỜ NƯỚC LỚN, NƯỚC RÒNG (3 NGÀY)</p><table class="bang-thong-tin">${dinh}</table>
    <p class="ghi-chu">Mực nước so với mực nước biển trung bình, từ mô hình toàn cầu (Open-Meteo). Có thể lệch 30–60 phút so với bảng thuỷ triều chính thức — chỉ để tham khảo khi ra vào cửa.</p>`,
    b => CN.veDuong(b.querySelector("#cn-canvas"), cn));
}
async function moBangDuLieu() {
  const soO = await demOBanDo(), luoiByte = S.luoi ? await khoLon.kichThuoc("luoi") : 0;
  const dong = (ten, moTa, luc, byte, moi) => `<li><div class="noi-dung"><b>${ten}</b><span>${moTa} · lưu ${tuoi(luc)}${byte ? ` · ${dinhDangByte(byte)}` : ""}</span></div><span style="color:${moi ? "var(--tot)" : "var(--nguy-hiem)"};font-weight:700;white-space:nowrap">${moi ? "✓ còn mới" : "✗ cũ"}</span></li>`;
  const g = S.goiTau, d = S.goiTro, l = S.luoi, han = x => x ? `tới ${new Date(x.hanDung).getDate()}/${new Date(x.hanDung).getMonth() + 1}` : "chưa có";
  const tramLuu = (S.duLieu.tramConNuoc?.danhSach || []).map(t => kho.doc("con-nuoc." + t.ten, null)).filter(Boolean);
  GD.moBang("Dữ liệu đã lưu để đi biển", `<p class="ghi-chu">Mỗi lớp cần tải sẵn lúc còn sóng để xem được khi ra khơi mất sóng. Dòng nào cũ thì chạm <b>Tải lại</b>.</p>
    <ul class="danh-sach">
      ${dong("Tin bão Biển Đông", S.tinBao?.tuDuBao ? "suy từ dự báo gió" : "nguồn riêng", S.tinBao?.luc, kho.kichThuoc("tin-bao"), S.tinBao && Date.now() - S.tinBao.luc < 12 * 3600e3)}
      ${dong("Gió sóng CẢ VÙNG biển", l ? `cả Biển Đông · ${LTT.LUOI.soNgay} ngày · ${han(l)}` : "chưa tải (mở Thời tiết → bật một lớp)", l?.luc, luoiByte, l && Date.now() < l.hanDung)}
      ${dong("Gió sóng tại tàu", g ? `${CAU_HINH.thoiTiet.soNgay} ngày · ${han(g)}` : "chưa có", g?.luc, kho.kichThuoc("goi-tau"), g && Date.now() < g.hanDung)}
      ${dong("Gió sóng chi tiết điểm đang xem", d ? `1 điểm · ${CAU_HINH.thoiTiet.soNgay} ngày` : "chưa có", d?.luc, kho.kichThuoc("goi-tro"), d && Date.now() < d.hanDung)}
      ${dong("Bản đồ cá", l?.lop?.sea_surface_temperature ? "tính từ lưới cả vùng · vài ngày tới" : "cần lưới cả vùng", l?.luc, 0, !!l?.lop?.sea_surface_temperature)}
      ${dong("Lớp màu mây · mưa · nhiệt · dông · áp suất", l ? "cùng gói lưới cả vùng" : "cần lưới cả vùng", l?.luc, 0, !!l)}
      ${dong("Con nước", tramLuu.length ? `${tramLuu.length} trạm · 3 ngày` : "chạm vào trạm trên bản đồ để lấy", tramLuu[0]?.luc, 0, tramLuu.length && tramLuu.every(c => Date.now() - c.luc < 24 * 3600e3))}
      ${dong("Giá cá, giá dầu", "bảng giá trong app", Date.now(), kho.kichThuoc("trang.gia-tu-ghi"), true)}
      ${dong("Ô bản đồ", soO == null ? "không đếm được" : `${soO} ô đã lưu`, soO ? Date.now() : null, 0, !!soO)}
    </ul>
    <p class="ghi-chu">Tổng trong máy: ~${dinhDangByte(luoiByte + ["goi-tau", "goi-tro", "tin-bao", "vet", "diem-luu"].reduce((s, k) => s + kho.kichThuoc(k), 0))} (chưa tính ô bản đồ).</p>
    <div class="hang"><button class="nut" id="dl-tai">Tải lại tất cả</button><button class="nut phu" id="dl-bd">Tải ô bản đồ</button></div>
    <p class="ghi-chu">Cần có sóng (mạng) để tải. Ngoài khơi mất sóng thì chỉ xem lại được thứ đã tải sẵn.</p>`,
    b => { b.querySelector("#dl-tai").onclick = () => { GD.dongBang(); capNhatThoiTiet(true); dambaoLuoi(true).then(ok => { if (ok) { capNhatLopMau(); if (S.caBat) veCa(); GD.dongBang(); } }); }; b.querySelector("#dl-bd").onclick = moBangTaiBanDo; });
}
async function demOBanDo() { try { if (!("caches" in window)) return null; return (await (await caches.open("haido-o-ban-do-v1")).keys()).length; } catch { return null; } }
function moBangTaiBanDo() {
  const z = banDo.zoom(), nt = CAU_HINH.ngoaiTuyen, zMin = Math.max(z - 1, 3), zMax = Math.min(z + nt.zoomThemKhiTai, nt.zoomToiDa);
  const urls = banDo.urlOTrongKhung(zMin, zMax), nhieu = urls.length > nt.gioiHanOMoiLan;
  GD.moBang("Tải bản đồ dùng khi mất sóng", `<p class="ghi-chu">Vùng đang xem, mức phóng ${zMin}–${zMax}: <b>${urls.length}</b> ô bản đồ.${nhieu ? ` Quá giới hạn ${nt.gioiHanOMoiLan} ô — phóng to vào vùng nhỏ hơn rồi tải nhiều lần.` : ""}</p><p class="ghi-chu">Ô bản đồ đã xem khi có mạng cũng được tự lưu lại.</p>
    <div class="tien-trinh"><div id="tb-tien"></div></div><div class="hang"><button class="nut" id="tb-tai" ${nhieu || !urls.length ? "disabled" : ""}>Tải ${urls.length} ô</button></div><p class="ghi-chu" id="tb-chu"></p>`,
    b => { b.querySelector("#tb-tai").onclick = async () => {
      if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) { b.querySelector("#tb-chu").textContent = "Cần mở app qua địa chỉ https:// để lưu được bản đồ."; return; }
      b.querySelector("#tb-tai").disabled = true; let ok = 0, loi = 0;
      for (let i = 0; i < urls.length; i += 6) { await Promise.all(urls.slice(i, i + 6).map(u => fetch(u, { mode: "cors", credentials: "omit" }).then(() => ok++, () => loi++))); b.querySelector("#tb-tien").style.width = `${(ok + loi) / urls.length * 100}%`; b.querySelector("#tb-chu").textContent = `Đã tải ${ok}/${urls.length}${loi ? ` · lỗi ${loi}` : ""}`; }
      b.querySelector("#tb-chu").textContent += " · Xong. Có thể xem vùng này khi mất sóng.";
    }; });
}
function batDoKhoangCach() {
  GD.dongBang(); S.nhomLop = null; veLai(); $("thanh-do").hidden = false; $("thanh-do-chu").textContent = "Chạm 2 điểm trên bản đồ";
  banDo.batDo(diem => { const tong = HH.chieuDaiTuyen(diem); $("thanh-do-chu").textContent = diem.length > 1 ? `${fKc(tong)} · ${diem.length} điểm · đoạn cuối ${Math.round(HH.huongDi(diem[diem.length - 2], diem[diem.length - 1]))}°` : diem.length === 1 ? "Chạm điểm thứ hai…" : "Chạm 2 điểm trên bản đồ"; });
}
function tatDoKhoangCach() { banDo.tatDo(); $("thanh-do").hidden = true; }
function moBangThongTin() {
  GD.moBang("Nguồn dữ liệu", `<table class="bang-thong-tin">
    <tr><td>Nền đáy biển</td><td>Esri World Ocean Base (GEBCO, NOAA)</td></tr><tr><td>Ảnh vệ tinh</td><td>Esri World Imagery</td></tr>
    <tr><td>Phao đèn</td><td>© OpenSeaMap</td></tr><tr><td>Đường phố</td><td>© OpenStreetMap</td></tr>
    <tr><td>Dự báo</td><td>Open-Meteo (gió GFS/ICON, sóng GFS Wave, dòng chảy, nhiệt mặt biển, mực nước)</td></tr>
    <tr><td>Địa danh ngầm</td><td>Thông tư 33/2024 · vị trí gần đúng</td></tr><tr><td>Khu trú bão</td><td>QĐ 582/QĐ-TTg 2024 · vị trí gần đúng</td></tr>
    <tr><td>Ranh giới</td><td>TOẠ ĐỘ MẪU · ranh chính thức tra Chi cục Thủy sản</td></tr></table>
    <p class="hop-tt canh-bao">Số độ sâu chỉ để THAM KHẢO, KHÔNG thay hải đồ chính thức và Thông báo hàng hải. Dự báo là mô hình, luôn nghe đài duyên hải.</p>`);
}
// Chuyển sang máy mới: xuất/nhập toàn bộ localStorage của app
function xuatDuLieu() {
  const du = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("haido.") && !/goi-tau|goi-tro|tin-bao|con-nuoc/.test(k)) du[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: "hai-do-ra-khoi", luc: new Date().toISOString(), du }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `hai-do-ra-khoi-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function nhapDuLieu(tep) {
  if (!tep) return;
  try { const j = JSON.parse(await tep.text()); if (j.app !== "hai-do-ra-khoi") throw new Error("Không phải tệp của app"); Object.entries(j.du).forEach(([k, v]) => localStorage.setItem(k, v)); GD.moBang("Đã phục hồi", `<p class="ghi-chu">Đã nạp ${Object.keys(j.du).length} mục. Mở lại app để áp dụng.</p><div class="hang"><button class="nut" onclick="location.reload()">Mở lại</button></div>`); }
  catch (e) { GD.moBang("Không nhập được", `<p class="hop-tt nguy-hiem">${esc(e.message)}</p>`); }
}

khoiDong();
