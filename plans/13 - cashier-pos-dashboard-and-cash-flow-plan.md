# Implementation Plan — Tahap 13: Dashboard Kasir POS & Alur Pembayaran Tunai

Rencana implementasi antarmuka kasir/admin `/pos`, konfirmasi uang masuk tunai atomik, alur pembatalan berizin, dan pencatatan refund manual faktual untuk **Cravio — Your craving, Perfectly Matched** (Pilot: **SELA Artisanal Coffee & Bake**).

---

## 1. Goal Description

Membangun sistem dan dashboard kasir operasional `/pos` yang aman, cepat, dan transparan untuk peran **`CASHIER`** dan **`ADMIN`** (peran `KITCHEN` ditolak):
1. **Pemisahan Antrean Visual yang Jelas**:
   - **Tab 1: Antrean Bayar Tunai (`WAITING_CASHIER`)**: Menampilkan daftar pesanan tunai yang belum lunas.
   - **Tab 2: Riwayat Transaksi Lunas (`PAID`)**: Menampilkan riwayat transaksi lunas (CASH & QRIS).
   - **Tab 3: Riwayat Batal & Refund Manual**: Menampilkan pesanan batal serta status penyelesaian refund fisik.
2. **Identifikasi Pesanan yang Tepat**:
   - Memilih pesanan berdasarkan **Nomor Order** (`orderNumber`, e.g. `SELA-261029-001`) dan **ID unik**, bukan semata nomor meja (karena satu meja dapat memiliki beberapa pesanan bertahap).
   - Menampilkan total snapshot resmi (Integer IDR), nama item, modifier, catatan khusus barista, metode bayar, status, dan durasi tunggu (*elapsed time* / *age*).
   - Tanpa auto-expiry sewenang-wenang 20 menit pada alur tunai; kasir memiliki kendali penuh sesuai kebijakan operasional kafe.
3. **Konfirmasi Uang Masuk Atomik & Nir-Klik Ganda**:
   - Dialog konfirmasi fisik yang jelas sebelum mutasi status.
   - Endpoint terproteksi `POST /api/staff/orders/[id]/confirm-cash` dengan verifikasi: order memang `CASH`, berstatus `WAITING_CASHIER`, belum dibatalkan/kedaluwarsa, dan belum lunas.
   - Mutasi atomik (`$transaction`): update `paymentStatus = PAID`, `paidAt = now`, buka gate antrean dapur `orderStatus = QUEUED`, buat record `PaymentAttempt (CASH, PAID)`, naikkan `soldCount`, terbitkan tepat satu `OutboxEvent ORDER_PAID`, dan catat `AuditLog CONFIRM_CASH`.
   - Idempoten: Klik ganda atau 2 kasir bersamaan tidak menggandakan omzet atau tiket dapur.
4. **Pembatalan Pesanan & Pencatatan Refund Manual V1**:
   - Endpoint terproteksi `POST /api/staff/orders/[id]/cancel` mewajibkan input alasan pembatalan (`reason: string`).
   - Role `KITCHEN` ditolak 403 Forbidden.
   - **Pesanan Belum Bayar**: dibatalkan (`orderStatus = CANCELLED`).
   - **Pesanan Sudah Bayar (`PAID`)**:
     - Status pembayaran **TETAP `PAID`** (uang faktual sudah masuk ke kas kafe, tidak boleh dihilangkan dari laporan omzet kas!).
     - Status pesanan `orderStatus = CANCELLED` (dapur berhenti memasak).
     - Dicatat pada tabel `ManualRefundRecord` dan `AuditLog` untuk penyelesaian pengembalian uang fisik kasir ke pelanggan.
     - **Tanpa Refund API Gateway** dan status tidak otomatis diubah ke *refunded* fiktif.

---

## 2. User Review Required

> [!IMPORTANT]
> **Invarian Finansial Pembatalan Pesanan yang Sudah Lunas**:
> Ketika pesanan yang sudah lunas (`PAID`) dibatalkan, status `paymentStatus` di database **TETAP `PAID`**, dan `orderStatus` menjadi `CANCELLED`. Hal ini menjamin bahwa penerimaan kas faktual tetap tercatat di pembukuan. Pengembalian uang fisik kepada pelanggan dicatat sebagai entitas terpisah pada tabel `manual_refund_records` (ManualRefundRecord) dengan referensi kasir, nominal, alasan, dan waktu pengembalian.

