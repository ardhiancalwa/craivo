# Rencana Kerja: Konfigurasi Kuis, Pengaturan Finansial, Laporan Omzet, & Audit Trail (Tahap 18)

## 1. Goal Description

Melengkapi modul administrasi kafe di luar CRUD katalog menu untuk memenuhi seluruh kebutuhan yang tercantum pada PRD (`REQ-ADMIN-05`, `REQ-ADMIN-06`, `REQ-ADMIN-07`), *agent instructions*, dan *design system*:

1. **Manajemen Kuis Preferensi Rasa Dinamis (`REQ-ADMIN-06`):**
   * Pengaturan label pertanyaan dan opsi, status aktivasi (*active/inactive*), urutan (*stepNumber / sortOrder*), pemetaan tag preferensi (*flavor, mood, format*), dan pembobotan (*weight*) dengan baseline awal 3 langkah sesuai `ADR-0006`.
   * Validasi konfigurasi ketat anti-*crash* (mencegah kondisi 0 pertanyaan aktif, pertanyaan tanpa opsi, atau opsi tanpa tag).
   * Sistem *versioning* (`quizVersion`) dan penanganan anggun (*graceful fallback*) saat konfigurasi kuis diperbarui ketika pelanggan sedang mengisi kuis di meja (*in-flight quiz handling*).

2. **Pengaturan Identitas & Kebijakan Finansial Pajak / Layanan (`REQ-ADMIN-05`, `REQ-ADMIN-08`):**
   * Pengaturan identitas resmi SELA (nama kafe, tagline, alamat Senopati, nomor kontak, jam operasional, zona waktu `Asia/Jakarta`).
   * Kebijakan pajak PB1 dan biaya layanan (*service charge*) dengan nilai bawaan awal **0%** (*Nett All-Inclusive baseline*).
   * Formulasi matematis resmi dan pembulatan *integer* server untuk **Mode Eksklusif** dan **Mode Inklusif**, penyajian rincian transparan sebelum *checkout*, serta penguncian *snapshot* permanen pada pesanan.
   * Perubahan kebijakan finansial wajib melalui wewenang eksklusif `ADMIN` dengan pencatatan `AuditLog FINANCIAL_POLICY_UPDATED`.

3. **Laporan Penjualan, Omzet Harian, & Rekap Transaksi (`REQ-ADMIN-07`):**
   * Agregasi omzet harian dengan batas waktu pergantian hari **WIB (`Asia/Jakarta`)** yang tepat terhadap *timestamp* UTC database (mencegah pergeseran transaksi malam hari jam 23:30 vs 00:30 WIB).
   * Definisi finansial presisi: **Gross Receipts** (seluruh order `PAID` termasuk yang pemenuhannya *cancelled*), **Completed Manual Refunds** (total pengembalian tunai fisik dari kasir), dan **Net Turnover** ($\text{Gross} - \text{Refund}$).
   * Pengecualian tegas pesanan `UNPAID`, `WAITING_CASHIER`, `PENDING`, dan `EXPIRED` dari omzet.
   * Rincian metode pembayaran (QRIS vs Tunai), item terlaris (*top-selling items*), dan daftar transaksi terpaginasi (*date/status/method filters*).

4. **Ekspor CSV Aman & Audit Trail Tersanitasi (`REQ-ADMIN-09`, `REQ-ADMIN-10`):**
   * Ekspor laporan transaksi ke berkas CSV standar RFC 4180 dengan **Proteksi Formula Injection (CWE-1236)** pada seluruh teks input pengguna/staf.
   * Penampil log audit aktivitas (*price change, stock toggle, cash confirm, cancellation, manual refund, status transition, print attempt, config change*) yang bersifat *append-only*.
   * **Sanitasi Kredensial Sensitif:** Menyaring dan menyembunyikan token rahasia (`orderSecretToken`, hash password/PIN, kunci API gateway, token sesi) dari respons audit log.

