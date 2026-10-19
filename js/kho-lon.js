// =====================================================================
// KHO LỚN — lưu gói dữ liệu to (lưới dự báo cả vùng) bằng IndexedDB
// localStorage chỉ chứa được ~5 MB nên gói lưới (vài MB) để ở đây.
// Dùng: await khoLon.ghi("luoi", goi); const g = await khoLon.doc("luoi");
// =====================================================================
const TEN_DB = "haido", TEN_BANG = "goi";

function moDb() {
  return new Promise((ok, loi) => {
    if (!("indexedDB" in window)) return loi(new Error("Không có IndexedDB"));
    const yc = indexedDB.open(TEN_DB, 1);
    yc.onupgradeneeded = () => yc.result.createObjectStore(TEN_BANG);
    yc.onsuccess = () => ok(yc.result);
    yc.onerror = () => loi(yc.error);
  });
}
function giaoDich(cheDo, viec) {
  return moDb().then(db => new Promise((ok, loi) => {
    const tx = db.transaction(TEN_BANG, cheDo), bang = tx.objectStore(TEN_BANG);
    const yc = viec(bang);
    tx.oncomplete = () => { db.close(); ok(yc?.result); };
    tx.onerror = () => { db.close(); loi(tx.error); };
  }));
}

export const khoLon = {
  async doc(khoa)       { try { return await giaoDich("readonly",  b => b.get(khoa)); } catch { return undefined; } },
  async ghi(khoa, gt)   { try { await giaoDich("readwrite", b => b.put(gt, khoa)); return true; } catch { return false; } },
  async xoa(khoa)       { try { await giaoDich("readwrite", b => b.delete(khoa)); } catch { /* bỏ qua */ } },
  /** Ước lượng dung lượng (byte) của một gói bằng cách đo chuỗi JSON. */
  async kichThuoc(khoa) { const g = await this.doc(khoa); return g ? JSON.stringify(g).length : 0; },
};
