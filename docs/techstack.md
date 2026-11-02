# ARSITEKTUR & STACK PRODUKSI SMART QR MENU
## Dokumen Keputusan Arsitektur & Teknologi Produksi

> **Lokasi Berkas:** `techstack.md` (Root Repositori)  
> **Status:** Keputusan Disetujui (Baseline Engineering Architecture)  
> **Peran:** Technical Lead  
> **Dokumen Referensi:** `Proposal Pengembangan Website Smart QR Menu.docx`, `docs/AGENT.md`, `docs/DESIGN.md`, dan prototipe `design-preview/`  
> **Tanggal Pemeriksaan & Rilis:** 2026-10-27  

---

## 1. Ringkasan Kebutuhan yang Memengaruhi Pemilihan Teknologi

Pemilihan teknologi produksi Smart QR Menu didasarkan pada batasan bisnis, operasional, dan teknis yang ketat:

1. **Pengembang Tunggal (Solo Developer) & Sprint 7 Hari:** Arsitektur harus meminimalkan *cognitive load*, menghindari overhead konfigurasi berlapis (*monorepo tooling*, *microservices*, atau *dual-repo sync*), dan memungkinkan *rapid feature iteration* dari Hari 1 hingga Hari 7.
2. **Keterjangkauan Biaya Operasional (Affordable Zero-to-Low Cloud Cost):** Nilai komersial proposal pengembangan (Rp 750.000) dan segmen kafe mandiri (*single-tenant*) menuntut arsitektur yang dapat berjalan di atas *free-to-low tier* layanan cloud tanpa biaya langganan bulanan minimum yang membebani.
3. **Integritas Transaksional Relasional (ACID):** Pemesanan makanan melibatkan nomor meja, item menu, *modifier* berbayar, kalkulasi subtotal, alokasi stok (*sold out*), dan pencocokan token pembayaran QRIS. Dibutuhkan database relasional yang mendukung transaksi atomik dan *foreign key constraint* ketat.
4. **Kebutuhan Real-Time Antrean Dapur (KDS) & Pelacak Pesanan:** Pesanan baru yang dibayar via QRIS atau dikonfirmasi kasir harus muncul seketika di layar barista/dapur tanpa *refresh* browser manual, disertai pemicu audio lonceng (*chime alert*).
5. **Nir-Instalasi di Sisi Pelanggan (Zero-App-Install Mobile Web):** Aplikasi pelanggan harus berjalan ringan dan instan di browser ponsel Android dan iOS melalui pemindaian QR code meja kamera native, dengan *initial payload* kecil dan performa *fast load*.
6. **Anti-Overengineering:** Tidak menggunakan Kubernetes, Docker Swarm, message broker terpisah (Kafka/RabbitMQ), microservices, atau layanan berbayar AI/LLM. Seluruh kebutuhan dipenuhi oleh satu aplikasi modular monolitik (*modular monolith*).

---

## 2. Perbandingan Dua Opsi Stack Realistis & Rekomendasi Utama

Kami membandingkan dua opsi arsitektur realistis yang paling relevan untuk ekosistem Node.js/TypeScript:

| Kriteria Evaluasi | Opsi 1 (Rekomendasi Utama): Fullstack Next.js (App Router) + PostgreSQL | Opsi 2 (Alternatif): Terpisah (Vite React SPA + Express.js API) + PostgreSQL |
|---|---|---|
| **Struktur Repositori** | **Monolitik Modular (Single Codebase)**. Frontend, API Route Handlers, dan skema database berada dalam 1 proyek. | **Terpisah / Dual-Service**. Frontend SPA dan backend API berjalan sebagai dua proses/proyek terpisah. |
| **Kecepatan Sprint 7 Hari** | **Sangat Tinggi**. Tidak ada setup CORS, tidak ada sinkronisasi tipe ganda, deploy 1-klik ke platform cloud. | **Sedang**. Membutuhkan konfigurasi CORS, reverse proxy, sharing schema TypeScript manual, dan deployment ganda. |
| **Integritas Tipe Data** | **End-to-End Type Safety**. Tipe model Prisma langsung di-share dari database query ke server action/route handler dan UI komponen. | **Parsial**. Memerlukan monorepo tool (Turborepo/Nx) atau duplikasi interface TypeScript antar repo. |
| **Mekanisme Real-Time KDS** | **Server-Sent Events (SSE) / Supabase Realtime**. Ringan, hemat resource, bekerja alami di HTTP/2 serverless. | **WebSockets murni (Socket.io)**. Sangat cepat, namun memerlukan server Node.js *stateful* yang berjalan terus-menerus (*long-running process*). |
| **Biaya Hosting Awal** | **Rp 0 / bulan** (Vercel Hobby Tier + Supabase/Neon Free Tier PostgreSQL). | **Minimal Rp 80.000–Rp 150.000 / bulan** (memerlukan VPS Linux / Railway dyno untuk server Socket.io yang *stateful*). |
| **Kemudahan Pemeliharaan** | **Tinggi bagi solo developer**. Hanya 1 pipeline CI/CD, 1 file konfigurasi environment, dan 1 repositori. | **Sedang**. Pengembang harus memantau dua runtime (server web statis + backend API daemon). |