---

## 2. User Review Required

> [!IMPORTANT]
> **1. Formula Matematis Pajak & Service (Inklusif vs Eksklusif):**
> - **Mode Eksklusif (`isTaxInclusive: false`):**
>   $$\text{Service} = \text{round}\left(\text{Subtotal} \times \frac{\text{serviceRateBps}}{10000}\right)$$
>   $$\text{Tax (PB1)} = \text{round}\left((\text{Subtotal} + \text{Service}) \times \frac{\text{taxRateBps}}{10000}\right)$$
>   $$\text{Total} = \text{Subtotal} + \text{Service} + \text{Tax}$$
> - **Mode Inklusif (`isTaxInclusive: true`):**
>   Harga di katalog menu sudah merupakan total bersih all-inclusive yang dibayar pelanggan. Untuk pelaporan & struk:
>   $$\text{Net Base} = \text{round}\left(\frac{\text{Subtotal}}{1 + \frac{\text{serviceRateBps} + \text{taxRateBps}}{10000}}\right)$$
>   $$\text{Service} = \text{round}\left(\text{Net Base} \times \frac{\text{serviceRateBps}}{10000}\right)$$
>   $$\text{Tax} = \text{Subtotal} - \text{Net Base} - \text{Service}$$
>   $$\text{Total yang Ditagih} = \text{Subtotal}$$
> *Nilai bawaan SELA pilot tetap 0% (tidak otomatis menyalakan 10%/5% kecuali admin mengaktifkannya secara eksplisit).*

> [!IMPORTANT]
> **2. Batas Hari Bisnis Asia/Jakarta (UTC+7) vs UTC Database:**
> Database PostgreSQL menyimpan stempel waktu dalam UTC. Hari bisnis `"YYYY-MM-DD"` di Jakarta dihitung tepat dari:
> - Mulai: `YYYY-MM-DD 00:00:00.000+07:00` $\rightarrow$ UTC `[D-1] 17:00:00.000Z`
> - Selesai: `YYYY-MM-DD 23:59:59.999+07:00` $\rightarrow$ UTC `[D] 16:59:59.999Z`
> Transaksi pesanan jam 23:30 WIB pada tanggal 29 Oktober tetap tercatat di laporan tanggal 29 Oktober, bukan tanggal 30 Oktober.

> [!WARNING]
> **3. Penanganan Transisi Kuis In-Flight:**
> Jika seorang pelanggan sedang membuka layar kuis di meja lalu admin kafe mengubah opsi atau bobot kuis, saat pelanggan mengirim jawaban (`POST /api/quiz/recommend`):
> - Server memproses opsi-opsi yang valid.
> - Jika ada opsi yang baru dinonaktifkan, sistem tidak melempar error 500, melainkan mencocokkan sisa opsi atau mengeksekusi fallback Best Seller yang aman sesuai `ADR-0006`.

---

## 3. Open Questions

Tidak ada isu pemblokir (*zero blockers*). Seluruh model database yang dibutuhkan telah tersedia atau dapat diperluas secara non-destruktif.

---

## 4. Proposed Changes

### Komponen 1: Skema Database & Migrasi Prisma

#### [MODIFY] `prisma/schema.prisma`
- Menambahkan field pada `QuizQuestion`:
  - `isActive Boolean @default(true)`
  - `sortOrder Int @default(0)`
- Menambahkan field pada `QuizOption`:
  - `isActive Boolean @default(true)`
- Menambahkan field pada `CravioConfig`:
  - `isTaxInclusive Boolean @default(false)`
  - `openingHours String? @default("08:00 - 22:00 WIB")`
  - `quizVersion Int @default(1)`
- Sinkronisasi database via `pnpm exec prisma db push`.

---

### Komponen 2: Engine Kalkulasi Finansial, Timezone, & Keamanan CSV

