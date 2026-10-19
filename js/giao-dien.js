// =====================================================================
// GIAO DIỆN — các hàm cập nhật màn hình và bảng trượt dùng chung
// Không chứa logic nghiệp vụ; app.js quyết định hiện gì.
// =====================================================================

export const $ = id => document.getElementById(id);

/** Thoát ký tự HTML khi chèn chữ do người dùng nhập. */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Thanh tin bão ----------
export function thanhBao(muc, chu) {
  const b = $("thanh-bao");
  b.className = "thanh-bao" + (muc === "tot" ? "" : " " + muc);
  $("thanh-bao-dau").textContent = muc === "tot" ? "✓" : muc === "nguy-hiem" ? "⚠" : "!";
  $("thanh-bao-chu").textContent = chu;
  // Các khối dưới (thẻ vị trí, bảng chạy) xếp theo chiều cao thật của thanh báo
  requestAnimationFrame(() => document.documentElement.style.setProperty("--cao-bao", `${b.offsetHeight + 8}px`));
}

// ---------- Thẻ vị trí ----------
export function theViTri({ tau, dich, phu }) {
  $("vi-tri-tau").textContent = tau;
  $("vi-tri-dich").textContent = dich;
  $("vi-tri-phu").textContent = phu;
}

// ---------- Nhãn nổi ----------
export function nhanRanhGioi(chu, nguyHiem) {
  const el = $("nhan-ranh-gioi");
  if (!chu) { el.hidden = true; return; }
  el.hidden = false; el.textContent = chu;
  el.classList.toggle("an-toan", !nguyHiem);
}
export function goiNgoaiTuyen(chu, hetHan) {
  const el = $("goi-ngoai-tuyen");
  if (!chu) { el.hidden = true; return; }
  el.hidden = false; el.textContent = chu; el.classList.toggle("het-han", !!hetHan);
}

// ---------- Nút cột phải ----------
export function nutBat(id, bat, chu) {
  const b = $(id); b.classList.toggle("bat", !!bat);
  if (chu != null) { const s = $(id + "-chu"); if (s) s.textContent = chu; }
}

// ---------- Dải dưới ----------
export function tabNgay(nhan, chon, onChon) {
  const hop = $("tab-ngay"); hop.innerHTML = "";
  nhan.forEach((n, i) => {
    const b = document.createElement("button");
    b.textContent = n; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(i === chon));
    if (i === chon) b.classList.add("bat");
    b.onclick = () => onChon(i);
    hop.appendChild(b);
  });
  const dangChon = hop.children[chon]; if (dangChon) dangChon.scrollIntoView({ inline: "center", block: "nearest" });
}
export function songGio(chu, huongGioToi) {
  $("song-gio-chu").textContent = chu;
  const mt = $("song-gio-mui-ten");
  if (huongGioToi == null) { mt.hidden = true; return; }
  mt.hidden = false; mt.style.transform = `rotate(${(huongGioToi + 180) % 360}deg)`; // gió THỔI TỚI hướng này
}
export function tabChinh(khoa) {
  document.querySelectorAll(".thanh-tab button").forEach(b => b.classList.toggle("bat", b.dataset.tab === khoa));
}

// ---------- Bảng trượt ----------
const bang = () => $("bang-truot");
let _onDong = null;
/** Mở bảng với tiêu đề + nội dung HTML; `gan()` được gọi sau khi gắn vào trang để nối sự kiện. */
export function moBang(tieuDe, html, gan, { onDong } = {}) {
  const b = bang();
  b.innerHTML = `<h2>${esc(tieuDe)}<button class="dong" id="bang-dong">Đóng</button></h2>${html}`;
  b.hidden = false; b.scrollTop = 0;
  _onDong = onDong || null;
  $("bang-dong").onclick = dongBang;
  gan && gan(b);
}
export function dongBang() {
  const b = bang(); if (b.hidden) return;
  b.hidden = true; b.innerHTML = "";
  const f = _onDong; _onDong = null; f && f();
}
export const bangDangMo = () => !bang().hidden;

// ---------- Mảnh HTML dùng lại ----------
export const htmlTuyChon = (loai, name, giaTri, nhan, moTa, chon, mau) =>
  `<label class="tuy-chon"><input type="${loai}" name="${esc(name)}" value="${esc(giaTri)}" ${chon ? "checked" : ""}>` +
  (mau ? `<span class="mau" style="background:${esc(mau)}"></span>` : "") +
  `<span><b>${esc(nhan)}</b>${moTa ? `<br><small style="color:var(--mo);font-weight:400">${esc(moTa)}</small>` : ""}</span></label>`;

export const htmlTieuDeNhom = chu => `<p class="ghi-chu" style="letter-spacing:.08em;font-weight:800;margin-top:14px">${esc(chu)}</p>`;
