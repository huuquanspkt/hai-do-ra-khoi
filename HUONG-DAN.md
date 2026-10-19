# Hải Đồ Ra Khơi — bản mẫu 2

Link dùng ngay: **https://huuquanspkt.github.io/hai-do-ra-khoi/** (mở bằng Chrome trên điện thoại → ⋮ → *Thêm vào màn hình chính*).

App web làm lại theo cấu trúc của SDFish (forfish.vercel.app) để tham khảo. Mã HTML/CSS/JavaScript thuần,
không cần công cụ xây dựng; tên biến, hàm, chú thích bằng tiếng Việt. Mọi dữ liệu người dùng lưu trên máy.

---

## 1. Có gì trong app

### Màn "Ra khơi" (bản đồ)
| Phần | Làm gì | Nguồn / cách làm |
|---|---|---|
| Thanh tin bão | Xanh = không có bão; vàng/đỏ = biển động | Suy từ gió giật & sóng 2 ngày tới (Open-Meteo). Có chỗ nối nguồn tin bão riêng (`CAU_HINH.nguonTinBao`) |
| Thẻ TÀU / TRỎ | Toạ độ tàu (GPS) và điểm đang xem (chạm bản đồ) | Chạm TÀU → về tàu; chạm TRỎ → về điểm |
| Nhãn "… hải lý tới ranh giới" | Khoảng cách tới ranh ngoài gần nhất, đỏ khi < 10 hải lý | `data/ranh-gioi.json` (toạ độ MẪU) |
| Bảng gió sóng dưới | Biển êm / động, sóng, gió, 16 tab ngày, chạm `i` xem theo giờ | Open-Meteo tại điểm đang xem hoặc tại tàu |
| Lớp bản đồ › Hải đồ | 4 nền (Hải đồ độ sâu, Nước nóng lạnh, Vệ tinh, Đường phố) + Hải đồ chi tiết, Báo hiệu & nguy hiểm, Tên địa danh ngầm, Đèn biển, Khu trú bão, Ký hiệu là gì | Esri Ocean, OpenSeaMap, OSM, tệp `data/` |
| Lớp bản đồ › Ngư trường | Dự báo cá: ô 0,5° Thấp/Trung bình/Cao + điểm nóng ◎ | `js/ngu-truong.js` — mô hình đơn giản từ nhiệt mặt biển, sóng, dòng chảy (xem mục 4) |
| Lớp bản đồ › Thời tiết | 8 lớp màu: Gió, Sóng, Dòng chảy, Mây, Mưa, Nhiệt không khí, Dông (CAPE), Áp suất; thanh thời gian 8 ngày mỗi 3 giờ | Lưới 13×13 điểm cả Biển Đông từ Open-Meteo (`js/luoi-thoi-tiet.js`), vẽ canvas (`js/lop-mau.js`) |
| Lớp bản đồ › Công cụ | Đo khoảng cách nhiều điểm; tải ô bản đồ vùng đang xem | |
| Lớp bản đồ › Cài đặt | Hải lý/km, DMS/thập phân, giọng đọc 3 mức, rung, tự chạy khi mở, tuỳ chọn tàu (tốc độ, dầu, mớn), lưới toạ độ, ranh giới, khu bảo tồn, trạm con nước, tên vùng biển, chuyển máy mới | |
| Bật GPS | GPS thật; giữ 1 giây = tàu giả lập để thử | `js/dinh-vi.js` |
| Bắt đầu chạy | Bảng "Đang chạy" (kéo được): Dừng, Ẩn, Giọng, Rung, câu vừa đọc, cảnh báo; đọc ranh giới, khu cấm, sắp tới đích, 10 phút đọc khoảng cách | Web Speech API tiếng Việt (`js/giong-noi.js`) |
| Đến điểm | Nhập "8 30" / "109 18" → đặt điểm đang xem | |
| Điểm đã lưu | Ghim, đặt tên, cảng nhà | |
| Lộ trình | Xuất phát = GPS / cảng nhà / cảng gần nhất → điểm đang xem (+ điểm trung gian); quãng, giờ, dầu; "Dẫn đường tới điểm đang xem" | Đường thẳng, chưa tránh đảo/bãi cạn |
| Trạm con nước | 11 trạm; chạm → đường mực nước 3 ngày, giờ nước lớn/ròng | Open-Meteo `sea_level_height_msl` (`js/con-nuoc.js`) |
| Sen Biển | Nói "mười ba độ ba mươi, một trăm mười độ" hoặc tên điểm → chỉ chỗ, hỏi dẫn đường; không có micro thì gõ chữ | `js/sen-bien.js` |
| Dữ liệu đã lưu | Tin bão, lưới cả vùng, gió sóng tại tàu/điểm, bản đồ cá, lớp màu, con nước, giá cá, ô bản đồ — còn mới / cũ, Tải lại | localStorage + IndexedDB (`js/kho-lon.js`) + service worker |