#### [NEW] `src/lib/server/financial-calculator.ts`
- Implementasi formula resmi pajak & layanan:
  - `calculateOrderFinancials(subtotalAmount: number, config: FinancialConfig): CalculatedFinancials`
  - Mengembalikan `{ subtotalAmount, serviceAmount, taxAmount, totalAmount, netBaseAmount, isTaxInclusive, taxRateBps, serviceRateBps }`.
  - Pembulatan murni integer rupiah via `Math.round()`, bebas dari galat desimal float (`0.1 + 0.2`).
  - Menjamin invarian: $\text{Total} = \text{Subtotal} + \text{Service} + \text{Tax}$ (eksklusif) atau $\text{Total} = \text{Subtotal} = \text{Net Base} + \text{Service} + \text{Tax}$ (inklusif).

#### [MODIFY] `src/lib/server/quote-service.ts`
- Mengintegrasikan pembacaan konfigurasi aktif dari tabel `cravio_configs`.
- Menggunakan `calculateOrderFinancials` untuk menghitung `taxAmount`, `serviceAmount`, dan `totalAmount`.
- Menyertakan detail `financialBreakdown` di respons quote agar UI dapat menampilkan transparansi pajak/layanan sebelum checkout.

#### [NEW] `src/lib/server/timezone-utils.ts`
- Utilitas penanganan zona waktu `Asia/Jakarta`:
  - `getJakartaDayBoundaries(dateStr: string): { startUtc: Date, endUtc: Date }`
  - `getJakartaDateRangeBoundaries(startDateStr: string, endDateStr: string): { startUtc: Date, endUtc: Date }`
  - `formatJakartaDate(date: Date, formatPattern?: string): string`
  - `getJakartaNow(): Date`

#### [NEW] `src/lib/server/csv-exporter.ts`
- Sanitasi keamanan sel CSV terhadap serangan Formula Injection (CWE-1236):
  ```typescript
  export function sanitizeCsvCell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '""'
    let str = String(value)
    // Cegah eksekusi formula jika diawali =, +, -, @, tab, newline, %
    if (/^[=+\-@\t\r%]/.test(str)) {
      str = "'" + str
    }
    // Escape tanda kutip ganda
    str = str.replace(/"/g, '""')
    return `"${str}"`
  }
  ```
- Generator berkas CSV transaksi harian SELA (`generateTransactionsCsv`).

---

### Komponen 3: Service Laporan, Audit, Kuis, & Konfigurasi

#### [NEW] `src/lib/server/report-service.ts`
- `getTurnoverReport(startDateStr: string, endDateStr: string)`:
  - Mengonversi rentang tanggal ke batas UTC yang tepat via `timezone-utils`.
  - Query pesanan lunas (`paymentStatus === 'PAID'`) dalam rentang tanggal.
  - Query pengembalian dana selesai dari `manual_refund_records`.
  - Menghitung agregasi:
    - `grossReceipts`: Total rupiah pesanan lunas.
    - `totalRefunds`: Total rupiah refund manual selesai.
    - `netTurnover`: $\text{grossReceipts} - \text{totalRefunds}$.
    - `totalPaidOrders`: Jumlah transaksi lunas.
    - `breakdown`: Rincian per metode bayar (`QRIS`, `CASH`).
    - `topSellingItems`: Peringkat item menu terjual berdasarkan kuantitas & nominal.
- `getTransactionList(params: TransactionFilterParams)`:
  - Paginasi data transaksi (`page`, `limit`).
  - Filter: rentang tanggal, metode bayar, status pesanan, status refund.
  - Snapshot item, nominal, refund, status kasir, dan waktu WIB.

#### [NEW] `src/lib/server/audit-service.ts`
- `getSanitizedAuditLogs(params: AuditLogParams)`:
  - Mengambil daftar log dari `audit_logs` terurut terbaru (`createdAt DESC`).
  - Menyensor/menghapus token rahasia, credential, dan signature dari field `details`.
  - Filter berdasarkan tipe aksi (`action`), staf (`staffUserId`), dan rentang waktu.