### Keputusan & Rekomendasi Utama
> **DIPILIH: OPSI 1 — Fullstack Next.js (App Router, TypeScript) + PostgreSQL (Prisma ORM)**  
> **Trade-off yang Diterima:** Mekanisme real-time untuk KDS dapur menggunakan pendekatan *Server-Sent Events (SSE)* atau *Supabase Realtime (PostgreSQL WAL)* daripada WebSocket dua arah (*bidirectional*) penuh. Trade-off ini sangat ideal karena data pesanan di kafe didominasi aliran satu arah (*one-way server-to-client push* dari kasir/webhook ke dapur).

---

## 3. Rincian Keputusan Komponen Teknologi Produksi

Berikut adalah keputusan teknis per modul dan fungsinya:

### 3.1. Frontend & Rendering
* **Pilihan:** **Next.js 15 (App Router, React 19)**.
* **Alasan:** Menyediakan pemisahan *React Server Components* (RSC) untuk loading cepat pada katalog menu dan *Client Components* interaktif untuk state keranjang, stepper modifier, audio alert KDS, dan dialog print thermal.
* **Styling/UI:** **Tailwind CSS v3.4** + **Lucide React** (ikon). Memastikan bundle CSS minimal, menghindari CSS runtime overhead, dan mendukung styling presisi untuk mobile viewport 390px serta dashboard KDS 1280px.

### 3.2. Backend & API Layer
* **Pilihan:** **Next.js Route Handlers (`/app/api/...`)**.
* **Alasan:** Menjadi titik integrasi webhook Midtrans (`/api/webhooks/midtrans`), kalkulasi transaksi pesanan, mutasi stok, dan endpoint SSE untuk antrean dapur. Berjalan sebagai fungsi modular terisolasi.

### 3.3. Bahasa Pemrograman
* **Pilihan:** **TypeScript (v5.7, Strict Mode)**.
* **Alasan:** Menghilangkan potensi *type error* atau salah penamaan field antara skema database transaksi, payload gateway, dan antarmuka UI.

### 3.4. Database Relasional & Migrasi Data
* **Pilihan Database:** **PostgreSQL (v15 / v16)** via penyedia terkelola (**Supabase Database** atau **Neon Serverless Postgres**).
* **Alasan:** Mendukung integritas data relasional ACID, indeks performa tinggi pada nomor meja dan status pesanan, serta kolom bertipe `JSONB` untuk menyimpan konfigurasi modifier dinamis per menu tanpa perlu *table join* berlebihan.
* **ORM & Migrasi:** **Prisma ORM (v6.1)**. Menjamin skema database terdokumentasi dalam berkas deklaratif tunggal (`prisma/schema.prisma`), migrasi versi terkelola otomatis (`prisma migrate deploy`), dan *client autocompletion* bebas kesalahan ketik.