### Các màn khác
- **Trang chủ**: chào, thông tin tàu, 4 ô vào nhanh, Thông báo (app tự ghi khi biển động), Sắp hết hạn (giấy tờ, bảo hiểm).
- **Tàu cá**: Tàu của tôi (thông tin tàu 19 mục theo giấy đăng ký/đăng kiểm, Tủ giấy tờ có nhắc hạn, Sổ nhắc bảo dưỡng, VMS, Đồ tự ghi), Cửa hàng (danh mục + hỏi giá), Đơn hàng (yêu cầu đặt hàng).
- **Bạn thuyền**: Sổ thuyền viên (tên, CCCD/SĐT, vai trò, bảo hiểm & hạn, người thân), Tra cảnh báo bảo hiểm.
- **Giao dịch**: Giá cá (dầu DO, 13 loại cá có xu hướng, Ghi giá hôm nay, Biểu đồ giá tự ghi), Tin mua/bán (đăng, sửa), Bán ở đâu (vựa mẫu theo loại, xếp gần cảng nhà, Mối quen có nút Gọi).

---

## 2. Cấu trúc thư mục

```
├── index.html                Khung trang: bản đồ, lớp nổi, bảng dẫn đường, Sen Biển, dải dưới, tab
├── css/app.css               Giao diện; màu ở :root
├── js/
│   ├── app.js                Nối mọi thứ (trạng thái, bảng, dẫn đường, Sen Biển, tab)  ← đọc trước
│   ├── trang.js              Trang chủ · Tàu cá · Bạn thuyền · Giao dịch (form, danh sách, lưu máy)
│   ├── ban-do.js             Leaflet: nền, lớp phủ, tàu/trỏ/đích, lộ trình, dự báo cá, đo
│   ├── luoi-thoi-tiet.js     Lưới dự báo cả vùng (Open-Meteo nhiều điểm), nội suy
│   ├── lop-mau.js            Vẽ lớp màu + mũi tên lên canvas (Mercator), thang màu
│   ├── ngu-truong.js         Chỉ số thuận lợi cá (mô hình đơn giản)
│   ├── con-nuoc.js           Mực nước, giờ nước lớn/ròng, vẽ đường
│   ├── sen-bien.js           Nhận dạng giọng nói, đổi số tiếng Việt, hiểu câu
│   ├── thoi-tiet.js          Dự báo tại một điểm, đánh giá biển động
│   ├── dinh-vi.js            GPS + chế độ thử
│   ├── giong-noi.js          Đọc cảnh báo + rung
│   ├── hang-hai.js           Toán hàng hải, định dạng toạ độ/khoảng cách
│   ├── giao-dien.js          Bảng trượt, nhãn, tab
│   ├── kho.js / kho-lon.js   localStorage / IndexedDB
│   └── cau-hinh.js           Ngưỡng, số ngày, mặc định
├── data/                     JSON dễ sửa: ranh-gioi · dia-danh-ngam · khu-tru-bao · den-bien · cang ·
│                             dia-danh-lon · khu-bao-ton · tram-con-nuoc · gia-ca · vua · cua-hang
├── sw.js, manifest.webmanifest, icon.svg
└── .github/workflows/pages.yml   Tự đưa lên GitHub Pages mỗi lần đẩy lên main
```

---

## 3. Nguồn dữ liệu