#### [NEW] `src/lib/server/quiz-config-service.ts`
- `getAdminQuizConfig()`: Mengambil pertanyaan, opsi, pemetaan tag, dan bobot (termasuk yang non-aktif).
- `updateQuizConfig(payload)`:
  - Validasi: minimal 3 pertanyaan aktif, setiap pertanyaan minimal 2 opsi aktif, setiap opsi minimal 1 tag preferensi, bobot 1–10.
  - Transaksi Prisma: update pertanyaan, opsi, tag mapping, bobot.
  - Menaikkan `quizVersion` di `cravio_configs`.
  - Mencatat `AuditLog QUIZ_CONFIG_UPDATED`.
  - Menerbitkan event realtime `QUIZ_CONFIG_UPDATED` ke kanal `CATALOG`.

#### [NEW] `src/lib/server/config-service.ts`
- `getCafeConfig()`: Membaca konfigurasi kafe dan kebijakan finansial terkini.
- `updateCafeIdentity(payload)`: Update nama, tagline, alamat, telepon, jam buka.
- `updateFinancialPolicy(payload)`: Update tarif PB1 (`taxRateBps`), tarif layanan (`serviceRateBps`), dan mode inklusif (`isTaxInclusive`). Mencatat `AuditLog FINANCIAL_POLICY_UPDATED`.

#### [MODIFY] `src/lib/server/quiz-service.ts`
- Memperbarui `getQuizRecommendations(selectedOptionIds, clientQuizVersion)`:
  - Membaca opsi yang dipilih pelanggan dengan toleransi jika sebagian opsi baru dinonaktifkan.
  - Fallback aman ke rekomendasi Best Seller jika seluruh opsi tidak valid, tanpa melempar error 500.

---

### Komponen 4: Backend API Rute Admin

#### [NEW] `src/app/api/staff/admin/config/route.ts`
- `GET /api/staff/admin/config`: Ambil konfigurasi kafe lengkap (RBAC `ADMIN`).
- `PUT /api/staff/admin/config`: Update identitas kafe & kontak resmi (RBAC `ADMIN`, CSRF check).

#### [NEW] `src/app/api/staff/admin/config/financial/route.ts`
- `PUT /api/staff/admin/config/financial`: Update kebijakan pajak & service charge (RBAC `ADMIN`, CSRF check, `AuditLog`).

#### [NEW] `src/app/api/staff/admin/quiz/route.ts`
- `GET /api/staff/admin/quiz`: Ambil master data konfigurasi kuis lengkap (RBAC `ADMIN`).
- `PUT /api/staff/admin/quiz`: Update konfigurasi kuis dengan validasi anti-crash & version bump (RBAC `ADMIN`, CSRF check).

#### [NEW] `src/app/api/staff/admin/reports/turnover/route.ts`
- `GET /api/staff/admin/reports/turnover?startDate=...&endDate=...`: Ringkasan omzet harian (RBAC `ADMIN`).

#### [NEW] `src/app/api/staff/admin/reports/transactions/route.ts`
- `GET /api/staff/admin/reports/transactions?page=1&limit=10&...`: Daftar transaksi terpaginasi (RBAC `ADMIN`).

#### [NEW] `src/app/api/staff/admin/reports/export/route.ts`
- `GET /api/staff/admin/reports/export?startDate=...&endDate=...`: Unduh berkas CSV dengan proteksi formula injection (RBAC `ADMIN`, header `Content-Disposition: attachment`).

#### [NEW] `src/app/api/staff/admin/audit-logs/route.ts`
- `GET /api/staff/admin/audit-logs?page=1&limit=20&...`: Daftar audit log tersanitasi append-only (RBAC `ADMIN`).

---

