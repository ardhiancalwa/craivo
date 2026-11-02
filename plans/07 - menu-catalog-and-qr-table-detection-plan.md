# Rencana Kerja: Katalog Menu & Deteksi Meja QR (Tahap 07)

Rencana kerja ini menetapkan strategi dan arsitektur pengembangan pintu masuk pelanggan melalui kode QR, validasi meja server ke PostgreSQL, katalog menu dinamis, pencarian, kustomisasi modifier, serta penanganan stok *Sold Out* untuk platform **Cravio — Your craving, Perfectly Matched** (Pilot: **SELA Artisanal Coffee & Bake**), berlandaskan [`docs/route-map.md`](file:///d:/project/project-qr/cravio/docs/route-map.md), [`docs/api-contracts.md`](file:///d:/project/project-qr/cravio/docs/api-contracts.md), [`docs/design.md`](file:///d:/project/project-qr/cravio/docs/design.md), dan skill [`smart-menu-ui`](file:///d:/project/project-qr/cravio/.agents/skills/smart-menu-ui/SKILL.md).

---

## 1. Deskripsi Tujuan (Goal Description)

Membangun alur utama pelanggan dari titik pemindaian kode QR fisik meja hingga penjelajahan katalog menu secara aman, akurat, dan transparan:
1. **Pintu Masuk & Validasi Meja Otoritatif:** Mengakses `/order?table=07` memvalidasi nomor meja langsung ke tabel `tables` di PostgreSQL. Mencegah pemilihan meja default diam-diam; jika meja hilang, tidak terdaftar, atau nonaktif, sistem menampilkan instruksi pemindaian ulang / kontak staf dan mengunci proses pemesanan.
2. **Katalog Menu Dinamis dari Database:** Mengambil daftar kategori riil (*Kopi, Non-Kopi, Makanan*) dan item menu aktif dari database. Kategori *"Semua"* disediakan secara murni di level antarmuka pengguna (*UI aggregation*) tanpa membuat baris baru di database.
3. **Pencarian & Detail Modifier:** Grid responsif 2-kolom mobile, foto rasio 1:1, badge *"Favorit"*, dan drawer kustomisasi modifier (*Bottom Sheet*) dengan kalkulasi subtotal seketika.
4. **Integritas Stok & Stepper:** Menu *Sold Out* (`isAvailable: false`) tetap ditampilkan transparan dengan badge *"Habis"*, foto grayscale $80\%$, opasitas $45\%$, dan tombol aksi terkunci. Tombol stepper tidak boleh menambah varian yang belum dikonfigurasi atau menggabungkan dua racikan modifier yang berbeda ke dalam satu baris.
5. **State Feedback yang Jujur:** Menyediakan skeleton shimmer saat loading, ilustrasi ramah saat pencarian kosong (*empty state*), penanganan error jaringan dengan tombol coba lagi (*error & retry*), dan deteksi offline.

---

## 2. Hal yang Memerlukan Review Pengguna (User Review Required)

> [!IMPORTANT]
> **1. Penanganan Akses Tanpa Meja (Read-Only Menu Browsing):**
> Jika pengunjung membuka `/menu` tanpa parameter `table` (misalnya tautan dari media sosial atau dibagikan teman), katalog tetap dapat dijelajahi dalam mode baca (*Read-Only*). Namun, sistem menampilkan banner peringatan: *"Mode Baca Menu: Meja belum terdeteksi. Silakan pindai QR di meja kafe untuk memesan."* Tombol checkout dan pemesanan otomatis diblokir sampai meja valid terkonfirmasi.

> [!IMPORTANT]
> **2. Larangan Memilih Meja Default Diam-Diam:**
> Kode lama di placeholder `menu/page.tsx` memiliki fallback `const table = params.table || '07'`. Fallback ini **DIBERSIHKAN TOTAL**. Tidak ada meja yang dipilih secara diam-diam. Validasi meja wajib dilakukan ke serverless database `prisma.table.findUnique({ where: { tableNumber } })`.

> [!NOTE]
> **3. Pemisahan Konfigurasi Modifier Unik di Keranjang:**
> Dua item dengan menu dasar sama tetapi modifier berbeda (contoh: *Kopi Susu Less Ice* vs *Kopi Susu Normal Ice*) disimpan dengan kunci kombinasi unik (`${menuId}:${sortedModifierIds.join('-')}`) sehingga tidak dilebur menjadi satu baris kuantitas. Tombol `+` pada menu yang memiliki modifier wajib membuka drawer kustomisasi, bukan langsung menambah kuantitas tanpa memilih varian.

---

## 3. Pertanyaan Terbuka (Open Questions)

*Tidak ada blocker arsitektur.* Skema relasional `Table`, `Category`, `MenuItem`, `ModifierGroup`, dan `ModifierOption` telah tersedia di database Neon PostgreSQL bersama 18 menu riil SELA dan 10 meja contoh.

---

## 4. Diagram Alur Pelanggan & Validasi Meja

```mermaid
sequenceDiagram
    autonumber
    actor C as Pelanggan (Peramban Ponsel)
    participant GW as Next.js (/order?table=XX)
    participant DB as PostgreSQL (Neon)
    participant UI as Halaman Katalog (/menu)
    participant CART as Keranjang (Cart State)

    C->>GW: Pindai QR Meja (/order?table=07)
    GW->>DB: Table.findUnique({ where: { tableNumber: '07' } })
    
    alt Meja Valid & Aktif (isActive == true)
        DB-->>GW: Data Meja 07
        GW-->>C: Set Cookie Meja 'cravio_table=07' + Redirect /menu?table=07
        C->>UI: Muat Katalog Menu Meja 07
        UI->>DB: Ambil Kategori & Menu (isArchived == false)
        DB-->>UI: 18 Menu SELA + Modifier + Stok Aktual
        UI-->>C: Render Grid 2 Kolom, Tab 'Semua', Badge Meja 07
    else Parameter Hilang / Tidak Terdaftar
        DB-->>GW: null (Not Found)
        GW-->>C: Tampilkan Layar Peringatan "Meja Tidak Terdaftar"
        Note over C,GW: Checkout Terkunci; Opsi Scan Ulang / Hubungi Kasir
    else Meja Nonaktif (isActive == false)
        DB-->>GW: Table { isActive: false }
        GW-->>C: Tampilkan Layar Peringatan "Meja Sedang Tutup / Nonaktif"
        Note over C,GW: Checkout Terkunci; Opsi Hubungi Staf
    end

    alt Pelanggan Memilih Menu dengan Modifier
        C->>UI: Klik Tambah pada Menu Kopi Susu
        UI-->>C: Buka ModifierBottomSheet (Pilihan Gula, Es, Susu, Catatan)
        C->>UI: Pilih "Less Sweet" + "Oat Milk (+Rp8.000)"
        C->>UI: Klik "Tambah ke Pesanan — Rp36.000"
        UI->>CART: Simpan Item dengan Unique Key (MenuId + ModifierHash)
        CART-->>C: FloatingOrderTray Muncul di Bawah Layar
    else Pelanggan Memilih Menu Sold Out (Habis)
        Note over UI: Card Opacity 45%, Grayscale 80%, Badge 'Habis'
        C->>UI: Klik Tombol Tambah
        Note over UI: Tombol Disabled (Tidak Ada Aksi / Feedback Stok Habis)
    end
```

---

## 5. Rencana Perubahan Berkas (Proposed Changes)

### A. Layanan Server & Validasi Data

#### [NEW] `src/lib/server/table-service.ts`
* Fungsi `validateTableServer(tableNumber: string | undefined | null)`:
  * Memvalidasi parameter via Zod: string alfanumerik panjang $1-10$ karakter.
  * Menjalankan kueri `prisma.table.findUnique({ where: { tableNumber } })`.
  * Mengembalikan status terstruktur:
    * `VALID`: Meja terdaftar dan `isActive === true`.
    * `NOT_FOUND`: Nomor meja tidak ada di master database.
    * `INACTIVE`: Nomor meja ada namun `isActive === false`.
    * `MISSING`: Parameter meja tidak disertakan pada request.

#### [NEW] `src/lib/server/menu-service.ts`
* Fungsi `getCatalogData(categorySlug?: string, search?: string)`:
  * Mengambil kategori aktif dari database `prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })`.
  * Menyisipkan opsi tab gabungan virtual `{ id: 'semua', name: 'Semua', slug: 'semua', sortOrder: 0 }` di posisi paling awal.
  * Mengambil menu dari `prisma.menuItem.findMany`:
    * Filter `isArchived: false`.
    * Filter kategori jika slug bukan `'semua'` dan valid.
    * Filter pencarian teks menggunakan `contains` (case-insensitive) pada `name` dan `description`.
    * Relasi `category`, `tags` (via `MenuItemTag.tag`), dan `modifierGroups` (via `MenuItemModifierGroup.modifierGroup.options` yang `isAvailable: true`).
  * Memastikan seluruh harga dalam integer IDR murni tanpa manipulasi floating point.

---

### B. Endpoint API Route Handlers

#### [NEW] `src/app/api/tables/[tableNumber]/route.ts`
* Endpoint publik `GET /api/tables/[tableNumber]`:
  * Validasi param nomor meja via Zod.
  * Memanggil `validateTableServer`.
  * Mengembalikan respon Envelope baku:
    * 200 OK: `{ "success": true, "data": { "table": { "id", "tableNumber", "qrSlug", "isActive" } } }`
    * 404 Not Found: `{ "success": false, "error": { "code": "TABLE_NOT_FOUND", "message": "Nomor meja tidak terdaftar..." } }`
    * 403 Forbidden: `{ "success": false, "error": { "code": "TABLE_INACTIVE", "message": "Meja ini sedang tidak aktif..." } }`

#### [NEW] `src/app/api/menu/route.ts`
* Endpoint publik `GET /api/menu`:
  * Query parameters: `category` (opsional) dan `search` (opsional, maks 50 karakter).
  * Mengembalikan Envelope dengan daftar kategori (termasuk "Semua") dan item menu beserta modifier options.
  * Header `Cache-Control: no-cache, no-store, must-revalidate` untuk memastikan perubahan stok atau harga oleh staf langsung terefleksi tanpa stale cache.

---

### C. Manajemen State Keranjang & Modifier

#### [NEW] `src/lib/cart-context.tsx`
* State management keranjang belanja di tingkat client:
  * Struktur item keranjang:
    ```typescript
    interface CartItem {
      cartItemId: string; // Hash unik: `${menuItemId}:${modifierOptionIds.sort().join('-')}`
      menuItemId: string;
      name: string;
      basePrice: number;
      selectedModifiers: Array<{ optionId: string; groupName: string; optionName: string; price: number }>;
      notes?: string;
      quantity: number;
      itemSubtotal: number;
    }
    ```
  * Menegakkan aturan: item dengan modifier berbeda tidak boleh digabungkan.
  * Menyimpan nomor meja aktif pelanggan dan status validitas meja.
  * Sinkronisasi lokal ke `sessionStorage` / `localStorage` agar tidak hilang saat refresh halaman.

---

### D. Komponen Antarmuka Katalog & Modifier

#### [NEW] `src/components/menu/table-status-banner.tsx`
* Banner peringatan di atas katalog:
  * Muncul jika pelanggan membuka katalog tanpa meja terdeteksi (*Read-Only Mode*) atau dengan meja tidak valid.
  * Menampilkan pesan ramah: *"Mode Baca Menu: Meja belum terdeteksi. Silakan pindai QR di meja kafe untuk memesan."*
  * Tombol pemicu dialog bantuan staf / info pemindaian.

#### [NEW] `src/components/menu/category-nav.tsx`
* Bar navigasi kategori melekat (*sticky pill tabs*):
  * Menampilkan tab: `Semua`, `Kopi`, `Non-Kopi`, `Makanan`.
  * Indikator tab aktif dengan warna terakota `#924805`.
  * Smooth horizontal scroll dan target sentuh $\ge 44$ px.

#### [NEW] `src/components/menu/menu-search-bar.tsx`
* Kotak pencarian instan:
  * Input teks dengan ikon pencarian, tombol hapus (*clear button*), dan placeholder: *"Cari kopi, pastry, atau makanan..."*.
  * Integrasi debounce 250ms untuk pengalaman pencarian yang halus.

#### [NEW] `src/components/menu/menu-card.tsx`
* Komponen kartu menu grid 2-kolom mobile:
  * Foto produk rasio 1:1 (`aspect-square`), sudut `rounded-DEFAULT`, object-cover.
  * Badge *"Favorit"* jika `isPopular === true`.
  * Nama menu (`line-clamp-1`, semibold) dan deskripsi singkat (`line-clamp-2`, warna `on-surface-variant`).
  * Harga rupiah tabular: `Rp28.000` (`font-price-tabular tabular-nums`).
  * **State Sold Out:**
    * Opasitas kartu turun ke $45\%$.
    * Filter foto `filter: grayscale(80%)`.
    * Badge abu-abu berlabel *"Habis"*.
    * Tombol aksi terkunci (`disabled`, `cursor-not-allowed`).
  * **Tombol Aksi:**
    * Jika memiliki modifier: tombol `+` membuka `ProductModifierSheet`.
    * Jika tidak memiliki modifier: tombol `+` menambahkan item langsung atau menampilkan stepper inline kapsul hitam `#241E1B`.

#### [NEW] `src/components/menu/product-modifier-sheet.tsx`
* Bottom Sheet drawer untuk pemilihan kustomisasi menu:
  * Header: Foto thumbnail, nama menu, dan harga dasar.
  * Pilihan Varian Tunggal (Radio): Tingkat Kemanisan (Normal 100%, Less 70%, Slightly 30%, No Sugar 0%) dan Pilihan Es (Normal, Less, No Ice).
  * Pilihan Tambahan (Checkbox): Pilihan Susu (Oat Milk +Rp8.000, Almond Milk +Rp8.000) dan Extra Shot Espresso (+Rp6.000).
  * Textarea catatan barista (maks 100 karakter).
  * Sticky footer: Tombol lebar penuh berlatar `#924805` berlabel: *"Tambah ke Pesanan — Rp36.000"* (menghitung kalkulasi harga secara seketika).

#### [NEW] `src/components/menu/floating-order-tray.tsx`
* Dock keranjang belanja melayang di bagian bawah layar:
  * Melayang di atas bottom navigation bar dengan clearance aman (`bottom-16` atau diselaraskan).
  * Menampilkan pil kuantitas: `2 item`, total subtotal rupiah `Rp56.000` (tabular), dan tombol `Lihat Keranjang`.
  * Otomatis muncul dengan animasi slide-up jika keranjang berisi $\ge 1$ item, dan otomatis sembunyi jika kosong.

---

### E. Halaman Rute Pelanggan

#### [MODIFY] [`src/app/(customer)/order/page.tsx`](file:///d:/project/project-qr/cravio/src/app/(customer)/order/page.tsx)
* Merevisi total halaman pintu masuk `/order?table=XX`:
  * Mengambil `searchParams.table`.
  * Menjalankan `validateTableServer` ke PostgreSQL.
  * Jika valid: set cookie `cravio_table` dan alihkan ke `/menu?table=${tableNumber}`.
  * Jika missing, not found, atau inactive: tampilkan layar status meja yang informatif dan jujur dengan tombol *"Pindai Ulang"* dan tombol *"Lihat Menu (Mode Baca)"*, tanpa memilih meja palsu secara diam-diam.
  * Menghapus seluruh tombol demo lama ("Gunakan Meja Demo (Meja 01)").

#### [MODIFY] [`src/app/(customer)/menu/page.tsx`](file:///d:/project/project-qr/cravio/src/app/(customer)/menu/page.tsx)
* Merevisi total halaman `/menu`:
  * Menghapus hardcoded mock items dan hardcoded `table || '07'`.
  * Mengambil data nyata dari `getCatalogData` di server atau via `/api/menu`.
  * Memvalidasi nomor meja dari query param atau cookie.
  * Merender Search Bar, Category Tabs, Grid 2 Kolom Menu, Modifier Drawer, dan Floating Order Tray.
  * Menampilkan state: 6 Skeleton Card saat loading, EmptyState saat pencarian tidak menemukan hasil, dan ErrorState jika koneksi gagal.

---

### F. Pengujian Otomatis

#### [NEW] `tests/unit/table-validation.test.ts`
* Unit test untuk logika validasi meja:
  * Memverifikasi meja valid & aktif menghasilkan status `VALID`.
  * Memverifikasi parameter tidak ada menghasilkan status `MISSING`.
  * Memverifikasi meja acak yang tidak terdaftar menghasilkan status `NOT_FOUND`.
  * Memverifikasi meja nonaktif menghasilkan status `INACTIVE`.
  * Memverifikasi fungsi tidak pernah menyetel meja fallback secara diam-diam.

#### [NEW] `tests/unit/menu-catalog.test.ts`
* Unit test untuk pengolahan katalog dan keranjang:
  * Memverifikasi kategori "Semua" menggabungkan seluruh item menu dari semua kategori.
  * Memverifikasi filter pencarian berbasis teks (nama dan deskripsi menu).
  * Memverifikasi format harga integer IDR tanpa sen.
  * Memverifikasi pemisahan item keranjang dengan modifier berbeda (hash uniqueness).
  * Memverifikasi pencegahan pemesanan menu yang berstatus `isAvailable: false`.

#### [NEW] `tests/integration/menu-catalog-api.test.ts`
* Pengujian integrasi API dengan database PostgreSQL Neon:
  * `GET /api/tables/07` $\rightarrow$ Return 200 OK dengan data Meja 07.
  * `GET /api/tables/99` $\rightarrow$ Return 404 dengan kode `TABLE_NOT_FOUND`.
  * `GET /api/menu` $\rightarrow$ Return 200 OK memuat minimal 18 menu SELA, 3 kategori riil + 1 tab Semua, dan opsi modifier.
  * Verifikasi kueri filter kategori `?category=kopi` dan pencarian `?search=aren`.

---

## 6. Rencana Verifikasi (Verification Plan)

### A. Pengujian Otomatis (Automated Tests)
1. `pnpm run test tests/unit`
   * Menjalankan seluruh unit test (fondasi, RBAC, UI components, dan modul baru table-validation & menu-catalog).
2. `pnpm run test:integration tests/integration/menu-catalog-api.test.ts`
   * Menjalankan pengujian endpoint API meja dan katalog langsung terhadap database.
3. `pnpm run typecheck`
   * Memastikan tidak ada kesalahan tipe TypeScript strict (`0 errors`).
4. `pnpm run lint`
   * Memastikan kebersihan sintaks ESLint Next.js 15.
5. `pnpm run build`
   * Memastikan kompilasi produksi seluruh halaman App Router sukses tanpa error.

### B. Verifikasi Manual (Manual Verification)
1. **Pemeriksaan Skenario Meja:**
   * Buka `/order?table=07`: Pastikan berhasil divalidasi dan diarahkan ke `/menu?table=07` dengan badge Meja 07.
   * Buka `/order?table=99` (tidak terdaftar): Pastikan muncul pesan ramah "Nomor Meja 99 Tidak Terdaftar" dan checkout terkunci.
   * Buka `/order` (tanpa param): Pastikan muncul pesan instruksi pemindaian ulang.
   * Buka `/menu` langsung (tanpa param): Pastikan mode baca aktif dengan banner peringatan dan tombol pesan terkunci.
2. **Pemeriksaan Filter Kategori & Pencarian:**
   * Klik tab *Kopi*: Menampilkan hanya menu kategori kopi.
   * Klik tab *Semua*: Menampilkan gabungan seluruh menu.
   * Ketik "aren" di search bar: Hanya menampilkan menu dengan kata aren secara seketika.
   * Ketik kata acak "xyz123": Menampilkan `EmptyState` dengan tombol reset pencarian.
3. **Pemeriksaan Stok Sold Out:**
   * Temukan menu berstatus habis (atau simulasikan `isAvailable: false`): Pastikan foto grayscale $80\%$, ada badge *Habis*, dan tombol tambah terkunci.
4. **Pemeriksaan Modifier & Keranjang:**
   * Klik menu yang memiliki varian: Pastikan `ModifierBottomSheet` terbuka, pilih Less Sweet dan Oat Milk (+Rp8.000), pastikan subtotal terhitung akurat.
   * Tambahkan varian berbeda dari menu yang sama: Pastikan di keranjang tersimpan sebagai dua baris terpisah dengan rincian modifier masing-masing.

---

## 7. Status Tahapan Proyek

Setelah seluruh berkas selesai diimplementasikan dan diverifikasi:
* Status **Tahap 07** di [`docs/implementation-progress.md`](file:///d:/project/project-qr/cravio/docs/implementation-progress.md) akan diubah menjadi **PASS**.
* Dokumen walkthrough terperinci akan dimutakhirkan di [`walkthrough.md`](file:///C:/Users/ardhi/.gemini/antigravity/brain/c671d52e-b4af-44b8-8a27-047d47235bad/walkthrough.md).

