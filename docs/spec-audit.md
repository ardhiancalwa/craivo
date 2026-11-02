# AUDIT SPESIFIKASI, RESOLUSI KONFLIK, & PENETAPAN BASELINE (SPEC-AUDIT.MD)
## Cravio — Your craving, Perfectly Matched
### Pilot Mitra Kafe: SELA (Artisanal Coffee & Bake)

> **Lokasi Berkas:** `docs/spec-audit.md`  
> **Status:** Baseline Disetujui (Phase 01 Complete)  
> **Tanggal Pemeriksaan:** 28 Oktober 2026  
> **Peran Penulis:** Technical Lead & Fullstack Engineer  
> **Acuan Dokumen:** `Proposal Pengembangan Website Smart QR Menu.docx`, `docs/agent.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/techstack.md`, `docs/architecture.md`, `docs/design.md`, `docs/visual-direction.md`, `docs/skils.md`, `docs/project-context.md`, dan prototipe `design-preview/`.

---

## 1. Inventarisasi Aset & Realitas Proyek

### 1.1. Inventarisasi Dokumen & Komponen yang Tersedia
Pemeriksaan menyeluruh pada repositori membuktikan keberadaan aset-aset berikut:

| Kategori Aset | Lokasi Fisik Berkas | Ukuran / Karakter | Kondisi Aktual |
|---|---|:---:|---|
| **Register Keputusan** | `docs/project-context.md` | 59 baris | Memuat register resmi `DEC-001` s/d `DEC-015`. |
| **Panduan Agent** | `docs/agent.md` | 377 baris | Konvensi Next.js 15, invarian proyek, DoD, protokol kerja. |
| **Kebutuhan Produk** | `docs/PRD.md` | 917 baris | Kebutuhan 5 modul, business rules `BR-01` s/d `BR-12`, 17 UAT. |
| **Kebutuhan Teknis** | `docs/TRD.md` | 526 baris | Riwayat spesifikasi teknis awal, integrasi Midtrans, dependensi kafe. |
| **Matriks Teknologi** | `docs/techstack.md` | 293 baris | Next.js 15, PostgreSQL, Prisma 6.1, Tailwind v3.4, Zod 3.24. |
| **Arsitektur Sistem** | `docs/architecture.md` | 776 baris | ERD relasional, alur data SSE, state machine pesanan vs bayar. |
| **Sistem Desain** | `docs/design.md` | 731 baris | Token SELA, layout mobile 390px, KDS 1280px, layout print. |
| **Arah Visual** | `docs/visual-direction.md` | Diselaraskan | Canonical pointer resmi menuju `docs/design.md`. |
| **Indeks Prosedur** | `docs/skils.md` | 104 baris | Indeks katalog 6 prosedur operasional rekayasa. |
| **Rencana Prompt** | `docs/SELA-Production-Ready-Prompt-Plan.md` | 569 baris | Rencana eksekusi bertahap 26 langkah implementasi. |
| **Proposal Asli** | `../proposal/Proposal Pengembangan Website Smart QR Menu.docx` | 18.548 bytes | Dokumen penawaran resmi awal (Word format). |
| **Titik Masuk Root** | `../AGENTS.md` | 38 baris | Instruksi wajib bagi agen Antigravity untuk membaca `docs/agent.md`. |
| **Prototipe Visual** | `design-preview/*.html` | 8 berkas HTML | Prototipe statis terisolasi (*Dilarang diimpor ke src/*). |
| **Skill Proyek** | `.agents/skills/*/SKILL.md` | 6 unit skill | Terverifikasi ada fisik dan terdaftar di runtime harness. |

### 1.2. Pembedaan Rencana Dokumen vs Realitas Implementasi
Untuk mencegah pelaporan yang menyesatkan (*hallucination prevention*), status proyek dipisahkan secara tegas:

* **Klaim Rencana Dokumen:** Dokumen proposal dan arsitektur awal memuat diagram Gantt dengan label `done` pada Hari 1, serta status *Production Ready* pada dokumen desain.
* **Realitas Implementasi Aktual:**
  1. **Aplikasi Belum Di-Scaffold:** Belum ada folder `src/`, `prisma/schema.prisma`, `package.json` aplikasi Next.js, maupun pipeline build. Status implementasi kode adalah **0% (Pra-Scaffolding)**.
  2. **Pengujian Nyata Belum Berjalan:** 17 skenario UAT berstatus *Belum Diuji*; unit test Vitest dan Playwright belum dapat dieksekusi karena kode sumber belum ditulis.
  3. **Akun Gateway Masih Tertunda:** Akun Midtrans Production masih menunggu penyerahan KTP dan rekening kafe. Seluruh pengujian fase pengembangan wajib menggunakan **Midtrans Sandbox**.
  4. **Perangkat Keras Belum Tersedia:** Pengujian printer thermal fisik dan audio diuji menggunakan emulator browser (`window.print()` ke PDF dan HTML5 Web Audio).

---

## 2. Pemetaan Lokasi Kanonis Dokumen (Canonical Mapping)

Untuk menghindari kebingungan akibat variasi nama berkas (seperti suffix `(1)`, perbedaan kapitalisasi, atau path ganda), ditetapkan lokasi penyimpanan kanonis resmi:

```
d:/project/project-qr/cravio/
├── docs/
│   ├── project-context.md        <-- CANONICAL: Register Keputusan (DEC-001 s/d DEC-015)
│   ├── agent.md                  <-- CANONICAL: Panduan Kerja & Protokol Rekayasa Agent
│   ├── PRD.md                    <-- CANONICAL: Product Requirements Document & UAT
│   ├── TRD.md                    <-- CANONICAL: Technical Requirements Document (Historical Baseline)
│   ├── techstack.md              <-- CANONICAL: Matriks Teknologi, Versi, & Environment
│   ├── architecture.md           <-- CANONICAL: Spesifikasi Arsitektur Sistem & ERD
│   ├── design.md                 <-- CANONICAL: Acuan Utama Sistem Desain & Token SELA
│   ├── visual-direction.md       <-- CANONICAL POINTER: Merujuk langsung ke design.md
│   ├── skils.md                  <-- CANONICAL: Indeks Dokumentasi Prosedur Proyek
│   ├── spec-audit.md             <-- CANONICAL: [DOKUMEN INI] Laporan Audit & Baseline
│   ├── requirements-traceability.md <-- CANONICAL: Matriks Keterlacakan Kebutuhan
│   └── implementation-progress.md   <-- CANONICAL: Buku Log Kemajuan Implementasi
├── plans/
│   └── audit-and-baseline-specification-plan.md <-- CANONICAL: Rencana Kerja Tahap 01
├── design-preview/               <-- TERISOLASI: Prototipe visual (tidak boleh diimpor)
├── .agents/skills/               <-- HARNESS: 6 Unit runbook skill proyek
└── ../proposal/                  <-- ARSIP SUMBER: Proposal Word asli
```

---

## 3. Audit Mendalam 13 Area Diskrepansi & Resolusi Resmi

### 3.1. Identitas Merek Produk & Kafe Mitra
* **Temuan Diskrepansi:** Terdapat 4 nama berbeda yang tercampur di berbagai dokumen: *Cravia* (nama proposal lama), *Cravio* (nama folder dan arsitektur), *Kala Senja Coffee* (nama dummy di techstack), dan *SELA* (nama desain dan register DEC-001).
* **Resolusi Resmi:**
  1. **Nama Produk / Platform Sistem:** **Cravio — Your craving, Perfectly Matched**. Digunakan pada landing page B2B, judul sistem, dan promosi komersial solusi.
  2. **Nama Kafe Mitra Perdana (Single-Tenant Pilot):** **SELA** (*Artisanal Coffee & Bake*). Digunakan pada web app pelanggan meja, header menu, KDS dapur, struk kasir, dan QR meja.
  3. Nama *Cravia* dan *Kala Senja* dinyatakan **USANG (DEPRECATED)**. Seluruh data kontak dan alamat fiktif lama dilarang digunakan sebagai data asli.
* **Status:** `CONFIRMED (DEC-001)`

### 3.2. Struktur Alur Kuis Selera (3 Langkah vs 4 Langkah)
* **Temuan Diskrepansi:** Proposal lama, PRD awal, dan TRD menyebutkan kuis 4 langkah (Mood $\rightarrow$ Kategori $\rightarrow$ Rasa $\rightarrow$ Suhu). Sebaliknya, prototipe visual terisolasi (`kuesioner-1.html` s/d `3.html`), `design.md`, dan `project-context.md` menetapkan kuis 3 langkah.
* **Resolusi Resmi:**
  * **Kuis Kurasi Konsumen Resmi:** Ditetapkan **3 Langkah Presisi**:
    1. **Langkah 1 (Suasana / Mood):** Santai, Fokus Bekerja, Mengobrol, Menyegarkan Diri.
    2. **Langkah 2 (Karakter Rasa / Flavor Profile):** Manis Lembut, Gurih Renyah, Pahit Intens, Segar Buah.
    3. **Langkah 3 (Format & Suhu Penyajian / Temperature & Format):** Es Segar, Hangat Menenangkan, Makanan Pengenyang, Kudapan Ringan.
  * **Penanganan Kategori:** Kategori (*Semua, Kopi, Non-Kopi, Makanan*) tetap dipertahankan sebagai **filter navigasi katalog** di halaman menu utama (`/menu`), bukan langkah kuis yang berulang.
  * **Tombol Lewati (*Skip*):** Wajib tampil mencolok di setiap langkah kuis; menekan tombol lewati langsung membuka katalog lengkap tanpa penalti alur.
* **Status:** `CONFIRMED (DEC-004)`

### 3.3. Formula & Kontrak Mesin Rekomendasi Menu
* **Temuan Diskrepansi:** Terdapat perbedaan formula pembobotan antara `architecture.md` (formula 4 dimensi bobot 3-2-2-2) dengan `skils.md` (formula 3 dimensi bobot 3-2-1).
* **Resolusi Resmi:**
  * **Formula Pembobotan Kanonis (3 Langkah Kuis SELA):**
    $$\text{Skor Menu } (S) = (W_{\text{flav}} \cdot M_{\text{flav}}) + (W_{\text{format}} \cdot M_{\text{format}}) + (W_{\text{mood}} \cdot M_{\text{mood}}) + B_{\text{seller}}$$
    Dengan nilai bobot:
    * $W_{\text{flav}} = 3$ (Karakter rasa memiliki prioritas tertinggi bagi preferensi lidah).
    * $W_{\text{format}} = 2$ (Format sajian & suhu: dingin/panas/makanan/kudapan).
    * $W_{\text{mood}} = 1$ (Konteks suasana hati pelanggan).
    * $B_{\text{seller}} = 1$ (Bonus poin penentu untuk menu berstatus *Best Seller*).
  * **Aturan Ambang Batas (*Threshold*):** Menu direkomendasikan jika memiliki skor $S \ge 3$. Maksimal menampilkan **2 menu teratas**.
  * **Aturan Seri (*Tie-Break*):** Jika skor identik, urutkan berdasarkan:
    1. Menu dengan badge `isBestSeller: true`.
    2. Angka penjualan terbanyak (`orderCount DESC`).
    3. Harga terendah (`basePrice ASC`).
    4. Nama menu alfabetis (`name ASC`).
  * **Filter Stok & Fallback:** Item dengan `isSoldOut: true` **wajib dieksklusikan**. Jika tidak ada menu yang mencapai ambang $S \ge 3$, tampilkan 2 menu *Best Seller* aktif.
  * **Larangan Tegas:** **Dilarang memanggil LLM/AI pihak ketiga** di alur kalkulasi runtime. Seluruh komputasi bersifat deterministik murni (< 10 ms).
* **Status:** `CONFIRMED (DEC-009)`

### 3.4. Kebijakan Kitchen Gate (KDS Dapur PAID-Only)
* **Temuan Diskrepansi:** PRD awal (`BR-05`) dan diagram sequence lama memperlihatkan pesanan tunai masuk ke KDS dapur dengan badge kuning *"Menunggu Kasir"*.
* **Resolusi Resmi:**
  * Sesuai keputusan resmi **`DEC-013`**: **Dapur HANYA memproses pesanan setelah pembayaran lunas (`PAID`)**.
  * **Pesanan QRIS:** Berstatus `PENDING` selama pelanggan belum scan; **TIDAK MUNCUL** di KDS dapur. Baru muncul di dapur + audio chime setelah webhook payment gateway mengonfirmasi `settlement`.
  * **Pesanan Tunai:** Berstatus `WAITING_CASHIER`; tertahan di antrean kasir. Dapur **TIDAK BOLEH** melihat atau memasak pesanan tunai sebelum kasir menerima uang fisik dan menekan tombol *"Konfirmasi Tunai"*.
  * Hal ini mutlak guna mencegah pemborosan bahan baku (*food waste*) jika tamu meninggalkan meja tanpa membayar.
* **Status:** `CONFIRMED (DEC-013)`

### 3.5. Pemisahan Model State (Pesanan vs Pembayaran)
* **Temuan Diskrepansi:** Pada beberapa tabel awal, status operasional dapur dan status keuangan kasir dicampur menjadi satu kolom `status`.
* **Resolusi Resmi:**
  * Sistem memisahkan secara ketat dua mesin status (*two independent state machines*):
    1. **`OrderStatus` (Siklus Fisik Dapur):**
       `QUEUED` (Masuk antrean lunas) $\rightarrow$ `COOKING` (Sedang dibuat barista/koki) $\rightarrow$ `READY` (Siap saji/diantar) $\rightarrow$ `COMPLETED` (Selesai dinikmati meja). Status pembatalan: `CANCELLED`.
    2. **`PaymentStatus` (Siklus Finansial Gateway/Kasir):**
       `PENDING` (Menunggu QRIS) / `WAITING_CASHIER` (Menunggu tunai di kasir) $\rightarrow$ `PAID` (Lunas terverifikasi) / `EXPIRED` (Batas waktu 15 menit habis) / `FAILED` (Gagal/ditolak).
  * KDS dapur hanya me-render pesanan dengan predikat: `paymentStatus == 'PAID' AND orderStatus IN ['QUEUED', 'COOKING', 'READY']`.
* **Status:** `CONFIRMED (DEC-013 & DEC-015)`

### 3.6. Disambiguasi Rute Aplikasi (Route Map Disambiguation)
* **Temuan Diskrepansi:** Dua route group pada dokumen arsitektur sama-sama mengklaim root URL `/` (`src/app/(customer)/page.tsx` vs `src/app/(b2b)/page.tsx`).
* **Resolusi Resmi:**
  Ditetapkan pemetaan rute kanonis tanpa tabrakan:
  * `/`: **Landing Page Pemasaran B2B Cravio** (Etalase solusi untuk pemilik kafe lain, live demo kuis mock, dan CTA WhatsApp).
  * `/order?table=XX`: **Pintu Masuk Utama Pelanggan Meja SELA** (Validasi meja otomatis via query parameter `table`, inisiasi sesi belanja).
  * `/order/quiz`: Alur kuis kurasi rasa 3 langkah.
  * `/order/menu`: Katalog menu digital lengkap & filter kategori.
  * `/order/cart`: Drawer keranjang belanja & kustomisasi modifier.
  * `/order/[orderId]/pay`: Halaman bayar QRIS dinamis (timer 15 menit) atau petunjuk bayar tunai kasir.
  * `/order/[orderId]/track`: Layar pelacak pesanan real-time pelanggan (terproteksi `orderSecretToken`).
  * `/order/[orderId]/receipt`: Struk digital (*e-receipt*) pelanggan.
  * `/staff/login`: Gerbang login terpadu staf kafe.
  * `/staff/pos`: Dashboard kasir operasional (antrean tunai, verifikasi, cetak struk).
  * `/staff/kitchen`: Kitchen Display System (KDS) tablet dapur & barista (antrean FIFO, chime alert, touch target $\ge 56$ px).
  * `/staff/admin`: Panel manajemen menu, harga rupiah integer, toggle stok biner, konfigurasi kuis, dan generator master QR meja.
  * `/api/*`: Route handler backend server-only.
* **Status:** `PROPOSED (Siap Diformalkan di ADR Tahap 02)`

### 3.7. Mekanisme Autentikasi Staf (Admin vs Kasir/Dapur)
* **Temuan Diskrepansi:** `PRD.md` menyebutkan admin login menggunakan Username + Password terenkripsi, sementara `techstack.md` menampilkan variabel `ADMIN_PIN_HASH` (berbasis PIN).
* **Resolusi Resmi:**
  * **Staf Kasir & Dapur / Barista:** Membutuhkan kecepatan operasional fisik pergantian shift di meja counter/bar. Menggunakan **PIN Cepat 4–6 Digit** yang disimpan sebagai hash bcrypt dan dikelola via sesi cookie HTTP-Only terenkripsi.
  * **Super Admin / Pemilik Kafe:** Mengakses data sensitif (omzet, perubahan harga, download QR). Menggunakan **Kredensial Username/Email + Password Kuat (bcrypt hash)**.
* **Status:** `OPEN (Rekomendasi Technical Lead: Password untuk Admin, PIN untuk Kasir/Dapur)`

### 3.8. Batas Karakter Catatan Pelanggan & Tipografi KDS
* **Temuan Diskrepansi:** Sebagian teks mockup UI menyebut batas catatan 120 karakter, sedangkan PRD dan TRD menetapkan 100 karakter. Ukuran font KDS juga bervariasi.
* **Resolusi Resmi:**
  * **Batas Catatan Khusus Pelanggan:** Maksimal **100 karakter** (`BR-03`). Form input divalidasi ketat oleh Zod di client dan server; karakter berbahaya/HTML di-sanitasi.
  * **Standar Tipografi Layar KDS Dapur (Jarak Pandang 1.5–2 Meter):**
    * Nomor Meja: Ukuran $\ge 28\text{ px}$ (tebal / bold high-contrast).
    * Nama Item Menu: Ukuran $\ge 18\text{ px}$ (semi-bold).
    * Catatan Kustom (*less sugar, no ice*): Ukuran $\ge 14\text{ px}$ dengan latar warna peringatan (*amber badge*).
    * Tombol Transisi Status KDS: Tinggi minimal $\ge 56\text{ px}$ (*jumbo touch target* ramah sarung tangan).
* **Status:** `CONFIRMED`

### 3.9. Transparansi Nilai Finansial B2B vs Kontrak Pengembangan
* **Temuan Diskrepansi:** Proposal memuat nilai investasi pengembangan Rp 750.000, sedangkan landing page B2B dan desain memuat paket penawaran Rp 2.500.000.
* **Resolusi Resmi:**
  * **Rp 750.000:** Adalah **Biaya Kontrak Pengembangan Awal Kafe Mitra Perdana (SELA)** sebagai proyek pilot rintisan (DP 50% Rp 375.000 + Pelunasan 50% Rp 375.000). Bersifat internal dan tidak dipublikasikan ke publik.
  * **Rp 2.500.000:** Adalah **Harga Penawaran Komersial Paket B2B Cravio** yang ditawarkan kepada pemilik kafe/restoran lain di halaman landing page publik (mencakup lisensi setup sistem, hosting tahun pertama, pendampingan UAT, dan pencetakan master QR meja).
* **Status:** `CONFIRMED`

### 3.10. Token Rahasia Pesanan & Isolasi QR Meja Publik
* **Temuan Diskrepansi:** Model ERD awal di beberapa sketsa belum merinci kolom penampung token rahasia pesanan tamu.
* **Resolusi Resmi:**
  * Kode QR fisik yang ditempel pada meja akrilik kafe bersifat **publik**. Memindai meja `05` tidak boleh membuka riwayat atau tagihan pelanggan sebelumnya.
  * Saat pesanan dibuat, server men-generate token kriptografis acak `orderSecretToken` (disimpan sebagai hash di database dan disimpan di `localStorage` peramban pemesan).
  * Seluruh endpoint pembacaan detail pesanan (`/api/orders/[orderId]`), SSE streaming pelanggan (`/api/orders/[orderId]/stream`), dan layar pelacak (`/order/[orderId]/track`) **wajib menyertakan token ini**. Tanpa token valid, akses ditolak 403 Forbidden.
* **Status:** `CONFIRMED (DEC-014)`

### 3.11. Deteksi & Persetujuan Perubahan Harga saat Checkout
* **Temuan Diskrepansi:** Kebutuhan melarang client mengirimkan total harga, namun sistem harus mendeteksi jika admin menaikkan/menurunkan harga saat pelanggan sedang menyusun keranjang.
* **Resolusi Resmi:**
  * Client hanya mengirimkan array `{ menuItemId, selectedModifierOptionIds, quantity }`.
  * Saat membuka checkout, server menerbitkan quote harga bertanda waktu (*Price Quote Version/Hash*).
  * Jika saat tombol bayar ditekan terdeteksi selisih antara harga quote dengan harga terkini di database, server menolak transaksi dengan kode `PRICE_CHANGED`, mengembalikan rincian nominal terbaru, dan mewajibkan pelanggan menyetujui harga baru sebelum QRIS dibuat.
  * Begitu pesanan berstatus `DITERIMA`, server merekam *snapshot* permanen nama item, harga dasar, dan harga modifier pada tabel transaksi. Perubahan katalog menu di masa mendatang tidak mengubah riwayat transaksi historis.
* **Status:** `CONFIRMED`

### 3.12. Koreksi Kritis Infrastruktur Produksi (Audit Fakta 2026)
Pemeriksaan dokumentasi resmi penyedia layanan pada 28 Oktober 2026 menghasilkan koreksi wajib:

1. **Paket Vercel Hosting:**  
   *Fakta Resmi:* Dokumen [Vercel Terms of Service & Plan Comparison](https://vercel.com/docs/plans/hobby) secara tegas menyatakan paket **Vercel Hobby Tier ditujukan untuk proyek personal dan non-komersial**. Operasional pemesanan kafe komersial secara hukum memerlukan paket berbayar (Vercel Pro) atau hosting mandiri (Docker VPS via Coolify/Railway). Pengembang tidak boleh menjanjikan biaya hosting produksi komersial Rp 0 permanen.
2. **Runtime Node.js LTS:**  
   *Fakta Resmi:* Node.js 20 telah memasuki status End-of-Life (EOL). Dokumen lama yang mencantumkan Node 20.18.0 dikoreksi; proyek wajib menggunakan **Node.js LTS aktif (Node.js 22+ atau Node.js 24 LTS)**.
3. **Pencadangan Database Supabase:**  
   *Fakta Resmi:* Fitur pencadangan harian otomatis terkelola (*Point-in-Time Recovery & Daily Managed Backup*) pada Supabase hanya tersedia untuk paket berbayar (Pro, Team, Enterprise). Proyek gratis (*Free Tier*) disarankan mengekspor skema dan data secara mandiri. Strategi backup wajib menyertakan script `pg_dump` otomatis berkala ke cloud storage independen.
4. **Batas Waktu Kedaluwarsa QRIS Midtrans:**  
   *Fakta Resmi:* Panduan integrasi Midtrans Core API menyebutkan pemrosesan expiry QRIS pada sisi acquirer/bank dapat mengalami latensi beberapa menit. Target bisnis pembatalan 15 menit diterapkan secara defensif: timer frontend mengatur visual hitung mundur, sedangkan server menjalankan rekonsiliasi terjadwal (*scheduled reconciler*) untuk memastikan transaksi kedaluwarsa dibatalkan dan settlement terlambat tidak menyebabkan data menggantung.
* **Status:** `CONFIRMED (Koreksi Baseline Infrastruktur 2026)`

### 3.13. Rekonsiliasi Jadwal Sprint & Status Kemajuan
* **Temuan Diskrepansi:** Dokumen proposal memuat target pengerjaan 7 hari dengan beberapa baris berlabel `done`.
* **Resolusi Resmi:**
  * Timeline 7 hari adalah target sprint pengerjaan internal pengembang.
  * Seluruh label `done` pada dokumen historis pra-pengembangan dikoreksi menjadi status nyata: **Proyek berada pada Tahap Fondasi & Audit Dokumen (Tahap 01)**. Belum ada kode Next.js yang selesai atau teruji.
  * Kelayakan rilis produksi live sepenuhnya ditentukan oleh kelulusan gerbang kualitas (17 skenario UAT, verifikasi KYC perbankan, dan pengujian fisik di lokasi kafe).
* **Status:** `CONFIRMED`

---

## 4. Register Keputusan Resmi & Status Pengambilan Keputusan

| ID Keputusan | Judul Keputusan | Status | Ketetapan Resmi yang Disepakati |
|---|---|:---:|---|
| `DEC-001` | Identitas Produk & Kafe | **DIKONFIRMASI** | Produk: **Cravio — Your craving, Perfectly Matched**. Kafe Mitra: **SELA** (*Artisanal Coffee & Bake*). Single-tenant baseline. |
| `DEC-002` | Kategori & Hirarki Katalog | **DIKONFIRMASI** | Semua, Kopi, Non-Kopi, Makanan. Filter diletakkan di halaman menu. |
| `DEC-003` | Sistem Desain Visual SELA | **DIKONFIRMASI** | Warm Canvas `#FBF9F5`, Aksen Terakota `#924805`, Charcoal `#1B1C1A`, Plus Jakarta Sans + Inter. Grid 2-kolom mobile 390px. |
| `DEC-004` | Alur Kuis Kurasi Selera | **DIKONFIRMASI** | Kuis 3 Langkah (Suasana $\rightarrow$ Karakter Rasa $\rightarrow$ Format/Suhu) dengan tombol lewati di setiap langkah. |
| `DEC-005` | Mekanisme Custom Modifier | **DIKONFIRMASI** | Modal bottom sheet: Radio untuk gula/es, Checkbox untuk add-on berbayar, Textarea catatan maks 100 karakter. |
| `DEC-006` | Pajak & Service Charge | **DIKONFIRMASI** | Default 0% (Harga Nett All-Inclusive). Switch dinamis di Admin untuk opsi eksklusif/inklusif masa depan. |
| `DEC-007` | Verifikasi Pembayaran Digital | **DIKONFIRMASI** | 100% otomatis via Midtrans Core API QRIS Dinamis (Webhook SHA512). Tanpa upload bukti transfer manual. |
| `DEC-008` | Alokasi Beban Biaya | **DIKONFIRMASI** | Domain & cloud tahun pertama ditanggung pengembang; MDR 0,7% dan hardware fisik ditanggung pihak kafe. |
| `DEC-009` | Engine Kuis Rekomendasi | **DIKONFIRMASI** | Weighted Tag Matching deterministik (non-AI/LLM) terkonfigurasi dinamis dari database. Ambang skor $\ge 3$. |
| `DEC-010` | Arsitektur & Runtime | **DIKONFIRMASI** | Fullstack Modular Monolith Next.js 15 (App Router, TypeScript strict) + PostgreSQL (Prisma ORM 6.1). |
| `DEC-011` | Payment Gateway Provider | **DIKONFIRMASI** | Midtrans Core API (Charge QRIS). Mode Sandbox selama sprint; migrasi live via env variables pasca-KYC. |
| `DEC-012` | Real-time & Cetak Thermal | **DIKONFIRMASI** | Server-Sent Events (SSE) untuk KDS dapur; CSS `@media print` 58/80 mm universal via dialog print OS. |
| `DEC-013` | Kitchen Gate Policy | **DIKONFIRMASI** | **Dapur HANYA memproses pesanan setelah pembayaran PAID**. Pesanan tunai tertahan di kasir sampai uang diterima. |
| `DEC-014` | Token Privasi Pesanan Meja | **DIKONFIRMASI** | QR meja fisik publik; pelacak pesanan dilindungi `orderSecretToken` kriptografis di peramban pemesan. |
| `DEC-015` | Expiry Transaksi 15 Menit | **DIKONFIRMASI** | Batas masa bayar mutlak 15 menit dari gateway. Melewati 15 menit, pesanan batal dan tidak masuk dapur. |
| `OPN-01` | Toleransi Bayar Tunai Kasir | **OPEN** | Usulan: 20 menit sejak order dibuat. Jika kasir belum konfirmasi, pesanan otomatis berstatus batal. |
| `OPN-02` | Izin Toggle Stok oleh Barista | **OPEN** | Usulan: Barista diizinkan mengubah stok *Sold Out* dari header KDS terproteksi PIN dapur. |
| `OPN-03` | Skema Kredensial Admin | **OPEN** | Usulan: Admin menggunakan Username + Password terenkripsi; Kasir/Dapur menggunakan PIN cepat 4–6 digit. |
| `OPN-04` | Konfirmasi Kontak & Harga B2B | **OPEN** | Usulan: Paket B2B komersial publik Rp 2.500.000; kontak WhatsApp menggunakan nomor resmi perwakilan pengembang. |

