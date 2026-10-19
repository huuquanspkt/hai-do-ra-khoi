// =====================================================================
// KHO — lưu trữ trong máy (localStorage), an toàn khi bị chặn
// =====================================================================
const TIEN_TO = "haido.";

export const kho = {
  doc(khoa, macDinh) {
    try {
      const v = localStorage.getItem(TIEN_TO + khoa);
      return v === null ? macDinh : JSON.parse(v);
    } catch { return macDinh; }
  },
  ghi(khoa, giaTri) {
    try { localStorage.setItem(TIEN_TO + khoa, JSON.stringify(giaTri)); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
  },
  xoa(khoa) {
    try { localStorage.removeItem(TIEN_TO + khoa); } catch { /* bỏ qua */ }
  },
  /** Kích thước ước lượng (byte) của một khoá, để hiện trong "Dữ liệu đã lưu". */
  kichThuoc(khoa) {
    try { return (localStorage.getItem(TIEN_TO + khoa) || "").length; } catch { return 0; }
  },
};

/** Đổi byte → "7 KB", "3,4 MB". */
export function dinhDangByte(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** "lưu 2 phút trước" từ mốc thời gian. */
export function tuoi(luc) {
  if (!luc) return "chưa lưu";
  const phut = Math.round((Date.now() - luc) / 60000);
  if (phut < 1) return "vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  const gio = Math.round(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  return `${Math.round(gio / 24)} ngày trước`;
}
