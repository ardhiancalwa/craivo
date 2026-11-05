# Cravio Operational Runbook & Incident Response Guide
## Pilot Deployment: SELA Artisanal Coffee & Bake

Dokumen ini adalah panduan standar operasional (Standard Operating Procedure / SOP) bagi tim teknis (Primary Ops) dan staf operasional kafe (Secondary Ops) dalam menangani insiden, melakukan rekonsiliasi transaksi, menjalankan pemulihan darurat (*Disaster Recovery*), serta melakukan *rollback* aplikasi produksi secara aman dengan komitmen biaya hosting Rp 0.

---

## 1. Matriks Klasifikasi Insiden & Kontak PIC (Person In Charge)

| Tingkat Keparahan | Definisi & Contoh Kasus | Target Respon (SLA) | Target Resolusi (RTO) | PIC Utama | Saluran Komunikasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P1 - CRITICAL** | • QRIS Midtrans tidak menghasilkan QR / Webhook gagal total.<br>• Seluruh kasir atau KDS dapur tidak dapat memuat data pesanan.<br>• Kerusakan data transaksi atau kegagalan database Neon. | **< 5 Menit** | **< 30 Menit** | **Primary Ops**<br>(Technical Lead Cravio) | Telepon Langsung & Slack/WA Urgent Alert |
| **P2 - HIGH** | • KDS dapur mengalami staleness > 30 menit (pesanan menumpuk).<br>• Transaksi pelanggan QRIS terpotong namun status pesanan masih PENDING.<br>• Printer thermal kasir/dapur macet atau kehabisan kertas. | **< 15 Menit** | **< 45 Menit** | **Secondary Ops**<br>(Store Manager On-Duty & Lead Barista) | Grup WhatsApp Operasional Kafe SELA |
| **P3 - MEDIUM** | • Jadwal backup terenkripsi belum berjalan > 24 jam (RPO breach).<br>• Glitch visual non-blocking pada antarmuka landing page atau kuis.<br>• Lambatnya loading gambar menu tertentu. | **< 60 Menit** | **< 4 Jam** | **Technical Support**<br>(On-Call Engineer) | GitHub Issues / Ticketing |

