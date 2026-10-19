// =====================================================================
// SERVICE WORKER — để app mở được và xem được bản đồ khi mất sóng
// Ba kho riêng, bản nào xoá bản đó:
//   haido-vo-v1       : vỏ app (HTML, CSS, JS, dữ liệu tĩnh, thư viện)
//   haido-o-ban-do-v1 : ô bản đồ (tile) — không xoá khi cập nhật app
//   (dự báo thời tiết do app tự lưu bằng localStorage, không qua đây)
// =====================================================================
const VO = "haido-vo-v2";
const O_BAN_DO = "haido-o-ban-do-v1";
const TOI_DA_O = 20000;

// Phải tải đủ các tệp này lúc cài; thiếu một tệp là cài thất bại (như SDFish)
const VO_BAT_BUOC = [
  "./", "./index.html", "./css/app.css",
  "./js/app.js", "./js/ban-do.js", "./js/cau-hinh.js", "./js/dinh-vi.js", "./js/giao-dien.js",
  "./js/giong-noi.js", "./js/hang-hai.js", "./js/kho.js", "./js/thoi-tiet.js",
  "./data/ranh-gioi.json", "./data/dia-danh-ngam.json", "./data/khu-tru-bao.json",
  "./data/den-bien.json", "./data/dia-danh-lon.json", "./data/cang.json",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
];
// Có thì tốt, thiếu không sao
const VO_TUY_CHON = ["./manifest.webmanifest", "./icon.svg"];

const MAY_CHU_O = ["server.arcgisonline.com", "tile.openstreetmap.org", "tiles.openseamap.org"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VO);
    await c.addAll(VO_BAT_BUOC);
    await Promise.all(VO_TUY_CHON.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    // Xoá vỏ cũ, giữ nguyên kho ô bản đồ
    for (const k of await caches.keys()) if (k.startsWith("haido-vo-") && k !== VO) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function donOCu() {
  const c = await caches.open(O_BAN_DO), ks = await c.keys();
  for (let i = 0; i < ks.length - TOI_DA_O; i++) await c.delete(ks[i]);
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // 1) Ô bản đồ: có trong kho thì dùng ngay; không thì tải và lưu
  if (MAY_CHU_O.some(h => url.hostname.endsWith(h))) {
    e.respondWith((async () => {
      const c = await caches.open(O_BAN_DO);
      const co = await c.match(url.href, { ignoreVary: true });
      if (co) return co;
      try {
        let res;
        try { res = await fetch(url.href, { mode: "cors", credentials: "omit" }); }
        catch { res = await fetch(e.request); }
        if (res.ok || res.type === "opaque") { c.put(url.href, res.clone()); donOCu(); }
        return res;
      } catch { return new Response("", { status: 504, statusText: "Mất sóng, chưa có ô này" }); }
    })());
    return;
  }

  // 2) Dự báo thời tiết: luôn lấy mạng (app tự lưu bản mới nhất)
  if (url.hostname.endsWith("open-meteo.com")) return;

  // 3) Vỏ app: lấy mạng nếu có (để nhận bản mới), mất sóng thì lấy bản đã lưu
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok && (url.origin === location.origin || url.hostname === "cdnjs.cloudflare.com")) {
        const c = await caches.open(VO); c.put(e.request, res.clone());
      }
      return res;
    } catch {
      const co = await caches.match(e.request, { ignoreSearch: true });
      if (co) return co;
      if (e.request.mode === "navigate") return caches.match("./index.html");
      return new Response("", { status: 504 });
    }
  })());
});
