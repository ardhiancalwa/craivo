# Rencana Kerja: Panel Admin Menu, Kategori, Modifier, & Manajemen Katalog (Tahap 17)

## 1. Goal Description

Membangun modul manajemen katalog menu, kategori, modifier group/options, dan tag kurasi lengkap pada rute `/staff/admin` (dan `/admin`) yang hanya dapat diakses oleh peran berwenang (`ADMIN`). Menyediakan kemampuan tambah menu baru, edit rincian menu (nama, deskripsi, harga integer IDR, kategori, tag rasa/suasana/format, badge Best Seller, urutan tampilan, grup modifier), toggle ketersediaan stok (*Available* / *Sold Out*), serta pengarsipan menu (*soft-delete*).

Seluruh validasi dieksekusi secara ketat di sisi server: foto maksimal 2 MB dengan inspeksi *magic bytes* biner sebenarnya (JPG, PNG, WebP) dan parsing dimensi/batas pemrosesan (mencegah *decompression bomb*, SVG/HTML/script *polyglot*); penamaan objek acak kriptografis (UUID); dan arsitektur penyimpanan gambar yang aman untuk *serverless* tanpa menulis ke *filesystem* sementara (`/tmp`) dan tanpa memberikan *service role key* ke peramban client. Penggantian foto menerapkan aturan pembersihan objek usang yang cerdas agar tidak merusak aset yang masih digunakan.

Perubahan harga, stok, dan konfigurasi mencatat aktor staf, stempel waktu, dan konteks perubahan secara persisten pada `AuditLog`, serta menyiarkan invalidasi *real-time* ke kanal publik `CATALOG`. Pengarsipan menu menjamin integritas kekal transaksi historis, *snapshot* struk, dan pembayaran, sementara checkout server seketika menolak item/opsi yang telah diarsipkan atau habis.

---

## 2. User Review Required

> [!IMPORTANT]
> **1. Hak Akses Toggle Stok Barista KDS vs Hak Admin Penuh:**
> Sesuai ketetapan `ADR-0007` (Seksi 3.2 `OPN-02`), peran `BARISTA` dan `CASHIER` tetap memiliki wewenang sakelar cepat ketersediaan stok (`isAvailable`) pada menu item di KDS dapur (`PATCH /api/staff/menu/[id]/stock`) demi responsivitas jam sibuk kafe (*rush hour*). Namun, untuk mutasi CRUD menu (tambah, edit, arsip), perubahan harga, upload foto, pengelolaan kategori, dan konfigurasi modifier group/options, hak akses **DITETAPKAN SECARA EKSKLUSIF DAN KETAT HANYA UNTUK ROLE `ADMIN`**. Percobaan akses oleh `BARISTA`, `CASHIER`, atau tamu publik akan langsung ditolak dengan HTTP `401 Unauthorized` atau `403 Forbidden`.

> [!IMPORTANT]
> **2. Arsitektur Penyimpanan Foto Menu Tanpa Filesystem Sementara & Tanpa Bocor Kredensial:**
> Lingkungan *serverless* (seperti Vercel) memiliki *ephemeral read-only filesystem* di mana penyimpanan ke `/tmp` atau folder lokal akan hilang setelah fungsi selesai dieksekusi. Memberikan *service role key* cloud ke peramban juga dilarang keras karena membahayakan seluruh bucket.  
> Untuk memenuhi batasan ini secara deterministik dan mandiri:
> - Validasi gambar dilakukan di memori serverless buffer (`image-validator.ts`).
> - Data gambar biner yang valid disimpan secara persisten di tabel database `MenuImage` (`data Bytes`, `mimeType String`, `size Int`, `width Int`, `height Int`, `hash String`) dan disajikan secara aman via route `GET /api/images/[filename]` dengan header caching kuat (`Cache-Control: public, max-age=31536000, immutable`).
> - Jika kredensial bucket eksternal (`SUPABASE_STORAGE_URL` & `SUPABASE_SERVICE_ROLE_KEY`) dikonfigurasi di server, service secara modular mendukung penyimpanan langsung ke bucket storage.
> - Mekanisme ini 100% tahan uji di lingkungan lokal, CI/CD, maupun *serverless deployment* tanpa bergantung pada disk lokal sementara.