### Matriks Kontak Darurat
- **Primary Technical Ops:** Lead Technical Cravio (`ops@cravio.id` / Hotline On-Call Dev)
- **Secondary Kafe Ops:** Store Manager SELA Artisanal Coffee (`manager@selacoffee.id` / On-Duty Floor Supervisor)
- **Midtrans Merchant Support:** `support@midtrans.com` / Portal Dashboard: [dashboard.midtrans.com](https://dashboard.midtrans.com)
- **Neon Cloud DB Status:** [status.neon.tech](https://status.neon.tech)
- **Vercel Platform Status:** [vercel-status.com](https://www.vercel-status.com)

---

## 2. SOP Rekonsiliasi Pembayaran QRIS & Sengketa Kasir

### Skenario A: Pelanggan Mengaku Sudah Membayar QRIS, namun Layar Masih "Menunggu Pembayaran" atau "EXPIRED"

> [!IMPORTANT]
> **Penyebab Utama:** Keterlambatan jaringan provider e-wallet/bank pelanggan, delay notifikasi webhook Midtrans, atau pelanggan baru menekan transfer tepat pada detik ke-15 kedaluwarsa.

#### Langkah Penanganan oleh Kasir (Secondary Ops):
1. **Verifikasi Bukti Mutasi:** Minta pelanggan menunjukkan mutasi rekening / e-wallet (GoPay, OVO, BCA, dsb.).
   - Pastikan **Jam Transaksi** cocok dengan waktu pembuatan pesanan (toleransi < 15 menit).
   - Pastikan **Nominal Pembayaran** tepat hingga rupiah terakhir (termasuk pajak & biaya layanan).
   - Cocokkan nama penerima merchant: **SELA Artisanal Coffee** atau **Cravio**.
2. **Cek Nomor Pesanan di POS Kasir:**
   - Masuk ke dashboard Kasir (`/staff/pos`).
   - Cari nomor pesanan (format: `#SELA-xxxxx-xxx`).
   - Jika status masih `PENDING` atau `EXPIRED`:
     - Tekan tombol **"Periksa Status Pembayaran"** pada detail pesanan.
     - Aksi ini akan memicu panggilan langsung ke Midtrans API status check.
3. **Penyelesaian Transaksi:**
   - Jika Midtrans mengembalikan status `settlement`: Sistem secara otomatis memperbarui status menjadi `PAID`, mencetak tiket dapur, dan mengirim pesanan ke antrean KDS.
   - Jika Midtrans tetap mengembalikan `expire` padahal saldo pelanggan terdebet (kasus *Late Settlement*):
     - Kasir mengklik tombol **"Terima Tunai / Manual Settlement"** dengan catatan: `"Late QRIS Settlement Ref: [ID Transaksi Bank]"`.
     - Barista segera memproses minuman pelanggan agar pelanggan tidak menunggu lama.
     - Kasir mencatat Order ID pada *Log Rekonsiliasi Harian Kafe*.

#### Langkah Penanganan oleh Tim Teknis (Primary Ops):
Jalankan pemicu rekonsiliasi manual melalui terminal atau cURL:
```bash
curl -X POST https://sela.cravio.id/api/cron/reconcile-payments \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```
Log rekonsiliasi akan memeriksa semua transaksi berumur 15–60 menit ke Midtrans Core API dan menyelaraskan status database.

---

## 3. SOP Gangguan KDS & Dapur (Kitchen Staleness)

### Skenario B: Tablet Dapur KDS Tidak Menerima Pesanan Baru atau Indikator Merah Berkedip

1. **Pemeriksaan Koneksi Wi-Fi:**
   - Periksa koneksi Wi-Fi tablet barista. Jika sinyal terputus, hubungkan ke SSID cadangan kafe.
   - Sistem KDS Cravio dilengkapi **Auto-Reconnect SSE** dengan interval backoff 5 detik, 10 detik, hingga 15 detik.
2. **Penyegaran Halaman KDS:**
   - Tekan tombol **"Sinkronkan Ulang"** di sudut kanan atas layar `/staff/kds` atau lakukan *pull-to-refresh*.
   - KDS akan menarik *snapshot* mutlak seluruh pesanan berstatus `QUEUED` dan `COOKING`.
3. **Fallback Cetak Struk Dapur:**
   - Jika tablet dapur mengalami kerusakan fisik / baterai drop, kasir dapat menekan **"Cetak Tiket Dapur (Kitchen Ticket)"** dari printer POS kasir.
   - Struk thermal memuat item pesanan, modifier racikan, nomor meja, dan catatan khusus pelanggan.

---

## 4. Prosedur Rollback Aplikasi & Kebijakan Backward-Compatible Schema

> [!CAUTION]
> **ATURAN UTAMA DATABASE CRAVIO:**  
> Dilarang keras menjalankan `prisma migrate reset` atau membalikkan migrasi (*down migration*) yang bersifat destruktif pada lingkungan Staging maupun Live Produksi. Seluruh perubahan skema wajib mengikuti pola **Expand and Contract**.

### Mengapa Rollback Aplikasi Tidak Merusak Database?
1. Seluruh kolom baru yang ditambahkan selalu memiliki nilai *default* atau bertipe *nullable* (opsional).
2. Kode aplikasi versi sebelumnya (Commit N-1) tetap dapat membaca tabel yang memiliki kolom tambahan dari rilis baru (Commit N) tanpa mengalami *runtime error*.

### Langkah-Langkah Rollback Rilis Vercel (Durasi < 2 Menit):
1. **Buka Dashboard Vercel:** Masuk ke `https://vercel.com/[team]/cravio/deployments`.
2. **Identifikasi Deployment Stabil Terakhir:** Pilih *Deployment* yang sebelumnya berstatus `Ready` sebelum insiden terjadi.
3. **Klik Menu "..." -> Pilih "Promote to Production" / "Instant Rollback"**:
   - Vercel akan mengalihkan 100% traffic domain produksi (`sela.cravio.id`) ke build lama secara instan tanpa perlu rebuild.
4. **Verifikasi Health Endpoint:**
   ```bash
   curl -I https://sela.cravio.id/api/health
   # Pastikan mengembalikan HTTP 200 OK
   ```

### Strategi Forward-Fix jika Terjadi Kegagalan Skema Database:
Jika terjadi kesalahan nama kolom atau constraint database, **JANGAN** membatalkan migrasi lama. Buat migrasi koreksi maju (*forward-fix migration*):
```bash
# 1. Buat koreksi pada prisma/schema.prisma
# 2. Deploy migrasi koreksi secara terkelola
npx prisma migrate deploy
```

---

## 5. Prosedur Pemulihan Bencana (Disaster Recovery & Restore Drill)

Sistem Cravio dilengkapi dengan snapshot harian terenkripsi militer **AES-256-GCM** yang menjamin:
- **RPO (Recovery Point Objective):** < 24 Jam
- **RTO (Recovery Time Objective):** < 30 Menit (Terbukti 14.88 detik pada pengujian riil)

### A. Menjalankan Backup Terenkripsi Manual / Terjadwal
```bash
# Mengekspor ke-25 tabel + media foto, mengenkripsi AES-256-GCM, dan membuat manifest SHA-256
pnpm run backup
```
Hasil backup disimpan pada direktori `backups/` dengan nama `cravio-backup-[YYYYMMDD-HHmmss].enc` dan `*-manifest.json`.

### B. Menjalankan Restore Drill ke Schema Terisolasi (`cravio_restore_drill`)
Untuk memastikan arsip cadangan tidak korup dan dapat dipulihkan tanpa mengganggu database live:
```bash
pnpm run restore:drill
```
Prosedur ini akan:
1. Memvalidasi hash SHA-256 arsip terhadap manifest.
2. Mendekripsi payload dengan `BACKUP_ENCRYPTION_KEY`.
3. Mengaplikasikan migrasi skema ke schema `cravio_restore_drill`.
4. Mengimpor ke-25 tabel dalam urutan relasi asing (*foreign-key graph*).
5. Memverifikasi integritas baris data dan mencatat durasi RTO aktual.

### C. Prosedur Pemulihan Total Saat Terjadi Bencana Kehilangan Data Live:
Jika database produksi mengalami kerusakan fatal:
1. Pasang mode pemeliharaan (*Maintenance Mode*) pada DNS / edge middleware.
2. Siapkan instance database Neon baru atau schema produksi bersih.
3. Jalankan script restore dengan parameter target database produksi:
   ```bash
   DATABASE_URL="<PROD_CONNECTION_STRING>" DIRECT_URL="<PROD_DIRECT_STRING>" pnpm run restore:drill
   ```
4. Verifikasi kesehatan melalui protected internal diagnostics:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" https://sela.cravio.id/api/staff/admin/system/health
   ```
5. Buka kembali akses pelanggan dan verifikasi alur scan meja.

---

## 6. Daftar Perintah Cepat Operasional (Cheat Sheet)

```bash
# 1. Validasi Variabel Lingkungan & Mode Gateway
pnpm run validate-env

# 2. Audit & Simulasi Operational Alerts (P1, P2, P3)
pnpm run simulate:alerts

# 3. Jalankan Backup Database Terenkripsi
pnpm run backup

# 4. Uji Pemulihan Bencana ke Schema Terisolasi (Restore Drill)
pnpm run restore:drill

# 5. Eksekusi Pengujian Integritas Penuh
pnpm run test

# 6. Typecheck & Strict Build Verification
pnpm run typecheck && pnpm run build
```

## 7. Konfirmasi Pembayaran Manual dan Pemeriksaan Safari

- Kasir mengonfirmasi `CASH`, `MANUAL_QRIS`, dan `MANUAL_TRANSFER` melalui `/api/staff/orders/[id]/confirm-cash`. Bukti bayar bersifat opsional. QRIS Midtrans tetap diverifikasi melalui gateway.
- Konfirmasi memakai metode pesanan dalam transaksi atomik. Konfirmasi ulang tidak membuat histori pembayaran atau event dapur ganda. Histori gateway, payload KDS, dan audit mencatat metode sebenarnya.
- Jika muncul `ORDER_STATE_CONFLICT` (HTTP 409), muat ulang antrean sebelum mencoba lagi; status pesanan mungkin berubah saat diproses.
- Untuk Safari, buka URL lengkap termasuk `https://` melalui kolom alamat Safari. Jika layar menampilkan hasil pencarian Google, ketuk tautan lengkap secara langsung; halaman pencarian tersebut belum membuktikan website gagal dimuat.
- Checkout memakai UUID v4 dari Web Crypto, dengan fallback `getRandomValues` jika `randomUUID` belum tersedia. Konfirmasi cepat kasir mengandalkan transaksi atomik server tanpa header idempotensi yang tidak dipakai endpoint tersebut.
- Uji pada iPhone asli setelah deploy: buka tautan meja, lewati kuis, tambah menu, checkout QRIS toko, lalu konfirmasi dari kasir dengan dan tanpa bukti. Ulangi konfirmasi dan pastikan tidak ada tiket dapur ganda.

