# Implementation Plan — Tahap 12: Webhook Midtrans & Service Rekonsiliasi Kedaluwarsa

Rencana implementasi jalur webhook Midtrans resmi dan service rekonsiliasi pembayaran untuk **Cravio — Your craving, Perfectly Matched** (Pilot: **SELA Artisanal Coffee & Bake**).

---

## 1. Goal Description

Membangun endpoint webhook `POST /api/webhooks/midtrans` dan background service rekonsiliasi pembayaran (`POST /api/cron/reconcile-payments`) sebagai sumber kebenaran perubahan status pembayaran yang tangguh, aman, dan konsisten:
1. **Verifikasi Kriptografis SHA-512**: Memverifikasi `SHA512(order_id + status_code + gross_amount + ServerKey)` menggunakan representasi string asli dari provider dan pembandingan *timing-safe* (`crypto.timingSafeEqual`) untuk menangkal serangan *timing attack*.
2. **Validasi Skema & Integritas Finansial**: Validasi Zod schema ketat, mencocokkan `merchantOrderId`, `transactionId`, `currency === 'IDR'`, metode pembayaran `qris`, serta nominal snapshot.
3. **Parsing Uang Aman Tanpa Pecahan Terselubung**: Mem-parse uang tanpa menggunakan `parseFloat` atau `parseInt` yang rentan menoleransi desimal tersembunyi (seperti `.50` atau `.99`), menjamin hanya integer IDR sah yang diterima.
4. **QRIS Success Mapping Khusus**: Memetakan sukses QRIS secara ketat hanya pada status **`settlement`**; **menolak `capture` generik dari alur kartu kredit**.
5. **Idempotensi, Dedup, & Out-of-Order Safety**:
   - Pembaruan status kondisional atomik (`$transaction`).
   - Callback duplikat direspons `200 OK` tanpa memicu event ganda atau melipatgandakan `soldCount`.
   - Notifikasi `pending`, `expire`, atau `cancel` yang tiba setelah order berstatus `PAID` diabaikan secara aman (tidak menurunkan status `PAID`).
   - Penerbitan tepat **satu durable `OutboxEvent`** (`ORDER_PAID`) untuk sinkronisasi KDS.
6. **Service Rekonsiliasi & Expiry Job Otomatis**:
   - Mengatasi batas kedaluwarsa 15 menit tanpa bergantung pada browser pelanggan.
   - Panggilan Midtrans Get Status berkala, disusul pemanggilan `POST /v2/{order_id}/expire` atau `cancel` di gateway jika transaksi masih menggantung di sisi Midtrans.
   - Membedakan pembayaran tepat waktu (webhook terlambat) dengan dana yang masuk setelah pembatalan: semua dana valid dicatat (`PaymentAttempt.status = PAID`), ditandai `REVIEW_REQUIRED`, dan dicatat ke `AuditLog` untuk SOP refund manual, tanpa memasak pesanan batal di dapur.
   - Cron endpoint `POST /api/cron/reconcile-payments` yang terautentikasi (`CRON_SECRET`), aman konkurensi (*advisory lock*), dan terpantau.

---

## 2. User Review Required

> [!IMPORTANT]
> **Mapping Sukses QRIS vs Kartu Kredit**:
> Sesuai arahan teknis Midtrans dan instruksi Anda, notifikasi QRIS **hanya menerima status `settlement`** sebagai pembayaran sah. Status `capture` (yang lazim digunakan pada kartu kredit) akan ditolak bila metode pembayaran adalah `qris`.

> [!WARNING]
> **Penanganan Dana Masuk Setelah Expiry (Late Payment / Edge Case)**:
> Jika nasabah mentransfer di bank/e-wallet tepat saat order kedaluwarsa di sistem kafe, dana tersebut **tidak akan dihilangkan dari pencatatan**. Sistem akan menandai attempt sebagai `PAID`, mencatat audit log khusus `PAYMENT_SETTLED_AFTER_EXPIRY_REVIEW_REQUIRED`, dan **TIDAK otomatis memasak order di KDS dapur**. Kasir/Admin akan menindaklanjuti secara SOP manual (membuatkan pesanan pengganti atau memproses refund).

