// =====================================================================
// CÁC TRANG: Trang chủ · Tàu cá · Bạn thuyền · Giao dịch
// Mọi dữ liệu ở đây lưu trên máy (localStorage), không cần máy chủ.
// Mỗi trang là một hàm trả về HTML và một hàm nối sự kiện.
// =====================================================================
import { kho } from "./kho.js";
import * as GD from "./giao-dien.js";

const esc = GD.esc;
let ctx = null; // { duLieu, chuyenTab, tauTomTat() }
export function khoiTaoTrang(c) { ctx = c; }

// ---------- Kho dữ liệu của các trang ----------
const D = {
  doc: (k, d) => kho.doc("trang." + k, d),
  ghi: (k, v) => kho.ghi("trang." + k, v),
};
export const docTau = () => D.doc("tau", null);
export const docThongBao = () => D.doc("thong-bao", []);
/** Thêm một thông báo (app tự sinh: biển động, bão, giấy tờ sắp hết hạn…). Giữ 30 tin mới nhất. */
export function themThongBao(muc, tieuDe, chu) {
  const ds = docThongBao();
  if (ds[0] && ds[0].tieuDe === tieuDe && ds[0].chu === chu) return; // không lặp
  ds.unshift({ luc: Date.now(), muc, tieuDe, chu }); D.ghi("thong-bao", ds.slice(0, 30));
}