---

## 3. Open Questions

Tidak ada isu pemblokir (*zero blockers*). Seluruh kontrak skema data (`MenuItem`, `Category`, `Tag`, `ModifierGroup`, `ModifierOption`, `MenuItemTag`, `MenuItemModifierGroup`) telah terdefinisi di Prisma dan siap dieksekusi.

---

## 4. Proposed Changes

### Komponen 1: Skema Database & Migrasi Prisma

#### [MODIFY] `prisma/schema.prisma`
- Menambahkan field `sortOrder Int @default(0)` dan indeks `@@index([categoryId, sortOrder])` pada model `MenuItem`.
- Menambahkan model `MenuImage` untuk penyimpanan objek gambar yang persisten dan aman:
  ```prisma
  model MenuImage {
    id             String   @id @default(cuid())
    filename       String   @unique // misal: "menu-7f8b9a2c-d4e5-4a6b-8c7d-9e0f1a2b3c4d.webp"
    mimeType       String   // "image/webp", "image/jpeg", "image/png"
    data           Bytes    // Raw binary buffer
    size           Int      // Ukuran byte
    width          Int      // Dimensi lebar
    height         Int      // Dimensi tinggi
    hash           String   // SHA-256 hash untuk dedup
    createdAt      DateTime @default(now())
    updatedAt      DateTime @updatedAt

    @@index([hash])
    @@map("menu_images")
  }
  ```
- Menjalankan `pnpm exec prisma db push` untuk memperbarui PostgreSQL Neon.

---

### Komponen 2: Mesin Validasi Gambar & Service Penyimpanan

#### [NEW] `src/lib/server/image-validator.ts`
- Memeriksa batas ukuran berkas $\le 2$ MB (`2 * 1024 * 1024` bytes). Jika lebih besar, tolak dengan kode `FILE_TOO_LARGE`.
- Memeriksa *magic bytes* biner sebenarnya dari buffer:
  - JPEG: `0xFF, 0xD8, 0xFF`
  - PNG: `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`
  - WebP: `0x52, 0x49, 0x46, 0x46` (RIFF) ... `0x57, 0x45, 0x42, 0x50` (WEBP)
  - Menolak seluruh berkas selain 3 tipe tersebut (termasuk SVG, HTML, PHP, EXE, dan polyglot).
- Parsing dimensi biner tanpa ketergantungan library native C++:
  - PNG: Ekstraksi lebar dan tinggi 32-bit big-endian dari chunk IHDR (byte 16–23).
  - JPEG: Ekstraksi marker frame SOF0/SOF2 (byte 0xFF, 0xC0/0xC2).
  - WebP: Ekstraksi chunk VP8 / VP8L / VP8X.
- Batasan dimensi & pemrosesan aman:
  - Lebar minimal: 100px, Tinggi minimal: 100px.
  - Lebar maksimal: 4000px, Tinggi maksimal: 4000px (mencegah *pixel flood* / *decompression bomb*).

#### [NEW] `src/lib/server/storage-service.ts`
- Generator nama objek acak kriptografis: `menu-${randomUUID()}.${ext}`.
- Fungsi `saveMenuImage(buffer, validation)`: Menyimpan data ke `MenuImage` (atau Supabase Storage jika dikonfigurasi).
- Fungsi `cleanupOldImage(oldImageUrl)`:
  - Memeriksa apakah `oldImageUrl` adalah aset yang dikelola (misal `/api/images/...`).
  - Memeriksa apakah masih ada menu lain (`MenuItem.count({ where: { image: oldImageUrl } })`) yang menggunakan URL tersebut.
  - Jika tidak ada referensi lain dan bukan aset *starter seed*, hapus data objek lama dengan aman.