---

## 3. Proposed Changes

Grouped by component layer.

### A. Environment Configuration Layer
#### [MODIFY] `src/lib/server/env.ts`
- Menambahkan validasi `CRON_SECRET: z.string().min(16).default('sela_cron_reconcile_secret_2026')` untuk mengamankan job terjadwal rekonsiliasi.

---

### B. Gateway Adapter Layer (Midtrans Core API)
#### [MODIFY] `src/lib/server/midtrans.ts`
- **Fungsi Verifikasi Signature**:
  `verifyMidtransSignature(params: { orderId: string, statusCode: string, grossAmount: string, signatureKey: string, serverKey: string }): boolean`
  Menggunakan `crypto.createHash('sha512')` dan `crypto.timingSafeEqual`.
- **Fungsi Parser Uang Aman**:
  `parseAndValidateIdrAmount(rawGrossAmount: string): number`
  Menggunakan pencocokan regex ketat `^(\d+)(\.00)?$` tanpa `parseInt`/`parseFloat` parsial.
- **Fungsi Expire & Cancel Gateway**:
  - `expireTransaction(merchantOrderId: string): Promise<MidtransStatusResult>` (`POST /v2/{order_id}/expire`)
  - `cancelTransaction(merchantOrderId: string): Promise<MidtransStatusResult>` (`POST /v2/{order_id}/cancel`)

---

### C. Webhook Processing Layer
#### [NEW] `src/lib/server/webhook-service.ts`
- Skema Zod `MidtransNotificationSchema` untuk memvalidasi struktur payload notifikasi Midtrans.
- Fungsi inti `processMidtransWebhook(rawPayload: unknown): Promise<WebhookProcessResult>`:
  1. Validasi struktur JSON dan field wajib.
  2. Verifikasi SHA-512 signature menggunakan string asli `rawPayload.gross_amount`.
  3. Validasi nominal uang integer IDR via `parseAndValidateIdrAmount`.
  4. Pencarian `PaymentAttempt` berdasarkan `merchantOrderId`.
  5. Pencocokan mata uang (`IDR`), metode (`qris`), dan snapshot total (`order.totalAmount`).
  6. Penegakan aturan khusus QRIS: `settlement` = sukses, `capture` = ditolak.
  7. Penanganan Idempotensi:
     - Jika order sudah `PAID` dan notifikasi adalah `settlement`: respons `200 OK` (deduplicated).
     - Jika order sudah `PAID` dan notifikasi adalah `expire`/`cancel`/`pending`: abaikan (out-of-order safety) dan catat `AuditLog`.
  8. Eksekusi transaksi atomik `$transaction`:
     - Update order $\rightarrow$ `PAID`, `paidAt: now`, `orderStatus: QUEUED`.
     - Update payment attempt $\rightarrow$ `PAID`, `transactionId`, `rawResponse`.
     - Increment `soldCount` menu item.
     - Penerbitan durable `OutboxEvent` (`channel: 'KDS'`, `eventType: 'ORDER_PAID'`).
     - Catat `AuditLog` (`PAYMENT_SETTLED_WEBHOOK`).
  9. Error Handling: Bila database gagal menyimpan, lempar HTTP 500 retryable agar Midtrans mengirim ulang callback.

#### [NEW] `src/app/api/webhooks/midtrans/route.ts`
- Endpoint publik `POST /api/webhooks/midtrans`.
- Mengambil raw JSON body, memanggil `processMidtransWebhook(body)`.
- Mengembalikan HTTP 200 untuk payload sukses/dedup, HTTP 403 untuk signature palsu, HTTP 400 untuk mismatch data, dan HTTP 500 untuk retryable database error.

---

