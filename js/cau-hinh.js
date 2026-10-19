// =====================================================================
// CẤU HÌNH — mọi con số có thể chỉnh nằm ở đây
// =====================================================================

export const HAI_LY = 1852; // mét trong một hải lý

export const CAU_HINH = {
  // Vị trí mở bản đồ lần đầu (vĩ độ, kinh độ) và mức phóng
  tamMacDinh: [14.57, 109.07],
  zoomMacDinh: 7,

  // Dự báo thời tiết (Open-Meteo, miễn phí, không cần đăng ký)
  thoiTiet: {
    soNgay: 16,                     // tối đa 16
    muiGio: "Asia/Ho_Chi_Minh",
    moHinhSong: "ncep_gfswave025",  // mô hình sóng GFS Wave 0.25°
    hanGoiNgay: 15,                 // "Còn dùng tới ngày …" = lúc tải + số ngày này
    lamMoiSauGio: 3,                // tự tải lại nếu gói cũ hơn số giờ này (khi có mạng)
    lamMoiKhiDiXaHaiLy: 30,         // hoặc tàu đi xa điểm đã tải quá số hải lý này
  },

  // Ngưỡng cảnh báo biển động (đọc trong 2 ngày tới)
  nguong: {
    bienDong:  { gioCap: 6, songMet: 2.5 },
    nguyHiem:  { gioCap: 8, songMet: 4.0 },
    ranhGioiHaiLy: 10,              // dưới mức này nhãn ranh giới chuyển đỏ
    sapToiDichHaiLy: 1,             // đọc "sắp tới" khi còn dưới mức này
  },

  // Nguồn tin bão (tuỳ chọn). Để trống thì app suy ra từ dự báo gió giật.
  // Nếu có máy chủ riêng, trả về JSON: { coBao: true/false, ten: "…", capNhat: "ISO date", moTa: "…" }
  nguonTinBao: "",

  // Tải bản đồ ngoại tuyến
  ngoaiTuyen: {
    gioiHanOMoiLan: 800,            // số ô bản đồ tối đa mỗi lần bấm "Tải"
    zoomThemKhiTai: 3,              // tải từ mức đang xem tới mức này cộng thêm
    zoomToiDa: 13,
  },

  // Chế độ thử (giữ nút GPS 1 giây): tàu giả lập chạy
  thu: { tocDoHaiLyGio: 7, huongDo: 138 },

  // Mặc định cài đặt (người dùng đổi được trong "Cài đặt")
  caiDatMacDinh: {
    donVi: "hl",          // "hl" (hải lý) | "km"
    toaDo: "dms",         // "dms" (độ-phút-giây) | "thap-phan"
    giong: "day-du",      // "day-du" | "it" | "tat"
    rung: true,
    lopBat: ["nhan-bien", "phao-den", "dia-danh-ngam", "ranh-gioi", "khu-tru-bao", "den-bien"],
    nen: "hai-do",
  },
};