### 3.5. Autentikasi Staf (Kasir, Dapur, Admin)
* **Pilihan:** **Cookie-Based Stateless Session (JWT via `jose` atau Iron-Session) dengan Proteksi PIN 4–6 Digit**.
* **Alasan:** Sistem kafe fisik tidak memerlukan registrasi email/OAuth Google yang rumit untuk kasir dan barista. Staf berganti shift dengan memasukkan PIN kasir/dapur cepat. Sesi disimpan dalam HTTP-Only secure cookie yang tervalidasi via Next.js Middleware. Pelanggan meja beroperasi sepenuhnya *guest* (tanpa login).

### 3.6. Validasi Skema Data
* **Pilihan:** **Zod (v3.24)**.
* **Alasan:** Validasi ketat pada *boundary* aplikasi: memeriksa payload pembuatan pesanan dari pelanggan, parameter meja, skema konfigurasi kuis admin, dan verifikasi struktur payload webhook dari payment gateway.

### 3.7. Penyimpanan Foto Menu (Asset Storage)
* **Pilihan:** **Supabase Storage** (atau **Cloudinary Free Tier** sebagai alternatif).
* **Alasan:** Menu kafe rata-rata berkisar 20–50 item. Free tier menyediakan kapasitas 1 GB–25 GB dengan CDN global, jauh melampaui kebutuhan foto katalog kafe (~15 MB total). Tidak perlu menyewa bucket AWS S3 berbayar.

### 3.8. Arsitektur Real-Time (KDS Dapur & Pelacak Pesanan)
* **Pilihan:** **Server-Sent Events (SSE) via Route Handler** atau **Supabase Realtime (PostgreSQL Change Data Capture)**.
* **Alasan:** Ringan, otomatis melakukan *reconnect*, tidak membutuhkan server Socket.io terpisah, dan hemat bandwidth. Saat tabel `orders` diperbarui statusnya, event seketika diteruskan ke browser dapur dan browser pelanggan.

### 3.9. Pengujian (Testing Suite)
* **Pilihan:** **Vitest (Unit/Integration Test)** + **Playwright (End-to-End UAT Test)**.
* **Alasan:** Vitest menguji fungsi murni (algoritma *weighted tag matching* kuis, kalkulasi subtotal modifier, dan verifikasi signature SHA512 webhook). Playwright menguji skenario kritis: Buka Meja 05 $\rightarrow$ Keranjang $\rightarrow$ Checkout Tunai $\rightarrow$ Muncul di KDS Kasir $\rightarrow$ Cetak Struk.

### 3.10. Deployment & Hosting
* **Pilihan:** **Vercel Hobby Tier** (Frontend & API) terhubung ke **Supabase / Neon** (Managed PostgreSQL) untuk fase awal, dengan opsi alternatif single Docker container pada **Railway** atau **VPS Coolify/Dokku** jika kuota Vercel terlampaui.

### 3.11. Logging & Monitoring
* **Pilihan:** **Structured JSON Logger (Pino)** + Next.js Serverless Function Logs.
* **Alasan:** Logging terstruktur tanpa overhead performa; memudahkan pelacakan ID transaksi pembayaran gagal atau anomali webhook.

### 3.12. Pencadangan Data (Backup Strategy)
* **Pilihan:** **Automated Daily Snapshot** bawaan Supabase/Neon + script terjadwal `pg_dump` mingguan ke cloud storage independen.

---

## 4. Analisis & Pemilihan Payment Gateway (Midtrans vs Xendit)

Berdasarkan pemeriksaan dokumentasi resmi terkini (2026-10-27), berikut perbandingan mendalam antara dua alternatif proposal:

| Parameter Evaluasi | Midtrans (Core API / Snap) | Xendit (QR Codes API v2) |
|---|---|---|
| **Metode QRIS Dinamis** | Endpoint `POST /v2/charge` dengan payload `payment_type: "qris"` dan `acquirer: "gopay"`. Mengembalikan raw `qr_string` (standar EMVCo) dan URL gambar QR siap tampil di array `actions`[1][8]. | Endpoint `POST /qr_codes` (header `api-version: 2022-07-31`) dengan `type: "DYNAMIC"`. Mengembalikan `qr_string` dan `status: "ACTIVE"`[3][6]. |
| **Waktu Kedaluwarsa QRIS** | Bawaan 15 menit[8] (sangat ideal untuk pesanan makan di tempat / *dine-in* kafe). | Dapat dikustomisasi via parameter ISO 8601 `expires_at` (default 48 jam jika tidak diisi)[1][2]. |
| **Mekanisme Webhook Callback** | Mengirimkan HTTP POST dengan JSON payload. Verifikasi keamanan menggunakan **SHA512 Signature Hash**:  
`SHA512(order_id + status_code + gross_amount + ServerKey)`[11]. Status sukses: `transaction_status == "settlement"`[11][12]. | Mengirimkan HTTP POST dengan event `qr.payment`[9][10]. Verifikasi keamanan menggunakan pengecekan header `x-callback-token` terhadap token webhook dashboard[1][8]. |
| **Lingkungan Sandbox & Simulator** | Tersedia lengkap di `api.sandbox.midtrans.com`[3][4] dengan **Simulator QRIS resmi** berbasis web yang memungkinkan pengembang melakukan simulasi pemindaian bayar sukses/gagal instan tanpa uang riil. | Tersedia di `api.xendit.co` dengan mode test key (`xnd_development_...`)[4]. |
| **Persyaratan Akun Merchant** | Mendukung pendaftaran **Akun Individu / Perorangan** (cukup KTP + Buku Tabungan pribadi). Cocok untuk UMKM kafe mandiri tanpa badan hukum PT/CV. | Lebih condong dan mengutamakan entitas bisnis legal formal (PT/CV/Yayasan) untuk aktivasi channel perbankan tertentu. |
| **Biaya Transaksi (MDR QRIS)** | Standar Bank Indonesia **0,7%** per transaksi (dipotong otomatis saat *settlement*). Tanpa biaya integrasi awal dan tanpa biaya bulanan. | Standar Bank Indonesia **0,7%** per transaksi. Tanpa biaya bulanan. |

### Keputusan Payment Gateway Terpilih
> **REKOMENDASI UTAMA: MIDTRANS CORE API (CHARGE QRIS)**  
> **Alasan Pemilihan:**  
> 1. Kemudahan verifikasi merchant perorangan (*individual merchant*) bagi kafe rintisan tanpa badan hukum PT/CV.  
> 2. Ketersediaan simulator QRIS interaktif publik di Sandbox yang mempercepat UAT pengembang pada Hari ke-4 sprint tanpa menunggu rekening bank merchant aktif.  
> 3. Response API menyertakan URL gambar QR langsung di samping string mentah, memberikan fallback rendering instan di frontend pelanggan.  
>  
> **Status Verifikasi Akun Merchant:**  
> ⚠️ **BELUM DIVERIFIKASI / BELUM AKTIF**. Akun produksi Midtrans milik kafe memerlukan dokumen KTP dan rekening tabungan dari pemilik kafe. Proses integrasi sprint Hari 1–6 **wajib menggunakan Sandbox Midtrans**. Perpindahan ke Production Key dilakukan saat sesi serah terima Hari ke-7.

---

## 5. Strategi Kode QR Meja, Struk Digital, & Cetak Thermal

Proposal menjanjikan generator QR meja, struk digital, dan kompatibilitas printer thermal 58/80 mm. Berikut pembagian strategi teknis nyata:

### 5.1. Generator QR Meja (Admin)
* **Teknologi:** Pustaka `qrcode` (Node.js/Browser).
* **Format:** Vektor SVG dan PNG beresolusi tinggi (300 DPI, ukuran cetak $10 \times 10$ cm).
* **Payload URL:** Mengarah langsung ke URL produksi kafe dengan query parameter meja:  
  `https://[domain-kafe]/order?table=05`
* **Keamanan:** Nilai meja divalidasi terhadap database meja aktif di server. Meja yang non-aktif akan menampilkan peringatan dan mencegah *checkout*.

### 5.2. Struk Digital (*E-Receipt*)
* **Teknologi:** Halaman responsif web `/receipt/[orderId]` dengan layout struk kasir monospaced.
* **Fitur:** Tampil otomatis setelah status pesanan berubah menjadi `PAID` atau `WAITING_CASHIER`. Dilengkapi tombol unduh gambar struk (menggunakan `html-to-image` / Canvas) untuk disimpan di galeri ponsel pelanggan.