> [!WARNING]
> **Kebijakan Batas Waktu Tunggu Tunai**:
> Sesuai instruksi Anda, sistem **tidak menerapkan auto-expiry 20 menit** pada pesanan tunai. Kasir melihat *age* (durasi tunggu dalam menit/detik) dan memiliki wewenang manual untuk mengonfirmasi ketika pelanggan tiba di meja kasir atau membatalkannya jika pelanggan pergi.

---

## 3. Proposed Changes

Grouped by component layer.

### A. Staff API Layer (Backend Endpoints)

#### [NEW] `src/app/api/staff/orders/route.ts`
- **Method**: `GET /api/staff/orders?tab=cash_queue|paid_history|cancelled_history`
- **RBAC**: Hanya role `CASHIER` dan `ADMIN`. Role `KITCHEN` ditolak HTTP 403 Forbidden.
- **Logika**:
  - Filter `tab === 'cash_queue'`: `paymentMethod: 'CASH'`, `paymentStatus: 'WAITING_CASHIER'`, `orderStatus: { not: 'CANCELLED' }`, diurutkan FIFO (`createdAt: 'asc'`).
  - Filter `tab === 'paid_history'`: `paymentStatus: 'PAID'`, diurutkan LIFO (`paidAt: 'desc'`).
  - Filter `tab === 'cancelled_history'`: `orderStatus: 'CANCELLED'`, mencakup `manualRefunds`.
- Mengembalikan data lengkap item, modifier snapshot, catatan, table number, elapsed time, dan audit history.

#### [MODIFY] `src/app/api/staff/orders/[id]/confirm-cash/route.ts`
- **Method**: `POST /api/staff/orders/[id]/confirm-cash`
- **RBAC**: Hanya `CASHIER` dan `ADMIN`.
- **Integritas & Anti Klik-Ganda**:
  - Validasi: `paymentMethod === 'CASH'`, `paymentStatus === 'WAITING_CASHIER'` (atau `'UNPAID'`), `orderStatus !== 'CANCELLED'`.
  - Eksekusi atomik dalam `prisma.$transaction`:
    - Cek ulang status; jika sudah `PAID`, kembalikan sukses idempoten tanpa duplikasi.
    - Update `Order`: `paymentStatus = 'PAID'`, `paidAt = new Date()`, `orderStatus = 'QUEUED'`.
    - Buat `PaymentAttempt`: `gateway = 'CASH'`, `status = 'PAID'`, `merchantOrderId = '${order.orderNumber}-CASH'`, `grossAmount = order.totalAmount`.
    - Increment `soldCount` menu item.
    - Terbitkan **SATU durable `OutboxEvent`** (`channel: 'KDS'`, `eventType: 'ORDER_PAID'`).
    - Catat `AuditLog`: `action: 'CONFIRM_CASH'`, actor `staff.username`, `staff.id`, total nominal IDR.

#### [NEW] `src/app/api/staff/orders/[id]/cancel/route.ts`
- **Method**: `POST /api/staff/orders/[id]/cancel`
- **RBAC**: Hanya `CASHIER` dan `ADMIN`.
- **Payload**: `{ reason: string }` (wajib, min 3 karakter).
- **Logika**:
  - Validasi: jika order `COMPLETED` $\rightarrow$ tolak 400.
  - Jika `paymentStatus !== 'PAID'`:
    - Ubah `orderStatus = 'CANCELLED'`.
    - Catat `AuditLog: ORDER_CANCELLED_UNPAID`.
  - Jika `paymentStatus === 'PAID'`:
    - `orderStatus = 'CANCELLED'`.
    - `paymentStatus` **TETAP `PAID`**.
    - Catat `AuditLog: ORDER_CANCELLED_PAID_REFUND_PENDING`.
    - Buat `ManualRefundRecord` jika alasan refund disertakan.

#### [NEW] `src/app/api/staff/orders/[id]/refund/route.ts`
- **Method**: `POST /api/staff/orders/[id]/refund`
- **RBAC**: Hanya `CASHIER` dan `ADMIN`.
- **Payload**: `{ amount: number, reason: string, notes?: string }`.
- **Logika**:
  - Validasi pesanan: harus `orderStatus === 'CANCELLED'` dan `paymentStatus === 'PAID'`.
  - Validasi nominal: `amount > 0` dan total akumulasi refund tidak melebihi `order.totalAmount`.
  - Buat record `ManualRefundRecord` (`refundMethod: 'MANUAL_CASH'`).
  - Catat `AuditLog: MANUAL_REFUND_COMPLETED`.

---