#### [NEW] `src/app/api/images/[filename]/route.ts`
- Endpoint publik edge-cached untuk menyajikan gambar:
  - Menemukan record `MenuImage` berdasarkan `filename`.
  - Mengembalikan stream respons biner dengan header:
    - `Content-Type: image.mimeType`
    - `Content-Length: image.size`
    - `Cache-Control: public, max-age=31536000, immutable`
  - Mengembalikan `404 Not Found` jika tidak ditemukan.

---

### Komponen 3: Backend API Rute Admin Menu & Kategori

#### [NEW] `src/app/api/staff/admin/upload/route.ts`
- `POST /api/staff/admin/upload`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Verifikasi CSRF origin.
  - Membaca `multipart/form-data` dengan field `file`.
  - Menjalankan `validateImageBuffer`.
  - Menyimpan via `saveMenuImage`.
  - Mengembalikan `{ url, filename, size, width, height }`.

#### [NEW] `src/app/api/staff/admin/menu/route.ts`
- `GET /api/staff/admin/menu`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Mengambil seluruh menu (termasuk filter opsional `includeArchived=true`, `categoryId`), beserta kategori, tags, dan modifier groups.
- `POST /api/staff/admin/menu`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Validasi Zod: `name` (3–100 char), `description` (10–500 char), `price` (integer IDR positif $\ge 1000$), `categoryId`, `image` (opsional), `isPopular` (boolean), `sortOrder` (int), `tagIds` (array string), `modifierGroupIds` (array string).
  - Mutasi Prisma: Membuat `MenuItem`, menghubungkan `MenuItemTag` dan `MenuItemModifierGroup`.
  - Audit log: `CREATE_MENU_ITEM` mencatat ID staf, username, nama menu, harga, dsb.
  - Realtime: Menerbitkan event `MENU_CREATED` ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/menu/[id]/route.ts`
- `GET /api/staff/admin/menu/[id]`: Mengambil detail satu menu untuk form edit.
- `PUT /api/staff/admin/menu/[id]`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Validasi input Zod.
  - Mengambil data lama menu: jika `image` berubah, panggil `cleanupOldImage(oldMenu.image)`.
  - Transaksi Prisma: Memperbarui field menu, menyelaraskan relasi `tags` (delete & re-insert) dan `modifierGroups` (delete & re-insert).
  - Audit log: `UPDATE_MENU_ITEM` mencatat rincian perubahan (sebelum vs sesudah).
  - Realtime: Menerbitkan `MENU_UPDATED` (dan `PRICE_CHANGED` jika harga berubah) ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/menu/[id]/archive/route.ts`
- `PATCH /api/staff/admin/menu/[id]/archive`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Transaksi Prisma: Set `isArchived: true, isAvailable: false, deletedAt: new Date()`.
  - **Invarian:** Dilarang menghapus baris tabel `menu_items` (mencegah rusaknya relasi historis order/struk).
  - Audit log: `ARCHIVE_MENU_ITEM`.
  - Realtime: Menerbitkan `MENU_ARCHIVED` ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/menu/[id]/restore/route.ts`
- `PATCH /api/staff/admin/menu/[id]/restore`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Transaksi Prisma: Set `isArchived: false, deletedAt: null`.
  - Audit log: `RESTORE_MENU_ITEM`.
  - Realtime: Menerbitkan `MENU_UPDATED` ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/menu/[id]/popular/route.ts`
- `PATCH /api/staff/admin/menu/[id]/popular`:
  - RBAC: `requireStaffRole(['ADMIN'])`.
  - Toggle `isPopular: boolean`.
  - Audit log: `TOGGLE_BEST_SELLER`.
  - Realtime: Menerbitkan `MENU_UPDATED` ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/categories/route.ts` & `[id]/route.ts`
- CRUD Kategori khusus `ADMIN`:
  - `GET /api/staff/admin/categories`: Daftar kategori dengan hitungan menu aktif.
  - `POST /api/staff/admin/categories`: Tambah kategori (`name`, `slug`, `sortOrder`).
  - `PUT /api/staff/admin/categories/[id]`: Edit nama dan urutan kategori.
  - `DELETE /api/staff/admin/categories/[id]`: Hapus kategori **HANYA JIKA** tidak ada menu yang terhubung.
  - Realtime: Menerbitkan `CATEGORY_UPDATED` ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/modifiers/route.ts` & `options/route.ts`