### 5.3. Cetak Thermal Kasir & Dapur (58 mm & 80 mm)
Klaim cetak thermal diterjemahkan secara objektif ke dalam 3 tingkatan strategi:

```
+---------------------------------------------------------------------------------------+
|                       STRATEGI PENCETAKAN THERMAL SISTEM SMART QR MENU                |
+------------------------------------+--------------------------------------------------+
| Tingkat 1: Browser Print Dialog    | Jalur Utama Baseline (Universal di Semua Device) |
| (CSS @media print 58/80 mm)        | • Bekerja di Windows, macOS, Android, dan iOS.   |
|                                    | • Memakai driver printer OS yang sudah terpasang.|
|                                    | • Butuh 1-klik konfirmasi dialog cetak browser.  |
+------------------------------------+--------------------------------------------------+
| Tingkat 2: Web Bluetooth / WebUSB  | Jalur Peningkatan Bertahap (Progressive Opt-In)  |
| (ESC/POS Direct Byte Streaming)    | • Cetak instan 1-klik tanpa dialog OS.           |
|                                    | • Terbatas di Chrome Android & Desktop Windows.  |
|                                    | • TIDAK DIDUKUNG di Safari iOS / iPadOS.         |
+------------------------------------+--------------------------------------------------+
| Tingkat 3: Local Hardware Bridge   | Solusi Khusus (Out-of-Scope Baseline 7 Hari)     |
| (QZ Tray / Local Service Daemon)   | • Butuh aplikasi tambahan diinstal di PC kasir.  |
|                                    | • Diusulkan sebagai add-on jika kafe menuntut    |
|                                    |   "silent auto-print" tanpa interaksi staf.      |
+------------------------------------+--------------------------------------------------+
```

> **Batasan Realistis:** Tim pengembang **tidak menjamin** *silent print* otomatis tanpa dialog pada semua printer thermal murah di pasaran tanpa pengujian unit fisik printer secara langsung di lokasi kafe. Seluruh pencetakan baseline menggunakan template layout CSS `@media print` presisi 58 mm / 80 mm.

---

## 6. Tabel Matriks Teknologi, Versi Terverifikasi, & Strategi Lockfile

Pemeriksaan versi dilakukan pada tanggal **2026-10-27** mengacu pada registry resmi NPM, Context7 docs, dan dokumentasi penyedia layanan.

