# Hải Đồ Ra Khơi — app mẫu tham khảo

App web chạy trên trình duyệt điện thoại / máy tính bảng Android, làm lại phần **"Ra khơi"** của
SDFish (forfish.vercel.app) để tham khảo cách tổ chức: hải đồ, định vị, dự báo sóng gió 16 ngày,
dẫn đường có giọng đọc, ranh giới vùng biển, lộ trình, điểm đã lưu, và dùng được khi mất sóng.

Mã nguồn viết bằng HTML/CSS/JavaScript thuần, không cần cài công cụ xây dựng. Tên biến, hàm, chú thích
đều bằng tiếng Việt để dễ đọc.

---

## 1. Chạy thử

### Trên máy tính (nhanh nhất)
```
cd haido-v2
python3 -m http.server 8080
```
Mở trình duyệt vào `http://localhost:8080`. Bấm F12 → biểu tượng điện thoại để xem ở khổ máy điện thoại.
`localhost` được trình duyệt coi là an toàn nên GPS và service worker vẫn hoạt động.

### Trên điện thoại
1. Đưa cả thư mục lên một máy chủ có **https** (GitHub Pages, Netlify, Cloudflare Pages đều miễn phí).
2. Mở địa chỉ đó bằng Chrome trên điện thoại → menu ⋮ → **Thêm vào màn hình chính**.
3. Chạm **Bật GPS** và cho phép vị trí.

> GPS, giọng đọc và lưu bản đồ ngoại tuyến **chỉ hoạt động qua https** (hoặc localhost).
> Mở trực tiếp tệp `index.html` thì chỉ xem được giao diện.

### Không có GPS (đang ngồi trên bờ)
**Giữ nút Bật GPS khoảng 1 giây** → app chạy chế độ thử: tàu giả lập chạy 7 hải lý/giờ hướng 138°,
mọi số liệu (khoảng cách, ranh giới, cảnh báo giọng nói) đổi theo để kiểm tra.

---

## 2. Cấu trúc thư mục

```
haido-v2/
├── index.html              Khung trang: bản đồ, thẻ vị trí, cột nút, dải dưới
├── css/app.css             Toàn bộ giao diện; màu đặt ở :root để đổi tông một chỗ
├── js/
│   ├── app.js              Nối mọi thứ: trạng thái, bảng trượt, dẫn đường  ← đọc tệp này trước
│   ├── cau-hinh.js         Các con số chỉnh được (ngưỡng cảnh báo, số ngày dự báo, …)
│   ├── hang-hai.js         Toán hàng hải: khoảng cách, hướng, đọc/ghi toạ độ, Beaufort
│   ├── ban-do.js           Bọc Leaflet: lớp nền, lớp phủ, tàu, đích, tuyến, đo khoảng cách
│   ├── dinh-vi.js          GPS thật + chế độ thử
│   ├── thoi-tiet.js        Gọi Open-Meteo, đóng gói dự báo để dùng ngoại tuyến
│   ├── giong-noi.js        Đọc cảnh báo bằng giọng máy + rung
│   ├── giao-dien.js        Cập nhật màn hình, bảng trượt dùng chung
│   └── kho.js              localStorage an toàn
├── data/                   Dữ liệu tĩnh, dạng JSON dễ sửa
│   ├── ranh-gioi.json      Ranh giới vùng biển (TOẠ ĐỘ MẪU)
│   ├── dia-danh-ngam.json  Tên núi/đồi/thung lũng ngầm (vị trí gần đúng)
│   ├── khu-tru-bao.json    Khu neo đậu tránh trú bão
│   ├── den-bien.json       Đèn biển
│   ├── cang.json           Cảng cá (điểm xuất phát lộ trình, cảng nhà)
│   └── dia-danh-lon.json   Nhãn Biển Đông, Hoàng Sa, Trường Sa…
├── sw.js                   Service worker: vỏ app + ô bản đồ cho lúc mất sóng
├── manifest.webmanifest    Để cài như app
└── icon.svg
```

---

## 3. Chức năng và cách SDFish làm tương ứng