### D. Rekonsiliasi & Scheduled Job Layer
#### [NEW] `src/lib/server/reconciliation-service.ts`
- Fungsi inti `reconcilePendingAndExpiredOrders(options?: { dryRun?: boolean, limit?: number }): Promise<ReconciliationResult>`:
  1. **Concurrency Guard**: Menggunakan PostgreSQL advisory lock atau conditional locking untuk mencegah eksekusi ganda jika beberapa cron instance berjalan bersamaan.
  2. Mencari pesanan QRIS berstatus `PENDING` dengan `expiresAt <= now` (atau lebih dari 15 menit).
  3. Memeriksa status resmi ke Midtrans (`getTransactionStatus`).
  4. Analisis status:
     - **Midtrans = `settlement`**: Webhook terlambat; selesaikan pembayaran dan buka gate KDS dapur. Jika order sudah terlanjur berstatus `EXPIRED` di DB, catat uang masuk valid, tandai `needsReview: true`, dan buat `AuditLog` SOP refund tanpa memasak di dapur.
     - **Midtrans = `pending`**: Panggil `expireTransaction()` di Midtrans untuk menutup QR code di gateway, ubah status DB ke `EXPIRED`.
     - **Midtrans = `expire` / `cancel` / `not_found`**: Sinkronkan status DB ke `EXPIRED`.
  5. Mengembalikan ringkasan metrik eksekusi (processed, settled, expired, flaggedReview, errors).

#### [NEW] `src/app/api/cron/reconcile-payments/route.ts`
- Endpoint terproteksi `POST /api/cron/reconcile-payments`.
- Validasi header `Authorization: Bearer <CRON_SECRET>`.
- Menjalankan `reconcilePendingAndExpiredOrders()`.
- Mengembalikan metrik JSON terperinci untuk observabilitas.

---

### E. Integrasi Sisi Klien Layar Bayar (UI Final Status Check)
#### [MODIFY] `src/app/(customer)/order/[id]/pay/payment-client-view.tsx`
- Ketika hitung mundur 15 menit mencapai `00:00`:
  1. Hentikan timer dan kunci antarmuka pembayaran.
  2. Lakukan satu kali request konfirmasi final ke `/api/orders/[id]/pay/status` untuk memastikan apakah pembayaran diselesaikan di detik-detik terakhir sebelum menampilkan status kedaluwarsa permanen.

---

## 4. Verification Plan

### Automated Tests
1. **Unit Tests Signature & Parser (`tests/unit/webhook-signature.test.ts`)**:
   - `pnpm run test tests/unit/webhook-signature.test.ts`
   - Test kalkulasi SHA-512 dengan representasi string asli.
   - Test timing-safe equality comparison.
   - Test penolakan signature salah / dimanipulasi.
   - Test parser uang aman: `"38000.00"` dan `"38000"` sah, `"38000.50"` ditolak, non-integer ditolak.
   - Test penolakan status `capture` pada alur QRIS.
2. **Live Integration Webhook Suite (`tests/integration/midtrans-webhook.test.ts`)**:
   - `pnpm run test tests/integration/midtrans-webhook.test.ts`
   - Test webhook valid memicu settlement, update atomik, penerbitan `OutboxEvent`, dan peningkatan `soldCount`.
   - Test callback duplikat (idempoten: status HTTP 200, tanpa duplikasi order/event).
   - Test out-of-order callback: status `expire` yang tiba setelah order `PAID` diabaikan secara aman.
   - Test penolakan signature palsu (HTTP 403) dan amount mismatch (HTTP 400).
3. **Live Integration Reconciliation Suite (`tests/integration/payment-reconciliation.test.ts`)**:
   - `pnpm run test tests/integration/payment-reconciliation.test.ts`
   - Test eksekusi rekonsiliasi pesanan kedaluwarsa tanpa browser aktif.
   - Test autentikasi Bearer `CRON_SECRET` pada endpoint cron (401 jika salah).
   - Test deteksi dana masuk setelah pembatalan (pencatatan valid + audit log review tanpa masak otomatis).
4. **Full Automated Suite & CI Quality Gates**:
   - `pnpm run test tests/unit`
   - `pnpm run test tests/integration --fileParallelism=false`
   - `pnpm run typecheck`
   - `pnpm exec eslint src`
   - `pnpm run build`

### Manual Verification
1. Verifikasi callback webhook menggunakan Midtrans Simulator di Sandbox Portal.
2. Verifikasi endpoint cron via `curl` dengan header `Authorization: Bearer <CRON_SECRET>`.
3. Verifikasi log audit di database Neon PostgreSQL untuk event webhook settlement dan rekonsiliasi.