| Dữ liệu | Nguồn | Ghi chú |
|---|---|---|
| Nền đáy biển, nhãn biển | Esri World Ocean (GEBCO, NOAA) | Tham khảo; không tải ồ ạt |
| Phao, đèn, xác tàu | OpenSeaMap | Vùng VN còn thưa |
| Ảnh vệ tinh / đường phố | Esri / OpenStreetMap | OSM cấm dùng máy chủ công cộng cho app đông người |
| Gió, mưa, mây, nhiệt, CAPE, áp suất | Open-Meteo Forecast | Miễn phí 10.000 lượt/ngày |
| Sóng, dòng chảy, nhiệt mặt biển, mực nước | Open-Meteo Marine (`ncep_gfswave025`) | Giống SDFish |
| Ranh giới, địa danh ngầm, khu trú bão, khu bảo tồn, đèn biển, trạm | tệp `data/` | **Toạ độ MẪU / gần đúng** — thay bằng số chính thức |
| Giá cá, vựa, cửa hàng | tệp `data/` | Mẫu, cập nhật thủ công |

SDFish còn dùng: ảnh NASA, ETOPO/EMODnet, Copernicus Marine (độ mặn, dòng tầng sâu, nước dâng), UHSLC, dữ liệu cá riêng, máy chủ Supabase cho ranh VMS, tin mua bán, tài khoản. Bản mẫu không có các phần cần máy chủ.

---

## 4. Dự báo cá — cách tính và giới hạn

`js/ngu-truong.js` chấm mỗi ô 0,5°:
- 45% **ranh nước nóng/lạnh**: chênh nhiệt mặt biển với ô bên cạnh (≥ 0,5°C là mạnh);
- 25% **nhiệt vừa**: 26–29°C tốt nhất, ngoài 24–31°C = 0;
- 15% **biển êm**: sóng < 1 m tốt nhất;
- 15% **dòng chảy vừa**: 0,2–0,8 m/s.
≥ 0,62 = Cao, ≥ 0,42 = Trung bình. Điểm nóng = 8 ô Cao nhất cách nhau > 1°.

Đây là mô hình minh hoạ. Muốn dùng thật cần thêm màu nước (chlorophyll) từ NASA OceanColor / Copernicus,
khí hậu cá theo mùa và đối chiếu sản lượng thực tế. Đổi trọng số/ngưỡng ngay trong tệp đó.

---

## 5. Thay dữ liệu thật

- **Ranh giới**: `data/ranh-gioi.json`, mỗi vùng theo bảng `vms_zones` (id, name, color, style, default_on, is_border, geometry). Toạ độ [kinh độ, vĩ độ]. `is_border: true` dùng cho "hải lý tới ranh giới".
- **Tin bão**: dựng máy chủ trả JSON `{ coBao, ten, moTa, capNhat }` từ nchmf.gov.vn, điền vào `CAU_HINH.nguonTinBao`.
- **Giá cá, vựa, cửa hàng**: sửa `data/gia-ca.json`, `data/vua.json`, `data/cua-hang.json`. Muốn cập nhật từ xa: đặt các tệp này lên máy chủ và đổi đường dẫn trong `napDuLieu()` (app.js).
- **Giọng Sen Biển**: hiện dùng giọng máy; muốn giọng thật, thu mp3 từng câu/số và ghép như SDFish (`/giong/sen-bien/`).

---

## 6. Chạy thử trên máy tính

```
python3 -m http.server 8080
```
Mở `http://localhost:8080`. GPS, giọng đọc, micro, service worker chỉ chạy qua https hoặc localhost.
Không có GPS: giữ nút **Bật GPS** 1 giây để tàu giả lập chạy.

---

## 7. Đường đi lên app thật

1. Thay ranh giới, khu trú bão, khu bảo tồn, trạm, đèn biển bằng toạ độ chính thức.
2. Mua hải đồ chính thức hoặc C-MAP/Navionics cho vùng gần bờ.
3. Dựng máy chủ ô bản đồ riêng (Protomaps/PMTiles) và chuyển Leaflet → MapLibre GL.
4. Máy chủ (Supabase/Postgres) cho tài khoản, tin mua bán chung, ranh VMS, giá cá cập nhật, tin bão.
5. Đóng gói lên CH Play bằng Bubblewrap (TWA) hoặc Capacitor.

---

## 8. Lưu ý an toàn

Số độ sâu, dự báo cá, lớp thời tiết, con nước đều là mô hình — **chỉ để tham khảo**, không thay hải đồ chính thức,
Thông báo hàng hải và bản tin của Trung tâm Dự báo KTTV quốc gia / đài duyên hải. Ranh giới trong bản mẫu là toạ độ MẪU.
