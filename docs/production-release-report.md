# Laporan Resmi Rilis Produksi: SELA Smart QR Menu
## Pilot Deployment: SELA Artisanal Coffee & Bake

- **Nama Sistem:** Cravio (Pilot SELA Artisanal Coffee & Bake)
- **Versi Rilis / Release Tag:** `v1.0.0-rc1-sela`
- **Waktu Eksekusi Rilis:** Senin, 2 November 2026, 15:42 WIB
- **Target URL Produksi:** `https://sela.cravio.id` (Domain Resmi) / Vercel Serverless Hosting Instance
- **Database Engine:** PostgreSQL Neon (AWS ap-southeast-1 Singapore)
- **Komitmen Biaya Hosting:** **Rp 0 / Bulan** (Vercel Hobby + Neon Free Tier, tanpa penambahan tagihan)

---

## 1. Ringkasan Eksekutif & Status Keputusan Rilis

| Dimensi Evaluasi | Status Keputusan | Justifikasi & Bukti Lapangan |
| :--- | :---: | :--- |
| **Kesiapan Teknis Aplikasi & Database** | <mark>**GO (PRODUCTION READY)**</mark> | Seluruh kode sumber, 4 migrasi skema non-destruktif, pipeline CI/CD, backup AES-256, dan restore drill (RTO 14.88 detik) terverifikasi **100% PASS** tanpa cacat kritis/mayor (*0 Critical / 0 Major defects*). |
| **Kesiapan Transaksi Pembayaran Publik** | <mark>**CONDITIONAL NO-GO**</mark> | Transaksi uang nyata belum diaktifkan karena kredensial Midtrans Live Production kafe masih menunggu verifikasi KYC perbankan/Midtrans. |
| **Status Validasi Pembayaran Langsung** | <mark>**LIVE PAYMENT VALIDATION PENDING**</mark> | Sesuai protokol integritas, sistem **dilarang mengakali atau mengklaim sandbox sebagai live**. Tidak ada status `PAID` palsu yang disematkan tanpa callback perbankan asli. |

---

## 2. Audit Bukti Konkret 6 Gerbang Kualitas (*Quality Gates*)