### Komponen 5: Antarmuka Pengguna Panel Admin SELA (`/staff/admin`)

#### [MODIFY] `src/app/(staff)/staff/admin/admin-client-view.tsx`
- Memperluas tab navigasi di panel admin:
  1. **Tab Menu & Katalog:** (Fitur CRUD katalog, stok, dan foto dari Tahap 17).
  2. **Tab Konfigurasi Kuis:**
     - Tampilan 3 langkah kuis SELA (Suasana, Rasa, Format).
     - Formulir edit judul pertanyaan & deskripsi.
     - Pengaturan opsi kuis: label, icon, status aktif/non-aktif, pemetaan tag, dan input bobot (1–10).
     - Indikator versi kuis aktif (`Versi #N`).
     - Validasi real-time sebelum simpan (mencegah konfigurasi rusak).
  3. **Tab Pengaturan Kafe & Pajak:**
     - Kartu Identitas: Nama kafe, alamat Senopati, nomor telepon, jam operasional.
     - Kartu Kebijakan Finansial:
       - Switcher Mode Pajak: **Inklusif (Nett)** vs **Eksklusif (Plus-Plus)**.
       - Input tarif Pajak Restoran / PB1 (%) dan Biaya Layanan / Service (%).
       - Simulasi kalkulator harga instan: memperlihatkan perhitungan rincian pada pesanan contoh Rp50.000 secara transparan.
       - Tombol Simpan Kebijakan Finansial dengan konfirmasi keamanan.
  4. **Tab Laporan & Omzet:**
     - Date Range Picker (Hari Ini, 7 Hari Terakhir, 30 Hari Terakhir, Kustom).
     - 4 Kartu KPI: **Omzet Kotor (Gross)**, **Pengembalian (Refund)**, **Omzet Bersih (Net)**, **Total Transaksi Lunas**.
     - Diagram / Bar breakdown penerimaan: QRIS vs Tunai Kasir.
     - Tabel Item Terlaris (*Top Selling Items*).
     - Tabel Riwayat Transaksi: Nomor order, Meja, Waktu WIB, Metode, Status Pembayaran, Status Dapur, Total, Refund, Aksi detail.
     - Tombol **"📥 Unduh Laporan CSV"**.
  5. **Tab Audit Trail:**
     - Tabel log aktivitas kafe (Waktu WIB, Aktor, Aksi, Rincian, Alamat IP).
     - Filter berdasarkan aksi (Harga, Stok, Kasir, Void/Refund, Config).
     - Bebas dari kebocoran credential/token rahasia.

#### [MODIFY] `src/app/(customer)/order/cart/cart-client-view.tsx`
- Menampilkan rincian transparan sebelum checkout:
  - Subtotal Item
  - Biaya Layanan (jika > 0%)
  - Pajak Restoran PB1 (jika > 0%)
  - Total Pembayaran
  - Catatan status pajak: *"Harga sudah termasuk PB1 & Layanan"* (inklusif) atau *"Belum termasuk PB1 & Layanan"* (eksklusif).

---

## 5. Verification Plan

### Automated Tests
Pengujian otomatis dijalankan secara ketat menggunakan Vitest (Unit & Live Neon Integration Suite):

