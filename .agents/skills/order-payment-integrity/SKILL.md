---
name: order-payment-integrity
description: >-
  Handle checkout creation, server-authoritative price calculation, Midtrans Core API QRIS charge, sandbox payment simulation, SHA512 webhook signature verification, idempotency protection, and 15-minute expiration handling. Use when touching payment endpoints, order state transitions, or webhook handlers.
---

# Prosedur Integritas Pesanan & Transaksi Pembayaran (order-payment-integrity)

Skill ini memandu penanganan pembuatan pesanan, verifikasi harga sisi server, integrasi pembayaran QRIS via Midtrans Core API Sandbox, verifikasi webhook signature, proteksi idempotensi, dan batas kedaluwarsa 15 menit.

---

## 1. Trigger (Kapan Skill Ini Digunakan)
Gunakan skill ini setiap kali Anda:
* Mengimplementasikan atau memodifikasi endpoint pembuatan pesanan (`POST /api/orders`).
* Menangani charge QRIS dinamis (`POST /api/payments/qris`) atau pesanan tunai (`POST /api/payments/cash`).
* Memproses callback notifikasi webhook Midtrans (`POST /api/webhooks/midtrans`).
* Menerapkan validasi header `Idempotency-Key` pada tombol checkout.
* Mengelola transisi status pesanan (`PENDING`, `PAID`, `EXPIRED`, `CANCELLED`).
* Menangani timer kedaluwarsa 15 menit QRIS dan pembatalan otomatis.

---

## 2. Invarian Finansial & Keamanan Mutlak
1. **Server-Authoritative Pricing:** Nilai grand total dihitung 100% oleh server dari database resmi; client dilarang mendikte total rupiah. Nilai disimpan sebagai integer IDR tanpa pecahan.
2. **Nir-Bukti Manual & Expiry 15 Menit (`DEC-015`):** Tanpa upload bukti transfer manual; verifikasi uang masuk 100% otomatis via webhook Midtrans. Sesi QRIS kedaluwarsa tepat 15 menit.
3. **Kitchen Gate on PAID (`DEC-013`):** Pesanan HANYA diteruskan ke KDS Dapur setelah status pembayaran lunas (`PAID`).
4. **Idempotensi:** Webhook callback duplikat tidak boleh memicu pembuatan transaksi atau lonceng KDS ganda.
5. **Zero Secrets Leak:** `MIDTRANS_SERVER_KEY` tidak boleh bocor ke client bundle atau git commit.

---

## 3. Input & Prasyarat

### Input
* Payload keranjang checkout: `{ tableNumber: string, items: Array<{ menuItemId: string, quantity: number, modifierOptionIds: string[], notes?: string }> }`.
* Header HTTP: `Idempotency-Key: string`.
* Variabel Lingkungan: `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=false`.

### Dokumen Rujukan Wajib
* [architecture.md](../../../architecture.md) — Seksi 8 (Kontrak API Checkout & Webhook) & Seksi 9 (State Machine).
* [techstack.md](../../../techstack.md) — Seksi 4 (Spesifikasi Midtrans Core API).
* [agent.md](../../../agent.md) — Seksi 6 (Invarian Proyek) & Seksi 10 (Uji Risiko Finansial).
* [docs/project-context.md](../../../docs/project-context.md) — Keputusan `DEC-007`, `DEC-011`, `DEC-013`, `DEC-015`.

---

## 4. Langkah Kerja Berurutan

### Langkah 1: Kalkulasi Harga Sisi Server (Server-Authoritative)
1. Baca daftar menu dan modifier dari database PostgreSQL menggunakan Prisma Client.
2. Hitung subtotal tiap item:
   $$\text{Subtotal Item} = (\text{Harga Dasar Menu} + \sum \text{Harga Modifier}) \times \text{Kuantitas}$$
3. Hitung grand total:
   $$\text{Grand Total} = \sum \text{Subtotal Item} + \text{Pajak (jika aktif)} + \text{Service Charge (jika aktif)}$$
4. Tolak request jika nominal $\le 0$ atau jika ada item yang berstatus `isAvailable: false`.