// ---------- Tiện ích ----------
const ngayVN = iso => { if (!iso) return "—"; const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
const gioVN = luc => { const d = new Date(luc); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} · ${d.getDate()}/${d.getMonth() + 1}`; };
const tien = v => v == null || v === "" ? "—" : Number(v).toLocaleString("vi-VN") + " đ";
const conNgay = iso => iso ? Math.ceil((new Date(iso) - Date.now()) / 86400e3) : null;
const nhanHan = iso => { const n = conNgay(iso); if (n == null) return ""; if (n < 0) return `<span class="nhan-tt het-han">Hết hạn ${-n} ngày</span>`; if (n <= 30) return `<span class="nhan-tt sap-het">Còn ${n} ngày</span>`; return `<span class="nhan-tt">Còn ${n} ngày</span>`; };
const TINH = ["Quảng Ninh", "Hải Phòng", "Hưng Yên", "Ninh Bình", "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Trị", "Thừa Thiên Huế", "Đà Nẵng", "Quảng Ngãi", "Gia Lai", "Đắk Lắk", "Khánh Hòa", "Lâm Đồng", "Thành phố Hồ Chí Minh", "Đồng Nai", "Đồng Tháp", "Vĩnh Long", "An Giang", "Cần Thơ", "Cà Mau"];

/**
 * Mở bảng nhập liệu từ mô tả trường. truong: [{khoa, nhan, loai, ph, tuyChon, batBuoc, so}]
 * loai: text | number | date | select | textarea. Gọi onLuu(giaTri) khi bấm Lưu.
 */
export function bangForm(tieuDe, truong, giaTri = {}, onLuu, { onXoa } = {}) {
  const o = t => {
    const v = giaTri[t.khoa] ?? "";
    if (t.loai === "select") return `<label class="o-nhap">${esc(t.nhan)}<select data-k="${t.khoa}"><option value="">— Chọn —</option>${t.tuyChon.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>`;
    if (t.loai === "textarea") return `<label class="o-nhap">${esc(t.nhan)}<textarea data-k="${t.khoa}" rows="2" placeholder="${esc(t.ph || "")}">${esc(v)}</textarea></label>`;
    return `<label class="o-nhap">${esc(t.nhan)}<input data-k="${t.khoa}" type="${t.loai || "text"}" class="${t.so ? "so" : ""}" placeholder="${esc(t.ph || "")}" value="${esc(v)}" ${t.loai === "number" ? 'inputmode="decimal"' : ""}></label>`;
  };
  const nhom = {}; truong.forEach(t => { (nhom[t.nhom || ""] ||= []).push(t); });
  const html = Object.entries(nhom).map(([n, ds]) => (n ? `<p class="tieu-de-nhom">${esc(n)}</p>` : "") + `<div class="hang">${ds.map(o).join("")}</div>`).join("") +
    `<p class="ghi-chu" id="form-loi"></p><div class="hang"><button class="nut cam" id="form-luu">Lưu</button><button class="nut phu" id="form-huy">Hủy</button>${onXoa ? `<button class="nut do" id="form-xoa">Xoá</button>` : ""}</div>`;
  GD.moBang(tieuDe, html, b => {
    b.querySelector("#form-huy").onclick = GD.dongBang;
    if (onXoa) b.querySelector("#form-xoa").onclick = () => { onXoa(); GD.dongBang(); };
    b.querySelector("#form-luu").onclick = () => {
      const gt = { ...giaTri };
      b.querySelectorAll("[data-k]").forEach(e => { gt[e.dataset.k] = e.value.trim(); });
      const thieu = truong.filter(t => t.batBuoc && !gt[t.khoa]);
      if (thieu.length) { b.querySelector("#form-loi").textContent = `Cần điền: ${thieu.map(t => t.nhan).join(", ")}.`; return; }
      onLuu(gt); GD.dongBang();
    };
    const dau = b.querySelector("[data-k]"); dau && dau.focus();
  });
}

// =====================================================================
// TRANG CHỦ
// =====================================================================
function htmlTrangChu() {
  const tau = docTau(), c = kho.doc("cai-dat", {});
  const tb = docThongBao();
  const o = (khoa, svgPath, ten, moTa) => `<button data-di="${khoa}">${svgPath}<b>${ten}</b><span>${moTa}</span></button>`;
  return `<div class="dau-trang"><div class="tieu-de-nho">HẢI ĐỒ RA KHƠI · BẠN CỦA NGƯ DÂN</div><h1>Chào bà con</h1>
    <p>${tau ? `<b>${esc(tau.ten || "Tàu của tôi")}</b>${tau.maSo ? ` · ${esc(tau.maSo)}` : ""}${tau.tinh ? ` · ${esc(tau.tinh)}` : ""}` : "Chưa có thông tin tàu"}${c.soDienThoai ? `<br>${esc(c.soDienThoai)}` : ""}</p>
    ${tau ? "" : `<p style="margin-top:10px"><button class="nut-nho cam" data-di="tau-ca">Thêm tàu</button></p>`}</div>
    <div class="luoi-o">
      ${o("ra-khoi", `<svg viewBox="0 0 24 24"><path d="M3 12c3-4 7-6 11-6l4 6-4 6c-4 0-8-2-11-6z"/><path d="m18 6 3 6-3 6"/></svg>`, "Ra khơi", "Dự báo cá, gió sóng, dẫn đường")}
      ${o("tau-ca", `<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 13a7 7 0 0 0 14 0M3 13h4M17 13h4"/></svg>`, "Tàu cá", "Giấy tờ, bảo dưỡng, đồ nghề")}
      ${o("ban-thuyen", `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15a5 5 0 0 1 6 5"/></svg>`, "Bạn thuyền", "Hồ sơ, giấy tờ, bảo hiểm")}
      ${o("giao-dich", `<svg viewBox="0 0 24 24"><path d="M12 2v20M17 6.5a4 4 0 0 0-4-2.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></svg>`, "Giao dịch", "Giá cá, tin mua bán, chỗ bán")}
    </div>
    <div class="khoi"><h2>Thông báo${tb.length > 5 ? ` <small style="color:var(--mo);font-weight:600">· còn ${tb.length - 5} tin cũ hơn</small>` : ""}${tb.length > 5 ? `<button class="nut-nho" id="tb-xem-het">Xem hết</button>` : ""}</h2>
      ${tb.length ? tb.slice(0, 5).map(t => `<div class="thong-bao-item ${t.muc}"><i class="cham"></i><div><b>${esc(t.tieuDe)}</b><span>${gioVN(t.luc)} — ${esc(t.chu)}</span></div></div>`).join("")
        : `<p class="trong">Chưa có thông báo. Khi có biển động, tin bão hay giấy tờ sắp hết hạn, app ghi ở đây.</p>`}</div>
    ${htmlNhacHan()}`;
}
/** Khối nhắc giấy tờ tàu / bảo hiểm thuyền viên sắp hết hạn. */
function htmlNhacHan() {
  const gt = D.doc("giay-to", []).filter(g => g.hetHan && conNgay(g.hetHan) <= 30).map(g => ({ ten: g.ten, han: g.hetHan, loai: "Giấy tờ tàu" }));
  const bh = D.doc("thuyen-vien", []).filter(t => t.hetHanBH && conNgay(t.hetHanBH) <= 30).map(t => ({ ten: `Bảo hiểm ${t.ten}`, han: t.hetHanBH, loai: "Bạn thuyền" }));
  const ds = [...gt, ...bh]; if (!ds.length) return "";
  return `<div class="khoi"><h2>Sắp hết hạn</h2>${ds.map(d => `<div class="hang-tin"><div class="noi-dung"><b>${esc(d.ten)}</b><span>${d.loai} · hạn ${ngayVN(d.han)}</span></div>${nhanHan(d.han)}</div>`).join("")}</div>`;
}
function noiTrangChu(b) {
  b.querySelectorAll("[data-di]").forEach(x => x.onclick = () => ctx.chuyenTab(x.dataset.di));
  const xh = b.querySelector("#tb-xem-het"); if (xh) xh.onclick = () => GD.moBang("Thông báo", docThongBao().map(t => `<div class="thong-bao-item ${t.muc}"><i class="cham"></i><div><b>${esc(t.tieuDe)}</b><span>${gioVN(t.luc)} — ${esc(t.chu)}</span></div></div>`).join("") + `<div class="hang"><button class="nut do" id="tb-xoa">Xoá hết</button></div>`, bb => bb.querySelector("#tb-xoa").onclick = () => { D.ghi("thong-bao", []); GD.dongBang(); veTrang("trang-chu"); });
}

// =====================================================================
// TÀU CÁ
// =====================================================================
const TRUONG_TAU = [
  { khoa: "ten", nhan: "Tên tàu (để dễ nhớ)", ph: "VD: Tàu câu Bình Minh" },
  { khoa: "maSo", nhan: "Mã tàu / số đăng ký", ph: "VD: BĐ-91234-TS", batBuoc: true },
  { khoa: "tinh", nhan: "Tỉnh cảng nhà (để hiện nơi gần tàu)", loai: "select", tuyChon: TINH },
  { khoa: "dai", nhan: "Chiều dài tàu Lmax (m) — nếu biết", loai: "number", ph: "VD: 18,00", so: true },
  { nhom: "GIẤY ĐĂNG KÝ & GIẤY PHÉP KHAI THÁC", khoa: "chuTau", nhan: "Chủ tàu" }, { nhom: "GIẤY ĐĂNG KÝ & GIẤY PHÉP KHAI THÁC", khoa: "hoHieu", nhan: "Hô hiệu" },
  { nhom: "GIẤY ĐĂNG KÝ & GIẤY PHÉP KHAI THÁC", khoa: "cangDangKy", nhan: "Cảng đăng ký" }, { nhom: "GIẤY ĐĂNG KÝ & GIẤY PHÉP KHAI THÁC", khoa: "ngheChinh", nhan: "Nghề chính", ph: "VD: Câu, lưới vây, lưới rê" },
  { nhom: "GIẤY ĐĂNG KÝ & GIẤY PHÉP KHAI THÁC", khoa: "vungHoatDong", nhan: "Vùng hoạt động", loai: "select", tuyChon: ["Vùng khơi", "Vùng lộng", "Vùng ven bờ"] },
  { nhom: "GIẤY AN TOÀN KỸ THUẬT (ĐĂNG KIỂM)", khoa: "capTau", nhan: "Cấp tàu", loai: "select", tuyChon: ["Không hạn chế", "Hạn chế I", "Hạn chế II", "Hạn chế III"] },
  { nhom: "GIẤY AN TOÀN KỸ THUẬT (ĐĂNG KIỂM)", khoa: "vatLieu", nhan: "Vật liệu vỏ", loai: "select", tuyChon: ["Gỗ", "Thép", "Composite", "Khác"] },
  { nhom: "GIẤY AN TOÀN KỸ THUẬT (ĐĂNG KIỂM)", khoa: "namDong", nhan: "Năm đóng", loai: "number", so: true }, { nhom: "GIẤY AN TOÀN KỸ THUẬT (ĐĂNG KIỂM)", khoa: "noiDong", nhan: "Nơi đóng" },
  { nhom: "GIẤY AN TOÀN KỸ THUẬT (ĐĂNG KIỂM)", khoa: "soThuyenVien", nhan: "Số thuyền viên", loai: "number", so: true },
  { nhom: "KÍCH THƯỚC & TRỌNG TẢI", khoa: "rong", nhan: "Rộng Bmax (m)", loai: "number", so: true }, { nhom: "KÍCH THƯỚC & TRỌNG TẢI", khoa: "caoMan", nhan: "Cao mạn D (m)", loai: "number", so: true },
  { nhom: "KÍCH THƯỚC & TRỌNG TẢI", khoa: "chim", nhan: "Chiều chìm d (m)", loai: "number", so: true }, { nhom: "KÍCH THƯỚC & TRỌNG TẢI", khoa: "gt", nhan: "Dung tích GT", loai: "number", so: true },
  { nhom: "KÍCH THƯỚC & TRỌNG TẢI", khoa: "trongTai", nhan: "Trọng tải (tấn)", loai: "number", so: true },
  { nhom: "MÁY CHÍNH", khoa: "kyHieuMay", nhan: "Ký hiệu máy" }, { nhom: "MÁY CHÍNH", khoa: "soMay", nhan: "Số máy" },
  { nhom: "MÁY CHÍNH", khoa: "congSuat", nhan: "Công suất (kW)", loai: "number", so: true }, { nhom: "MÁY CHÍNH", khoa: "soMayChinh", nhan: "Số máy chính", loai: "number", so: true },
];
const TRUONG_GIAY_TO = [
  { khoa: "ten", nhan: "Loại giấy", loai: "select", batBuoc: true, tuyChon: ["Giấy chứng nhận đăng ký tàu cá", "Giấy chứng nhận an toàn kỹ thuật (đăng kiểm)", "Giấy phép khai thác thủy sản", "Giấy chứng nhận ATTP tàu cá", "Bảo hiểm thân tàu", "Bảo hiểm thuyền viên", "Sổ danh bạ thuyền viên", "Giấy xác nhận thiết bị VMS", "Văn bằng thuyền trưởng", "Văn bằng máy trưởng", "Khác"] },
  { khoa: "so", nhan: "Số giấy", ph: "VD: 123/2026/GPKT" }, { khoa: "capNgay", nhan: "Cấp ngày", loai: "date" }, { khoa: "hetHan", nhan: "Hết hạn", loai: "date" },
  { khoa: "ghiChu", nhan: "Ghi chú", loai: "textarea", ph: "Nơi cấp, nơi cất giấy…" },
];
const TRUONG_BAO_DUONG = [
  { khoa: "viec", nhan: "Việc cần làm", batBuoc: true, ph: "VD: Thay nhớt máy chính, kiểm tra bơm nước" },
  { khoa: "ngay", nhan: "Hạn làm", loai: "date" }, { khoa: "gioMay", nhan: "Hoặc tới giờ máy", loai: "number", so: true, ph: "VD: 2500" },
  { khoa: "ghiChu", nhan: "Ghi chú", loai: "textarea" },
];
const TRUONG_DO = [
  { khoa: "ten", nhan: "Tên món đồ", batBuoc: true, ph: "VD: Máy dò cá, bộ đàm, phao bè" },
  { khoa: "ngayMua", nhan: "Ngày mua", loai: "date" }, { khoa: "hetBaoHanh", nhan: "Hết bảo hành", loai: "date" }, { khoa: "noiMua", nhan: "Mua ở đâu / SĐT" },
  { khoa: "ghiChu", nhan: "Ghi chú", loai: "textarea" },
];
let tabTau = "tau-cua-toi";
function htmlTauCa() {
  const tau = docTau();
  const tab = `<div class="tab-phu">${[["tau-cua-toi", "Tàu của tôi"], ["cua-hang", "Cửa hàng"], ["don-hang", "Đơn hàng"]].map(([k, t]) => `<button data-tab-tau="${k}" class="${k === tabTau ? "bat" : ""}">${t}</button>`).join("")}</div>`;
  let than = "";
  if (tabTau === "tau-cua-toi") {
    const gt = D.doc("giay-to", []), bd = D.doc("bao-duong", []), dd = D.doc("do-tu-ghi", []);
    const soMuc = tau ? TRUONG_TAU.filter(t => t.nhom && tau[t.khoa]).length : 0;
    than = `<div class="khoi"><h2>${tau ? esc(tau.ten || tau.maSo) : "Chưa có thông tin tàu"}<button class="nut-nho cam" id="tau-sua">${tau ? "Sửa" : "Thêm tàu"}</button></h2>
      ${tau ? `<p>${esc(tau.maSo || "")}${tau.tinh ? ` · ${esc(tau.tinh)}` : ""}${tau.dai ? ` · dài ${esc(tau.dai)} m` : ""}${tau.ngheChinh ? ` · ${esc(tau.ngheChinh)}` : ""}${tau.vungHoatDong ? ` · ${esc(tau.vungHoatDong)}` : ""}</p><p class="ghi-chu">Theo giấy đăng ký, đăng kiểm, giấy phép: đã ghi ${soMuc}/19 mục</p>` : `<p class="trong">Ghi tên tàu, số đăng ký, cảng nhà để app nhắc giấy tờ và chỉ chỗ bán gần tàu.</p>`}</div>
      <div class="khoi"><h2>Tủ giấy tờ · ${gt.length} giấy<button class="nut-nho cam" data-them="giay-to">Thêm</button></h2>
      ${gt.length ? gt.map((g, i) => `<div class="hang-tin" data-sua="giay-to:${i}"><div class="noi-dung"><b>${esc(g.ten)}</b><span>${g.so ? `Số ${esc(g.so)} · ` : ""}hạn ${ngayVN(g.hetHan)}</span></div>${nhanHan(g.hetHan)}</div>`).join("") : `<p class="trong">Chưa có giấy tờ nào. Bấm nút cam ở trên để thêm.</p>`}</div>
      <div class="khoi"><h2>Sổ nhắc bảo dưỡng · ${bd.filter(x => !x.xong).length} việc<button class="nut-nho cam" data-them="bao-duong">Thêm</button></h2>
      ${bd.length ? bd.map((v, i) => `<div class="hang-tin" data-sua="bao-duong:${i}"><div class="noi-dung"><b style="${v.xong ? "text-decoration:line-through;color:var(--mo)" : ""}">${esc(v.viec)}</b><span>${v.ngay ? `hạn ${ngayVN(v.ngay)}` : ""}${v.gioMay ? ` · tới ${esc(v.gioMay)} giờ máy` : ""}</span></div>${v.xong ? `<span class="nhan-tt">Xong</span>` : nhanHan(v.ngay)}<button class="nut-nho" data-xong="${i}">${v.xong ? "Mở lại" : "Xong"}</button></div>`).join("") : `<p class="trong">Ghi việc thay nhớt, kiểm tra máy, sơn vỏ… app nhắc khi tới hạn.</p>`}</div>
      <div class="khoi"><h2>Giám sát hành trình (VMS)</h2><p>Thiết bị VMS phải hoạt động liên tục khi tàu dài từ 15 m ra khơi. Gia hạn cước đúng hạn để tàu đủ điều kiện ra khơi.</p>
      ${(() => { const v = gt.find(g => /VMS/.test(g.ten)); return v ? `<div class="hang-tin"><div class="noi-dung"><b>${esc(v.ten)}</b><span>hạn ${ngayVN(v.hetHan)}</span></div>${nhanHan(v.hetHan)}</div>` : `<p class="ghi-chu">Thêm "Giấy xác nhận thiết bị VMS" vào tủ giấy tờ để được nhắc hạn.</p>`; })()}</div>
      <div class="khoi"><h2>Đồ tự ghi · ${dd.length} món<button class="nut-nho cam" data-them="do-tu-ghi">Thêm</button></h2>
      ${dd.length ? dd.map((d, i) => `<div class="hang-tin" data-sua="do-tu-ghi:${i}"><div class="noi-dung"><b>${esc(d.ten)}</b><span>${d.ngayMua ? `mua ${ngayVN(d.ngayMua)}` : ""}${d.noiMua ? ` · ${esc(d.noiMua)}` : ""}</span></div>${d.hetBaoHanh ? nhanHan(d.hetBaoHanh) : ""}</div>`).join("") : `<p class="trong">Máy dò cá, bộ đàm, phao bè, lưới… ghi ngày mua và bảo hành để dễ tra.</p>`}</div>`;
  } else if (tabTau === "cua-hang") {
    const ch = ctx.duLieu.cuaHang || { danhMuc: [], danhSach: [] }, dm = D.doc("cua-hang-dm", "Tất cả");
    const ds = ch.danhSach.filter(s => dm === "Tất cả" || s.danhMuc === dm);
    than = `<div class="tab-phu">${["Tất cả", ...ch.danhMuc].map(d => `<button data-dm="${esc(d)}" class="${d === dm ? "bat" : ""}">${esc(d)}</button>`).join("")}</div>
      <div class="khoi"><h2>Cần món chợ chưa có?<button class="nut-nho cam" data-them="dat-hang">Đặt</button></h2><p class="ghi-chu">Ghi món cần — đại lý tìm hàng, báo giá, hẹn ngày giao.</p></div>
      <div class="khoi"><h2>Món hàng${ds.length ? ` · ${ds.length}` : ""}</h2>${ds.length ? ds.map(s => `<div class="hang-tin"><div class="noi-dung"><b>${esc(s.ten)}</b><span>${esc(s.danhMuc)} · ${esc(s.noiBan)}</span></div><button class="nut-nho" data-hoi-gia="${esc(s.ten)}">Liên hệ báo giá</button></div>`).join("") : `<p class="trong">Chưa có món nào trong mục này.</p>`}
      <p class="ghi-chu">${esc(ch.ghiChu || "")}</p></div>`;
  } else {
    const dh = D.doc("dat-hang", []);
    const dem = tt => dh.filter(x => x.trangThai === tt).length;
    than = `<div class="khoi"><div class="the-so"><div><b>${dem("xu-ly")}</b>Đang xử lý</div><div><b>${dem("cho-nhan")}</b>Chờ nhận</div><div><b>${dem("xong")}</b>Xong</div><div><b>${dem("huy")}</b>Đã huỷ</div></div></div>
      <div class="khoi"><h2>Yêu cầu đặt hàng của tôi<button class="nut-nho cam" data-them="dat-hang">Đặt</button></h2>
      ${dh.length ? dh.map((d, i) => `<div class="hang-tin" data-sua="dat-hang:${i}"><div class="noi-dung"><b>${esc(d.mon)}</b><span>${d.soLuong ? `SL ${esc(d.soLuong)} · ` : ""}${gioVN(d.luc)}${d.ghiChu ? ` · ${esc(d.ghiChu)}` : ""}</span></div><span class="nhan-tt">${{ "xu-ly": "Đang xử lý", "cho-nhan": "Chờ nhận", "xong": "Xong", "huy": "Đã huỷ" }[d.trangThai] || ""}</span></div>`).join("") : `<p class="trong">Món không có trên chợ — ghi ở đây, lưu trong máy để gọi đại lý.</p>`}</div>`;
  }
  return `<div class="dau-trang"><div class="tieu-de-nho">QUẢN LÝ TÀU</div><h1>Tàu cá</h1><p>Chăm tàu, mua đồ, theo dõi đơn.</p></div>${tab}${than}`;
}
function noiTauCa(b) {
  b.querySelectorAll("[data-tab-tau]").forEach(x => x.onclick = () => { tabTau = x.dataset.tabTau; veTrang("tau-ca"); });
  b.querySelectorAll("[data-dm]").forEach(x => x.onclick = () => { D.ghi("cua-hang-dm", x.dataset.dm); veTrang("tau-ca"); });
  const sua = b.querySelector("#tau-sua"); if (sua) sua.onclick = () => bangForm("Thông tin tàu", TRUONG_TAU, docTau() || {}, gt => { D.ghi("tau", gt); veTrang("tau-ca"); });
  const FORM = { "giay-to": ["Giấy tờ", TRUONG_GIAY_TO], "bao-duong": ["Việc bảo dưỡng", TRUONG_BAO_DUONG], "do-tu-ghi": ["Đồ trên tàu", TRUONG_DO],
    "dat-hang": ["Đặt hàng", [{ khoa: "mon", nhan: "Món cần mua", batBuoc: true }, { khoa: "soLuong", nhan: "Số lượng" }, { khoa: "ghiChu", nhan: "Ghi chú (hãng, cỡ, giao ở đâu)", loai: "textarea" }, { khoa: "trangThai", nhan: "Trạng thái", loai: "select", tuyChon: ["xu-ly", "cho-nhan", "xong", "huy"] }]] };
  b.querySelectorAll("[data-them]").forEach(x => x.onclick = () => { const [td, tr] = FORM[x.dataset.them]; bangForm("Thêm " + td.toLowerCase(), tr, x.dataset.them === "dat-hang" ? { trangThai: "xu-ly" } : {}, gt => { const ds = D.doc(x.dataset.them, []); ds.push({ ...gt, luc: Date.now() }); D.ghi(x.dataset.them, ds); veTrang("tau-ca"); }); });
  b.querySelectorAll("[data-sua]").forEach(x => x.onclick = e => { if (e.target.closest("[data-xong]")) return; const [k, i] = x.dataset.sua.split(":"); const ds = D.doc(k, []); const [td, tr] = FORM[k];
    bangForm("Sửa " + td.toLowerCase(), tr, ds[+i], gt => { ds[+i] = { ...ds[+i], ...gt }; D.ghi(k, ds); veTrang("tau-ca"); }, { onXoa: () => { ds.splice(+i, 1); D.ghi(k, ds); veTrang("tau-ca"); } }); });
  b.querySelectorAll("[data-xong]").forEach(x => x.onclick = () => { const ds = D.doc("bao-duong", []); ds[+x.dataset.xong].xong = !ds[+x.dataset.xong].xong; D.ghi("bao-duong", ds); veTrang("tau-ca"); });
  b.querySelectorAll("[data-hoi-gia]").forEach(x => x.onclick = () => bangForm("Hỏi giá: " + x.dataset.hoiGia, [{ khoa: "soLuong", nhan: "Số lượng" }, { khoa: "ghiChu", nhan: "Yêu cầu (cỡ, hãng, giao ở đâu)", loai: "textarea" }], {}, gt => { const ds = D.doc("dat-hang", []); ds.push({ mon: x.dataset.hoiGia, ...gt, trangThai: "xu-ly", luc: Date.now() }); D.ghi("dat-hang", ds); tabTau = "don-hang"; veTrang("tau-ca"); }));
}

// =====================================================================
// BẠN THUYỀN
// =====================================================================
const TRUONG_TV = [
  { khoa: "ten", nhan: "Họ và tên", batBuoc: true, ph: "VD: Nguyễn Văn Hai" },
  { khoa: "cccd", nhan: "Số CCCD (12 số — nếu không có thì điền số điện thoại)", ph: "VD: 079090001234", so: true },
  { khoa: "sdt", nhan: "Số điện thoại", ph: "VD: 0901234567", so: true },
  { khoa: "vaiTro", nhan: "Làm việc", loai: "select", tuyChon: ["Thuyền trưởng", "Máy trưởng", "Thuyền phó", "Thợ máy", "Bạn thuyền", "Đầu bếp"] },
  { khoa: "baoHiem", nhan: "Bảo hiểm thuyền viên", loai: "select", tuyChon: ["Chưa có bảo hiểm", "Có bảo hiểm"] },
  { khoa: "hetHanBH", nhan: "Bảo hiểm hết hạn", loai: "date" },
  { khoa: "giayTo", nhan: "Giấy tờ khác (chứng chỉ, sổ thuyền viên…)", loai: "textarea" },
  { khoa: "nguoiThan", nhan: "Người thân liên hệ khi khẩn cấp (tên · SĐT)" },
];
function htmlBanThuyen() {
  const tv = D.doc("thuyen-vien", []), tau = docTau();
  return `<div class="dau-trang"><div class="tieu-de-nho">BẠN THUYỀN</div><h1>Sổ thuyền viên</h1><p>${tau ? `Tàu ${esc(tau.ten || tau.maSo)}` : "Chưa có thông tin tàu"}</p>${tau ? "" : `<p style="margin-top:10px"><button class="nut-nho cam" data-di="tau-ca">Thêm tàu</button></p>`}</div>
    <div class="khoi"><h2>${tv.length} bạn thuyền<button class="nut-nho cam" id="tv-them">Thêm</button></h2>
    ${tv.length ? tv.map((t, i) => `<div class="hang-tin" data-tv="${i}"><div class="noi-dung"><b>${esc(t.ten)}</b><span>${esc(t.vaiTro || "Bạn thuyền")}${t.cccd ? ` · CCCD ${esc(t.cccd)}` : t.sdt ? ` · ${esc(t.sdt)}` : ""}</span><span>${t.baoHiem === "Có bảo hiểm" ? `Bảo hiểm tới ${ngayVN(t.hetHanBH)}` : "Chưa có bảo hiểm"}</span></div>${t.baoHiem === "Có bảo hiểm" ? nhanHan(t.hetHanBH) : `<span class="nhan-tt sap-het">Chưa BH</span>`}</div>`).join("")
      : `<p class="trong">Chưa có ai trong sổ. Bấm nút cam ở trên để thêm bạn thuyền.</p>`}
    <p class="ghi-chu">Hồ sơ thuyền viên lưu trên máy bà con, không gửi đi đâu. Yêu cầu có Tên + CCCD hoặc số điện thoại.</p></div>
    <div class="khoi"><h2>Tra cảnh báo</h2><p>Trước mỗi chuyến, kiểm tra: đủ bảo hiểm thuyền viên, sổ danh bạ thuyền viên, thuyền trưởng và máy trưởng có văn bằng phù hợp cấp tàu. Vi phạm có thể bị phạt theo Nghị định 38/2024.</p>
    ${tv.length ? `<p class="hop-tt ${tv.every(t => t.baoHiem === "Có bảo hiểm" && conNgay(t.hetHanBH) > 0) ? "tot" : "canh-bao"}">${tv.every(t => t.baoHiem === "Có bảo hiểm" && conNgay(t.hetHanBH) > 0) ? "Tất cả bạn thuyền đều có bảo hiểm còn hạn." : `${tv.filter(t => !(t.baoHiem === "Có bảo hiểm" && conNgay(t.hetHanBH) > 0)).length} người chưa có bảo hiểm hoặc đã hết hạn.`}</p>` : ""}</div>`;
}
function noiBanThuyen(b) {
  b.querySelectorAll("[data-di]").forEach(x => x.onclick = () => ctx.chuyenTab(x.dataset.di));
  b.querySelector("#tv-them").onclick = () => bangForm("Thêm bạn thuyền", TRUONG_TV, { vaiTro: "Bạn thuyền", baoHiem: "Chưa có bảo hiểm" }, gt => { if (!gt.cccd && !gt.sdt) { return; } const ds = D.doc("thuyen-vien", []); ds.push(gt); D.ghi("thuyen-vien", ds); veTrang("ban-thuyen"); });
  b.querySelectorAll("[data-tv]").forEach(x => x.onclick = () => { const ds = D.doc("thuyen-vien", []), i = +x.dataset.tv; bangForm("Sửa bạn thuyền", TRUONG_TV, ds[i], gt => { ds[i] = gt; D.ghi("thuyen-vien", ds); veTrang("ban-thuyen"); }, { onXoa: () => { ds.splice(i, 1); D.ghi("thuyen-vien", ds); veTrang("ban-thuyen"); } }); });
}

// =====================================================================
// GIAO DỊCH
// =====================================================================
let tabGd = "gia-ca";
function htmlGiaoDich() {
  const tau = docTau();
  const tab = `<div class="tab-phu">${[["gia-ca", "Giá cá"], ["tin", "Tin mua/bán"], ["ban-o-dau", "Bán ở đâu"]].map(([k, t]) => `<button data-tab-gd="${k}" class="${k === tabGd ? "bat" : ""}">${t}</button>`).join("")}</div>`;
  let than = "";
  if (tabGd === "gia-ca") {
    const g = ctx.duLieu.giaCa || { danhSach: [], dauDO: {} }, tuGhi = D.doc("gia-tu-ghi", {}), dau = D.doc("dau-tu-ghi", null);
    const d = dau || g.dauDO;
    than = `<div class="khoi"><div class="gia-dau"><div>Dầu DO hôm nay${dau ? " (bà con ghi)" : " (Petrolimex)"} · ${dau ? ngayVN(dau.ngay) : ngayVN(g.ngayCapNhat)}</div><b>${tien(d.ganKho)}/lít</b> gần kho · <b>${tien(d.xaKho)}/lít</b> xa kho, đảo<small>Giá tham khảo. Giá thật tại cảng có thể khác.</small></div>
      <div class="hang" style="margin-bottom:0"><button class="nut phu" id="gd-ghi-dau">Ghi giá dầu hôm nay</button></div></div>
      <div class="khoi"><h2>Giá cá tại cảng<small style="color:var(--mo);font-weight:600">tổng hợp ${ngayVN(g.ngayCapNhat)}</small></h2>
      ${g.danhSach.map(c => { const ls = tuGhi[c.ten] || []; const cuoi = ls[ls.length - 1];
        return `<div class="hang-tin"><div class="noi-dung"><b>${esc(c.ten)}</b><span class="gia">${tien(c.thap)} – ${tien(c.cao)}/kg</span><span>${c.vung ? esc(c.vung) + " · " : ""}${esc(c.ghiChu || "")}</span>${cuoi ? `<span>Bà con ghi ${ngayVN(cuoi.ngay)}: <b>${tien(cuoi.gia)}/kg</b>${ls.length > 1 ? ` · ${ls.length} lần` : ""}</span>` : ""}</div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="nhan-tt ${c.xuHuong === "tang" ? "tang" : c.xuHuong === "giam" ? "giam" : ""}">${{ tang: "đang tăng", giam: "đang giảm", on: "bình ổn" }[c.xuHuong] || ""}</span><button class="nut-nho" data-ghi-gia="${esc(c.ten)}">Ghi giá</button>${ls.length > 1 ? `<button class="nut-nho" data-bieu-do="${esc(c.ten)}">Biểu đồ</button>` : ""}</div></div>`; }).join("")}
      <p class="ghi-chu">${esc(g.ghiChu || "")}</p></div>`;
  } else if (tabGd === "tin") {
    const tin = D.doc("tin-mua-ban", []), loc = D.doc("tin-loc", "tat-ca");
    const ds = tin.filter(t => loc === "tat-ca" || t.loai === loc);
    than = `<div class="khoi"><h2>${tin.length} tin đang mở<button class="nut-nho cam" id="tin-dang">Đăng tin</button></h2>
      <div class="tab-phu" style="margin:0 0 10px">${[["tat-ca", "Tất cả"], ["ban", "Tin bán"], ["mua", "Tin mua"]].map(([k, t]) => `<button data-loc="${k}" class="${k === loc ? "bat" : ""}">${t}</button>`).join("")}</div>
      ${ds.length ? ds.map((t, i) => `<div class="hang-tin" data-tin="${tin.indexOf(t)}"><div class="noi-dung"><b>${t.loai === "ban" ? "BÁN" : "MUA"}: ${esc(t.matHang)}</b><span>${t.soLuong ? `${esc(t.soLuong)} · ` : ""}${t.gia ? `${tien(t.gia)}/kg · ` : ""}${gioVN(t.luc)}</span><span>${esc(t.ghiChu || "")}${t.sdt ? ` · ${esc(t.sdt)}` : ""}</span></div><span class="nhan-tt ${t.loai === "ban" ? "tang" : ""}">${t.loai === "ban" ? "Bán" : "Mua"}</span></div>`).join("")
        : `<p class="trong">Chưa có tin nào ở mục này. Bà con đăng tin đầu tiên đi.</p>`}
      <p class="ghi-chu">Bản mẫu lưu tin trên máy. Muốn mọi người cùng thấy cần máy chủ (xem HUONG-DAN.md).</p></div>`;
  } else {
    const vua = ctx.duLieu.vua?.danhSach || [], moi = D.doc("moi-quen", []), locV = D.doc("vua-loc", "Tất cả");
    const tinh = tau?.tinh;
    const ds = vua.filter(v => (locV === "Tất cả" || v.loai === locV)).sort((a, b) => (b.tinh === tinh) - (a.tinh === tinh));
    than = `<div class="tab-phu">${["Tất cả", "Vựa hải sản", "Chợ đầu mối", "Nhà máy", "Cơ sở thu mua"].map(k => `<button data-loc-vua="${esc(k)}" class="${k === locV ? "bat" : ""}">${esc(k)}</button>`).join("")}</div>
      <div class="khoi"><h2>Mối quen · ${moi.length}<button class="nut-nho cam" id="moi-them">Thêm</button></h2>
      ${moi.length ? moi.map((m, i) => `<div class="hang-tin" data-moi="${i}"><div class="noi-dung"><b>${esc(m.ten)}</b><span>${esc(m.diaChi || "")}</span><span>${m.thuMua ? `Thu mua: ${esc(m.thuMua)}` : ""}</span></div>${m.sdt ? `<a class="nut-nho dam" href="tel:${esc(m.sdt)}">Gọi</a>` : ""}</div>`).join("") : `<p class="trong">Ghi vựa, thương lái quen để gọi một chạm.</p>`}</div>
      ${tinh ? "" : `<div class="khoi"><p class="ghi-chu">Khai báo tỉnh của cảng nhà trong mục <b>Tàu cá</b> để app xếp nơi gần bà con lên trước.</p></div>`}
      <div class="khoi"><h2>${ds.length} vựa</h2><p class="ghi-chu">Vựa/cơ sở thu mua có đăng tin công khai — gọi hỏi cho chắc trước khi bán.</p>
      ${ds.map(v => `<div class="hang-tin"><div class="noi-dung"><span style="letter-spacing:.06em;font-weight:800;font-size:11px">${esc(v.loai.toUpperCase())}</span><b>${esc(v.ten)}</b><span>${esc(v.diaChi)}${v.tinh ? `, ${esc(v.tinh)}` : ""}</span>${v.sdt ? `<span>SĐT: ${esc(v.sdt)}</span>` : ""}${v.thuMua ? `<span>Thu mua: ${esc(v.thuMua)}</span>` : ""}</div>${v.sdt ? `<a class="nut-nho dam" href="tel:${esc(v.sdt)}">Gọi</a>` : ""}</div>`).join("")}
      <p class="ghi-chu">${esc(ctx.duLieu.vua?.ghiChu || "")}</p></div>`;
  }
  return `<div class="dau-trang"><div class="tieu-de-nho">GIAO DỊCH</div><h1>Mua bán của tàu</h1><p>Giúp bà con nắm giá cả và đầu mối thu mua — dễ dàng đăng tin, gọi trực tiếp thương lái.</p></div>${tab}${than}`;
}
function noiGiaoDich(b) {
  b.querySelectorAll("[data-tab-gd]").forEach(x => x.onclick = () => { tabGd = x.dataset.tabGd; veTrang("giao-dich"); });
  b.querySelectorAll("[data-loc]").forEach(x => x.onclick = () => { D.ghi("tin-loc", x.dataset.loc); veTrang("giao-dich"); });
  b.querySelectorAll("[data-loc-vua]").forEach(x => x.onclick = () => { D.ghi("vua-loc", x.dataset.locVua); veTrang("giao-dich"); });
  const homNay = new Date().toISOString().slice(0, 10);
  const gd = b.querySelector("#gd-ghi-dau"); if (gd) gd.onclick = () => bangForm("Ghi giá dầu hôm nay", [{ khoa: "ganKho", nhan: "Gần kho (đ/lít)", loai: "number", so: true, batBuoc: true }, { khoa: "xaKho", nhan: "Xa kho, đảo (đ/lít)", loai: "number", so: true }, { khoa: "ngay", nhan: "Ngày", loai: "date" }], { ngay: homNay }, gt => { D.ghi("dau-tu-ghi", gt); veTrang("giao-dich"); });
  b.querySelectorAll("[data-ghi-gia]").forEach(x => x.onclick = () => bangForm("Ghi giá: " + x.dataset.ghiGia, [{ khoa: "gia", nhan: "Giá bán được (đ/kg)", loai: "number", so: true, batBuoc: true }, { khoa: "ngay", nhan: "Ngày", loai: "date" }, { khoa: "noi", nhan: "Bán ở đâu" }], { ngay: homNay }, gt => { const t = D.doc("gia-tu-ghi", {}); (t[x.dataset.ghiGia] ||= []).push(gt); D.ghi("gia-tu-ghi", t); veTrang("giao-dich"); }));
  b.querySelectorAll("[data-bieu-do]").forEach(x => x.onclick = () => { const ls = D.doc("gia-tu-ghi", {})[x.dataset.bieuDo] || [];
    GD.moBang("Giá " + x.dataset.bieuDo + " bà con ghi", `<canvas class="do-thi" id="bd-canvas" width="340" height="140"></canvas><table class="bang-thong-tin">${ls.map(l => `<tr><td>${ngayVN(l.ngay)}</td><td>${tien(l.gia)}/kg${l.noi ? ` · ${esc(l.noi)}` : ""}</td></tr>`).join("")}</table>`, bb => veDoThi(bb.querySelector("#bd-canvas"), ls)); });
  const td = b.querySelector("#tin-dang"); if (td) td.onclick = () => bangForm("Đăng tin", [{ khoa: "loai", nhan: "Loại tin", loai: "select", tuyChon: ["ban", "mua"], batBuoc: true }, { khoa: "matHang", nhan: "Mặt hàng", batBuoc: true, ph: "VD: Cá ngừ đại dương 40 kg/con" }, { khoa: "soLuong", nhan: "Số lượng", ph: "VD: 2 tấn" }, { khoa: "gia", nhan: "Giá mong muốn (đ/kg)", loai: "number", so: true }, { khoa: "sdt", nhan: "Số điện thoại liên hệ", so: true }, { khoa: "ghiChu", nhan: "Ghi chú (cảng về, giờ về bến…)", loai: "textarea" }], { loai: "ban" }, gt => { const ds = D.doc("tin-mua-ban", []); ds.unshift({ ...gt, luc: Date.now() }); D.ghi("tin-mua-ban", ds); veTrang("giao-dich"); });
  b.querySelectorAll("[data-tin]").forEach(x => x.onclick = () => { const ds = D.doc("tin-mua-ban", []), i = +x.dataset.tin; bangForm("Sửa tin", [{ khoa: "loai", nhan: "Loại tin", loai: "select", tuyChon: ["ban", "mua"] }, { khoa: "matHang", nhan: "Mặt hàng", batBuoc: true }, { khoa: "soLuong", nhan: "Số lượng" }, { khoa: "gia", nhan: "Giá (đ/kg)", loai: "number", so: true }, { khoa: "sdt", nhan: "SĐT", so: true }, { khoa: "ghiChu", nhan: "Ghi chú", loai: "textarea" }], ds[i], gt => { ds[i] = { ...ds[i], ...gt }; D.ghi("tin-mua-ban", ds); veTrang("giao-dich"); }, { onXoa: () => { ds.splice(i, 1); D.ghi("tin-mua-ban", ds); veTrang("giao-dich"); } }); });
  const mt = b.querySelector("#moi-them"); if (mt) mt.onclick = () => bangForm("Thêm mối quen", [{ khoa: "ten", nhan: "Tên vựa / thương lái", batBuoc: true }, { khoa: "sdt", nhan: "Số điện thoại", so: true }, { khoa: "diaChi", nhan: "Địa chỉ" }, { khoa: "thuMua", nhan: "Thu mua gì" }], {}, gt => { const ds = D.doc("moi-quen", []); ds.push(gt); D.ghi("moi-quen", ds); veTrang("giao-dich"); });
  b.querySelectorAll("[data-moi]").forEach(x => x.onclick = e => { if (e.target.tagName === "A") return; const ds = D.doc("moi-quen", []), i = +x.dataset.moi; bangForm("Sửa mối quen", [{ khoa: "ten", nhan: "Tên", batBuoc: true }, { khoa: "sdt", nhan: "SĐT", so: true }, { khoa: "diaChi", nhan: "Địa chỉ" }, { khoa: "thuMua", nhan: "Thu mua gì" }], ds[i], gt => { ds[i] = gt; D.ghi("moi-quen", ds); veTrang("giao-dich"); }, { onXoa: () => { ds.splice(i, 1); D.ghi("moi-quen", ds); veTrang("giao-dich"); } }); });
}
function veDoThi(canvas, ls) {
  if (!canvas || ls.length < 2) return;
  const ctx2 = canvas.getContext("2d"), w = canvas.width, h = canvas.height, v = ls.map(l => +l.gia);
  const min = Math.min(...v), max = Math.max(...v), x = i => 36 + (w - 48) * i / (v.length - 1), y = g => 14 + (h - 36) * (1 - (g - min) / (max - min || 1));
  ctx2.fillStyle = "#fff"; ctx2.fillRect(0, 0, w, h);
  ctx2.strokeStyle = "#1e8fd6"; ctx2.lineWidth = 2.5; ctx2.beginPath(); v.forEach((g, i) => i ? ctx2.lineTo(x(i), y(g)) : ctx2.moveTo(x(i), y(g))); ctx2.stroke();
  ctx2.fillStyle = "#14324f"; v.forEach((g, i) => { ctx2.beginPath(); ctx2.arc(x(i), y(g), 4, 0, 7); ctx2.fill(); });
  ctx2.fillStyle = "#5b7088"; ctx2.font = "11px sans-serif"; ctx2.fillText((max / 1000) + "k", 2, 18); ctx2.fillText((min / 1000) + "k", 2, h - 24);
  ls.forEach((l, i) => { if (i === 0 || i === ls.length - 1) ctx2.fillText(ngayVN(l.ngay).slice(0, 5), x(i) - 12, h - 6); });
}

// =====================================================================
// VẼ TRANG
// =====================================================================
const TRANG = { "trang-chu": [htmlTrangChu, noiTrangChu], "tau-ca": [htmlTauCa, noiTauCa], "ban-thuyen": [htmlBanThuyen, noiBanThuyen], "giao-dich": [htmlGiaoDich, noiGiaoDich] };
export function veTrang(khoa) {
  const hop = document.getElementById("man-trang-noi-dung");
  const [html, noi] = TRANG[khoa]; const cuon = document.getElementById("man-trang").scrollTop;
  hop.innerHTML = html(); noi(hop);
  document.getElementById("man-trang").scrollTop = cuon;
}
