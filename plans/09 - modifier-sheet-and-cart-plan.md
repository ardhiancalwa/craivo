# Rencana Kerja: Implementasi Modifier Bottom Sheet, Keranjang Belanja, & Server Quote (Tahap 09)
## Cravio — Your craving, Perfectly Matched (Pilot: SELA Artisanal Coffee & Bake)

> **Dokumen Rujukan:**
> - [ADR-0005: Integritas Finansial, Quote Harga, Idempotensi, & Hash Token Meja](file:///d:/project/project-qr/cravio/docs/adr/ADR-0005-transaction-integrity-idempotency-and-pricing-contracts.md)
> - [ADR-0004: State Machine Pembayaran & Pemenuhan Pesanan Independen](file:///d:/project/project-qr/cravio/docs/adr/ADR-0004-independent-payment-and-fulfillment-state-machines.md)
> - [Spesifikasi Kontrak API & Skema Zod (api-contracts.md)](file:///d:/project/project-qr/cravio/docs/api-contracts.md)
> - [Runbook Skill order-payment-integrity](file:///d:/project/project-qr/cravio/.agents/skills/order-payment-integrity/SKILL.md)
> - [Design Specification (SCR-CUST-04 Layar Keranjang & Modifier Sheet)](file:///d:/project/project-qr/cravio/design.md)

---

## 1. Deskripsi Tujuan

Tahap 09 bertujuan mengimplementasikan **Modifier Bottom Sheet Lanjutan**, **State Keranjang Belanja Pelanggan**, dan **Endpoint Server-Authoritative Price Quote (`POST /api/orders/quote`)**.

Sesuai ketetapan ADR-0005 dan instruksi non-negotiable:
1. **Pemisahan Kontrol Modifier:** Menggunakan Radio untuk grup pilihan tunggal (`maxSelect === 1`) dan Checkbox untuk grup pilihan jamak/add-on (`maxSelect > 1`), dengan validasi `isRequired`, `minSelect`, dan `maxSelect`.
2. **Nominal Tambahan Transparan:** Menampilkan delta harga yang jelas pada setiap opsi (misal `+Rp6.000` atau `+Rp0 (Termasuk)`).
3. **Validasi Kepemilikan Server yang Ketat:** Server memverifikasi bahwa setiap opsi modifier yang dikirimkan **benar-benar terdaftar pada grup modifier yang ditugaskan ke menu item tersebut** via tabel relasi `MenuItemModifierGroup`. Opsi palsu, duplikat, atau selundupan dari menu lain ditolak seketika (`VALIDATION_FAILED` / `MODIFIER_INVALID`).
4. **Batas Kuantitas & Catatan Aman:** Kuantitas dibatasi 1–50 per baris. Catatan pelanggan dibatasi maksimal 100 karakter, disanitasi, dan dirender sebagai teks aman tanpa risiko injeksi HTML/XSS.
5. **Diferensiasi Baris Keranjang:** Dua item dengan menu yang sama namun racikan modifier atau catatan berbeda menjadi **baris terpisah** di keranjang belanja.
6. **Kapabilitas Edit Modifier:** Pelanggan dapat mengubah racikan modifier dari keranjang; drawer terbuka kembali dengan konfigurasi item yang sudah terisi dan memperbarui total secara presisi.
7. **Penyimpanan Draft Lokal & Nir-Order Offline:** Keranjang disimpan di `localStorage` agar tidak hilang saat reload atau gangguan jaringan, namun pesanan baru **hanya dapat dibuat setelah validasi quote server**. Transaksi offline tidak pernah diizinkan.
8. **Server-Authoritative Quote (`POST /api/orders/quote`):** Server menghitung harga dasar, modifier, subtotal, serta pajak & layanan 0% (baseline pilot SELA). Menghasilkan token quote bertanda tangan kriptografis dengan masa berlaku (15 menit) dan hash integritas isi keranjang.
9. **Deteksi Perubahan Harga & Stok:** Jika admin mengubah harga menu (`PRICE_CHANGED`), stok habis (`ITEM_STOCK_DEPLETED`), atau quote kedaluwarsa (`QUOTE_EXPIRED`), sistem **TIDAK PERNAH menagih diam-diam**. Sistem mewajibkan persetujuan tampilan terbaru dari pelanggan sebelum lanjut ke tahap pembayaran.

---

## 2. Tinjauan Pengguna Diperlukan (User Review Required)

> [!IMPORTANT]
> **Total Kiriman Browser Tidak Pernah Dipercaya:**  
> Klien hanya mengirimkan ID meja, daftar `menuItemId`, `selectedModifierOptionIds`, `quantity`, dan `notes`. Server mengalkulasi seluruh rupiah dari database PostgreSQL dan menerbitkan quote terikat sesi meja dengan masa berlaku 15 menit.

> [!IMPORTANT]
> **Transparansi Perubahan Harga:**  
> Jika harga diubah admin saat keranjang aktif, pemanggilan quote atau pembuatan order akan merespons dengan kode `PRICE_CHANGED` beserta rincian harga lama vs baru. Pengguna akan melihat dialog konfirmasi transparan sebelum melanjutkan.

> [!NOTE]
> **Karakter Unik Baris Keranjang:**  
> Kunci unik baris keranjang dibentuk dari `${menuItemId}:${sortedOptionIds.join('-')}:${notes.trim()}`. Item dengan menu sama tetapi catatan berbeda (misal: "tanpa sedotan" vs "bawa pulang") menjadi dua baris terpisah dengan kontrol kuantitas masing-masing.

---

## 3. Rencana Perubahan Berkas (Proposed Changes)

### 3.1. Domain Layanan & Backend API

#### [NEW] `src/lib/server/quote-service.ts`
Layanan server untuk kalkulasi harga resmi dan penerbitan quote token:
* Validasi meja via `table-service.ts` (meja aktif dan terdaftar).
* Validasi keberadaan menu (`isArchived: false` dan `isAvailable: true`).
* Validasi kepemilikan modifier:
  ```typescript
  // Verifikasi bahwa optionId terhubung ke grup yang dipetakan ke menuItemId
  const validMapping = await prisma.menuItemModifierGroup.findFirst({
    where: {
      menuItemId: item.menuItemId,
      group: {
        options: {
          some: { id: optionId, isAvailable: true }
        }
      }
    }
  });
  ```
* Validasi grup `isRequired`: memastikan setiap grup wajib memiliki minimal `minSelect` opsi yang dipilih.
* Validasi kuantitas (1–50 per baris) dan panjang catatan ($\le 100$ karakter).
* Menghitung `subtotalAmount` integer IDR, `taxAmount: 0`, `serviceAmount: 0`, `totalAmount: subtotalAmount`.
* Menerbitkan token quote kriptografis menggunakan `jose` (JWT) dengan payload:
  `{ quoteId, tableNumber, itemsHash, totalAmount, priceSnapshot, exp: now + 15m }`.
* Mendeteksi diskrepansi harga vs snapshot quote sebelumnya (`PRICE_CHANGED`) dan status stok habis (`ITEM_STOCK_DEPLETED`).

#### [NEW] `src/app/api/orders/quote/route.ts`
Route handler `POST /api/orders/quote`:
* Skema Zod `QuoteRequestSchema` memvalidasi `tableNumber` (1–10 karakter) dan `items` (min 1, max 50).
* Memanggil `createOrderQuote(...)` dari `quote-service.ts`.
* Mengembalikan respon envelope sukses (HTTP 200) atau error ramah (HTTP 400, 404, 409).

---

### 3.2. Komponen State & Antarmuka Pengguna (Client)

#### [MODIFY] `src/lib/cart-context.tsx`
Pembaruan state manager keranjang belanja:
* Perbarui `generateCartItemId`:
  ```typescript
  export function generateCartItemId(
    menuItemId: string,
    modifiers: SelectedModifier[] = [],
    notes: string = ''
  ): string {
    const sortedOptionIds = modifiers.map((m) => m.optionId).sort().join('-')
    return `${menuItemId}:${sortedOptionIds}:${notes.trim()}`
  }
  ```
* Tambahkan batas kuantitas: `Math.min(50, Math.max(1, newQty))`.
* Tambahkan fungsi `updateItemDetails(cartItemId: string, newModifiers: SelectedModifier[], newNotes?: string)` untuk mendukung pengeditan modifier dari keranjang belanja.
* Tambahkan state `activeQuote` dan fungsi `invalidateQuote()` agar setiap mutasi keranjang (tambah, kurang, hapus, ubah varian) seketika membatalkan quote lama.

#### [MODIFY] `src/components/menu/product-modifier-sheet.tsx`
Peningkatan Bottom Sheet modifier:
* Dukungan Mode Edit: Menerima prop opsional `editingCartItem?: CartItem | null` dan `onUpdateCartItem?: (...) => void`.
* Validasi `isRequired`: Tombol submit terkunci (*disabled*) jika grup wajib belum dipilih atau pilihan kurang dari `minSelect`.
* Batas `maxSelect`: Checkbox menolak seleksi tambahan jika sudah mencapai `maxSelect` dengan pesan tooltip/toast.
* Input catatan dengan penghitung karakter tersisa (`X/100`) dan pembatas `maxLength={100}`.
* Pemaparan delta harga transparan pada radio dan checkbox.

#### [MODIFY] `src/app/(customer)/cart/page.tsx` & [NEW] `src/app/(customer)/cart/cart-client-view.tsx`
Pembangunan halaman keranjang belanja interaktif:
* Tampilan **Keranjang Kosong**: Menggunakan `EmptyState` SELA, mengarahkan kembali ke `/menu?table=XX`, dan mengunci tombol checkout.
* Tampilan **Daftar Item Keranjang**:
  - Kartu baris item dengan nama menu dan harga satuan.
  - Tag pill modifier terpilih dengan penambahan harga (`+Rp6.000`).
  - Catatan pelanggan yang dirender aman dengan ikon kutipan.
  - Stepper kuantitas inline (1–50) dengan tabular numerals.
  - Tombol "Ubah Racikan" yang membuka kembali `ProductModifierSheet` dalam mode edit.
  - Tombol "Hapus" baris item.
* Pilihan Metode Pembayaran:
  - QRIS Dinamis (GoPay, OVO, BCA, Livin, dll.).
  - Bayar Tunai di Kasir SELA.
* Rincian Tagihan Resmi:
  - Subtotal (Integer IDR).
  - Pajak & Layanan 0% (Rp0 Termasuk).
  - Total Pembayaran dengan font tabular terakota `#924805`.
* Tombol Aksi "Lanjut ke Pembayaran":
  - Memanggil `POST /api/orders/quote` untuk memvalidasi harga dan ketersediaan stok server.
  - Jika sukses, menyimpan quote valid dan membuka konfirmasi akhir.
  - Jika harga berubah (`PRICE_CHANGED`), menampilkan modal konfirmasi perubahan harga sebelum membuat tagihan.
  - Jika stok habis (`ITEM_STOCK_DEPLETED`), menampilkan pemberitahuan menu habis dan opsi menghapusnya dari keranjang.
  - Jika offline / gangguan jaringan, menampilkan `ConnectionBanner` dan mempertahankan draft tanpa membuat pesanan palsu.

---

## 4. Rencana Pengujian (Test Suite & Verifikasi)

### 4.1. Unit Test Suite (`tests/unit/cart-pricing.test.ts`)
1. **Perhitungan Subtotal Modifier & Menu:** Menghitung `(harga dasar + sum modifier) * quantity` secara presisi tanpa desimal.
2. **Diferensiasi Baris Modifier Berbeda:** Dua item dengan `menuItemId` sama namun modifier berbeda menjadi 2 baris terpisah di keranjang.
3. **Diferensiasi Baris Catatan Berbeda:** Dua item dengan `menuItemId` dan modifier sama namun catatan berbeda menjadi 2 baris terpisah di keranjang.
4. **Batas Kuantitas 1–50:** Kuantitas $< 1$ ditolak/dihapus; kuantitas $> 50$ dibatasi maksimal 50.
5. **Batas Catatan $\le 100$ Karakter:** Catatan dipotong atau ditolak jika melebihi 100 karakter.
6. **Pengeditan Modifier Item:** Mengubah racikan modifier pada item keranjang mempertahankan konsistensi total subtotal.
7. **Pencegahan Checkout Keranjang Kosong:** `items.length === 0` tidak mengizinkan pemanggilan quote.

### 4.2. Integration Test Suite (`tests/integration/quote-api.test.ts`)
1. **Endpoint `POST /api/orders/quote` Valid:** Menghasilkan subtotal resmi, total integer IDR, dan quote token bertanda tangan dengan expiry 15 menit.
2. **Penolakan Modifier Tidak Terdaftar / Selundupan:** Payload dengan modifier milik menu lain atau ID palsu ditolak HTTP 400 `VALIDATION_FAILED`.
3. **Penolakan Pelanggaran Constraint Grup:** Tidak memilih opsi pada grup `isRequired` atau memilih lebih dari `maxSelect` ditolak HTTP 400.
4. **Deteksi Stok Habis (`ITEM_STOCK_DEPLETED`):** Menu yang berstatus `isAvailable: false` pada saat quote diminta mengembalikan HTTP 409 dengan kode `ITEM_STOCK_DEPLETED`.
5. **Deteksi Perubahan Harga (`PRICE_CHANGED`):** Simulasi perubahan harga di DB mengembalikan HTTP 409 dengan rincian harga lama vs baru.
6. **Penolakan Meja Tidak Terdaftar / Nonaktif:** Nomor meja fiktif atau nonaktif ditolak HTTP 404 / 403.
7. **Verifikasi Masa Berlaku Quote:** Token quote yang sudah kedaluwarsa ($> 15$ menit) ditolak.

---

## 5. Rencana File yang Dibuat & Dimodifikasi

| No | Path Berkas | Status | Peran & Deskripsi |
|---|---|---|---|
| 1 | `plans/modifier-sheet-and-cart-plan.md` | Dibuat | Dokumen rencana kerja Tahap 09 di folder plans repositori |
| 2 | `src/lib/server/quote-service.ts` | Dibuat | Server service validasi modifier, integritas harga DB, kalkulasi subtotal, dan penerbitan quote token |
| 3 | `src/app/api/orders/quote/route.ts` | Dibuat | Endpoint publik `POST /api/orders/quote` |
| 4 | `src/lib/cart-context.tsx` | Dimodifikasi | Penyesuaian hash keunikan (menu + modifier + notes), limit qty 1–50, edit modifier, dan quote invalidation |
| 5 | `src/components/menu/product-modifier-sheet.tsx` | Dimodifikasi | Dukungan edit mode, validasi required/min/max, catatan max 100 karakter, dan transparansi delta harga |
| 6 | `src/app/(customer)/cart/page.tsx` | Dimodifikasi | Server component halaman keranjang dengan resolusi meja |
| 7 | `src/app/(customer)/cart/cart-client-view.tsx` | Dibuat | Antarmuka interaktif keranjang belanja, stepper, edit racikan, quote trigger, dan modal konfirmasi harga berubah |
| 8 | `tests/unit/cart-pricing.test.ts` | Dibuat | Unit tests untuk logika keranjang, hash keunikan, limit kuantitas, catatan aman, dan kalkulasi subtotal |
| 9 | `tests/integration/quote-api.test.ts` | Dibuat | Integration tests live DB untuk endpoint quote harga, proteksi modifier palsu, `PRICE_CHANGED`, dan `ITEM_STOCK_DEPLETED` |
| 10 | `docs/implementation-progress.md` | Dimodifikasi | Pemutakhiran status kemajuan proyek ke Tahap 09 |

---

## 6. Kriteria Keberhasilan (Definition of Done)

1. [ ] Radio button berfungsi untuk grup pilihan tunggal (`maxSelect === 1`) dan checkbox untuk grup add-on (`maxSelect > 1`).
2. [ ] Validasi `isRequired`, `minSelect`, dan `maxSelect` ditegakkan di sisi client dan di sisi server.
3. [ ] Setiap opsi modifier menampilkan nominal penambahan harga yang transparan.
4. [ ] Server menolak keras opsi modifier yang diduplikasi, palsu, atau diselundupkan dari menu item lain.
5. [ ] Kuantitas dibatasi secara ketat 1–50 per baris; catatan dibatasi maksimal 100 karakter dan dirender aman.
6. [ ] Dua item dengan modifier atau catatan berbeda menjadi baris terpisah di keranjang belanja.
7. [ ] Pelanggan dapat mengubah racikan modifier dari keranjang belanja dengan estimasi total yang tetap akurat.
8. [ ] Draft keranjang disimpan di `localStorage` saat terjadi reload atau jaringan terputus.
9. [ ] Endpoint `POST /api/orders/quote` menghitung subtotal server-authoritative dan mengembalikan quote terikat sesi meja, isi cart, dan expiry 15 menit tanpa mempercayai total kiriman browser.
10. [ ] Perubahan harga menghasilkan kode `PRICE_CHANGED` dan stok habis menghasilkan `ITEM_STOCK_DEPLETED`, mewajibkan persetujuan pelanggan sebelum checkout.
11. [ ] Seluruh automated unit test dan integration test lulus (`pnpm run test` & `pnpm run test:integration`).
12. [ ] `pnpm run typecheck`, `pnpm run lint`, dan `pnpm run build` berhasil tanpa error.