### Langkah 2: Pembuatan Pesanan & Token Rahasia Pelacak (`orderSecretToken`)
1. Periksa header `Idempotency-Key`: jika key sudah pernah diproses dalam rentang 10 menit terakhir, kembalikan data pesanan yang sudah ada.
2. Buat snapshot harga dan nama menu pada tabel `ORDER_ITEM` dan `ORDER_ITEM_MODIFIER`.
3. Buat token acak kriptografis: `crypto.randomBytes(32).toString('hex')` sebagai `orderSecretToken`.
4. Simpan pesanan dengan status `orderStatus: PENDING` dan `paymentStatus: UNPAID`.

### Langkah 3: Integrasi QRIS Dinamis Midtrans Core API
1. Panggil Midtrans Core API `charge()` dengan payload:
   ```json
   {
     "payment_type": "qris",
     "transaction_details": {
       "order_id": "SL-20261027-MEJA07-XXXX",
       "gross_amount": 56000
     },
     "qris": { "acquirer": "gopay" },
     "custom_expiry": {
       "expiry_duration": 15,
       "unit": "minute"
     }
   }
   ```
2. Tangkap URL gambar QR code (`actions[0].url` atau `qr_string`) dan kembalikan ke frontend bersama sisa waktu kedaluwarsa.

### Langkah 4: Pemrosesan Webhook Midtrans (`/api/webhooks/midtrans`)
1. Ambil payload notifikasi: `order_id`, `status_code`, `gross_amount`, `signature_key`, `transaction_status`.
2. Hitung signature hash verifikasi:
   $$\text{Expected Signature} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{MIDTRANS\_SERVER\_KEY})$$
3. Jika `signature_key !== Expected Signature`, **tolak seketika dengan respons `403 Forbidden`**.
4. Tangani status transaksi secara aman:
   * **`settlement` / `capture` (accept):**
     * Cek status pesanan di database. Jika sudah `PAID`, langsung respons `200 OK` (idempotensi callback ganda).
     * Jika belum `PAID`: ubah `orderStatus` $\rightarrow$ `PAID`, `paymentStatus` $\rightarrow$ `PAID`, `paidAt` $\rightarrow$ waktu sekarang, dan pancarkan event real-time ke KDS Dapur via SSE.
   * **`expire`:**
     * Ubah `orderStatus` $\rightarrow$ `EXPIRED`, `paymentStatus` $\rightarrow$ `EXPIRED`. Pesanan tidak akan pernah diteruskan ke dapur.
   * **`cancel` / `deny`:**
     * Ubah status menjadi `FAILED`.

### Langkah 5: Penanganan Alur Bayar Tunai di Kasir
1. Jika pelanggan memilih opsi tunai, simpan pesanan dengan `paymentMethod: CASH` dan `paymentStatus: UNPAID`.
2. Status antrean dapur diset ke `WAITING_CONFIRMATION`. Pesanan **TIDAK DITAMPILKAN** di KDS Dapur.
3. Pesanan tampil di antrean khusus kasir. Kasir memverifikasi uang fisik dan menekan tombol konfirmasi untuk mengubah status menjadi `PAID` dan mengalirkan tiket ke KDS Dapur.

---

## 5. Validasi & Pengujian

### Uji Kasus Finansial Kritis
- [ ] **Manipulasi Harga Payload:** Kirim request pembuatan pesanan dengan field palsu `{ price: 100 }`. Pastikan server mengabaikan field tersebut dan tetap menggunakan harga resmi database.
- [ ] **Uji Signature Webhook:** Kirim request mock webhook dengan signature palsu. Pastikan endpoint merespons `403 Forbidden` dan status database tidak berubah.
- [ ] **Uji Webhook Duplikat:** Kirim callback settlement dua kali berturut-turut untuk pesanan yang sama. Pastikan panggilan kedua merespons `200 OK` tanpa memicu event ganda.
- [ ] **Uji Kedaluwarsa 15 Menit:** Simulasikan callback notifikasi `expire` dari Midtrans Simulator. Pastikan pesanan ditandai batal dan tidak muncul di antrean masak KDS Dapur.

---

## 6. Tindakan Bila Menemui Hambatan
* Jika webhook Midtrans gagal divalidasi di localhost saat pengujian, gunakan alat tunneling lokal seperti Ngrok atau webhook simulator Midtrans resmi.
* Dilarang keras menonaktifkan validasi signature SHA512 demi mempercepat pengujian. Keamanan finansial adalah prioritas tertinggi.