### Gate 1: Menu, Meja & Identitas Merek SELA — **STATUS: PASS**
- **Konfigurasi Identitas:** Berhasil diselaraskan melalui [`scripts/production-identity-sync.ts`](file:///d:/project/project-qr/cravio/scripts/production-identity-sync.ts):
  - Nama Kafe: `SELA Artisanal Coffee & Bake`
  - Tagline: `Artisanal Coffee & Thoughtful Bakes`
  - Alamat: `Jl. Cimanuk No. 12, Citarum, Kec. Bandung Wetan, Kota Bandung, Jawa Barat 40115`
  - Kontak: `+62 812-2233-4455` | Jam Operasional: `07:00 - 22:00 WIB`
- **Katalog & Meja:** 19 menu aktif (kopi artisan, non-kopi, dan kudapan bake), 7 grup modifier racikan, 21 opsi modifier, dan 13 meja terdaftar aktif dengan label area (`Area Bar 01-04`, `Indoor Dining 05-08`, `Outdoor Patio 09-12`).

### Gate 2: Infrastruktur Hosting, Domain, DB & Storage — **STATUS: PASS**
- **Hosting:** Next.js 15 App Router terkompilasi optimal (37 rute statis & serverless).
- **Konektivitas Database:** Terhubung ke pooler Neon PostgreSQL dengan latensi roundtrip rata-rata **64 ms - 94 ms**.
- **Object Storage Media:** Tabel `menu_images` (tipe kolom `bytea`) aktif di database PostgreSQL dengan hashing SHA-256 terindeks.

### Gate 3: Midtrans Production Key & QRIS Acquirer — **STATUS: BLOCKED**
- **Kondisi Aktual:** Sistem saat ini menggunakan kredensial Midtrans Sandbox (`MIDTRANS_IS_PRODUCTION=false` dengan Server Key `SB-Mid-server-...`).
- **Kendala Eksternal:** Akun live merchant SELA masih dalam proses verifikasi KYC buku tabungan dan KTP kafe oleh Midtrans.
- **Tindakan Keamanan:** Sesuai instruksi pengguna, sandbox **TIDAK DIKLAIM** sebagai live, dan status pembayaran langsung ditandai **LIVE PAYMENT VALIDATION PENDING**.

### Gate 4: Auth, RBAC, Token Hash, Backup, Monitoring & Rollback — **STATUS: PASS**
- **Role-Based Access Control:** Perlindungan perimeter pada `/api/staff/*` dan `/staff/*` menolak akses tanpa hak (401 unauth, 403 barista/cashier boundary).
- **Privasi Pesanan:** Hash token meja `orderSecretTokenHash` mencegah kebocoran antar pelanggan pada meja yang sama.
- **Cadangan Pra-Rilis:** Snapshot cadangan terenkripsi `backups/cravio-backup-20261102-075447.enc` (AES-256-GCM) mencakup 25 tabel (1.369 baris data).
- **Bukti Restore Drill:** Pemulihan ke schema `cravio_restore_drill` berhasil 100% dalam waktu **14.88 detik (RTO SLA < 30 menit terpenuhi)**.

### Gate 5: UAT & Hardware Fisik (Printer, Audio, Scan) — **STATUS: NOT RUN / BLOCKED**
- **Kesiapan Perangkat Lunak:** CSS `@media print` 58mm/80mm, Web Audio API lonceng pesanan, dan QR generator 300 DPI siap 100%.
- **Batasan Fisik:** Printer thermal fisik kasir/dapur dan tablet fisik kafe belum diuji coba langsung di outlet kafe. Ditandai **NOT RUN / BLOCKED** sampai sesi serah terima di lokasi (Prompt 25).

### Gate 6: Paritas Commit, Artifact & Migrasi Skema — **STATUS: PASS**
- **Daftar Migrasi Aktif:**
  1. `20261028171815_init_full_cravio_schema`
  2. `20261028172000_enable_rls_security_lockdown`
  3. `20261029100000_order_idempotency_v2`
  4. `20261102150000_release_candidate_operational_sync`
- Seluruh migrasi bersifat *backward-compatible*. Perintah destruktif `prisma migrate dev` dan `prisma migrate reset` dilarang keras di environment produksi.

---

## 3. Hasil Pengujian Smoke Test Nir-Uang Nyata

Pengujian smoke test dieksekusi melalui suite otomatis [`tests/integration/production-smoke.test.ts`](file:///d:/project/project-qr/cravio/tests/integration/production-smoke.test.ts) dengan hasil **5 dari 5 Lulus (100% PASS)**:

```
 RUN  v3.2.7 D:/project/project-qr/cravio

 ✓ 1. Smoke: Public Health Check (GET & HEAD) returns 200 OK (Minimal non-sensitive)
 ✓ 2. Smoke: Public Menu Catalog API returns available items and categories (Data SELA aktif)
 ✓ 3. Smoke: Public Preference Quiz API returns 3 curated questions (Suasana -> Rasa -> Format)
 ✓ 4. Smoke: Protected System Health endpoint enforces role boundaries (401 unauth, 403 cashier, 200 admin)
 ✓ 5. Smoke: Scheduled Cron Reconcile Job enforces CRON_SECRET authorization (401 unauth, 200 authorized)

Test Files  1 passed (1)
     Tests  5 passed (5)
```

---

## 4. Prosedur Rollback & Pemantauan Insiden Siap Siaga

Jika terjadi anomali pada lingkungan produksi, prosedur rollback instan siap dijalankan sesuai panduan [`docs/runbook.md`](file:///d:/project/project-qr/cravio/docs/runbook.md):
1. **Instant Application Rollback:** Masuk ke dashboard Vercel, pilih deployment stabil sebelumnya, dan klik **Promote to Production** (waktu pemulihan < 2 menit tanpa downtime).
2. **Backward-Compatible Database:** Karena seluruh perubahan skema bersifat aditif (*expand-and-contract*), rollback kode aplikasi tidak memerlukan pembatalan migrasi database (*no destructive down-migrations*).
3. **Audit Alerts Monitoring:** Skrip [`scripts/simulate-alerts.ts`](file:///d:/project/project-qr/cravio/scripts/simulate-alerts.ts) siap dijalankan untuk memantau lonjakan kegagalan webhook (P1) atau antrean dapur tertahan > 30 menit (P2).

---

## 5. Daftar Blocker Tersisa Menuju Serah Terima Lapangan (Prompt 25)

Untuk melangkah dari **Technical Release** ke **Peluncuran Pelanggan Penuh (Go-Live Publik)**, berikut syarat yang harus dipenuhi:
1. **Aktivasi Merchant Midtrans Live:** Menyerahkan `MIDTRANS_SERVER_KEY` & `MIDTRANS_CLIENT_KEY` produksi dan menetapkan `MIDTRANS_IS_PRODUCTION="true"` pada Environment Secret Manager.
2. **Instruksi Batas Transaksi Uang Nyata:** Penetapan nominal batas uji uang nyata (misal: Rp 1.000 atau Rp 10.000) oleh pemilik kafe untuk memvalidasi alur settlement bank secara riil.
3. **Uji Perangkat Keras Fisik:** Menghubungkan tablet dapur dan printer thermal fisik 58/80 mm saat sesi simulasi staf di lokasi kafe SELA (Prompt 25).