| Trên màn hình | Bản mẫu này | SDFish làm thế nào |
|---|---|---|
| Thanh tin bão trên cùng | Suy ra từ gió giật/sóng 2 ngày tới (Open-Meteo). Có chỗ nối nguồn riêng `CAU_HINH.nguonTinBao` | Máy chủ riêng `/api/storms`, lưu bản tin mới nhất để đọc khi mất sóng |
| Thẻ TÀU / ĐÍCH | Toạ độ DMS hoặc thập phân, tốc độ, hướng, còn bao nhiêu hải lý, mấy giờ tới | Giống, thêm "Định vị bị chặn → Cài đặt › Vị trí" |
| Lớp bản đồ | 5 nhóm: Hải đồ · Ngư trường · Thời tiết · Công cụ · Cài đặt | Giống. Hải đồ của họ là ô ảnh tự dựng từ ETOPO/EMODnet/GEBCO + nền vector Protomaps (OSM) |
| Bật GPS / Vị trí | `watchPosition`, bám theo tàu, kéo bản đồ thì thôi bám | Giống |
| Bắt đầu chạy | Đọc cảnh báo bằng giọng máy (Web Speech), rung, 10 phút đọc khoảng cách một lần, tới điểm thì chuyển điểm kế | Giọng thu sẵn "Sen Biển" (file mp3 ghép số), rung, bảng "Đang chạy" kéo thả được |
| Đến điểm | Nhập "8 30" / "109 18" hoặc giữ tay lên bản đồ | Giống |
| Điểm đã lưu | Ghim, đặt tên, cảng nhà | Giống |
| Lộ trình | Xuất phát = GPS / cảng nhà / cảng gần nhất; nhiều điểm; tổng quãng, giờ chạy | Giống, có tính lộ trình tự động |
| Nhãn "159 hải lý tới ranh giới" | Khoảng cách tới đường `is_border` gần nhất, đỏ khi < 10 hải lý | Giống, ranh lấy từ bảng `vms_zones` trên Supabase |
| "Đã lưu đủ dự báo — tới ngày 3/11" | Gói 16 ngày, hạn 15 ngày; chạm → bảng "Dữ liệu đã lưu" | Giống, thêm gói "gió sóng CẢ VÙNG" (lưới 13×13 điểm, 8 ngày theo giờ) |
| Tab ngày + "Sóng 0,8 m · Gió cấp 3 Đông Bắc" | Open-Meteo, mũi tên chỉ hướng gió thổi tới, chạm → bảng chi tiết theo giờ | Giống |
| Chạm vào bản đồ | Hỏi gió sóng ngay chỗ đó | Giống |
| Đo khoảng cách | Công cụ → Bắt đầu đo → chạm nhiều điểm | Giống |
| Ngoại tuyến | Service worker lưu vỏ app + ô bản đồ; dự báo lưu localStorage | 8 kho cache tách riêng, cài theo 2 mức "sống còn" và "có thì tốt" |

---

## 4. Nguồn dữ liệu (đều miễn phí) và điều khoản

| Dữ liệu | Nguồn trong bản mẫu | Ghi chú |
|---|---|---|
| Nền đáy biển, đường đẳng sâu | Esri World Ocean Base (tổng hợp GEBCO, NOAA) | Chỉ tham khảo. Esri cho dùng miễn phí có ghi nguồn; không được tải ồ ạt |
| Nhãn biển | Esri World Ocean Reference | |
| Phao, đèn, xác tàu, luồng | OpenSeaMap | Cộng đồng đóng góp; vùng VN còn thưa |
| Ảnh vệ tinh | Esri World Imagery | |
| Đường phố, bờ biển | OpenStreetMap | Máy chủ công cộng cấm dùng cho app đông người: tự dựng máy chủ ô bản đồ hoặc dùng Protomaps/MapTiler |
| Gió, giật, mưa, mã thời tiết | Open-Meteo Forecast API (GFS/ICON) | Miễn phí 10.000 lượt/ngày, không cần khoá |
| Sóng, chu kỳ, dòng chảy | Open-Meteo Marine API (`models=ncep_gfswave025`) | Giống SDFish |
| Ranh giới vùng biển | `data/ranh-gioi.json` | **TOẠ ĐỘ MẪU** — thay bằng phụ lục NĐ 26/2019 hoặc dữ liệu Chi cục Thủy sản |
| Địa danh ngầm | `data/dia-danh-ngam.json` | Tên theo Thông tư 33/2024; vị trí ước lượng, cần đối chiếu |
| Khu trú bão | `data/khu-tru-bao.json` | Theo QĐ 582/QĐ-TTg 2024; vị trí gần đúng |

SDFish ngoài các nguồn trên còn dùng: ảnh NASA, ETOPO/EMODnet (độ sâu), Copernicus Marine (độ mặn, dòng chảy
tầng sâu), UHSLC (trạm thuỷ triều), và dữ liệu cá riêng (`fish-climatology`, `model-params`). Dữ liệu của họ
được mã hoá (tệp bắt đầu bằng `SDF2`) nên không đọc trực tiếp được.

---

## 5. Thay dữ liệu thật