- Pengelolaan Modifier Group & Options khusus `ADMIN`:
  - `GET /api/staff/admin/modifiers`: Daftar grup modifier beserta opsi-opsinya.
  - `POST /api/staff/admin/modifiers`: Tambah grup modifier (`name`, `isRequired`, `minSelect`, `maxSelect`).
  - `PUT /api/staff/admin/modifiers/[id]`: Edit grup modifier.
  - `POST /api/staff/admin/modifiers/[id]/options`: Tambah opsi (`name`, `price` integer IDR, `isAvailable`).
  - `PUT /api/staff/admin/modifiers/options/[optionId]`: Edit opsi modifier.
  - `PATCH /api/staff/admin/modifiers/options/[optionId]/stock`: Toggle ketersediaan opsi modifier (`isAvailable`).
  - Realtime: Menerbitkan `MODIFIER_UPDATED` ke kanal `CATALOG`.

#### [NEW] `src/app/api/staff/admin/tags/route.ts`
- `GET /api/staff/admin/tags`: Mengambil master daftar tag kurasi (dikelompokkan berdasarkan dimensi `FLAVOR`, `MOOD`, `FORMAT`) untuk opsi pilihan tag di formulir menu.

---

### Komponen 4: Antarmuka Panel Admin SELA (`/staff/admin`)

#### [MODIFY] `src/app/(staff)/staff/admin/page.tsx`
- Mengembangkan halaman panel admin menjadi dasbor manajemen katalog interaktif:
  - Header: Identitas resmi SELA Admin, status staf yang bertugas, badge `ADMIN`, tombol navigasi cepat ke POS dan KDS, serta tombol Logout.
  - Navigasi Tab Utama:
    1. **Katalog Menu:** Manajemen menu lengkap, filter kategori, filter status (Aktif / Diarsipkan), tombol Tambah Menu Baru.
    2. **Kategori:** Manajemen nama kategori dan urutan tampilan.
    3. **Grup Modifier:** Manajemen kustomisasi (Gula, Es, Susu, Add-on) dan opsi harga.
  - Mengintegrasikan komponen klien `AdminDashboardClientView`.

#### [NEW] `src/app/(staff)/staff/admin/admin-client-view.tsx`
- Komponen klien interaktif dengan fitur:
  - **Tabel & Kartu Menu:**
    - Thumbnail gambar produk (dengan fallback icon).
    - Nama, kategori, harga dalam format IDR tabular.
    - Switcher cepat ketersediaan stok (`Ada` / `Habis`) dengan **Optimistic Update & Auto-Rollback** jika server menolak.
    - Switcher cepat status Best Seller (`isPopular`) dengan optimistic update & rollback.
    - Tombol Edit (membuka modal formulir lengkap).
    - Tombol Arsipkan / Pulihkan dengan dialog konfirmasi.
  - **Modal Formulir Menu (Tambah & Edit):**
    - Input nama menu (min 3 karakter).
    - Dropdown kategori.
    - Input harga integer rupiah (dengan validasi angka murni tanpa desimal).
    - Textarea deskripsi menu.
    - **Komponen Upload Foto:**
      - Dropzone drag & drop, file picker (.jpg, .jpeg, .png, .webp).
      - Indikator ukuran file (maks 2MB) dan preview instan.
      - Unggah langsung ke endpoint `/api/staff/admin/upload`.
      - Tombol hapus/ganti foto.
    - Multi-select Tag Pills (Rasa, Suasana, Format).
    - Checkbox pilihan grup modifier yang ditugaskan ke menu ini.
    - Input urutan tampilan (`sortOrder`).
    - Pesan error server yang ramah dan jelas.
  - **Modal Formulir Kategori:** Tambah dan edit nama/urutan kategori.
  - **Modal Formulir Modifier & Options:** Tambah grup modifier baru dan opsi harga tambahannya.