### B. User Interface Layer (`/pos`)

#### [NEW] `src/app/(staff)/staff/pos/pos-client-view.tsx`
- Komponen klien interaktif POS Kasir:
  1. **Tab Navigator**:
     - *Antrean Tunai* (dengan badge hitungan dinamis).
     - *Riwayat Transaksi Lunas*.
     - *Riwayat Batal & Refund*.
  2. **Kartu Pesanan Tunai**:
     - Identifier tegas: **Nomor Order** (`#SELA-YYMMDD-NNN`) dan **Meja** (`Meja 07`).
     - Indikator usia pesanan (*age*): hitung durasi dari `createdAt`, warna peringatan jika >10m dan >20m.
     - Total tagihan resmi integer IDR terformat tebal.
     - Rincian item menu, modifier, dan catatan dapur aman.
     - Tombol `✓ Konfirmasi Uang Masuk` (hijau) dan `✕ Batalkan` (merah).
  3. **Dialog Konfirmasi Uang Fisik**:
     - Modal pop-up dengan ringkasan: Nomor Order, Meja, Total Rupiah, konfirmasi bahwa uang fisik telah dihitung kasir. Proteksi *isSubmitting* untuk mencegah klik ganda.
  4. **Dialog Pembatalan Pesanan**:
     - Input alasan pembatalan (wajib).
     - Peringatan transparan jika pesanan sudah dibayar (mewajibkan pencatatan refund manual).
  5. **Dialog Catat Refund Manual**:
     - Form pencatatan pengembalian uang fisik kasir: nominal IDR, alasan, dan catatan referensi.
  6. **Auto Refresh**:
     - Interval polling berkala (5 detik) untuk mendeteksi pesanan tunai baru yang masuk.

#### [MODIFY] `src/app/(staff)/staff/pos/page.tsx`
- Mengganti mock static sebelumnya dengan `PosClientView` yang terhubung langsung ke API staf dan dilindungi oleh layout RBAC.

---

## 4. Verification Plan

### Automated Tests
1. **Integration Test POS Orders API (`tests/integration/pos-cashier.test.ts`)**:
   - `pnpm run test tests/integration/pos-cashier.test.ts`
   - Skenario 1: Pesanan tunai baru muncul di antrean tunai POS (`WAITING_CASHIER`), tidak muncul di KDS dapur.
   - Skenario 2: Konfirmasi kasir sah (`CASHIER` / `ADMIN`) berhasil mengubah status menjadi `PAID`, `orderStatus = QUEUED`, membuat `PaymentAttempt CASH`, menerbitkan tepat 1 `OutboxEvent`, dan menaikkan `soldCount`.
   - Skenario 3: Role `KITCHEN` dilarang mengonfirmasi uang tunai (HTTP 403 Forbidden).
   - Skenario 4: Anti klik ganda & concurrency: 2 request konfirmasi bersamaan menghasilkan tepat 1 mutasi lunas dan tepat 1 `OutboxEvent`.
   - Skenario 5: Pembatalan pesanan belum lunas mengubah status ke `CANCELLED` dan mencatat alasan pada `AuditLog`.
   - Skenario 6: Pembatalan pesanan yang sudah `PAID` tetap mempertahankan `paymentStatus = PAID`, mengubah `orderStatus = CANCELLED`, dan mencatat `ManualRefundRecord` faktual tanpa error gateway.
   - Skenario 7: Mencegah konfirmasi pesanan QRIS melalui endpoint konfirmasi tunai (400 Bad Request).
2. **Full Automated Suite & CI Quality Gates**:
   - `pnpm run test tests/unit`
   - `pnpm run test tests/integration --fileParallelism=false`
   - `pnpm run typecheck`
   - `pnpm exec eslint src`
   - `pnpm run build`

### Manual Verification
1. Login sebagai Kasir (`kasir1` / `password123`) di `/login`, buka `/staff/pos`.
2. Lakukan checkout pesanan tunai dari browser tamu (`/cart` $\rightarrow$ Tunai $\rightarrow$ Buat Pesanan).
3. Pastikan pesanan muncul di tab "Antrean Bayar Tunai" dengan nomor order dan meja.
4. Klik "Konfirmasi Uang Masuk", verifikasi dialog konfirmasi, lalu konfirmasi.
5. Verifikasi tiket pesanan berpindah ke riwayat lunas dan tiket siap tampil di KDS dapur.
6. Coba batalkan pesanan lunas, masukkan alasan, dan verifikasi pencatatan refund manual.