| Kategori | Teknologi | Peran dalam Sistem | Alasan Pemilihan | Alternatif yang Tidak Dipilih | Batasan / Catatan | Versi Terverifikasi | Sumber Resmi |
|---|---|---|---|---|---|:---:|---|
| **Runtime** | Node.js | Runtime lingkungan eksekusi JavaScript server | Standar industri stabil LTS, performa I/O tinggi, kompatibilitas luas | Deno, Bun | Dijalankan pada mode Node 20+ LTS | `v20.18.0 LTS` | nodejs.org |
| **Package Manager** | PNPM | Pengelola paket dependensi repositori | Instalasi cepat, hemat penyimpanan disk via content-addressable storage, lockfile deterministik | NPM, Yarn | Harus dikunci via `pnpm-lock.yaml` | `v9.15.0` | pnpm.io |
| **Framework** | Next.js | Fullstack Web Application (Client & Server) | Arsitektur monolitik modular, SSR + Client hybrid, integrasi Route Handler instan | Remix, SvelteKit, Nuxt | Hosting serverless membutuhkan adaptor streaming SSE | `15.1.8` | npm / context7 (`/vercel/next.js`) |
| **UI Library** | React | Pustaka antarmuka deklaratif | Fondasi komponen Next.js 15, ekosistem UI terkaya | Vue, Solid | Komponen interaktif menggunakan directive `'use client'` | `19.0.0` | npm (`react`) |
| **Bahasa** | TypeScript | Bahasa pemrograman tipe ketat | Mencegah bug data transaksi dan payload API sebelum runtime | JavaScript murni | Menambah langkah kompilasi saat build | `5.7.3` | npm (`typescript`) |
| **CSS Framework** | Tailwind CSS | Sistem styling utility-first | Ukuran bundle kecil via purge, konsistensi token warna kafe, responsive modifier | Styled Components, Chakra UI | Membutuhkan disiplin penulisan class di JSX | `3.4.17` | npm (`tailwindcss`) |
| **Ikon UI** | Lucide React | Set ikon antarmuka fungsional | Ikon ringan, pohon dependensi modular (tree-shakeable) | FontAwesome, React Icons | Hanya memuat ikon yang di-import | `0.475.0` | npm (`lucide-react`) |
| **Database** | PostgreSQL | Sistem database relasional utama | Standar industri ACID, query relasional cepat, dukungan tipe data JSONB | MySQL, MongoDB | Membutuhkan connection pooler pada serverless hosting | `v16.x` | postgresql.org |
| **Database ORM** | Prisma | ORM tipe aman & migration runner | Skema deklaratif tunggal, migrasi otomatis, tipe TypeScript auto-generated | Drizzle ORM, TypeORM | Ukuran bundle Prisma engine pada serverless cold-start | `6.1.0` | npm / context7 (`/websites/prisma_io`) |
| **Skema Validasi** | Zod | Validasi tipe runtime input user & API | Inferensi tipe TypeScript otomatis, validasi aman untuk webhook & checkout | Yup, Joi | Perlu penulisan skema ganda jika tidak memakai generator | `3.24.2` | npm (`zod`) |
| **Payment Gateway** | Midtrans Client | SDK integrasi transaksi QRIS & status | SDK resmi teruji di Indonesia, mendukung QRIS Core API | Xendit SDK | Membutuhkan hashing signature SHA512 manual di endpoint webhook | `1.4.2` | npm (`midtrans-client`) / docs.midtrans.com |
| **QR Code Engine** | QRCode | Pembuat gambar QR meja SVG/PNG | Generator lokal tanpa dependensi API luar, cepat dan gratis | Google Chart API (usang) | Butuh canvas library jika render gambar di server | `1.5.4` | npm (`qrcode`) |
| **Audio Synthesizer** | Web Audio API | Pembangkit suara lonceng notifikasi KDS | Audio chime bawaan browser tanpa unduh berkas MP3 eksternal | Audio HTML5 file MP3 | Memerlukan interaksi klik pertama staf kafe (*autoplay policy*) | *Browser Native W3C Standard* | w3.org/TR/webaudio |
| **Unit Testing** | Vitest | Pengujian logika kuis & kalkulasi transaksi | Eksekusi sangat cepat berbasis Vite/ESM, kompatibel dengan sintaks Jest | Jest | Membutuhkan setup environment JSDOM untuk UI unit | `3.0.5` | npm (`vitest`) |
| **E2E Testing** | Playwright | Pengujian alur belanja hingga cetak struk | Otomasi browser nyata (Chromium/WebKit), headless runner stabil | Cypress | Membutuhkan resource komputasi saat build CI | `1.50.1` | npm (`@playwright/test`) |

### Strategi Penguncian Versi Dependensi (Lockfile Strategy)
Untuk menjamin hasil kompilasi deterministik dan mencegah inkonsistensi versi paket saat tim melakukan *deployment*, berlaku aturan teknis:
1. Seluruh dependensi dideklarasikan dengan versi eksplisit (tanpa tanda prefix wildcard `*` atau caret fleksibel `^` pada paket kritis).
2. Berkas `pnpm-lock.yaml` wajib di-*commit* ke repositori Git.
3. Pipeline build dan server deployment diinstruksikan untuk selalu menggunakan perintah:
   ```bash
   pnpm install --frozen-lockfile
   ```
   Perintah ini akan menggagalkan proses build jika terdapat ketidaksesuaian antara `package.json` dan `pnpm-lock.yaml`.

---

## 7. Klasifikasi Biaya Operasional Riil (Infrastruktur & Layanan)

Biaya jasa pengembangan perangkat lunak sebesar **Rp 750.000** pada proposal awal murni dialokasikan untuk rekayasa kode dan **tidak mencakup biaya sewa infrastruktur berbayar atau perangkat keras**. 

Sesuai konfirmasi keputusan `DEC-008`, tim pengembang menanggung biaya sewa domain dan cloud hosting tier standar pada tahun pertama. Rincian klasifikasi biaya disajikan di bawah ini:

| Komponen Pengeluaran | Status Alokasi Tanggung Jawab | Estimasi Biaya Riil (IDR) | Periode Pembayaran | Keterangan & Sumber Estimasi |
|---|---|---|---|---|
| **Domain Kustom (.com / .id)** | **Ditanggung Pengembang (Tahun Pertama)** (`DEC-008`) | Rp 150.000 – Rp 250.000 | Tahunan | Harga sewa domain registrar Indonesia (Niagahoster/Biznet/Cloudflare). Tahun kedua ditanggung kafe. |
| **Cloud Hosting Web & API** | **Ditanggung Pengembang (Tahun Pertama)** (`DEC-008`) | Rp 0 (Free Tier) s/d Rp 150.000 / bulan | Bulanan | Menggunakan Vercel Hobby Tier (Gratis) / Railway Starter ($5/bln) jika kuota serverless terlampaui. |
| **Managed Database (PostgreSQL)** | **Ditanggung Pengembang (Tahun Pertama)** (`DEC-008`) | Rp 0 (Free Tier) | Bulanan | Menggunakan Supabase Free Tier (500 MB database, 50.000 MAU) atau Neon Free Tier (0.5 GB storage). |
| **Asset Storage (Foto Menu)** | **Ditanggung Pengembang (Tahun Pertama)** (`DEC-008`) | Rp 0 (Free Tier) | Bulanan | Supabase Storage Free Tier (1 GB penyimpanan foto menu kafe). |
| **MDR Transaksi QRIS** | **Ditanggung Pihak Kafe (Merchant)** (`DEC-008`) | **0,7% per transaksi** | Per Transaksi | Ketetapan resmi Bank Indonesia untuk MDR QRIS kategori Usaha Mikro/Kecil. Dipotong otomatis oleh Midtrans. |
| **Perangkat Tablet/Laptop Kasir & Dapur** | **Ditanggung Pihak Kafe (Merchant)** (`DEC-008`) | Rp 1.500.000 – Rp 3.000.000 per unit | Satu Kali (Awal) | Perangkat keras fisik milik kafe (tablet Android min 10" / laptop operasional). |
| **Unit Printer Thermal 58/80 mm** | **Ditanggung Pihak Kafe (Merchant)** (`DEC-008`) | Rp 350.000 – Rp 750.000 per unit | Satu Kali (Awal) | Printer thermal Bluetooth/USB kasir dan dapur (contoh merk: Panda, Eppos, Iware, Sunmi). |
| **Kertas Struk Thermal (Rolls)** | **Ditanggung Pihak Kafe (Merchant)** (`DEC-008`) | Rp 30.000 – Rp 60.000 / pak | Rutin Operasional | Kertas roll thermal standar 58×30 mm atau 80×50 mm. |

---

## 8. Spesifikasi Variabel Lingkungan (Environment Variables)

Untuk menjaga keamanan kredensial dan rahasia dagang, variabel lingkungan dipisahkan secara tegas antara variabel publik (dapat diakses browser klien) dan variabel privat rahasia (hanya boleh dibaca runtime server):

### 8.1. Variabel Publik Klien (Aman Dikirim ke Browser)
Prefix: `NEXT_PUBLIC_`
```ini
# Identitas Kafe & Base URL
NEXT_PUBLIC_APP_NAME="Kala Senja Coffee & Eatery"
NEXT_PUBLIC_BASE_URL="https://order.kalasenja.com"

# Konfigurasi Fitur & Default Meja
NEXT_PUBLIC_DEFAULT_CURRENCY="IDR"
NEXT_PUBLIC_MAX_NOTES_LENGTH="100"

# Midtrans Client Key (Hanya Client Key untuk Snap UI jika diperlukan)
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="SB-Mid-client-xxxxxxxxxxxxxxxx"
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION="false"

# Supabase Public Anon Key (Untuk Realtime KDS & Storage CDN)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 8.2. Variabel Privat Server-Only (Dilarang Bocor ke Browser)
Tanpa prefix `NEXT_PUBLIC_` (Otomatis dicegah bocor oleh kompilator Next.js):
```ini
# Koneksi Database Relasional PostgreSQL
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres"

# Kredensial Rahasia Payment Gateway Midtrans
MIDTRANS_SERVER_KEY="SB-Mid-server-xxxxxxxxxxxxxxxx"
MIDTRANS_MERCHANT_ID="G123456789"

# Token Keamanan Autentikasi Staf & Webhook
STAFF_AUTH_SECRET="super-secret-random-32-bytes-string-for-jwt"
CASHIER_PIN_HASH="$2b$10$epvH...hashed_pin_kasir"
KITCHEN_PIN_HASH="$2b$10$z7uK...hashed_pin_dapur"
ADMIN_PIN_HASH="$2b$10$w8kL...hashed_pin_admin"

# Rate Limiting & Keamanan
RATE_LIMIT_MAX_REQUESTS_PER_MINUTE="60"
```

---

## 9. Risiko Kelayakan Timeline 7 Hari & Keputusan Terbuka

Proposal menargetkan penyelesaian dalam waktu **7 hari kerja**. Semua kebutuhan fungsional proposal (`REQ-CUST`, `REQ-PAY`, `REQ-OPS`, `REQ-ADMIN`, `REQ-B2B`) tetap dipetakan secara lengkap ke dalam arsitektur ini.

### 9.1. Matriks Risiko Timeline & Strategi Mitigasi

| Risiko Penghambat | Tingkat Dampak | Probabilitas | Rencana Mitigasi Teknis (Fallback) |
|---|:---:|:---:|---|
| **Aktivasi Merchant Midtrans Terlambat** | **Kritis** | Tinggi | Gunakan **Midtrans Sandbox Simulator** selama fase pengembangan Hari 1–6. Seluruh alur UAT pembayaran QRIS dinamis tetap dapat diuji 100% tanpa kendala verifikasi bank. |
| **Keterlambatan Penyerahan Foto & Data Menu Kafe** | Sedang | Tinggi | Sistem menggunakan *Starter Dataset Seed* berupa 20 item menu kopi dan makanan realistis. Pemilik kafe dapat mengedit dan mengimpor menu aslinya secara mandiri via modul Admin. |
| **Ketiadaan Fisik Printer Thermal saat Pengujian** | Sedang | Sedang | Lakukan uji coba layout cetak menggunakan emulator cetak atau *Print to PDF* ukuran kustom 58 mm / 80 mm. Uji fisik thermal dilakukan langsung saat serah terima lokasi di Hari ke-7. |
| **Koneksi Wi-Fi Kafe Tidak Stabil saat Jam Sibuk** | Sedang | Sedang | KDS dapur dilengkapi mekanisme *Heartbeat Polling* otomatis setiap 15 detik jika koneksi SSE terputus, disertai banner merah status offline pada layar kasir/dapur. |

### 9.2. Daftar Keputusan & Ketergantungan Terbuka (Open Dependencies)

Hal-hal berikut masih memerlukan tindakan atau penyediaan resmi dari pihak pemilik kafe sebelum peluncuran live produksi:
1. **Penyerahan Berkas KTP & Buku Tabungan Kafe:** Diperlukan untuk pengajuan KYC akun Midtrans Production agar dana penjualan dapat ditarik (*payout/settlement*) ke rekening kafe.
2. **Penentuan Nama Domain Utama Kafe:** Pemilik kafe harus memilih nama domain (contoh: `menu.namakafe.com` atau `namakafe.id`).
3. **Penyediaan Model & Merk Printer Thermal:** Mengetahui apakah printer kasir/dapur menggunakan koneksi Bluetooth, USB, atau LAN Network untuk optimalisasi driver.

---

## 10. Kesimpulan Rekomendasi Technical Lead

Arsitektur produksi berbasis **Next.js 15 Fullstack (TypeScript) + PostgreSQL (Prisma ORM) + Midtrans Core API + Tailwind CSS** adalah opsi yang paling unggul, realistis, dan hemat biaya untuk mengantarkan proyek Smart QR Menu mencapai target serah terima dalam 7 hari kerja oleh pengembang tunggal.

Arsitektur ini menghilangkan kerumitan operasional yang tidak perlu, menjamin keandalan data transaksi, memberikan performa cepat bagi pelanggan, serta ramah anggaran operasional kafe.