#### [NEW] `src/app/(staff)/admin/page.tsx`
- Redirect otomatis dari rute `/admin` ke `/staff/admin` demi kemudahan navigasi staf.

---

## 5. Verification Plan

### Automated Tests
Pengujian otomatis dijalankan secara ketat menggunakan Vitest (Unit & Live Neon Integration Suite):

```powershell
# 1. Unit Tests: Validasi Gambar (Maks 2MB, Magic Bytes, Bounds Dimensi)
pnpm run test tests/unit/image-validator.test.ts

# 2. Integration Tests: Admin Menu, Kategori, Modifier, Upload, & Otorisasi
pnpm run test tests/integration/admin-catalog-management.test.ts

# 3. Regresi Seluruh Suite Test (Unit & Integrasi Live DB)
pnpm run test tests/unit
pnpm run test tests/integration --fileParallelism=false

# 4. TypeScript Strict Compilation Check
pnpm run typecheck

# 5. ESLint Linter Check
pnpm exec eslint src tests/unit/image-validator.test.ts tests/integration/admin-catalog-management.test.ts

# 6. Next.js Production Build
pnpm run build
```

### Skenario Pengujian yang Dicakup
1. **RBAC Security Guard:**
   - Permintaan tanpa token $\rightarrow$ 401 Unauthorized.
   - Permintaan dengan token `BARISTA` atau `CASHIER` ke rute admin $\rightarrow$ 403 Forbidden.
   - Permintaan dengan token `ADMIN` $\rightarrow$ 200 OK diizinkan.
2. **Validasi Foto & Upload Keamanan:**
   - Berkas ukuran $> 2$ MB ditolak dengan HTTP 400 `FILE_TOO_LARGE`.
   - Berkas dengan ekstensi `.jpg` palsu (misal berisi teks/script/HTML) ditolak karena *magic bytes* tidak sah.
   - Berkas dengan dimensi $< 100\times 100$px atau $> 4000\times 4000$px ditolak.
   - Berkas JPG/PNG/WebP asli berukuran aman diproses dengan nama UUID acak dan disimpan dengan benar.
3. **Pembersihan Foto Lama & Preservasi Aset Digunakan:**
   - Mengganti foto menu dengan foto baru menghapus objek lama dari storage database jika tidak ada menu lain yang menggunakannya.
   - Jika foto lama juga dipakai oleh menu lain, foto lama tidak dihapus.
   - Foto starter seed bawaan tidak dihapus.
4. **CRUD Menu & Pengarsipan:**
   - Admin membuat menu baru dengan harga integer IDR, tag, dan grup modifier $\rightarrow$ tersimpan di DB dan muncul di katalog publik `/order/menu`.
   - Admin mengubah harga menu $\rightarrow$ tercatat di `AuditLog UPDATE_MENU_ITEM`, event `PRICE_CHANGED` dipublikasikan ke kanal `CATALOG`.
   - Admin mengarsipkan menu $\rightarrow$ `isArchived = true`, menu seketika hilang dari katalog pelanggan dan rekomendasi kuis.
   - Riwayat pesanan lama (`OrderItem`, `PaymentAttempt`, `PrintLog`, struk thermal) yang memuat menu tersebut tetap 100% utuh tanpa eror (*zero data loss*).
   - Checkout pelanggan dengan keranjang yang memuat menu yang baru saja diarsipkan $\rightarrow$ server menolak transaksi dengan HTTP 404/409.
5. **Optimistic Updates & Rollback:**
   - Simulasi kegagalan server saat toggle stok $\rightarrow$ UI mengembalikan (*rollback*) state sakelar ke kondisi semula dan menampilkan notifikasi kesalahan.