### Ranh giới (quan trọng nhất)
Mở `data/ranh-gioi.json`. Mỗi vùng là một `Feature` với:
```json
"properties": { "id": "ranh-ngoai", "name": "Ranh giới ngoài khơi", "color": "#c62828",
                "style": "dash", "default_on": true, "is_border": true, "moTa": "…" },
"geometry":   { "type": "LineString", "coordinates": [[kinh_do, vi_do], …] }
```
- `is_border: true` → dùng để tính "hải lý tới ranh giới" và đọc cảnh báo khi dưới 10 hải lý.
- Toạ độ theo thứ tự **[kinh độ, vĩ độ]** (chuẩn GeoJSON). Đổi từ độ-phút-giây: `độ + phút/60 + giây/3600`.
- Cấu trúc trùng với bảng `vms_zones` của SDFish nên sau này chuyển sang Supabase/Postgres rất dễ.

### Tin bão chính thức
Dựng một máy chủ nhỏ lấy bản tin từ Trung tâm Dự báo KTTV quốc gia (nchmf.gov.vn), trả JSON:
```json
{ "coBao": true, "ten": "Bão số 5", "moTa": "cấp 10, giật cấp 12, cách Hoàng Sa 150 km", "capNhat": "2026-10-19T18:00:00+07:00" }
```
rồi điền địa chỉ vào `CAU_HINH.nguonTinBao`.

### Giọng đọc
Bản mẫu dùng giọng máy của hệ điều hành (`speechSynthesis`, ngôn ngữ `vi-VN`). Android mới và iPhone có sẵn
giọng Việt; máy cũ có thể không có → app tự im lặng, vẫn rung và hiện chữ. Muốn giọng tự nhiên như "Sen Biển",
thu sẵn các câu và số (0–9, "hải lý", "hướng", "độ"…) thành mp3 rồi ghép, như SDFish làm trong `/giong/sen-bien/`.

---

## 6. Chỉnh nhanh (`js/cau-hinh.js`)

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `tamMacDinh`, `zoomMacDinh` | 14.57, 109.07 · 7 | Chỗ mở bản đồ lần đầu |
| `thoiTiet.soNgay` | 16 | Số ngày dự báo (tối đa 16) |
| `thoiTiet.hanGoiNgay` | 15 | "Còn dùng tới ngày…" |
| `nguong.bienDong` / `nguyHiem` | cấp 6 / 2,5 m · cấp 8 / 4 m | Đổi màu thanh tin bão |
| `nguong.ranhGioiHaiLy` | 10 | Nhãn ranh giới chuyển đỏ, giọng đọc cảnh báo |
| `nguong.sapToiDichHaiLy` | 1 | Đọc "sắp tới", chuyển điểm lộ trình |
| `ngoaiTuyen.gioiHanOMoiLan` | 800 | Số ô bản đồ tối đa mỗi lần "Tải vùng đang xem" |
| `thu.tocDoHaiLyGio`, `thu.huongDo` | 7 · 138 | Tàu giả lập ở chế độ thử |

---

## 7. Đường đi lên app thật

1. **Ranh giới pháp lý** và **khu trú bão**: nhập toạ độ chính thức (mục 5).
2. **Hải đồ gần bờ**: mua hải đồ chính thức (Tổng công ty Bảo đảm an toàn hàng hải) hoặc C-MAP/Navionics nếu
   cần độ sâu chính xác để tránh đá ngầm. Dữ liệu GEBCO/ETOPO quá thô cho việc này.
3. **Máy chủ ô bản đồ riêng**: dựng từ OpenStreetMap bằng Protomaps (PMTiles) để không phụ thuộc Esri/OSM
   công cộng, như SDFish (`vn-basemap.pmtiles`). Khi đó đổi Leaflet sang MapLibre GL.
4. **Gói dự báo cả vùng**: gọi Open-Meteo theo lưới điểm (SDFish dùng 13×13 điểm từ 1–24°N, 98–123°E,
   8 ngày theo giờ) và lưu một lần, để chạm bất kỳ chỗ nào ngoài khơi vẫn có số.
5. **Dự báo cá**: cần dữ liệu vệ tinh (nhiệt độ mặt biển, chlorophyll từ NASA OceanColor / Copernicus)
   và mô hình riêng; đây là phần khó nhất và là "bí quyết" của SDFish.
6. **Đóng gói lên CH Play**: dùng Bubblewrap (Trusted Web Activity) hoặc Capacitor, giữ nguyên mã này.
7. **Tài khoản, bạn thuyền, giao dịch**: cần máy chủ và cơ sở dữ liệu (SDFish dùng Next.js + Supabase).

---

## 8. Lưu ý an toàn

- Số độ sâu trên bản đồ chỉ để **tham khảo**, không thay hải đồ chính thức và Thông báo hàng hải.
- Ranh giới trong bản mẫu là toạ độ MẪU. Ranh chính thức tra Chi cục Thủy sản.
- Dự báo Open-Meteo là mô hình toàn cầu, có thể lệch gần bờ và trong bão. Luôn nghe bản tin của
  Trung tâm Dự báo KTTV quốc gia và đài duyên hải.
