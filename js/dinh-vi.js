// =====================================================================
// ĐỊNH VỊ — bọc navigator.geolocation, có chế độ thử (tàu giả lập)
// Gọi `batDinhVi(onViTri, onLoi)`; mỗi lần có vị trí mới sẽ gọi
// onViTri({ viTri:[lat,lon], tocDoMs, huong, doChinhXacM, luc })
// =====================================================================
import { CAU_HINH, HAI_LY } from "./cau-hinh.js";
import { diemToi, huongDi, khoangCach } from "./hang-hai.js";

let maTheoDoi = null;
let viTriTruoc = null;
let hienGioiHan = null;     // bộ đếm chế độ thử
export let dangThu = false;

/** Máy có hỗ trợ GPS không. */
export const coDinhVi = () => "geolocation" in navigator;

/** Bắt đầu theo dõi GPS thật. */
export function batDinhVi(onViTri, onLoi) {
  if (!coDinhVi()) { onLoi({ ma: "khong-ho-tro", chu: "Máy không hỗ trợ định vị." }); return; }
  if (maTheoDoi != null) return;
  maTheoDoi = navigator.geolocation.watchPosition(
    p => {
      const c = p.coords, viTri = [c.latitude, c.longitude];
      let huong = (c.heading != null && !isNaN(c.heading)) ? c.heading : null;
      // Không có cảm biến hướng thì suy từ hai vị trí liên tiếp cách nhau > 15 m
      if (huong == null && viTriTruoc && khoangCach(viTriTruoc, viTri) > 15) huong = huongDi(viTriTruoc, viTri);
      viTriTruoc = viTri;
      onViTri({ viTri, tocDoMs: c.speed ?? null, huong, doChinhXacM: c.accuracy, luc: p.timestamp });
    },
    e => {
      maTheoDoi = null;
      const ma = e.code === 1 ? "bi-chan" : e.code === 2 ? "khong-bat-duoc" : "het-gio";
      const chu = {
        "bi-chan": "Định vị bị chặn. Vào Cài đặt › Vị trí của máy, cho phép trình duyệt dùng vị trí rồi mở lại.",
        "khong-bat-duoc": "Chưa bắt được vệ tinh. Ra chỗ thoáng, gần cửa sổ cabin rồi thử lại.",
        "het-gio": "Chờ GPS quá lâu. Thử lại sau ít phút.",
      }[ma];
      onLoi({ ma, chu });
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 },
  );
}

/** Dừng theo dõi GPS (thật và thử). */
export function tatDinhVi() {
  if (maTheoDoi != null && coDinhVi()) navigator.geolocation.clearWatch(maTheoDoi);
  maTheoDoi = null;
  if (hienGioiHan) clearInterval(hienGioiHan);
  hienGioiHan = null; dangThu = false;
}

/**
 * Chế độ thử: tàu giả lập chạy đều từ `batDau` theo hướng cấu hình.
 * Mỗi 1,5 giây mô phỏng 5 phút đi biển, để thấy số liệu đổi nhanh.
 */
export function batCheDoThu(batDau, onViTri) {
  tatDinhVi();
  dangThu = true;
  let p = batDau.slice();
  const tocDo = CAU_HINH.thu.tocDoHaiLyGio * HAI_LY / 3600; // m/s
  const huong = CAU_HINH.thu.huongDo;
  const buoc = () => {
    p = diemToi(p, huong, tocDo * 5 * 60);
    onViTri({ viTri: p, tocDoMs: tocDo, huong, doChinhXacM: 5, luc: Date.now(), thu: true });
  };
  buoc();
  hienGioiHan = setInterval(buoc, 1500);
}
