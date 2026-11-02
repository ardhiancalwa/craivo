# ADR-0001: Strategi Hosting Vercel Free Tier, PostgreSQL Terkelola, & Resilient SSE Stream

## 1. Status
**ACCEPTED** (28 Oktober 2026)

## 2. Konteks & Masalah
Sistem Cravio dirancang untuk operasional satu kafe mandiri (*single-tenant pilot* SELA) oleh pengembang tunggal. Pemilik proyek menetapkan penggunaan **Vercel Free Tier (Hobby Tier)** untuk menjaga biaya hosting aplikasi tetap **Rp 0 / bulan**, dipadukan dengan layanan basis data terkelola cloud gratis (Supabase / Neon Free Tier) dan penyimpanan aset foto gratis (Supabase Storage 1 GB).

Tantangan teknis utama yang harus dipecahkan pada lingkungan serverless Vercel Free Tier:
1. **Batas Durasi Eksekusi Serverless (Function Timeout):** Serverless function di Vercel Hobby memiliki batas eksekusi maksimum default 15–60 detik. Koneksi real-time tradisional yang bersifat *long-running persistent socket* (seperti server Socket.io yang hidup berjam-jam) tidak dapat berjalan secara native di serverless function tanpa terputus secara sepihak oleh runtime Vercel.
2. **Kelebihan Beban Koneksi Database (*Connection Exhaustion*):** Setiap request serverless memicu instance function baru yang dapat membuka koneksi TCP terpisah ke database. Jika 20 pelanggan checkout bersamaan, koneksi PostgreSQL dapat habis jika terhubung langsung ke port 5432.
3. **Keterbatasan Pencadangan Terkelola Gratis:** Layanan Supabase Free Tier tidak menyediakan backup point-in-time otomatis terkelola (hanya tersedia di paket Pro ke atas).

## 3. Keputusan yang Ditetapkan

### 3.1. Target Hosting Aplikasi: Vercel Free Tier (Next.js 15 App Router)
* Aplikasi monolitik Next.js 15 di-deploy secara penuh di atas **Vercel Free Tier** (menghasilkan biaya server Rp 0).
* Semua rute UI, API Route Handlers, dan integrasi webhook berjalan sebagai serverless functions yang teroptimasi ringan.
* Seluruh state aplikasi bersifat *stateless* di memori server; data transaksi, nomor antrean, dan idempotensi sepenuhnya disimpan di database PostgreSQL.

### 3.2. Database Relasional: Managed PostgreSQL dengan Connection Pooler
* Menggunakan **Supabase Database / Neon Serverless Postgres (Free Tier)**.
* Mengonfigurasi dua connection string pada Prisma ORM:
  1. `DATABASE_URL`: Mengarah ke Supabase Supavisor / PgBouncer pooler (port 6543) dengan parameter `?pgbouncer=true`. Digunakan oleh runtime aplikasi untuk transaksi cepat tanpa menghabiskan pool koneksi.
  2. `DIRECT_URL`: Mengarah langsung ke database PostgreSQL (port 5432). Digunakan secara eksklusif oleh Prisma CLI saat mengeksekusi migrasi skema (`npx prisma migrate deploy`).

### 3.3. Mekanisme Real-Time: Graceful Resilient SSE Streaming
Untuk menyajikan sinkronisasi instan KDS dapur dan pelacak pesanan pelanggan tanpa terputus error timeout Vercel:
* **Server-Side Route Handler:** Endpoint `/api/staff/kds/events` dan `/api/orders/[orderId]/stream` menggunakan `ReadableStream` standar Web API.
* **Siklus Stream Anggun (25–30 Detik):** Server mengirimkan pesan heartbeat setiap 10 detik. Pada detik ke-25 hingga ke-28, server menutup stream secara anggun (*graceful close 200 OK*).
* **Auto-Reconnect Klien:** Klien browser (KDS & tracker) mendengarkan stream via `EventSource` atau custom stream reader. Begitu stream tertutup normal, klien otomatis menyambung kembali dalam tempo $\le 1$ detik dengan menyertakan header `Last-Event-ID` atau query timestamp.
* **Hasil:** Operasional dapur tetap menerima pesanan baru secara real-time $\le 2$ detik tanpa pernah terkena crash timeout 504 Gateway Timeout.

### 3.4. Penyimpanan Aset Foto Menu: Supabase Object Storage
* Foto produk menu disimpan di **Supabase Storage (Free Tier - 1 GB)**.
* File gambar di-upload oleh admin via server route handler terautentikasi, di-convert ke WebP terkompresi ($\le 300\text{ KB}$), dan disajikan ke pelanggan melalui public CDN URL Supabase tanpa membebani kuota bandwidth Vercel.

### 3.5. Strategi Pencadangan Database Mandiri
* Karena Supabase Free Tier tidak menyertakan backup harian terkelola otomatis, disiapkan skrip terjadwal `pg_dump` otomatis mingguan melalui GitHub Actions terjadwal ke penyimpanan cloud terpisah untuk menjamin pemulihan data transaksi (*Disaster Recovery*).

## 4. Konsekuensi & Trade-Off
* **Keuntungan:** Biaya hosting dan database Rp 0 / bulan, performa cepat via CDN global Vercel, setup mudah bagi solo developer, tidak ada biaya server bulanan yang membebani kafe.
* **Kelemahan & Mitigasi:** Koneksi SSE terputus dan tersambung ulang setiap ~30 detik; mitigasi diterapkan melalui penanganan deduplikasi event dan indikator reconnect transparan di antarmuka KDS.