```powershell
# 1. Unit Tests: Kalkulator Finansial (Inklusif vs Eksklusif, Rounding, 0% Baseline)
pnpm run test tests/unit/financial-calculator.test.ts

# 2. Unit Tests: Utilitas Timezone Asia/Jakarta (Batas Hari, 23:30 vs 00:30 WIB)
pnpm run test tests/unit/timezone-utils.test.ts

# 3. Unit Tests: Keamanan Ekspor CSV (Proteksi Formula Injection CWE-1236, Escaping)
pnpm run test tests/unit/csv-exporter.test.ts

# 4. Unit Tests: Validasi Konfigurasi Kuis (Anti-Crash, Versioning, Fallback)
pnpm run test tests/unit/quiz-config-validator.test.ts

# 5. Integration Tests: Admin Kuis, Pajak, Laporan Omzet, CSV, & Audit Log (Live Neon DB)
pnpm run test tests/integration/admin-quiz-tax-reports.test.ts

# 6. Regresi Seluruh Suite Test (Unit & Integrasi Live DB)
pnpm run test tests/unit
pnpm run test tests/integration --fileParallelism=false

# 7. TypeScript Strict Compilation Check
pnpm run typecheck

# 8. ESLint Linter Check
pnpm exec eslint src tests/unit/financial-calculator.test.ts tests/unit/timezone-utils.test.ts tests/unit/csv-exporter.test.ts tests/integration/admin-quiz-tax-reports.test.ts

# 9. Next.js Production Build
pnpm run build
```

### Skenario Pengujian yang Dicakup
1. **RBAC Security Guard:**
   - Permintaan tanpa token $\rightarrow$ 401 Unauthorized.
   - Permintaan staf `BARISTA` atau `CASHIER` ke rute config/laporan admin $\rightarrow$ 403 Forbidden.
   - Permintaan `ADMIN` $\rightarrow$ 200 OK diizinkan.
2. **Kalkulasi Finansial Pajak/Layanan:**
   - Baseline 0% / 0% $\rightarrow$ Tax = 0, Service = 0, Total = Subtotal.
   - Mode Eksklusif (10% tax, 5% service pada Rp50.000) $\rightarrow$ Service = 2.500, Tax = 5.250, Total = 57.750 (integer bulat tanpa desimal).
   - Mode Inklusif (10% tax, 5% service pada Rp50.000) $\rightarrow$ Total dibayar pelanggan tetap Rp50.000, Net Base = Rp43.478, Service = Rp2.174, Tax = Rp4.348 ($\text{Net} + \text{Service} + \text{Tax} = 50.000$).
   - Snapshot tersimpan di tabel `orders` dan tidak berubah saat tarif diubah kemudian.
3. **Manajemen Kuis & Transisi In-Flight:**
   - Admin mengubah label opsi dan bobot $\rightarrow$ `quizVersion` naik, tersimpan di DB.
   - Penolakan config berbahaya (misal 0 opsi aktif) $\rightarrow$ HTTP 400 dengan pesan validasi jelas, kuis tidak crash.
   - Simulasi pelanggan mengirim opsi kuis lama saat versi kuis diperbarui $\rightarrow$ server memproses rekomendasi secara mulus atau fallback ke Best Seller.
4. **Laporan Penjualan & Batas Hari Asia/Jakarta:**
   - Transaksi dibuat pada `2026-10-29 23:30 WIB` (UTC: `2026-10-29 16:30Z`) dan `2026-10-30 00:30 WIB` (UTC: `2026-10-29 17:30Z`).
   - Filter laporan tanggal `2026-10-29` secara tepat hanya mencakup transaksi jam 23:30 WIB dan tidak mencampurkan transaksi jam 00:30 WIB.
   - Gross receipts mencakup seluruh pesanan `PAID` (meskipun fulfillment `CANCELLED`).
   - Order `UNPAID` / `WAITING_CASHIER` / `EXPIRED` tidak dihitung ke omzet.
   - Pengembalian dana selesai mengurangi omzet kotor menghasilkan nilai net yang cocok secara matematis.
5. **Keamanan Ekspor CSV & Sanitasi Audit Log:**
   - Pelanggan/staf memasukkan catatan diawali `=CMD('calc')`, `+62812`, `@SUM` $\rightarrow$ file CSV mengekspornya dengan tanda kutip `'=CMD('calc')` sehingga spreadsheet tidak mengeksekusinya sebagai rumus formula.
   - Endpoint audit log memfilter dan menyembunyikan seluruh token `orderSecretToken`, hash password/PIN, dan data sensitif perbankan.

