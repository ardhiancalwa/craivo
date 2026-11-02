# Cravio — Catatan Kemajuan Implementasi (Implementation Progress)
## Sistem Smart QR Menu & Kurasi Preferensi Rasa (Pilot Kafe: SELA)

> **Lokasi File:** `docs/implementation-progress.md`  
> **Terakhir Diperbarui:** 30 Oktober 2026  
> **Peran:** Technical Lead & Fullstack Engineer  
> **Status Proyek:** Tahap 20 Selesai — Landing Page Promosi B2B & Demo Kuis Interaktif (Menunggu Prompt 21)  

---

## Ringkasan Status Tahapan Pengerjaan

| Tahap | Judul Tahap | Status | Commit Git | Tanggal Selesai | Catatan Kunci |
|---|---|:---:|---|---|---|
| **00** | **Instruksi Induk & Inventarisasi Konteks** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-28 | Seluruh 9 dokumen sumber, 6 skill, prototipe `design-preview/`, dan rencana prompt telah dibaca & diverifikasi. |
| **01** | **Audit Dokumen & Baseline Persyaratan** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-28 | Menghasilkan `spec-audit.md` (13 resolusi konflik) & `requirements-traceability.md` (100% REQ + 17 UAT terlacak). |
| **02** | **Keputusan Arsitektur & Kontrak (ADR)** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-28 | Menghasilkan 7 ADR (`docs/adr/`), `api-contracts.md` (Zod schemas), dan `route-map.md` teroptimasi Vercel Free Tier Rp 0. |
| **03** | **Inisialisasi Proyek & Tooling Dasar** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-28 | Scaffold modular monolith Next.js 15 App Router, TypeScript strict, Prisma 6, Tailwind CSS v3.4, Zod, jose, server-only guard, Vitest, CI workflow, dan README Windows PowerShell. |
| **04** | **Skema Database & Migrasi Prisma** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | 18 entitas relasional PostgreSQL (integer IDR, snapshot kekal, soft-delete menu, SHA-256 token hash, optimistic lock, RLS security lockdown, seeder idempoten 18 menu SELA & 10 meja). |
| **05** | **Autentikasi Staf & Otorisasi Server** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | RBAC ADMIN/CASHIER/KITCHEN, Jose JWT HttpOnly cookie, bcrypt hashing, deactivated staff protection, persistent lockout 5x, CSRF origin check, dan audit logs. |
| **06** | **Sistem Desain SELA & Komponen UI** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | 11 komponen atomik, tokens #FBF9F5/#924805/tabular-nums, aksesibilitas WCAG 2.1 AA (kontras aktual matematis), shell pelanggan 4-tab, shell staf terproteksi, dan galeri dev (/dev/ui) terisolasi. |
| **07** | **Katalog Menu & Deteksi Meja QR** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Pintu masuk /order?table=XX dengan validasi serverless DB, tab Semua (UI aggregate), live search, kartu grid 2-kolom, drawer modifier, pemisahan hash racikan unik di keranjang, dan pencegahan pemesanan menu habis. |
| **08** | **Engine Kuis & Rekomendasi Menu** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Engine deterministik murni (Flavor=3, Format=2, Mood=1, isPopular=+1), 5-level tie-breaker, sold-out guard, dynamic fallback, skip button, penyajian Hero + Alternatif, dan disclaimer alergi resmi tanpa AI/LLM. |
| **09** | **Keranjang Belanja & Price Quote** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Modifier sheet (radio/checkbox/required/min/max/edit mode), baris cart unik dengan catatan aman max 100 char, kuantitas 1-50, server-authoritative quote POST /api/orders/quote, token 15 menit, dan deteksi PRICE_CHANGED & ITEM_STOCK_DEPLETED. |
| **10** | **Order Service & Transaksi Idempoten** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | POST /api/orders idempoten (UUID v4 + fingerprint), lock 30s takeover, capability HMAC token deterministik, HttpOnly cookie cravio_ot, snapshot kekal, status awal UNPAID/WAITING_CASHIER (tersembunyi dari KDS), perbaikan cookie cravio_table tanpa fallback diam-diam '07'. |
| **11** | **Integrasi Charge QRIS Midtrans Sandbox** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Midtrans Core API POST /v2/charge, snapshot nominal server integer IDR, 15m custom_expiry, actions generate-qr-code, recovery timeout via Get Status, layar bayar countdown & mobile wallet guide, auto polling 5s, guard capability token 403, dan invarian nir-button cheat PAID. |
| **12** | **Webhook Gateway & Expiry Reconciler** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Webhook POST /api/webhooks/midtrans SHA-512 timingSafeEqual, parsing uang tanpa float/parseInt, mapping sukses QRIS murni (settlement only), dedup & out-of-order protection, 1 durable OutboxEvent, service rekonsiliasi independen browser, dan cron POST /api/cron/reconcile-payments terautentikasi Bearer CRON_SECRET. |
| **13** | **Dashboard Kasir POS & Alur Tunai** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Dashboard /pos terproteksi CASHIER/ADMIN, pemisahan antrean tunai dari riwayat lunas, konfirmasi uang masuk atomik ($transaction) & anti klik-ganda, cancellation berizin dengan invarian finansial paymentStatus=PAID, pencatatan ManualRefundRecord faktual tanpa Refund API gateway, tanpa auto-expiry 20m pada alur tunai. |
| **14** | **Sinkronisasi Real-Time (SSE / Event Bus)** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Server-Sent Events (SSE) Web Streams murni sesuai ADR-0001/0002, durable outbox table fan-out multi-instance, RBAC staf KDS/POS, isolasi mutlak token pelanggan, heartbeats 10s, lifecycle 25s, cursor Last-Event-ID, Kitchen Gate (DEC-013), audio chime alert Web Audio API, latency benchmark ~80ms (SLA <= 2s). |
| **15** | **KDS Dapur & Pelacak Pesanan Pelanggan** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | KDS rute /kitchen & /staff/kitchen (BARISTA/ADMIN), server-authoritative Kitchen Gate (PAID-only FIFO), tipografi keterbacaan 2 meter (meja >=28px, item >=18px, tombol >=56px), threshold usia (<10m/<20m/>20m pulse/reduced motion), transisi linier QUEUED->COOKING->READY->COMPLETED dengan optimistic locking versioning, kontrol audio Web Audio (unlock, mute, volume, dedup snapshot), dan Customer Tracker terisolasi token per order dengan deteksi review refund tunai. |
| **16** | **Struk Digital & Layout Cetak 58/80 mm** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | E-Receipt pelanggan (/order/[id]/receipt), cetak kasir & dapur (/staff/orders/[id]/print), CSS @media print 58mm/80mm monokrom monospace, tiket dapur TANPA HARGA meja >=28px, pencatatan attempt atomik & reprint counter independen per dokumen (PrintLog), unduh .txt/.html, proteksi RBAC & capability token 403. |
| **17** | **Panel Admin Katalog, Modifier, & Stok** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Panel Admin CRUD katalog, nama, deskripsi, harga integer, foto biner (magic bytes/dimensions), kategori, tag, Best Seller, urutan tampilan, modifier groups & options, toggle stock, soft-archive kekal (integritas pesanan). |
| **18** | **Konfigurasi Kuis, Pajak, & Laporan** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-29 | Kuis 3-langkah (versioning, dynamic weights 1-10, in-flight graceful fallback, anti-crash), identitas kafe, formula pajak PB1 & service (eksklusif vs inklusif inside breakdown), laporan omzet WIB (gross, refunds, net, top selling), ekspor CSV (BOM, RFC 4180, CWE-1236 formula injection guard), audit log tersanitasi. |
| **19** | **Manajemen Meja Kafe & Master QR Generator** | **PASS** | N/A (Git CLI tidak di PATH) | 2026-10-30 | Admin meja lengkap (nomor unik, label lokasi, toggle active/inactive), Zero Secret Leak di QR publik (/order?table=XX), resolusi tinggi PNG (1024x1024 300DPI) & SVG murni, Domain Guard (DEC-016: Master Live BLOCKED jika domain produksi belum terdaftar), ekspor massal ZIP & PDF Sheet A4 siap cetak dengan logo SELA, proteksi penolakan quote meja nonaktif (TABLE_INACTIVE) tanpa merusak riwayat transaksi. |
| **20** | **Landing Page Promosi B2B & Demo Kuis** | **PASS (Kontak WA & Harga Publik Menunggu Konfirmasi OPN-04)** | N/A (Git CLI tidak di PATH) | 2026-10-30 | Revisi editorial SELA (`font-display` Plus Jakarta Sans, 0 kartu `rounded-3xl` repetitif), panggung motion graphics hero 5-scene berbasis timeline 12 detik terpadu (`requestAnimationFrame` + SVG koordinat tunggal, adaptive mobile 390px, `IntersectionObserver` & `visibilitychange` auto-pause, `prefers-reduced-motion` diagram statis), demo kuis 3 langkah (`Suasana → Rasa → Format/Suhu`) in-memory 0 network/DB, penjaga anti-kontak palsu & tanpa pemilihan harga sepihak. |
| **21** | Audit Kualitas, Keamanan, & Aksesibilitas | *NOT RUN* | - | - | Prasyarat: Tahap 05–20 selesai. |
| **22** | Pengujian UAT Lengkap (17 Skenario) | *NOT RUN* | - | - | Prasyarat: Tahap 21 selesai. |
| **23** | Operasional, CI/CD, & Backup | *NOT RUN* | - | - | Prasyarat: Tahap 22 selesai. |
| **24** | Kesiapan Rilis Produksi & Deployment | *NOT RUN* | - | - | Prasyarat: Tahap 23 selesai. |
| **25** | Serah Terima & Panduan SOP Staf | *NOT RUN* | - | - | Prasyarat: Tahap 24 selesai. |

---

## Log Riwayat Tahap Terperinci

### Tahap 20 (Revisi Editorial & Motion Timeline) — Landing Page B2B SELA & Demo Kuis Interaktif
* **Tanggal:** 2026-10-30
* **Tujuan:** Memperbaiki landing page B2B pada rute publik `/` (`src/app/(b2b)/page.tsx`) setelah audit browser aktual menemukan pola template generik (`font-serif` Times/Georgia, 14 kartu `rounded-3xl` seragam, klaim persentase tak terverifikasi, dan hero berupa pergantian kartu statis 4,2 detik):
  1. **Identitas Editorial Kafe SELA (`REQ-B2B-01`):**
     - Mengoreksi seluruh tipografi judul ke `font-display` (*Plus Jakarta Sans*) dan teks isi ke `font-sans` (*Inter*) di atas kanvas hangat `#FBF9F5`, teks espresso `#1B1C1A`, garis tipis `#E7E2DA`, dan aksen terakota `#924805` terbatas.
     - Komposisi hero desktop ~40% teks/CTA (`lg:col-span-5`) dan ~60% panggung motion graphics (`lg:col-span-7`); variasi tata letak antar-bagian (editorial split, diagram proses 4 tahap, indeks spesifikasi modul, demo interaktif, tabel ruang lingkup paket, dan accordion garis tipis).
  2. **Panggung Motion Graphics Hero 5-Scene Berbasis Timeline 12 Detik:**
     - Satu komposisi SVG dalam sistem koordinat koheren berlabel permanen **"Simulasi alur pemesanan"** dan tombol **Jeda / Putar** aksesibel keyboard:
       - *Scene 1 (0–2 dtk):* `Meja 07` + ilustrasi QR geometris muncul, garis scan melintas tepat satu kali, lalu titik sinyal mengalir menuju tahap menu.
       - *Scene 2 (2–4 dtk):* Menampilkan `Kopi Susu Aren`, chip modifier `Less sugar` terpilih, lalu menyusun ringkasan `Less sugar · 1 item`.
       - *Scene 3 (4–6,5 dtk):* Ringkasan bergerak ke pembayaran; status `Menunggu pembayaran` berganti ke `Pembayaran terverifikasi` disertai centang animasi stroke (`stroke-dashoffset`); jalur ke dapur terkunci dan baru aktif setelah centang pembayaran selesai.
       - *Scene 4 (6,5–9 dtk):* Tiket dapur tersusun dari data identik (`Meja 07`, `1× Kopi Susu Aren`, `Less sugar`, `Antrean dapur`).
       - *Scene 5 (9–12 dtk):* Menahan komposisi penuh agar terbaca lalu reset halus tanpa perubahan ukuran layout (CLS = 0).
     - Mobile `390px` memiliki tata letak vertikal khusus (`viewBox="0 0 342 564"`), auto-pause via `IntersectionObserver` & `visibilitychange`, dan `prefers-reduced-motion: reduce` merender diagram final statis lengkap.
  3. **Isolasi Demo Kuis 3 Langkah (`REQ-B2B-02`):**
     - Urutan **Suasana → Rasa → Format/Suhu** berlabel **"Simulasi / Interactive Preview"**, transisi antar-langkah jelas, rekomendasi contoh + alternatif + tombol ulangi, 0 request jaringan & 0 mutasi Prisma.
  4. **Integritas Komersial & Penanganan Blocker Kontak (`REQ-B2B-03` & `REQ-B2B-04`):**
     - Tidak memilih sepihak antara `Rp750.000` dan `Rp2.500.000` sebelum penetapan resmi (`NEXT_PUBLIC_B2B_CONFIRMED_PRICE`).
     - Memblokir nomor/alamat contoh seeder (`0812-3456-7890`, `081299887766`, `Jl. Senopati`) agar tidak membentuk tautan WhatsApp palsu; otomatis mengaktifkan `https://wa.me/62...?text=...` ber-encoding aman segera setelah `NEXT_PUBLIC_B2B_WHATSAPP` dikonfigurasi.
* **Berkas yang Diubah:**
  1. `src/components/b2b/hero-flow-motion.tsx`
  2. `src/components/b2b/b2b-landing-view.tsx`
  3. `src/components/b2b/workflow-storytelling.tsx`
  4. `src/components/b2b/demo-menu-dataset.ts`
  5. `src/components/b2b/demo-quiz-simulator.tsx`
  6. `src/components/b2b/pricing-breakdown.tsx`
  7. `src/components/b2b/operational-faq.tsx`
  8. `src/app/(b2b)/page.tsx`
  9. `tests/unit/b2b-demo-isolation.test.ts` (11 unit tests)
  10. `tests/integration/b2b-landing-page.test.ts` (4 integration tests)
* **Pemeriksaan Aktual yang Dijalankan:**
  1. Verifikasi Playwright browser aktual (`http://localhost:3000/`): rekaman siklus penuh `.webm` (>12 dtk), uji 5 scene, keyboard Pause/Resume, `IntersectionObserver` offscreen pause, `visibilitychange` tab pause, `prefers-reduced-motion: reduce`, demo kuis + inspeksi network (`0` request transaksi, `0` console error), serta viewport `390x844` & `1440x900` (`scrollWidth === innerWidth`).
  2. `pnpm run test tests/unit/b2b-demo-isolation.test.ts tests/integration/b2b-landing-page.test.ts` $\rightarrow$ **15 passed (15)**.
  3. `pnpm run typecheck` (`tsc --noEmit`) $\rightarrow$ **0 errors**.
  4. `pnpm run lint` (`next lint`) $\rightarrow$ **✔ No ESLint warnings or errors**.
  5. `pnpm run build` (`next build`) $\rightarrow$ **PASS**.
* **Blocker / Ketergantungan Konfigurasi Bisnis (`OPN-04`):**
  1. Nomor WhatsApp bisnis resmi B2B (`NEXT_PUBLIC_B2B_WHATSAPP`) belum diisi pada `.env` (database masih memuat data contoh seed/pengujian), sehingga tautan `wa.me` sengaja ditahan agar tidak mengarah ke kontak palsu.
  2. Keputusan nominal harga publik resmi (`NEXT_PUBLIC_B2B_CONFIRMED_PRICE`) masih menunggu konfirmasi pemilik produk (`OPN-04`), sehingga halaman menampilkan rincian ruang lingkup yang sudah dikonfirmasi tanpa memilih sepihak antara Rp750.000 atau Rp2.500.000.
* **Langkah Berikutnya:**
  - Menunggu konfirmasi nilai `NEXT_PUBLIC_B2B_WHATSAPP` / `NEXT_PUBLIC_B2B_CONFIRMED_PRICE` dari pemilik proyek atau arahan **Prompt 21**.

---

### Tahap 19 — Manajemen Meja Kafe & Master QR Generator
* **Tanggal:** 2026-10-30
* **Tujuan:** Mengimplementasikan modul tata kelola meja kafe dan generator master kode QR fisik beresolusi tinggi dengan integritas keamanan mutlak:
  1. **Admin Meja Kafe (`REQ-ADMIN-09`):** Pengelolaan daftar meja kafe lengkap dengan nomor meja unik (`tableNumber`, alfanumerik maks 10 karakter), label lokasi fisik (`label`, e.g. "Area Rooftop VIP Lounge"), status aktif/nonaktif (`isActive`), penghitungan pesanan aktif (QUEUED/COOKING/READY), dan riwayat pesanan total per meja. Setiap penambahan, pembaruan, dan perubahan status meja dicatat ke `AuditLog` secara *append-only*.
  2. **Jaminan Zero Secret Leak (`DEC-014`):** Kode QR fisik publik HANYA memuat URL publik resmi pelanggan (`${baseUrl}/order?table=XX`). Mutlak dilarang menyertakan `orderSecretToken`, cookie sesi, PIN staf, atau token rahasia apapun. Pelanggan baru yang memindai QR fisik di meja yang sama tidak akan pernah dapat melihat atau mengakses pesanan/tagihan pelanggan sebelumnya.
  3. **Pemisahan Lingkungan & Domain Guard (`DEC-016`):**
     - **Mode Staging / Preview:** Menggunakan `NEXT_PUBLIC_APP_URL` aktif dengan badge visual dan watermark teks `"STAGING"` pada lembar cetak guna mencegah tercampurnya QR uji coba dengan produksi.
     - **Master Produksi Permanen:** Mengharuskan `productionDomain` tervalidasi HTTPS di database kafe (`cravioConfig`). Jika domain produksi belum dikonfigurasi, ekspor master produksi berstatus **`BLOCKED`** guna mencegah pemborosan biaya cetak akrilik/stiker permanen pada URL sementara.
  4. **Generator Unduhan Satuan & Massal:**
     - **Unduhan Satuan:** Berkas PNG resolusi tinggi (default 1024×1024 px pada 300 DPI, margin quiet zone 4 modul ISO/IEC 18004, error correction level Q) dan berkas SVG vektor murni yang dapat diskalakan tanpa kehilangan ketajaman.
     - **Unduhan Massal ZIP:** Berkas arsip `.zip` *in-memory* menggunakan `JSZip` berisi seluruh berkas PNG dan SVG untuk semua meja aktif, disertai panduan teknis `README-CETAK-MEJA.txt` (spesifikasi ukuran fisik akrilik, resolusi, kontras, dan penempatan).
     - **Sheet PDF Siap Cetak A4:** Dokumen PDF A4 multi-halaman *in-memory* menggunakan `pdf-lib` dengan tata letak grid 2×2 (4 kartu meja per lembar), tipografi nomor meja $\ge 28$pt bold, branding SELA Artisanal Coffee, instruksi scan, garis potong (*crop marks*), dan fallback URL manual.
     - **Halaman Cetak Browser A4:** Halaman khusus `/staff/admin/tables/print-sheet` dengan `@media print` CSS murni untuk pencetakan langsung dari browser ke printer atau Print to PDF.
  5. **Integritas Transaksi & Deaktivasi Meja:** Menonaktifkan meja (`isActive = false`) memblokir pembuatan quote baru (`TABLE_INACTIVE`, status 403) dan checkout baru di meja tersebut, namun TIDAK PERNAH menghapus atau merusak akses ke transaksi dan struk historis pelanggan maupun staf.
* **Berkas yang Dibuat / Diubah:**
  1. `prisma/schema.prisma`: Penambahan kolom `label` pada model `Table` dan `productionDomain` pada model `CravioConfig`. Berhasil disinkronkan ke PostgreSQL Neon live via `prisma db push`.
  2. `src/lib/server/qr-service.ts`: Service sentral generasi QR buffer PNG (`generateTableQrPng`), SVG string (`generateTableQrSvg`), paket ZIP (`generateTablesZip`), lembar cetak PDF A4 (`generatePrintReadyA4Pdf`), serta resolver target URL berproteksi domain guard (`resolveTableTargetUrl`).
  3. `src/app/api/staff/admin/tables/route.ts`: Endpoint GET (daftar meja + status environment) & POST (tambah meja baru + pencegahan duplikasi + audit trail).
  4. `src/app/api/staff/admin/tables/[id]/route.ts`: Endpoint GET detail, PUT update data/label, dan PATCH toggle status aktif/nonaktif.
  5. `src/app/api/staff/admin/tables/[id]/qr/route.ts`: Endpoint stream berkas PNG / SVG satuan ber-header attachment atau inline.
  6. `src/app/api/staff/admin/tables/export/zip/route.ts`: Endpoint stream arsip massal ZIP untuk seluruh meja aktif.
  7. `src/app/api/staff/admin/tables/export/pdf/route.ts`: Endpoint stream berkas PDF sheet A4 siap potong.
  8. `src/app/(staff)/staff/admin/tables/print-sheet/page.tsx` & `print-sheet-client-view.tsx`: Server Component & Client View untuk cetak lembar meja A4 via browser (`window.print()`).
  9. `src/app/(staff)/staff/admin/admin-client-view.tsx`: Penambahan tab ketujuh `"Meja & QR"`, KPI cards (Total Meja, Meja Aktif, Meja Nonaktif, Status Produksi), switcher staging/produksi, kartu meja interaktif, modal tambah/edit meja, dan field `productionDomain` pada tab Pengaturan.
  10. `tests/unit/qr-generator.test.ts`: 9 unit tests pengujian PNG magic bytes, SVG XML, ZIP packaging, PDF layout, Zero Secret Leak URL, dan Domain Guard BLOCKED.
  11. `tests/unit/table-management.test.ts`: 9 unit tests validasi skema nomor meja dan logika status `validateTableServer`.
  12. `tests/integration/table-admin-and-qr.test.ts`: 16 live integration tests terhadap PostgreSQL Neon: RBAC guard (401 & 403), CRUD meja, proteksi meja nonaktif (TABLE_INACTIVE 403), stream PNG, SVG, ZIP, PDF, dan Domain Guard produksi.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (21 test files, 169 unit tests passed, 100% PASS).
  2. `pnpm run test tests/integration/table-admin-and-qr.test.ts` $\rightarrow$ Exit code 0 (16 integration tests passed, duration 7.4s).
  3. `pnpm run typecheck` $\rightarrow$ Exit code 0 (0 error TypeScript strict).

---

### Tahap 18 — Konfigurasi Kuis, Pajak, Laporan Omzet, & Audit Trail
* **Tanggal:** 2026-10-29
* **Tujuan:** Melengkapi seluruh modul admin di luar CRUD katalog menu untuk tata kelola kafe operasional penuh:
  1. **Konfigurasi Kuis Dinamis (`REQ-ADMIN-06`):** Pengelolaan 3 langkah pertanyaan kuis (MOOD, FLAVOR, FORMAT per `ADR-0006`), pengeditan label pertanyaan & opsi, aktivasi/deaktivasi, urutan tampilan (`sortOrder`), pemetaan tag preferensi, dan bobot dinamis (1–10). Dilengkapi validasi ketat anti-*crash* (`QuizConfigValidationError`: min 3 langkah aktif, min 2 opsi aktif per pertanyaan, min 1 tag per opsi, bobot 1–10 integer), *versioning* transaksional atomik (`quizVersion` increment), dan penanganan toleransi *in-flight quiz* saat pelanggan sedang menjawab agar tidak crash 500 (*graceful fallback* ke Best Seller).
  2. **Pengaturan Finansial & Identitas Kafe (`REQ-ADMIN-05`, `REQ-ADMIN-08`):** Pengelolaan profil resmi SELA Artisanal Coffee & Bake (nama, tagline, alamat, telepon, jam operasional). Pengaturan tarif pajak PB1 dan service charge dalam basis points (default 0% / 0% baseline SELA). Dukungan Mode Eksklusif (subtotal + service + PB1) dan Mode Inklusif (*all-inclusive nett* di mana $\text{Net Base} + \text{Service} + \text{Tax} \equiv \text{Subtotal}$ dengan pembulatan integer IDR presisi tanpa selisih 1 rupiah). Rincian finansial disajikan transparan sebelum checkout di keranjang dan disimpan kekal di snapshot pesanan. Pergantian kebijakan finansial mutlak wewenang role `ADMIN` dan dicatat ke `AuditLog`.
  3. **Laporan Penjualan & Omzet Harian (`REQ-ADMIN-07`):** Perhitungan omzet dengan batas pergantian hari `Asia/Jakarta` (WIB) yang akurat terhadap timestamp UTC PostgreSQL (mencegah pergeseran transaksi jam 23:30 vs 00:30 WIB). Gross receipts mencakup seluruh pesanan `PAID` (termasuk pesanan lunas yang dibatalkan dapurnya), dikurangi nilai pengembalian dana manual yang disetujui (`totalRefunds`), menghasilkan nilai omzet bersih faktual (`netTurnover`). Pesanan `WAITING_CASHIER`, `UNPAID`, `PENDING`, dan `EXPIRED` mutlak dieksklusikan dari omzet. Penyajian daftar transaksi terpaginasi dengan filter rentang tanggal, metode bayar (QRIS vs Tunai), dan status.
  4. **Ekspor CSV Terproteksi & Audit Trail (`REQ-ADMIN-09`, `REQ-ADMIN-10`):** Unduhan berkas CSV terstandar RFC 4180 dengan UTF-8 BOM (`\uFEFF`) untuk kompatibilitas Microsoft Excel/Google Sheets, dilengkapi proteksi *CSV Formula Injection* (CWE-1236) pada teks input dinamis (awalan petik tunggal `'` jika dimulai dengan `=`, `+`, `-`, `@`, `\t`, `\r`, `%`). Penyajian log audit aktivitas sistem bersifat *append-only* dengan penyensoran token rahasia (`orderSecretToken`, hash PIN/password, kunci gateway).
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/server/financial-calculator.ts`: Formula kalkulasi finansial server-authoritative eksklusif vs inklusif, pembulatan integer rupiah, dan pemformatan BPS persentase.
  2. `src/lib/server/timezone-utils.ts`: Utilitas konversi rentang tanggal `Asia/Jakarta` (UTC+7) ke batas UTC presisi (`getJakartaDayBoundaries`, `getJakartaDateRangeBoundaries`, `formatJakartaDateTime`).
  3. `src/lib/server/csv-exporter.ts`: Generator CSV RFC 4180 dengan UTF-8 BOM dan proteksi Formula Injection CWE-1236 (`sanitizeCsvCell`).
  4. `src/lib/server/report-service.ts`: Service laporan omzet harian (`getTurnoverReport`), daftar transaksi terpaginasi (`getTransactionList`), dan dataset siap ekspor (`getTransactionsForExport`).
  5. `src/lib/server/audit-service.ts`: Service pembaca log audit append-only tersanitasi (`getSanitizedAuditLogs`).
  6. `src/lib/server/config-service.ts`: Service konfigurasi profil kafe dan kebijakan finansial dengan audit log dan realtime event bus.
  7. `src/lib/server/quiz-config-service.ts`: Service konfigurasi kuis admin dengan validasi anti-crash dan versioning atomik.
  8. `src/app/api/staff/admin/config/route.ts` & `financial/route.ts`: API endpoints manajemen profil dan finansial berproteksi RBAC `ADMIN` & CSRF.
  9. `src/app/api/staff/admin/quiz/route.ts`: API endpoint konfigurasi kuis berproteksi RBAC `ADMIN` & CSRF.
  10. `src/app/api/staff/admin/reports/turnover/route.ts`, `transactions/route.ts`, `export/route.ts`: API endpoints laporan omzet dan ekspor CSV berproteksi RBAC `ADMIN`.
  11. `src/app/api/staff/admin/audit-logs/route.ts`: API endpoint audit trail tersanitasi berproteksi RBAC `ADMIN`.
  12. `src/app/(staff)/staff/admin/admin-client-view.tsx`: Antarmuka admin 6-tab lengkap (Katalog, Kategori/Modifier, Kuis, Pengaturan Finansial dengan live simulator, Laporan Omzet dengan 4 KPI cards & tabel transaksi, dan Audit Trail).
  13. `src/app/(customer)/cart/cart-client-view.tsx`: Penyajian rincian transparan subtotal, biaya layanan, pajak restoran PB1, dan label inklusif/eksklusif sebelum checkout.
  14. `tests/unit/financial-calculator.test.ts`: 7 unit tests mencakup baseline 0%/0%, eksklusif 10%/5%, inklusif 10%/5%, invarian angka ganjil, dan edge cases.
  15. `tests/unit/timezone-utils.test.ts`: 7 unit tests batas WIB 00:00 s/d 23:59:59 terhadap UTC, transaksi 23:30 vs 00:30 WIB, rentang multi-hari, dan format jam WIB.
  16. `tests/unit/csv-exporter.test.ts`: 8 unit tests sanitasi CWE-1236 formula injection, quote escaping RFC 4180, UTF-8 BOM, dan kelengkapan kolom.
  17. `tests/unit/quiz-config-validator.test.ts`: 6 unit tests validasi anti-crash (minimal 3 langkah aktif, minimal 2 opsi aktif, tag mandatory, bobot 1–10).
  18. `tests/integration/admin-quiz-tax-reports.test.ts`: 17 live integration tests terhadap Neon PostgreSQL: RBAC guard (penolakan 401 & 403 kasir/barista), pembaruan identitas kafe, pembaruan finansial + audit log, soft-archive & restore menu, toggle Best Seller, kuis versioning, laporan omzet WIB (gross, refunds, net, top selling, eksklusi unpaid/expired), ekspor CSV attachment ber-BOM, dan sanitasi audit log.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (19 test files, 151 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/admin-quiz-tax-reports.test.ts` $\rightarrow$ Exit code 0 (17 live integration tests passed, duration 5.2s).
  3. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (14 test files, 146 tests passed, 100% PASS).
  4. Total Automated Tests: **297 tests passed across 33 test files (100% PASS)**.
  5. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  6. `pnpm run lint` $\rightarrow$ Exit code 0 (`next lint`: `✔ No ESLint warnings or errors`).
  7. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 69 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 17 — Panel Admin Katalog, Modifier, & Stok
* **Tanggal:** 2026-10-29
* **Tujuan:** Membangun antarmuka dan API manajemen katalog menu yang hanya dapat diakses oleh role berhak (`ADMIN`). Mencakup operasi tambah/edit menu, nama, deskripsi, harga integer rupiah, foto biner aman, kategori, preferensi tag kuis, penanda Best Seller (`isPopular`), urutan tampilan kustom (`sortOrder`), grup dan opsi modifier, serta toggle ketersediaan stok (`isAvailable`). Seluruh validasi dijalankan di server dengan Zod dan sanitasi ketat. Foto dibatasi maksimal 2 MB format JPG, PNG, atau WebP dengan pemeriksaan biner *magic bytes* mendalam dan batas dimensi 100x100 hingga 4000x4000 px (mencegah *decompression bomb* dan polyglot XSS/PHP). Penyimpanan gambar menggunakan tabel `MenuImage` di PostgreSQL Neon (menghindari ketergantungan disk sementara serverless `/tmp` dan tidak membagikan *service role key* ke browser), dengan ID acak UUID dan aturan pembersihan aset lama (`cleanupOldImage`). Soft-delete menu (`isArchived: true`) menjamin integritas pesanan historis, pembayaran, audit trail, dan snapshot struk tanpa baris data terhapus. Perubahan menu mempublikasikan event real-time ke saluran `CATALOG` untuk invalidasi instan di layar pelanggan.
* **Berkas yang Dibuat / Diubah:**
  1. `prisma/schema.prisma`: Penambahan model `MenuImage` (`id`, `filename`, `mimeType`, `data` Bytes, `size`, `width`, `height`, `hash`), penambahan `sortOrder Int @default(0)` pada `MenuItem`, indeks komposit `@@index([categoryId, sortOrder])`.
  2. `src/lib/server/image-validator.ts`: Validasi biner mendalam untuk foto menu (batas 2MB, magic bytes PNG/JPEG/WebP, ekstraksi dimensi frame, batas 100px s/d 4000px, penolakan SVG/script/polyglot).
  3. `src/lib/server/storage-service.ts`: Penyimpanan gambar biner database PostgreSQL (`saveMenuImage`, `getMenuImage`, `cleanupOldImage`).
  4. `src/app/api/images/[filename]/route.ts`: Streaming endpoint biner gambar publik ber-header caching HTTP (`Cache-Control: public, max-age=86400, stale-while-revalidate=604800`).
  5. `src/app/api/staff/admin/upload/route.ts`: Multipart form-data upload handler terproteksi RBAC `ADMIN` & CSRF origin guard.
  6. `src/app/api/staff/admin/menu/route.ts` & `[id]/route.ts`: Endpoint CRUD menu terproteksi RBAC `ADMIN` dengan audit logging dan event bus realtime.
  7. `src/app/api/staff/admin/menu/[id]/archive/route.ts` & `restore/route.ts`: Soft-archive & restore endpoints berproteksi `ADMIN`.
  8. `src/app/api/staff/admin/menu/[id]/popular/route.ts`: Toggle Best Seller berproteksi `ADMIN`.
  9. `src/app/api/staff/admin/categories/route.ts` & `[id]/route.ts`: Endpoint CRUD kategori menu berproteksi `ADMIN`.
  10. `src/app/api/staff/admin/modifiers/route.ts`, `[id]/options/route.ts`, `options/[optionId]/stock/route.ts`: Endpoint CRUD modifier groups & options berproteksi `ADMIN`.
  11. `src/app/api/staff/admin/tags/route.ts`: Endpoint daftar tag preferensi rasa berproteksi `ADMIN`.
  12. `src/app/(staff)/admin/page.tsx` & `src/app/(staff)/staff/admin/page.tsx`: Halaman kanonis `/admin` dan `/staff/admin` merender `AdminClientView`.
  13. `tests/unit/image-validator.test.ts`: 9 unit tests: penolakan berkas kosong, batas ukuran 2MB, deteksi magic bytes PNG/JPEG, penolakan SVG/skrip, ekstraksi dimensi, batas dimensi min/maks.
  14. `tests/integration/admin-quiz-tax-reports.test.ts`: Pengujian integrasi CRUD menu, soft-archive kekal, restore, dan Best Seller toggle.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (19 test files, 151 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/admin-quiz-tax-reports.test.ts` $\rightarrow$ Exit code 0 (17 live integration tests passed).
  3. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` 0 errors).
  4. `pnpm run lint` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  5. `pnpm run build` $\rightarrow$ Exit code 0.
* **Status:** **PASS**

---

### Tahap 16 — Struk Digital & Layout Cetak Thermal 58/80 mm
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan e-receipt digital pelanggan (`CUSTOMER_RECEIPT`), struk kasir POS (`CASHIER_RECEIPT`), dan tiket persiapan dapur (`KITCHEN_TICKET`) dari snapshot transaksi kekal yang sama di database. Seluruh akses otentikasi dan otorisasi diperiksa ketat di sisi server: pelanggan wajib memverifikasi kepemilikan pesanan via capability token `orderSecretToken` (via header atau cookie `cravio_ot_<id>`), sementara staf kasir/barista/admin wajib terotentikasi sesi JWT cookie (`verifyOrderOrStaffAccess`), menolak keras akses ilegal tanpa izin maupun cross-order token dengan HTTP 403 Forbidden. Menyajikan e-receipt digital beridentitas resmi SELA ("SELA Artisanal Coffee & Bake", Jl. Senopati No. 42), nomor order, nomor meja, stempel waktu WIB (`Asia/Jakarta`), rincian item, modifier, kuantitas, catatan dapur, subtotal, tax/service, total IDR snapshot, metode bayar, dan status finansial aktual (termasuk peringatan visual jelas "MENUNGGU PEMBAYARAN KASIR" jika tunai belum lunas, dilarang menyerupai bukti LUNAS). Membuat template cetak monokrom monospace CSS `@media print` untuk ukuran fisik 58mm (target 32 kolom, area cetak 48mm) dan 80mm (target 48 kolom, area cetak 72mm) dengan wrapping aman pada nama menu panjang (`break-words`) dan angka harga tabular (`tabular-nums`, `whitespace-nowrap`) yang tidak terpotong. Menjamin tiket dapur **MUTLAK TANPA NOMINAL RUPIAH/HARGA APAPUN**, menonjolkan nomor meja tebal ($\ge 28$px), nomor pesanan, dan modifier/catatan dapur. Menerapkan pencatatan upaya cetak atomik (`POST /api/orders/[id]/print-log`) via Prisma transaction dengan counter reprint independen per jenis dokumen (`PrintDocumentType`), sehingga pencetakan tiket dapur pertama kali tidak terlabel reprint hanya karena kasir sudah mencetak struk belanja sebelumnya. Upaya cetak ke-2 dan seterusnya diberi tanda watermark cetak ulang (`*** CETAK ULANG (REPRINT #N) ***`). Browser dialog didokumentasikan sebagai *print attempt/request*, bukan bukti fisik kertas keluar. Menyediakan fitur simpan/unduh berkas teks monospaced (`.txt`) dan dokumen mandiri (`.html`) via endpoint `GET /api/orders/[id]/receipt/download` ber-header `Content-Disposition: attachment`.
* **Berkas yang Dibuat / Diubah:**
  1. `prisma/schema.prisma`: Penambahan enum `PrintDocumentType` (`CUSTOMER_RECEIPT`, `CASHIER_RECEIPT`, `KITCHEN_TICKET`), penambahan field `documentType` pada model `PrintLog`, dan indeks komposit `@@index([orderId, documentType])`. Migrasi disinkronkan ke PostgreSQL Neon via `prisma db push`.
  2. `src/lib/server/order-access.ts`: Helper otorisasi ganda `verifyOrderOrStaffAccess(orderId, request, options)` untuk memeriksa capability token tamu vs sesi JWT staf.
  3. `src/lib/server/print-service.ts`: Service pencatatan cetak atomik (`recordPrintAttempt`) dengan transaksi Prisma, counter terpisah per `(orderId, documentType)`, pencatatan `AuditLog PRINT_ATTEMPT`, dan utilitas `getPrintSummary` tanpa efek samping.
  4. `src/lib/receipt-formatter.ts`: Formatter teks monospaced 58mm (32 kolom) & 80mm (48 kolom), wrapping nama item panjang tanpa merusak kolom harga tabular kanan, generator tiket dapur **MUTLAK TANPA HARGA**, dan generator HTML mandiri (`generatePrintableHtml`) dengan CSS `@media print`.
  5. `src/app/api/orders/[id]/print-log/route.ts`: Endpoint terproteksi `POST /api/orders/[id]/print-log` dengan skema Zod dan otorisasi ganda.
  6. `src/app/api/orders/[id]/receipt/download/route.ts`: Endpoint terproteksi `GET /api/orders/[id]/receipt/download?format=txt|html&paper=58mm|80mm&type=customer|cashier|kitchen` dengan `Content-Disposition: attachment`.
  7. `src/app/(customer)/order/[id]/receipt/page.tsx` & `receipt-client-view.tsx`: E-receipt digital responsif pelanggan dengan pemilih format 58mm/80mm, status finansial aktual (termasuk alert menunggu kasir), tombol cetak PDF dengan atomic print log, dan tombol unduh `.txt`/`.html`.
  8. `src/app/(staff)/staff/orders/[id]/print/page.tsx` & `print-client-view.tsx`: Halaman cetak thermal kasir & dapur terproteksi staf dengan switch jenis dokumen (Kasir / Dapur), switch ukuran (58mm / 80mm), layout monokrom monospace, reprint watermark, dan auto-print.
  9. `src/app/(staff)/staff/pos/pos-client-view.tsx`: Integrasi tombol `🖨️ Struk` pada kartu riwayat lunas, bukti pembatalan, dan pra-struk tagihan meja di antrean tunai.
  10. `src/app/(staff)/staff/kds/kds-client-view.tsx`: Integrasi tombol `🖨️` cetak tiket dapur di kartu antrean KDS (`QUEUED`, `COOKING`, `READY`).
  11. `tests/unit/receipt-formatter.test.ts`: 9 unit tests: wrapping panjang teks 32 & 48 kolom, penjajaran tabular harga, pemformatan struk kasir & pelanggan, tiket dapur bebas harga (zero financial amount), watermark reprint, dan penanganan status belum bayar.
  12. `tests/integration/receipt-and-thermal-print.test.ts`: 13 live integration tests terhadap Neon PostgreSQL: kesesuaian snapshot item/modifier/pajak/total, isolasi akses (penolakan token tamu silang 403), akses staf RBAC berwenang, counter reprint independen per dokumen (tiket dapur pertama vs struk kasir ke-2), unduhan teks dan HTML dengan attachment header, dan preservasi invarian finansial.
  13. `plans/16 - digital-receipt-and-thermal-print-plan.md`: Dokumen rencana kerja tersimpan di repositori.
  14. `docs/implementation-progress.md`: Pembaruan status log Tahap 16 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (14 test files, 114 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/receipt-and-thermal-print.test.ts` $\rightarrow$ Exit code 0 (13 live integration tests passed, duration 8.9s).
  3. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (13 test files, 129 tests passed, 100% PASS).
  4. Total Automated Tests: **243 tests passed across 27 test files (100% PASS)**.
  5. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  6. `pnpm exec eslint src tests/unit/receipt-formatter.test.ts tests/integration/receipt-and-thermal-print.test.ts` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  7. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 41 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 15 — KDS Dapur & Pelacak Pesanan Pelanggan
* **Tanggal:** 2026-10-29
* **Tujuan:** Membangun antarmuka Kitchen Display System (`/kitchen` & `/staff/kitchen`) dan Pelacak Pesanan Pelanggan (`/order/[id]/track`) dari order service dan sinkronisasi real-time aktual. Menegakkan Kitchen Gate (`DEC-013`): server hanya mengembalikan pesanan `paymentStatus === 'PAID'` dengan status fulfillment aktif (`QUEUED`, `COOKING`, `READY`), terurut ketat FIFO berdasarkan `paidAt: 'asc'`. Menyembunyikan kartu di UI saja tidak cukup; validasi wajib ditegakkan di level server/database. Menjamin keterbacaan KDS dari jarak jauh 1.5–2 meter (nomor meja $\ge 28$px, nama item $\ge 18$px, modifier/catatan jelas, tombol aksi $\ge 56$px `kds-touch`). Indikator usia konsisten: <10m normal abu/hijau, 10–20m kuning perhatian, >20m merah prioritas berkedip (`motion-safe:animate-pulse motion-reduce:animate-none`). Menjamin transisi status maju (`QUEUED -> COOKING -> READY -> COMPLETED`) dengan optimistic concurrency control (`where: { id, orderStatus: currentStatus, paymentStatus: 'PAID', version: order.version }`) agar dua staf yang bertindak bersamaan tidak memicu duplikasi atau race condition (mengembalikan 200 idempoten jika status sudah tercapai, atau 409 `CONCURRENT_MODIFICATION`). Menjaga invarian finansial mutlak (`paymentStatus` tetap `'PAID'`). Menyediakan kontrol audio dapur murni via Web Audio API (tombol gesture "Aktifkan Audio Dapur", Mute/Unmute, Slider Volume, Test Chime) dengan dedup ID agar snapshot awal dan reconnect tidak membunyikan pesanan lama, serta border flash visual fallback. Menyediakan tracker pelanggan dengan pemisahan status pembayaran vs progres dapur, bertahan setelah refresh, isolasi capability token `orderSecretToken` tanpa token leak, dan penanganan review refund tunai manual (`PAID` + `CANCELLED`).
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/audio-alert.ts`: Web Audio API synthesizer murni tanpa aset eksternal (frekuensi nada harmonik 880Hz $\rightarrow$ 1320Hz), `unlockAudio()` via silent buffer untuk memenuhi browser Autoplay Policy, `isAudioUnlocked()`, `isAudioMuted()`, `setMuted()`, `getVolume()`, `setVolume()`, dan persistensi konfigurasi `localStorage` (`cravio_kds_audio_config`).
  2. `src/app/api/staff/orders/[id]/status/route.ts`: Endpoint mutasi status dapur `PATCH /api/staff/orders/[id]/status` dengan penegakan Kitchen Gate (`paymentStatus === 'PAID'`), validasi urutan terurut linier (QUEUED -> COOKING -> READY -> COMPLETED), optimistic locking versioning (`where: { id, orderStatus: currentStatus, paymentStatus: 'PAID', version: order.version }`), deteksi race condition (200 idempoten vs 409 `CONCURRENT_MODIFICATION`), invarian finansial `paymentStatus` tetap `'PAID'`, dan penerbitan event `ORDER_STATUS_CHANGED`.
  3. `src/middleware.ts`: Proteksi middleware RBAC mencakup `/kitchen/:path*` dan `/staff/kitchen/:path*` yang mengizinkan `BARISTA` dan `ADMIN` (mengarahkan `CASHIER` ke `/staff/pos`).
  4. `src/app/(staff)/kitchen/page.tsx` & `src/app/(staff)/staff/kitchen/page.tsx`: Rute kanonis `/kitchen` dan `/staff/kitchen` merender `KdsClientView`.
  5. `src/app/(staff)/staff/kds/kds-client-view.tsx`: KDS touch display: nomor meja $\ge 28$px (`text-[28px] md:text-3xl font-black`), nama item $\ge 18$px (`text-[18px] md:text-xl font-bold`), tombol aksi $\ge 56$px (`kds-touch min-h-[56px] text-base font-bold`), visual age indicator (<10m abu/hijau normal, 10-20m oranye perhatian, >20m merah prioritas dengan `motion-safe:animate-pulse motion-reduce:animate-none`), audio toolbar (Aktifkan Audio, Mute/Unmute, Slider Volume, Test Chime), snapshot dedup filter (`initialLoadedIdsRef`), dan border flash notification.
  6. `src/app/(customer)/order/[id]/track/tracker-client-view.tsx`: Pelacak pesanan pelanggan dengan pemisahan status pembayaran vs status progres dapur 4-tahap, kartu khusus manual refund review saat `CANCELLED` + `PAID`, tombol penyegaran manual (`↻ Segarkan`), status offline/reconnecting, dan proteksi capability token (`OrderAccessDenied`).
  7. `tests/integration/kds-fulfillment-and-tracker.test.ts`: 10 integration tests live DB: pengecualian pesanan belum lunas dari KDS (Kitchen Gate DEC-013), urutan ketat FIFO `paidAt: 'asc'`, optimistic locking & versioning anti race condition, progres sekuensial penuh 4 status, penolakan transisi ilegal (QUEUED -> COMPLETED 400), pemisahan status pembayaran & fulfillment di API, isolasi capability token pelanggan & penolakan cross-order token 403, dan preservasi refund review state di tracker.
  8. `plans/15 - kitchen-display-and-customer-tracker-plan.md`: Dokumen rencana kerja tersimpan di folder `plans/`.
  9. `docs/implementation-progress.md`: Pembaruan status log Tahap 15 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (13 test files, 105 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/kds-fulfillment-and-tracker.test.ts` $\rightarrow$ Exit code 0 (10 live integration tests passed, duration 8.7s).
  3. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (12 test files, 117 tests passed, 100% PASS).
  4. Total Automated Tests: **222 tests passed across 25 test files (100% PASS)**.
  5. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  6. `pnpm exec eslint src tests/integration/kds-fulfillment-and-tracker.test.ts` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  7. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 37 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 14 — Sinkronisasi Real-Time (SSE & Event Bus)
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan infrastruktur sinkronisasi real-time berbasis Server-Sent Events (SSE) Web Streams API murni sesuai `ADR-0001` dan `ADR-0002` untuk POS, KDS, Pelacak Pesanan Pelanggan (*Customer Tracker*), dan invalidasi katalog menu. Dilarang membangun dual transport (tanpa WebSocket / Socket.io paralel) dan dilarang membuka tabel transaksi langsung ke publik/anon Supabase. Database PostgreSQL Neon tetap menjadi sumber kebenaran data mutlak (*source of truth*). Distribusi event lintas serverless instance (multi-instance fan-out) dijamin durable melalui tabel `outbox_events` di database tanpa bergantung pada state memori proses (`EventEmitter` / in-memory `Map`). Otorisasi kanal ketat: kanal staf KDS (`BARISTA`, `CASHIER`, `ADMIN`) dan POS (`CASHIER`, `ADMIN`) terproteksi sesi JWT cookie (`requireStaffRole`), sedangkan kanal pelanggan (`ORDER:<orderId>`) terisolasi mutlak hanya untuk pesanan miliknya menggunakan capability token guard (`orderSecretToken`), menolak keras akses lintas order dengan HTTP 403 Forbidden tanpa membocorkan token ke query log atau payload publik. Penegakan Kitchen Gate (`DEC-013`): dapur menolak keras memproses pesanan belum lunas (`ORDER_NOT_PAID`). Menyediakan audio chime alert berbasis Web Audio API murni (zero eksternal asset), heartbeat keep-alive 10 detik (`: ping\n\n`), graceful lifecycle 25 detik ramah batas Vercel serverless, cursor reconnect `Last-Event-ID` anti kehilangan event (*zero event loss*), rekonsiliasi snapshot saat reconnect/focus, fallback status `DEGRADED_POLLING`, dan pemenuhan SLA latensi normal $\le 2$ detik (terbukti rata-rata $\approx 84.55$ ms pada uji benchmark aktual).
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/server/realtime-bus.ts`: Modul engine event bus serverless: `publishEvent()` untuk persistensi durable atomik ke tabel PostgreSQL `outbox_events`, `fetchNewEvents()` dengan query cursor native Prisma (`cursor: { id }`, `skip: 1`), dan `createSseStream()` berbasis Web `ReadableStream` standar dengan keep-alive heartbeat 10 detik, auto graceful timeout 25 detik, pemulihan `Last-Event-ID`, dan pembersihan koneksi abort signal.
  2. `src/app/api/staff/kds/events/route.ts`: Endpoint SSE stream terproteksi RBAC untuk dapur/barista (`GET /api/staff/kds/events`, role `BARISTA`, `CASHIER`, `ADMIN`, channel `KDS`).
  3. `src/app/api/staff/pos/events/route.ts`: Endpoint SSE stream terproteksi RBAC untuk kasir POS (`GET /api/staff/pos/events`, role `CASHIER`, `ADMIN`, channel `['POS', 'KDS']`).
  4. `src/app/api/orders/[id]/stream/route.ts`: Endpoint SSE stream pelanggan terisolasi (`GET /api/orders/[id]/stream`) dengan verifikasi capability token guard (`orderSecretToken` via header `X-Order-Secret-Token` atau cookie `cravio_ot_<id>`), kanal terisolasi `ORDER:<orderId>`.
  5. `src/app/api/menu/stream/route.ts`: Endpoint SSE stream publik (`GET /api/menu/stream`) untuk invalidasi katalog menu realtime (channel `CATALOG`).
  6. `src/app/api/staff/orders/[id]/status/route.ts`: Endpoint mutasi status dapur `PATCH /api/staff/orders/[id]/status` dengan penegakan Kitchen Gate `paymentStatus === 'PAID'`, validasi transisi terurut (`QUEUED -> COOKING -> READY -> COMPLETED`), publikasi durable event `ORDER_STATUS_CHANGED` ke kanal `KDS` dan `ORDER:<id>`, serta pencatatan `AuditLog`.
  7. `src/app/api/staff/kds/orders/route.ts`: Endpoint snapshot antrean aktif dapur `GET /api/staff/kds/orders` menyaring hanya pesanan yang `paymentStatus === 'PAID'` dan status `QUEUED`, `COOKING`, atau `READY` (mengecualikan `UNPAID` dan `COMPLETED`).
  8. `src/lib/server/order-service.ts`: Penambahan siaran event `NEW_CASH_ORDER` ke channel `POS` saat pesanan tunai baru dibuat.
  9. `src/app/api/staff/menu/[id]/stock/route.ts`: Penambahan siaran event `STOCK_TOGGLED` ke channel `CATALOG`.
  10. `src/app/api/staff/menu/[id]/price/route.ts`: Penambahan siaran event `PRICE_CHANGED` ke channel `CATALOG`.
  11. `src/app/api/staff/orders/[id]/confirm-cash/route.ts`: Penambahan siaran event `PAYMENT_CONFIRMED` ke channel `ORDER:<id>`.
  12. `src/app/api/staff/orders/[id]/cancel/route.ts`: Penambahan siaran event `ORDER_CANCELLED` ke channel `ORDER:<id>`.
  13. `src/lib/server/webhook-service.ts`: Penambahan siaran event `PAYMENT_CONFIRMED` ke channel `ORDER:<id>` pada settlement QRIS.
  14. `src/lib/audio-alert.ts`: Utilitas suara lonceng pesanan kafe berbasis Web Audio API murni (frekuensi harmonik 880Hz $\rightarrow$ 1320Hz/1760Hz, zero external asset).
  15. `src/lib/hooks/use-realtime-stream.ts`: Hook React tangguh untuk konsumsi SSE dengan auto-reconnect backoff berjenjang (500ms, 1s, 2s, 4s, 10s), watchdog heartbeat 20s (deteksi `STALE`), penanganan `visibilitychange` / tab focus untuk snapshot re-sync, dan fallback transparan `DEGRADED_POLLING`.
  16. `src/app/(staff)/staff/kds/kds-client-view.tsx`: Tampilan 3 kolom KDS dapur (Antrean Masak `QUEUED`, Sedang Dimasak `COOKING`, Siap Saji `READY`), target sentuh ergonomis $\ge 56$px (`kds-touch`), live SSE listener, denting chime audio saat pesanan masuk, dan badge status koneksi real-time.
  17. `src/app/(staff)/staff/kds/page.tsx`: Server component `/staff/kds` terhubung ke `KdsClientView`.
  18. `src/app/(staff)/staff/pos/pos-client-view.tsx`: Pemasangan badge status koneksi realtime di header POS kasir dan auto-refresh saat event tiba.
  19. `src/app/(customer)/order/[id]/track/tracker-client-view.tsx`: Client view pelacak status meja pelanggan dengan step progression dinamis (1: Dikonfirmasi, 2: Disiapkan, 3: Siap Disajikan), live SSE listener, penanganan pembatalan, dan sinkronisasi otomatis.
  20. `src/app/(customer)/order/[id]/track/page.tsx`: Server component `/order/[id]/track` terhubung ke `TrackerClientView` terproteksi capability token.
  21. `tests/integration/realtime-sync.test.ts`: 17 integration tests live terhadap Neon PostgreSQL: persistensi outbox & cursor fetch, simulasi fan-out multi-instance terdistribusi, rekoneksi cursor `Last-Event-ID` zero event loss, kontrol akses RBAC stream staf (KDS/POS), isolasi mutlak stream pelanggan (penolakan tanpa token & cross-order token 403), Kitchen Gate enforcement (`ORDER_NOT_PAID`), progres status lengkap dapur, invalidasi katalog menu (`STOCK_TOGGLED`, `PRICE_CHANGED`), dan benchmark latensi aktual rata-rata 84.55 ms (SLA $\le 2$s).
  22. `plans/14 - realtime-sync-and-event-bus-plan.md`: Dokumen rencana kerja tersimpan di repositori.
  23. `docs/implementation-progress.md`: Pembaruan status log Tahap 14 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (13 test files, 105 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/realtime-sync.test.ts` $\rightarrow$ Exit code 0 (17 live tests passed, latency benchmark ~84.55 ms).
  3. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (11 test files, 107 integration tests passed, 100% PASS).
  4. Total Automated Tests: **212 tests passed across 24 test files (100% PASS)**.
  5. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  6. `pnpm exec eslint src tests/integration/realtime-sync.test.ts` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  7. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 35 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 13 — Dashboard Kasir POS & Alur Pembayaran Tunai
* **Tanggal:** 2026-10-29
* **Tujuan:** Membangun dashboard kasir `/pos` untuk role `CASHIER` dan `ADMIN` (menolak role `KITCHEN`/`BARISTA` dengan HTTP 403 Forbidden). Memisahkan visual antrean tunai belum lunas (`WAITING_CASHIER`), riwayat transaksi lunas (`PAID`), dan riwayat pembatalan serta refund manual. Mengidentifikasi dan memilih pesanan berdasarkan Nomor Order resmi (`orderNumber`, misal `#SELA-261029-001`) dan ID unik, bukan nomor meja saja (menghindari kerancuan satu meja dengan beberapa pesanan). Menampilkan usia pesanan (*elapsed time* / *age*) dengan pewarnaan peringatan (>10m amber, >20m red) tanpa menerapkan auto-expiry sewenang-wenang 20 menit pada alur tunai (kasir memegang wewenang penuh sesuai baseline). Menyediakan konfirmasi uang fisik atomik via `POST /api/staff/orders/[id]/confirm-cash` dengan conditional `updateMany` locking (anti klik-ganda & proteksi concurrency dua kasir paralel), mutasi atomik `Order` (`paymentStatus = PAID`, `orderStatus = QUEUED`), pembuatan record `PaymentAttempt (MANUAL_CASH, PAID)`, kenaikan `soldCount` menu, penerbitan tepat satu durable `OutboxEvent` (`ORDER_PAID`) untuk KDS, dan pencatatan `AuditLog CONFIRM_CASH`. Menyediakan alur pembatalan berizin via `POST /api/staff/orders/[id]/cancel` (alasan wajib $\ge 3$ char): pesanan belum bayar $\rightarrow$ `CANCELLED`; pesanan lunas $\rightarrow$ `orderStatus = CANCELLED`, `paymentStatus` **TETAP `PAID`** (invarian finansial mutlak: uang kas tercatat di omzet). Menyediakan pencatatan pengembalian fisik via `POST /api/staff/orders/[id]/refund` (`ManualRefundRecord`, `AuditLog MANUAL_REFUND_COMPLETED`) tanpa memanggil Refund API gateway dan tanpa status fiktif.
* **Berkas yang Dibuat / Diubah:**
  1. `src/app/api/staff/orders/route.ts`: Endpoint terproteksi `GET /api/staff/orders?tab=cash_queue|paid_history|cancelled_history` dengan RBAC `requireStaffRole(['CASHIER', 'ADMIN'])`, query badge counters paralel, sorting FIFO pada antrean tunai, sorting LIFO pada riwayat lunas, dan pemuatan relasi table/items/modifiers/manualRefunds/auditLogs.
  2. `src/app/api/staff/orders/[id]/confirm-cash/route.ts`: Endpoint mutasi `POST /api/staff/orders/[id]/confirm-cash` dengan verifikasi CSRF, guard RBAC, penolakan pesanan QRIS (400), penolakan pesanan batal (400), conditional `updateMany` locking, pembaruan status atomik, pembuatan `PaymentAttempt MANUAL_CASH`, kenaikan `soldCount`, penerbitan tepat satu `OutboxEvent ORDER_PAID`, dan pencatatan `AuditLog`.
  3. `src/app/api/staff/orders/[id]/cancel/route.ts`: Endpoint pembatalan `POST /api/staff/orders/[id]/cancel` dengan verifikasi CSRF, guard RBAC, validasi alasan min 3 karakter, pembatalan pesanan belum bayar (`CANCELLED`), dan penegakan invarian finansial untuk pesanan lunas (`orderStatus = CANCELLED`, `paymentStatus` tetap `PAID`, `AuditLog ORDER_CANCELLED_PAID_REFUND_PENDING`).
  4. `src/app/api/staff/orders/[id]/refund/route.ts`: Endpoint refund `POST /api/staff/orders/[id]/refund` dengan verifikasi CSRF, guard RBAC, validasi integer IDR positif, pembatasan total refund tidak melebihi total pesanan, pencatatan `ManualRefundRecord (MANUAL_CASH)`, dan `AuditLog MANUAL_REFUND_COMPLETED` tanpa Refund API gateway.
  5. `src/app/(staff)/staff/pos/pos-client-view.tsx`: Komponen klien interaktif POS kasir: Tab antrean tunai/lunas/batal, kartu pesanan dengan `orderNumber`, nomor meja, total snapshot IDR, item/modifier/catatan dapur, live age counter, dialog konfirmasi uang fisik anti klik-ganda, dialog pembatalan berizin, dialog pencatatan refund manual, dan auto-polling 5 detik.
  6. `src/app/(staff)/staff/pos/page.tsx`: Server component `/staff/pos` terhubung ke `PosClientView` dengan metadata resmi SELA.
  7. `tests/integration/pos-cashier.test.ts`: 20 live integration tests terhadap Neon PostgreSQL: proteksi RBAC (401/403 untuk Barista), filter tab antrean/lunas/batal, penolakan QRIS & order batal di confirm-cash, konfirmasi tunai atomik (soldCount + OutboxEvent + AuditLog), replay idempoten konfirmasi ganda, uji concurrency dua kasir paralel (tepat 1 mutasi & 1 OutboxEvent), pembatalan order belum lunas, invarian finansial pembatalan order PAID (`paymentStatus` tetap `PAID`), dan pencatatan valid `ManualRefundRecord`.
  8. `plans/13 - cashier-pos-dashboard-and-cash-flow-plan.md`: Dokumen rencana kerja tersimpan di repositori.
  9. `docs/implementation-progress.md`: Pembaruan status log Tahap 13 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (13 test files, 105 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/pos-cashier.test.ts` $\rightarrow$ Exit code 0 (20 live tests passed, 100% PASS).
  3. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (10 test files, 90 integration tests passed, 100% PASS).
  4. Total Automated Tests: **195 tests passed across 23 test files (100% PASS)**.
  5. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  6. `pnpm exec eslint src` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  7. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 37 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 12 — Webhook Gateway Midtrans & Expiry Reconciler
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan webhook resmi Midtrans (`POST /api/webhooks/midtrans`) dan background service rekonsiliasi pembayaran kedaluwarsa (`POST /api/cron/reconcile-payments`) sebagai sumber kebenaran perubahan status pembayaran yang tangguh dan konsisten. Memverifikasi signature kriptografis SHA-512 `order_id + status_code + gross_amount + ServerKey` menggunakan representasi string asli dari gateway dan pembandingan aman `crypto.timingSafeEqual`. Mem-parse uang secara ketat tanpa `float`/`parseInt` untuk menolak pecahan desimal tidak sah pada IDR (seperti `.50` atau `.99`). Menegakkan mapping status QRIS murni (`settlement` saja, menolak `capture` alur kartu kredit). Menerapkan dedup idempoten, proteksi out-of-order (notifikasi terlambat tidak menurunkan status order yang telah `PAID`), penerbitan tepat satu durable `OutboxEvent` (`ORDER_PAID`) untuk KDS, serta service rekonsiliasi yang independen dari browser pelanggan untuk meng-expire transaksi menggantung di gateway dan mencatat dana sah yang masuk setelah pembatalan tanpa memasak otomatis di dapur.
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/server/env.ts`: Penambahan validasi environment `CRON_SECRET` untuk otorisasi bearer token pada cron route rekonsiliasi.
  2. `src/lib/server/midtrans.ts`: Penambahan fungsi `verifyMidtransSignature` (SHA-512 timingSafeEqual), `parseAndValidateIdrAmount` (regex ketat desimal `.00` tanpa float/parseInt), `expireTransaction` (`POST /v2/{order_id}/expire`), dan `cancelTransaction` (`POST /v2/{order_id}/cancel`).
  3. `src/lib/server/webhook-service.ts`: Service pemrosesan webhook Midtrans dengan validasi skema Zod, verifikasi signature, validasi data finansial, QRIS settlement-only check, dedup idempoten, proteksi out-of-order status, transaksi atomik pembaruan order/attempt, kenaikan `soldCount`, pembuatan `OutboxEvent ORDER_PAID`, dan pencatatan `AuditLog`.
  4. `src/app/api/webhooks/midtrans/route.ts`: Endpoint publik aman `POST /api/webhooks/midtrans` dengan respons HTTP 200 (sukses/dedup), 403 (signature tidak sah), 400 (validation error / amount mismatch), dan 500 (retryable database error).
  5. `src/lib/server/reconciliation-service.ts`: Service rekonsiliasi otomatis (`reconcilePendingAndExpiredOrders`) untuk memeriksa order pending yang melewati batas 15 menit, membatalkan transaksi pending di Midtrans, menyinkronkan status expired, dan menangani dana masuk pasca pembatalan (dana sah dicatat `PAID`, ditandai review kasir, KDS dapur tidak memasak).
  6. `src/app/api/cron/reconcile-payments/route.ts`: Endpoint terjadwal `POST /api/cron/reconcile-payments` yang terautentikasi melalui header `Authorization: Bearer <CRON_SECRET>`.
  7. `src/app/(customer)/order/[id]/pay/payment-client-view.tsx`: Penambahan verifikasi status final ke server saat countdown mencapai `00:00` sebelum mengunci antarmuka bayar.
  8. `tests/unit/webhook-signature.test.ts`: 9 unit tests untuk verifikasi SHA-512 string asli, timing-safe equality, penolakan signature salah/panjang beda, dan validasi parser uang IDR tanpa pecahan tersembunyi.
  9. `tests/integration/midtrans-webhook.test.ts`: 6 live integration tests terhadap Neon PostgreSQL: settlement webhook transisi PAID dan emit OutboxEvent, dedup callback kedua (200 OK), out-of-order protection (notifikasi expire setelah PAID diabaikan), penolakan signature palsu (403), penolakan amount mismatch (400), dan penolakan status `capture` untuk QRIS (400).
  10. `tests/integration/payment-reconciliation.test.ts`: 4 live integration tests terhadap Neon PostgreSQL & Midtrans API: penolakan cron tanpa token (401), pemanggilan sah via Bearer CRON_SECRET (200), rekonsiliasi otomatis order kedaluwarsa tanpa browser aktif, dan penanganan dana masuk setelah pembatalan (pencatatan sah + audit log review tanpa masak otomatis).
  11. `plans/12 - midtrans-webhook-and-expiry-reconciliation-plan.md`: Dokumen rencana kerja tersimpan di folder `plans/` repositori.
  12. `docs/implementation-progress.md`: Pembaruan status log Tahap 12 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (13 test files, 105 tests passed, 100% PASS).
  2. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (9 test files, 70 integration tests passed, 100% PASS).
  3. Total Automated Tests: **175 tests passed across 22 test files (100% PASS)**.
  4. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  5. `pnpm exec eslint src` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  6. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 34 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 11 — Integrasi Charge QRIS Midtrans Core API (Mode Sandbox)
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan payment adapter Midtrans Core API dalam mode Sandbox (`POST /v2/charge` dengan `payment_type: "qris"`, acquirer: `"gopay"`, `custom_expiry: 15 menit`), menggunakan nominal snapshot server (`order.totalAmount`), bukan input client. Menghasilkan merchant order ID unik dan stabil per attempt (`${order.orderNumber}-P${attemptCount + 1}-${entropy}`), pre-persist `PaymentAttempt` ke database sebelum memanggil gateway. Mencegah charge ganda pada refresh/panggilan ulang (reuse attempt aktif). Menangani timeout jaringan secara tangguh via `GET /v2/{order_id}/status` sebelum membuat transaksi baru. Membangun layar bayar (`/order/[id]/pay`) dengan nominal resmi, QR gateway Midtrans, countdown 15m server-synced, panduan bayar satu ponsel (simpan/galeri disclaimer), auto-polling status 5s (pause saat tab hidden), cek manual, redirect otomatis saat `PAID`, serta menjamin **invarian mutlak: tombol pelanggan tidak dapat mengubah status menjadi PAID**.
* **Berkas yang Dibuat / Diubah:**
  1. `prisma/schema.prisma`: Penambahan kolom `merchantOrderId String? @unique` pada `model PaymentAttempt` dan sinkronisasi ke PostgreSQL Neon via `prisma db push`.
  2. `src/lib/server/midtrans.ts`: Adapter Midtrans Core API server-only (`getMidtransBaseUrl`, `getMidtransAuthHeader` HTTP Basic Auth base64 `MIDTRANS_SERVER_KEY:`, `formatMidtransOrderTime` zona Asia/Jakarta, `chargeQris` dengan timeout jaringan 10s, `getTransactionStatus` dengan handling 404, serta custom error classes `MidtransGatewayError` dan `MidtransTimeoutError`).
  3. `src/lib/server/payment-service.ts`: Service transaksi pembayaran server-authoritative (`getOrInitiateQrisPayment` dan `checkAndUpdatePaymentStatus`) dengan proteksi capability token guard DEC-014, reuse attempt aktif (nir-charge ganda), recovery attempt tanpa transactionId via Get Status, pre-persist `PaymentAttempt` sebelum panggilan gateway, nominal server snapshot, penanganan atomic transisi `PAID` saat `settlement` (buka antrean KDS `orderStatus = QUEUED`, naikkan `soldCount`, catat `AuditLog PAYMENT_SETTLED_MIDTRANS`), transisi `EXPIRED`, dan kalkulasi `remainingSeconds`.
  4. `src/app/api/orders/[id]/pay/qris/route.ts`: Endpoint publik aman `POST /api/orders/[id]/pay/qris` untuk inisialisasi QRIS dinamis berbasis snapshot total database dan capability token guard.
  5. `src/app/api/orders/[id]/pay/status/route.ts`: Endpoint publik aman `GET /api/orders/[id]/pay/status` untuk verifikasi status transaksi resmi ke gateway Midtrans.
  6. `src/app/(customer)/order/[id]/pay/payment-client-view.tsx`: Komponen klien interaktif layar bayar: render QR resmi dari `qrisUrl`, hitung mundur realtime berbasis `expiresAt` (15 menit), tombol unduh QR, panduan bayar satu ponsel (screenshot $\rightarrow$ e-wallet $\rightarrow$ pindai galeri foto dengan disclaimer jujur), auto-polling status 5 detik dengan listener `visibilitychange`, tombol manual verifikasi dengan spinner, dan auto-redirect ke `/order/[id]/track` saat pembayaran lunas.
  7. `src/app/(customer)/order/[id]/pay/page.tsx`: Server component layar bayar dengan verifikasi kepemilikan token `verifyOrderAccess`, inisialisasi otomatis QRIS via `getOrInitiateQrisPayment`, penanganan mode Tunai (panduan kasir), dan rendering snapshot menu.
  8. `src/lib/server/order-service.ts`: Perbaikan sequence harian agar mengambil nomor order tertinggi hari ini (`findFirst orderBy orderNumber desc`) dan penanganan error P2002 saat retry sequence.
  9. `tests/unit/midtrans-adapter.test.ts`: 8 unit tests untuk Basic Auth encoding, format custom expiry WIB, mapping response status 201/200, ekstraksi actions `generate-qr-code`, penanganan `MidtransGatewayError`, `MidtransTimeoutError`, dan parsing 404 pada Get Status.
  10. `tests/integration/midtrans-qris.test.ts`: 7 integration tests live ke PostgreSQL Neon dan Midtrans Sandbox API: charge 201 nyata mengembalikan QR URL resmi, nominal gross amount persis sama dengan snapshot integer IDR server, panggilan ulang me-reuse attempt aktif (200 OK, `reused: true`, nir-charge ganda), penolakan tanpa capability token (403 Forbidden), verifikasi status resmi via Midtrans Get Status, dan invarian tombol pelanggan tidak bisa menetapkan `PAID`.
  11. `plans/11 - midtrans-core-api-qris-charge-plan.md`: Dokumen rencana kerja tersimpan di repositori.
  12. `docs/implementation-progress.md`: Pembaruan status log Tahap 11 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (12 test files, 96 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/midtrans-qris.test.ts` $\rightarrow$ Exit code 0 (7 live tests passed against Midtrans Sandbox & Neon DB).
  3. `pnpm run test tests/integration --fileParallelism=false` $\rightarrow$ Exit code 0 (7 test files, 60 integration tests passed, 100% PASS).
  4. Total Automated Tests: **156 tests passed across 19 test files (100% PASS)**.
  5. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  6. `pnpm exec eslint src` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  7. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 32 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 10 — Order Service & Transaksi Idempoten
* **Tanggal:** 2026-10-29
* **Tujuan:** Membangun `POST /api/orders` dan service transaksi yang membuat tepat satu order per niat checkout dari quote yang disetujui, mengunci snapshot harga permanen (`OrderItem.nameSnapshot/priceSnapshot/quantity/subtotal/notes`, `OrderItemModifier.nameSnapshot/priceSnapshot`), tax/service 0%, total integer IDR, menerbitkan capability `orderSecretToken` deterministik (DEC-014), serta melindungi detail/pembayaran/receipt/tracking tanpa token di URL/log. Pembuatan order dipisahkan dari panggilan gateway (Tahap 11) dan order belum lunas tidak masuk antrean KDS dapur (`paymentStatus = UNPAID` untuk QRIS, `WAITING_CASHIER` untuk Tunai). Memperbaiki bug pembacaan cookie meja salah nama (`table_number` $\rightarrow$ `cravio_table`) dan menghapus fallback diam-diam ke meja `'07'`.
* **Berkas yang Dibuat / Diubah:**
  1. `prisma/schema.prisma` & `prisma/migrations/20261029100000_order_idempotency_v2/migration.sql`: Penambahan enum `WAITING_CASHIER`, enum `IdempotencyState { IN_PROGRESS, COMPLETED, FAILED }`, kolom `Order.capabilityNonce`, `Order.quoteId`, `OrderItem.notes`, serta pembaruan `IdempotencyRecord` dengan `ownerId`, `state`, `lockedUntil`, `orderId`, constraint `@@unique([scope, ownerId, key])`, dan sinkronisasi ke PostgreSQL Neon via `prisma db push`.
  2. `src/lib/server/guest-session.ts`: Modul sesi tamu kriptografis (`createGuestSession`, `resolveGuestSession`) dengan cookie HttpOnly `cravio_guest` (12 jam, SHA-256 hash di DB).
  3. `src/lib/server/order-capability.ts`: Derivasi deterministik capability token `deriveOrderSecretToken(orderId, capabilityNonce)` via HMAC-SHA256 dari `JWT_SECRET`, hash SHA-256 untuk PostgreSQL, dan verifikasi `timingSafeEqual`.
  4. `src/lib/server/idempotency.ts`: Pembuatan fingerprint kanonis `computePayloadFingerprint`, klaim atomik `claimIdempotencyKey` (deteksi 409 `IDEMPOTENCY_KEY_REUSED`, 409 `REQUEST_IN_PROGRESS` dengan `Retry-After: 2`, takeover stale lock >30s, dan replay 200 `COMPLETED`), `completeIdempotencyRecord`, serta `failIdempotencyRecord`.
  5. `src/lib/server/quote-service.ts`: Ekstraksi `calculateCartItems()`, penyertaan `gsid` sesi tamu pada payload JWT quote, fungsi verifikasi `verifyQuoteToken()`, dan kalkulasi `itemsHash`.
  6. `src/lib/server/order-service.ts`: Service transaksi atomik `createOrderFromQuote()` dengan retry loop sequence harian `SELA-YYMMDD-NNN`, snapshot kekal, status awal `UNPAID` (QRIS) / `WAITING_CASHIER` (Tunai), `AuditLog ORDER_CREATED`, dan pembaruan record idempotensi tanpa membocorkan token rahasia.
  7. `src/lib/server/order-access.ts`: Server guard `verifyOrderAccess(orderId, token)` dan ekstraksi token dari header `X-Order-Secret-Token` atau cookie HttpOnly `cravio_ot_<orderId>`. ID tidak dikenal & token salah memberi respons seragam 403 `FORBIDDEN`.
  8. `src/app/api/orders/route.ts`: Endpoint publik `POST /api/orders` dengan validasi Zod strict, verifikasi sesi tamu, proteksi meja mismatch/inaktif, eksekusi idempoten, dan Set-Cookie HttpOnly `cravio_ot_<id>`.
  9. `src/app/api/orders/[id]/route.ts`: Endpoint terproteksi `GET /api/orders/[id]` via capability token guard.
  10. `src/app/api/orders/quote/route.ts`: Pembaruan endpoint quote untuk mengikat `guestSessionId` ke klaim JWT quote.
  11. `src/app/(customer)/order/page.tsx`: Pembuatan `GuestSession` resmi saat pemindaian meja valid dan penerbitan cookie `cravio_guest` (HttpOnly) & `cravio_table`.
  12. `src/lib/checkout-intent.ts`: Intent stabilizer sisi klien di `localStorage` (`cravio_checkout_intent`) untuk memastikan UUID v4 yang sama dikirim saat retry/timeout/refresh selama keranjang identik, serta penyimpanan token `cravio_orders`.
  13. `src/app/(customer)/cart/cart-client-view.tsx`: Integrasi alur checkout dari konfirmasi quote ke `POST /api/orders`, retry otomatis untuk 409 `REQUEST_IN_PROGRESS`, input catatan dapur $\le 100$ char, dan banner peringatan meja belum terdeteksi.
  14. `src/app/(customer)/cart/page.tsx` & `src/app/(customer)/quiz/page.tsx`: Perbaikan pembacaan cookie ke `cravio_table` dan penghapusan fallback diam-diam ke meja `'07'`.
  15. `src/app/(customer)/order/[id]/pay/page.tsx`, `track/page.tsx`, `receipt/page.tsx`: Proteksi akses capability server guard dengan tampilan penolakan `<OrderAccessDenied />`, status jujur tanpa QR palsu ("Menunggu Pembuatan QRIS" / "Silakan Menuju Kasir"), rincian snapshot pesanan, dan layout cetak struk resmi.
  16. `tests/unit/order-capability.test.ts`: 6 unit tests untuk derivasi deterministik token HMAC, perbedaan nonce/orderId, verifikasi SHA-256 hash, dan timing-safe rejection.
  17. `tests/unit/idempotency-fingerprint.test.ts`: 9 unit tests untuk konsistensi fingerprint kanonis atas urutan item/modifier, deteksi perbedaan qty/notes/metode/meja, dan intent stabilizer di localStorage.
  18. `tests/integration/order-api.test.ts`: 8 live integration tests terhadap Neon PostgreSQL: pembuatan order UNPAID/QUEUED dengan audit log, replay idempoten 200, penanganan 5 request paralel $\rightarrow$ tepat 1 baris Order di DB, deteksi 409 `IDEMPOTENCY_KEY_REUSED`, isolasi sesi tamu berbeda dengan key sama, penolakan tanpa sesi/mismatch/injected fields (401/403/400), preservasi snapshot saat harga/nama menu diubah di DB, dan proteksi capability guard 403.
  19. `plans/10 - order-service-and-idempotent-checkout-plan.md`: Rencana kerja tersimpan di folder `plans/` repositori.
  20. `docs/implementation-progress.md`: Pembaruan status log Tahap 10 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (11 files, 88 tests passed, 100% PASS).
  2. `pnpm run test tests/integration/order-api.test.ts` $\rightarrow$ Exit code 0 (8 integration tests passed against live Neon PostgreSQL).
  3. `pnpm run test` $\rightarrow$ Exit code 0 (17 test files, 141 tests passed, 100% PASS across unit and live DB integration suites).
  4. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  5. `pnpm run lint` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  6. `pnpm run build` $\rightarrow$ Exit code 0 (Next.js production build terkompilasi sukses, 30 rute app terverifikasi).
* **Status:** **PASS**

---

### Tahap 09 — Keranjang Belanja, Modifier Sheet, & Server-Authoritative Quote
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan Bottom Sheet modifier dengan pemisahan kontrol radio/checkbox, validasi wajib/min/max di client & server, kalkulasi delta harga transparan, batas kuantitas 1–50, sanitasi catatan aman $\le 100$ karakter, diferensiasi baris keranjang berdasarkan menu + modifier + catatan, kapabilitas edit modifier dari keranjang, penyimpanan draft lokal `localStorage`, endpoint quote server-authoritative `POST /api/orders/quote` dengan validasi kepemilikan modifier ke menu, integritas harga DB, kalkulasi subtotal/tax/total integer IDR, token quote 15 menit, serta deteksi perubahan harga (`PRICE_CHANGED`) dan stok habis (`ITEM_STOCK_DEPLETED`) sebelum pembayaran.
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/server/quote-service.ts`: Server service validasi meja aktif, menu non-arsip, integritas kepemilikan modifier, batasan required/min/max grup, kalkulasi subtotal resmi integer IDR, penerbitan quote token JWT 15 menit, serta deteksi diskrepansi `PRICE_CHANGED` dan `ITEM_STOCK_DEPLETED`.
  2. `src/app/api/orders/quote/route.ts`: Endpoint publik `POST /api/orders/quote` dengan validasi skema Zod `QuoteRequestSchema`.
  3. `src/lib/cart-context.tsx`: Pembaruan generator keunikan `cartItemId: ${menuItemId}:${sortedOptionIds}:${notes}`, batas kuantitas 1–50, fungsi `updateItemDetails`, state `activeQuote`, dan mekanisme otomatis `invalidateQuote()` pada setiap mutasi.
  4. `src/components/menu/product-modifier-sheet.tsx`: Peningkatan drawer modifier dengan dukungan mode edit (`editingCartItem`), validasi required group (`isFormValid`), batas seleksi `maxSelect`, catatan barista $\le 100$ karakter dengan visual counter, dan label harga dinamis.
  5. `src/app/(customer)/cart/cart-client-view.tsx`: Komponen interaktif keranjang belanja dengan tampilan empty state, daftar kartu baris item, rendering catatan aman, stepper kuantitas 1–50, tombol ubah racikan, selector metode bayar (QRIS/Tunai), trigger verifikasi quote server, serta dialog konfirmasi transparan `PRICE_CHANGED`.
  6. `src/app/(customer)/cart/page.tsx`: Server component halaman keranjang dengan resolusi meja dari URL/cookie.
  7. `tests/unit/cart-pricing.test.ts`: 9 unit tests untuk verifikasi keunikan baris keranjang, kalkulasi subtotal modifier, format IDR, batasan kuantitas 1–50, dan sanitasi catatan.
  8. `tests/integration/quote-api.test.ts`: 9 integration tests live DB untuk endpoint quote harga, penolakan modifier palsu/selundupan, penolakan duplikasi opsi, penolakan grup wajib yang diabaikan, deteksi stok habis, dan deteksi perubahan harga (`PRICE_CHANGED`).
  9. `plans/09 - modifier-sheet-and-cart-plan.md`: Rencana kerja tersimpan di repositori.
  10. `docs/implementation-progress.md`: Pembaruan status log Tahap 09 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (9 files, 73 tests passed, termasuk 9 unit test cart pricing).
  2. `pnpm run test:integration` $\rightarrow$ Exit code 0 (5 files, 45 tests passed against Neon PostgreSQL live DB, termasuk 9 integration test quote API).
  3. Total Automated Tests: **118 tests passed (100% PASS)**.
  4. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  5. `pnpm run lint` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  6. `pnpm run build` $\rightarrow$ Exit code 0 (Semua rute termasuk `/cart` dan `/api/orders/quote` terkompilasi sukses).
* **Status:** **PASS**

---

### Tahap 08 — Engine Kuis & Rekomendasi Menu Deterministik
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan engine kuis kurasi selera 3 langkah (*Suasana / Mood* $\rightarrow$ *Karakter Rasa / Flavor* $\rightarrow$ *Format & Suhu / Format*) untuk pelanggan meja kafe SELA, murni deterministik berbasis *Weighted Tag Matching* dari database PostgreSQL tanpa dependensi OpenAI/Gemini/LLM pihak ketiga. Mematuhi ADR-0006 (Flavor=3, Format=2, Mood=1, BestSeller=+1), hierarki 5-level tie-breaker dengan stable key (`id ASC`), sold-out guard (`isAvailable: false` disaring keluar), dynamic fallback saat kombinasi langka atau stok habis, tombol "Lewati Kuis" di setiap langkah, penyajian 1 Hero Match + hingga 2 Alternatif dengan tag cocok dan alasan konkret, serta disclaimer alergi makanan resmi tanpa klaim medis.
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/recommendation-engine.ts`: Pure scoring engine, normalisasi input, 5-level tie-breaker, dynamic fallback, sold-out guard, dynamic reason builder, benchmark timer, dan disclaimer alergi konstan.
  2. `src/lib/server/quiz-service.ts`: Server service database yang mengambil 3 langkah pertanyaan kuis dan relasi bobot tag dari PostgreSQL (`QuizQuestion`, `QuizOption`, `QuizOptionTag`), serta kandidat menu aktif dengan modifier options dan `soldCount` pesanan lunas.
  3. `src/app/api/quiz/questions/route.ts`: Endpoint publik `GET /api/quiz/questions` mengembalikan 3 langkah pertanyaan kuis terurut beserta opsi dan tag.
  4. `src/app/api/quiz/recommend/route.ts`: Endpoint publik `POST /api/quiz/recommend` memvalidasi opsi kuis via Zod dan mengembalikan respon rekomendasi terstruktur.
  5. `src/app/api/recommendations/route.ts`: Endpoint publik alias `POST /api/recommendations` untuk kompatibilitas spesifikasi API kontrak lama (menerima tag slug maupun option IDs).
  6. `src/app/(customer)/quiz/recommendation-results.tsx`: Komponen visual penyaji kartu Hero Match beraksen terakota `#924805`, kartu alternatif, tag pills kecocokan, alasan konkret berbasis tag, integrasi `ProductModifierSheet` dan `CartContext`, tombol aksi, serta kotak disclaimer alergi resmi.
  7. `src/app/(customer)/quiz/quiz-stepper.tsx`: Client component interaktif 3 langkah dengan segmented progress bar, animasi transisi, kartu opsi ramah sentuh $\ge 44$ px, tombol "Lewati Kuis" di setiap langkah, dan loading state komputasi.
  8. `src/app/(customer)/quiz/page.tsx`: Server component halaman kuis pelanggan dengan penerimaan nomor meja (`?table=XX` / cookie sesi meja) dan pemanggilan data dari DB.
  9. `src/app/(customer)/order/quiz/page.tsx`: Redirect handler rute kanonis `/order/quiz` menuju `/quiz?table=XX`.
  10. `tests/unit/recommendation-engine.test.ts`: 15 unit tests komprehensif (determinisme 100x run, kalkulasi bobot, 5-level tie-breaker, sold-out guard, archived guard, fallback dinamis, skip/empty input, entire catalog sold-out, dynamic config change, benchmark kinerja $< 100$ ms, disclaimer alergi).
  11. `tests/integration/quiz-api.test.ts`: 6 integration tests live DB untuk endpoint pertanyaan kuis dan kalkulasi rekomendasi menu.
  12. `plans/08 - quiz-engine-and-recommendation-plan.md`: Rencana kerja tersimpan di repositori.
  13. `docs/implementation-progress.md`: Pembaruan status log Tahap 08 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (8 files, 64 tests passed, termasuk 15 unit test recommendation engine).
  2. `pnpm run test:integration` $\rightarrow$ Exit code 0 (4 files, 36 tests passed against Neon PostgreSQL live DB, termasuk 6 integration test kuis API).
  3. Total Automated Tests: **100 tests passed (100% PASS)**.
  4. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa error tipe).
  5. `pnpm run lint` $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  6. `pnpm run build` $\rightarrow$ Exit code 0 (18 rute Next.js 15 App Router dan Middleware terkompilasi sukses).
  7. Benchmark Kinerja Engine: Latensi kalkulasi in-memory terukur $\le 2$ ms (jauh melampaui target $< 100$ ms).
* **Status:** **PASS**

---

### Tahap 07 — Katalog Menu & Deteksi Meja QR
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan alur masuk pelanggan via QR meja (`/order?table=XX`), validasi meja serverless otoritatif ke PostgreSQL, penanganan status meja missing/invalid/nonaktif dengan pesan panduan ramah tanpa pemilihan meja default palsu, pembacaan katalog menu dinamis dari database, live instant search, kategori tab "Semua" (agregasi UI murni), kartu grid 2-kolom mobile, drawer kustomisasi modifier (*ProductModifierSheet*), pemisahan kombinasi racikan unik di keranjang belanja, serta transparansi stok *Sold Out* (grayscale 80%, opasitas 45%, badge Habis, tombol aksi terkunci).
* **Berkas yang Dibuat / Diubah:**
  1. `src/lib/server/table-service.ts`: Fungsi `validateTableServer` dengan validasi skema Zod dan kueri PostgreSQL `prisma.table.findUnique` untuk mendeteksi status `VALID`, `NOT_FOUND`, `INACTIVE`, `MISSING`.
  2. `src/lib/server/menu-service.ts`: Fungsi `getCatalogData` untuk mengambil kategori aktif dan menu non-arsip, menginjeksi tab virtual `Semua` di posisi 0, serta memformat relasi tags dan modifier options.
  3. `src/app/api/tables/[tableNumber]/route.ts`: Endpoint REST API validasi meja dengan respon Envelope baku (200 OK, 404 TABLE_NOT_FOUND, 403 TABLE_INACTIVE).
  4. `src/app/api/menu/route.ts`: Endpoint REST API query katalog dengan filter `category` dan `search` serta header `Cache-Control: no-cache, no-store, must-revalidate`.
  5. `src/lib/cart-context.tsx`: Provider state keranjang belanja client-side dengan generator hash racikan unik `cartItemId: ${menuItemId}:${sortedOptionIds.join('-')}`, pencegahan pemesanan menu habis, dan kalkulasi subtotal.
  6. `src/components/menu/table-status-banner.tsx`: Banner peringatan Mode Baca Menu jika pelanggan mengakses tanpa meja terverifikasi.
  7. `src/components/menu/category-nav.tsx`: Bar navigasi kategori sticky horizontal scroll (`Semua`, `Kopi`, `Non-Kopi`, `Makanan`) dengan aksen terakota `#924805`.
  8. `src/components/menu/menu-search-bar.tsx`: Input pencarian instan dengan ikon dan tombol clear.
  9. `src/components/menu/product-modifier-sheet.tsx`: Bottom Sheet kustomisasi modifier dengan radio single choice, checkbox add-ons, textarea catatan, dan subtotal seketika.
  10. `src/components/menu/menu-card.tsx`: Kartu menu 2-kolom mobile beresolusi 1:1, badge Favorit, format `Rp28.000` tabular, dan state sold-out terkunci.
  11. `src/components/menu/floating-order-tray.tsx`: Dock keranjang melayang di atas bottom navigation bar saat keranjang berisi item.
  12. `src/components/menu/menu-client-view.tsx`: Tampilan interaktif katalog pelanggan menggabungkan seluruh komponen menu, filter, dan drawer.
  13. `src/app/(customer)/order/page.tsx`: Halaman resolver meja server-side: validasi meja ke DB, set cookie sesi meja, redirect ke `/menu?table=XX`, atau tampilkan error panduan ramah tanpa default diam-diam.
  14. `src/app/(customer)/menu/page.tsx`: Halaman katalog utama dengan integrasi data nyata PostgreSQL dan validasi meja.
  15. `src/app/(customer)/layout.tsx`: Penyisipan `CartProvider` untuk seluruh rute pelanggan.
  16. `tests/unit/table-validation.test.ts`: 4 unit tests untuk validasi skema meja dan pencegahan fallback default.
  17. `tests/unit/menu-catalog.test.ts`: 3 unit tests untuk hashing modifier unik dan formatting harga integer IDR.
  18. `tests/integration/menu-catalog-api.test.ts`: 5 integration tests memverifikasi endpoint `/api/tables/[tableNumber]` dan `/api/menu` langsung ke Neon PostgreSQL.
  19. `plans/07 - menu-catalog-and-qr-table-detection-plan.md`: Rencana kerja tersimpan di repositori.
  20. `docs/implementation-progress.md`: Pembaruan status log Tahap 07 menjadi `PASS`.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (7 files, 49 tests passed).
  2. `pnpm exec vitest run tests/integration/menu-catalog-api.test.ts` $\rightarrow$ Exit code 0 (5 tests passed against Neon DB).
  3. `pnpm run test:integration` $\rightarrow$ Exit code 0 (3 files, 30 tests passed).
  4. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih).
  5. `pnpm run lint` $\rightarrow$ Exit code 0 (`next lint` lulus bersih tanpa peringatan).
  6. `pnpm run build` $\rightarrow$ Exit code 0 (18 rute Next.js 15 App Router dan Middleware terkompilasi sukses).
* **Status:** **PASS**

---

### Tahap 06 — Sistem Desain SELA & Komponen UI Reusable
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan fondasi antarmuka pengguna (UI) yang tangguh, modular, dan aksesibel (*WCAG 2.1 AA*) sesuai panduan `design.md`, `visual-direction.md`, dan skill `smart-menu-ui`. Menyediakan token warna SELA (`#FBF9F5`, `#FFFFFF`, `#924805`, `#1B1C1A`, `#241E1B`, `#E7E2DA`), tipografi (*Plus Jakarta Sans* & *Inter*), tabular numerals (`tabular-nums`), target sentuh ergonomis ($\ge 44$ px mobile, $\ge 56$ px KDS), 11 komponen primitif UI lengkap, shell pelanggan (header meja + 4-tab bottom nav + safe-area floating tray), shell staf terproteksi, serta galeri komponen `/dev/ui` yang aman (terblokir 404 di produksi).
* **Berkas yang Dibuat / Diubah:**
  1. `tailwind.config.ts`: Konfigurasi token semantik SELA, fonts display/sans/mono, target sentuh `min-h-touch: 44px` & `min-h-touch-kds: 56px`, SELA easing & motion transitions, shadows level 1-3.
  2. `src/app/globals.css`: Variabel CSS SELA, tabular numerals (`.tabular-nums`, `.font-price-tabular`), penanganan iOS safe-area (`.pb-safe`), prefers-reduced-motion media query, dan thermal print 58/80 mm styling.
  3. `src/app/layout.tsx`: Root layout Next.js 15 dengan kelas tema SELA dan tema bar peramban `#1B1C1A`.
  4. `src/components/ui/button.tsx`: Komponen Button multi-varian (`primary`, `secondary`, `outline`, `ghost`, `danger`, `kds`), state loading spinner, disabled, micro-tap physics (`active:scale-[0.98] duration-120`), dan fokus ring.
  5. `src/components/ui/input.tsx` & `src/components/ui/textarea.tsx`: Form input dan textarea ramah sentuh ($\ge 44$ px), label terhubung aksesibel, teks bantuan, pesan error `#BA1A1A`, dan penghitung karakter tersisa.
  6. `src/components/ui/badge.tsx`: Lencana status dual-encoding (ikon + teks, WCAG 2.1 AA) dengan varian `table`, `paid`, `cooking`, `error`, `soldout`, `primary`.
  7. `src/components/ui/dialog.tsx` & `src/components/ui/bottom-sheet.tsx`: Dialog terpusat desktop/tablet dan Bottom Sheet drawer mobile dengan scroll lock pada `document.body`, focus trap Tab/Shift+Tab, Escape listener, dan pemulihan fokus otomatis.
  8. `src/components/ui/radio.tsx` & `src/components/ui/checkbox.tsx`: Kontrol pilihan varian & modifier dengan target sentuh $\ge 44 \times 44$ px dan badge penambahan harga (`+Rp6.000`).
  9. `src/components/ui/quantity-stepper.tsx`: Stepper kuantitas inline kapsul gelap `#241E1B` dan varian drawer dengan tabular numerals dan tombol sentuh ergonomis.
  10. `src/components/ui/skeleton.tsx` & `src/components/ui/spinner.tsx`: Shimmer placeholder berlatar `#EFEEEA` (`SkeletonCard` 1:1, `SkeletonText`, `SkeletonButton`) dan SVG spinner.
  11. `src/components/ui/toast.tsx`: Toast provider & hook `useToast()` untuk notifikasi status instan yang melayang aman di atas floating tray / bottom nav.
  12. `src/components/ui/empty-state.tsx` & `src/components/ui/error-state.tsx`: Komponen visual ramah bertema artisanal kafe dengan pesan santun Bahasa Indonesia dan tombol aksi/retry.
  13. `src/components/ui/connection-banner.tsx`: Detektor status jaringan online/offline transparan berbasis `window.navigator.onLine`.
  14. `src/components/ui/index.ts`: Barrel export bersih untuk seluruh komponen UI primitif.
  15. `src/components/shells/staff-help-modal.tsx`: Modal bantuan staf dengan kontak resmi kafe (+62 812-3456-7890 WhatsApp, panggil pelayan ke meja, panduan tunai) tanpa tautan mati.
  16. `src/components/shells/customer-header.tsx`: Header meja sticky dengan badge nomor meja dan tombol bantuan staf.
  17. `src/components/shells/customer-bottom-nav.tsx`: Bar navigasi bawah 4-tab (Menu, Kurasi, Pesanan, Bantuan) dengan penjagaan query `?table=XX`.
  18. `src/app/(customer)/layout.tsx`: Layout pelanggan terpusat mobile (max-width 430px) dengan clearance bawah `pb-28 pb-safe` untuk floating tray.
  19. `src/components/shells/staff-header.tsx` & `src/app/(staff)/layout.tsx`: Shell staf terproteksi dengan jam digital WIB, role badge, status koneksi, dan logout aman.
  20. `src/app/dev/ui/page.tsx` & `client-showcase.tsx`: Galeri pengujian komponen development dengan guard 404 ketat pada mode produksi.
  21. `tests/unit/color-contrast.test.ts`: 11 pengujian matematis rasio kontras warna aktual berstandar WCAG 2.1 AA.
  22. `tests/unit/ui-components.test.tsx`: 19 pengujian render, interaksi, aksesibilitas, dan security guard dev UI.
  23. `plans/06 - sela-design-system-and-ui-components-plan.md`: Rencana kerja tersimpan di repositori.
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (5 files, 42 tests passed: 11 tests kontras aktual + 19 tests UI components + 12 unit tests dasar).
  2. `pnpm run typecheck` $\rightarrow$ Exit code 0 (`tsc --noEmit` lulus bersih tanpa kesalahan tipe).
  3. `pnpm run lint` $\rightarrow$ Exit code 0 (`next lint` lulus bersih tanpa peringatan).
  4. `pnpm run build` $\rightarrow$ Exit code 0 (17 halaman Next.js 15 App Router dan Middleware terkompilasi sukses).
* **Status:** **PASS**
* **Risiko / Catatan:** Kontras warna aktual yang diuji matematis membuktikan seluruh kombinasi warna memenuhi WCAG 2.1 AA ($\ge 4.5:1$ untuk teks normal dan $\ge 3.0:1$ untuk elemen besar). Nilai kontras aktual bahkan melampaui estimasi awal di dokumen (misal: `#1B1C1A` pada `#FBF9F5` menghasilkan kontras $16.27:1$ vs estimasi $13.8:1$).

---

### Tahap 05 — Autentikasi Staf & Otorisasi Server (RBAC)
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan sistem autentikasi sesi staf dan otorisasi berbasis peran (RBAC) dengan pertahanan berlapis (*defense-in-depth*), cookie HttpOnly via `jose` JWT HS256, hashing kredensial via `bcryptjs`, proteksi otomatis terhadap akun staf yang dinonaktifkan (`isActive: false`), matriks otorisasi tiga peran (`ADMIN`, `CASHIER`, `BARISTA` / `KITCHEN`), Next.js Middleware perimeter gate, pembatasan percobaan login persisten (lockout 5 kali gagal / 15 menit), CSRF origin check, serta audit log tanpa kebocoran kredensial.
* **Berkas yang Dibuat / Diubah:**
  1. `package.json` & `pnpm-lock.yaml` (memasang paket `bcryptjs`, `@types/bcryptjs`, dan memperbarui skrip `test:integration`).
  2. `prisma/schema.prisma` (menambahkan `failedLoginAttempts: Int @default(0)` dan `lockedUntil: DateTime?` pada model `StaffUser`).
  3. `prisma/seed.ts` (mengisi hash bcrypt nyata untuk akun testing dev: `admin`, `kasir`, `barista`).
  4. `src/lib/server/auth.ts` (fungsi `hashCredential`, `verifyCredential`, `signStaffToken`, `verifyStaffToken`, `STAFF_COOKIE_NAME`).
  5. `src/lib/server/csrf.ts` (fungsi verifikasi `verifyCsrfOrigin` untuk mutasi berbasis cookie).
  6. `src/lib/server/auth-guard.ts` (guard server-side otoritatif `requireStaffRole` dan `getAuthenticatedStaff` dengan pengecekan database `isActive === true`).
  7. `src/middleware.ts` (perimeter middleware Next.js yang memproteksi rute `/staff/*` dan `/api/staff/*`, mengecualikan `/api/webhooks/*`).
  8. `src/app/api/auth/login/route.ts` (endpoint login staf dengan validasi Zod, lockout persisten, verifikasi bcrypt, penerbitan cookie HttpOnly, dan AuditLog).
  9. `src/app/api/auth/logout/route.ts` (endpoint logout dengan invalidasi cookie `maxAge: 0` dan AuditLog).
  10. `src/app/api/auth/me/route.ts` (endpoint profil staf aktif untuk verifikasi sesi frontend).
  11. `src/app/api/staff/orders/[id]/confirm-cash/route.ts` (endpoint konfirmasi uang kasir, dilindungi `requireStaffRole(['CASHIER', 'ADMIN'])`).
  12. `src/app/api/staff/menu/[id]/price/route.ts` (endpoint perubahan harga menu, dilindungi khusus `requireStaffRole(['ADMIN'])`).
  13. `src/app/api/staff/menu/[id]/stock/route.ts` (endpoint quick toggle stok sold-out, dilindungi `requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'])`).
  14. `tests/integration/staff-auth-rbac.test.ts` (14 skenario pengujian integrasi lengkap).
  15. `tests/setup.ts` (mocking `server-only` untuk runtime pengujian Vitest).
  16. `plans/05 - staff-authentication-and-rbac-plan.md` (rencana kerja tersimpan).
  17. `docs/implementation-progress.md` (pembaruan status).
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm add bcryptjs` & `pnpm add -D @types/bcryptjs` $\rightarrow$ Exit code 0.
  2. `pnpm exec prisma db push` $\rightarrow$ Exit code 0 (Kolom `failedLoginAttempts` dan `lockedUntil` tersinkronisasi ke Neon).
  3. `pnpm run db:seed` $\rightarrow$ Exit code 0 (Hash bcrypt dev berhasil diaplikasikan).
  4. `vitest run tests/integration/staff-auth-rbac.test.ts` $\rightarrow$ Exit code 0 (14 tests lulus 100% dalam 6.30s).
  5. `pnpm run test:integration` $\rightarrow$ Exit code 0 (Seluruh 25 integration tests lulus dalam 7.65s).
  6. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (Seluruh 12 unit tests lulus dalam 3.89s).
  7. `pnpm run typecheck` $\rightarrow$ Exit code 0 (TypeScript strict lulus 100%).
  8. `pnpm run lint` $\rightarrow$ Exit code 0 (0 warnings / errors).
  9. `pnpm run build` $\rightarrow$ Exit code 0 (Seluruh 16 rute App Router + Middleware terkompilasi optimal).
* **Hasil Kriteria:**
  * Login Valid Admin, Kasir, & Barista Berfungsi: **PASS**
  * Penolakan Kredensial Salah (401): **PASS**
  * Guest Ditolak Mengakses Endpoint Staf (401): **PASS**
  * KITCHEN Dilarang Konfirmasi Uang & Ubah Harga (403): **PASS**
  * CASHIER Dilarang Ubah Harga Menu (403): **PASS**
  * CASHIER Berhak Konfirmasi Uang Tunai (200): **PASS**
  * ADMIN Berhak Ubah Harga Menu (200): **PASS**
  * BARISTA Berhak Toggle Stok Sold-Out (200): **PASS**
  * Staf Dinonaktifkan (`isActive: false`) Ditolak Seketika (403): **PASS**
  * Lockout Persisten 5 Kali Gagal (429): **PASS**
  * Proteksi CSRF Origin Mismatch (403): **PASS**
  * Logout & Invalidasi Cookie Berfungsi: **PASS**
  * Pengecualian Webhook Gateway Terjaga: **PASS**
  * Version Control Git: **BLOCKED / NOT RUN** (Git CLI tidak di PATH)
* **Blocker / Kendala:**
  * Tidak ada kendala teknis pada sistem autentikasi dan otorisasi RBAC; seluruh pengujian server guard dan middleware lulus 100%.
* **Langkah Berikutnya:**
  * Menunggu pengiriman **Prompt 06** dari pengguna untuk implementasi **Sistem Desain SELA & Komponen UI** (komponen atomik UI, token warna, typography, layout responsif mobile & desktop, status sold-out visual, dan dialog modal).

### Tahap 04 — Skema Database Relasional, Migrasi Prisma, & Seeder Idempoten
* **Tanggal:** 2026-10-29
* **Tujuan:** Mengimplementasikan skema relasional PostgreSQL lengkap dengan Prisma ORM untuk 18 entitas inti tanpa multi-tenancy (`tenant_id`) dan tanpa inventori bahan baku, mengunci nilai moneter dalam integer IDR, menjaga keabadian snapshot item transaksi, menerapkan soft-delete menu (`isArchived`, `deletedAt`), mengamankan token guest via hashing SHA-256, memasang indeks performa KDS dan rekonsiliasi kasir, menerapkan RLS lockdown untuk mengisolasi peran publik/anon, serta menyediakan seeder idempoten untuk 18 menu SELA, 3 kategori riil, 10 meja, konfigurasi Cravio, kuis 3-langkah, dan akun staf dev.
* **Berkas yang Dibuat / Diubah:**
  1. `prisma/schema.prisma` (18 entitas: Table, Category, MenuItem, Tag, MenuItemTag, ModifierGroup, ModifierOption, MenuItemModifierGroup, QuizQuestion, QuizOption, QuizOptionTag, CravioConfig, StaffUser, GuestSession, Order, OrderItem, OrderItemModifier, PaymentAttempt, IdempotencyRecord, AuditLog, ManualRefundRecord, PrintLog, OutboxEvent).
  2. `prisma/migrations/20261028171815_init_full_cravio_schema/migration.sql` (migrasi DDL ter-versioning).
  3. `prisma/migrations/20261028172000_enable_rls_security_lockdown/migration.sql` (migrasi DDL pengaktifan RLS dan pencabutan hak akses peran `anon`/`public`).
  4. `prisma/seed.ts` (dataset seeder idempoten dengan pola `upsert`: 18 menu SELA, 3 kategori, 10 meja, konfigurasi Cravio, kuis 3-langkah terbobot, modifier, dan akun staf dev).
  5. `tests/integration/db-schema-integrity.test.ts` (suite uji integrasi Vitest dengan 11 pengujian otomatis).
  6. `package.json` (memperbarui skrip `test:integration`).
  7. `.env` & `.env.example` (konfigurasi direct session URL untuk Prisma migrate dan URL database pengujian terisolasi).
  8. `plans/04 - prisma-schema-and-database-migration-plan.md` (rencana kerja tersimpan).
  9. `docs/implementation-progress.md` (pembaruan status).
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm run db:generate` $\rightarrow$ Exit code 0 (Prisma Client tergenerasi dalam 327ms).
  2. `pnpm exec prisma migrate dev --name init_full_cravio_schema` $\rightarrow$ Exit code 0 (Migrasi DDL diterapkan ke PostgreSQL Neon).
  3. `pnpm exec prisma migrate deploy` $\rightarrow$ Exit code 0 (Migrasi RLS lockdown diaplikasikan).
  4. `pnpm run db:seed` (Run 1) $\rightarrow$ Exit code 0 (18 menu, 10 meja, 3 kategori, kuis, dan akun staf berhasil di-seed).
  5. `pnpm run db:seed` (Run 2) $\rightarrow$ Exit code 0 (Membuktikan idempotensi seeder tanpa duplicate key errors).
  6. `vitest run tests/integration/db-schema-integrity.test.ts` $\rightarrow$ Exit code 0 (11 test integrasi lulus 100% dalam 6.07s).
  7. `pnpm run typecheck` $\rightarrow$ Exit code 0 (TypeScript strict lulus 100%).
  8. `pnpm run lint` $\rightarrow$ Exit code 0 (0 warnings / errors).
  9. `pnpm run test tests/unit` $\rightarrow$ Exit code 0 (3 files, 12 unit tests lulus).
  10. `pnpm run build` $\rightarrow$ Exit code 0 (Seluruh 13 rute App Router terkompilasi optimal).
* **Hasil Kriteria:**
  * Skema 18 Model Lengkap: **PASS**
  * Integritas Moneter Integer IDR: **PASS**
  * Snapshot Transaksi Kekal: **PASS**
  * Soft-Delete Menu Aman: **PASS**
  * Hash Token Guest SHA-256: **PASS**
  * Optimistic Concurrency Version: **PASS**
  * Idempotensi Seeder Terbukti: **PASS**
  * Isolasi RLS PostgreSQL Terbukti: **PASS**
  * Seluruh Test Integrasi Lulus: **PASS**
  * Version Control Git: **BLOCKED / NOT RUN** (Git CLI tidak di PATH)
* **Blocker / Kendala:**
  * Tidak ada kendala teknis pada skema database atau migrasi; database Neon PostgreSQL beroperasi optimal.
* **Langkah Berikutnya:**
  * Menunggu pengiriman **Prompt 05** dari pengguna untuk implementasi modul **Autentikasi Staf & Otorisasi Server** (login PIN/password, cookie HTTP-Only via `jose` JWT, proteksi Route Handlers, dan middleware).

### Tahap 03 — Inisialisasi Proyek & Tooling Dasar (Scaffolding)
* **Tanggal:** 2026-10-28
* **Tujuan:** Melakukan scaffolding aplikasi fullstack modular monolith Next.js 15 App Router secara aman tanpa menghapus berkas pengguna, memasang dependensi tersemat (*pinned*), menyiapkan konfigurasi TypeScript strict, Tailwind CSS v3.4 (token SELA), Prisma ORM 6, Zod, `jose`, batas arsitektur `server-only`, suite pengujian Vitest, GitHub Actions CI workflow, dan panduan Windows PowerShell di `README.md`.
* **Berkas yang Dibuat / Diubah:**
  1. `package.json` & `pnpm-lock.yaml` (dependensi pinned: Next.js 15.1.7, React 19, Prisma 6.19.3, Tailwind 3.4.19, Zod 3.25, jose 5.10, server-only 0.0.1, Vitest 3.2.7).
  2. `tsconfig.json` (`strict: true`, `noImplicitAny: true`, alias `@/*` -> `./src/*`).
  3. `next.config.ts` (`reactStrictMode: true`, `poweredByHeader: false`).
  4. `tailwind.config.ts` (token warna SELA: `#2C1810`, `#C67D3E`, `#FBF9F5`, font Plus Jakarta Sans/Playfair Display, touch targets 44px/56px).
  5. `postcss.config.mjs` & `eslint.config.mjs` (ESLint 9 Flat Config dengan Next.js core-web-vitals).
  6. `vitest.config.ts` & `tests/setup.ts` (Vitest runner dengan jsdom & testing-library/jest-dom).
  7. `prisma/schema.prisma` (model relasional PostgreSQL: Table, Category, MenuItem, ModifierGroup, ModifierOption, Order, OrderItem, OrderItemModifier, PaymentAttempt, StaffUser, IdempotencyRecord, AuditLog).
  8. `prisma/seed.ts` (seeder lokal meja 01-10, kategori, menu contoh SELA, dan akun staf).
  9. `.env.example` (template environment lengkap SELA, Midtrans Sandbox, JWT, dan Supavisor pooling tanpa kebocoran secret).
  10. `.gitignore` & `.github/workflows/ci.yml` (CI pipeline: frozen-lockfile, db:generate, lint, typecheck, test, build).
  11. `README.md` (panduan setup Windows PowerShell, execution policy, environment, script guide, dan verifikasi).
  12. Batas Server-Only:
      * `src/lib/server/db.ts` (PrismaClient singleton dengan `import 'server-only'`).
      * `src/lib/server/auth.ts` (Jose JWT sign & verify dengan `import 'server-only'`).
      * `src/lib/server/env.ts` (Zod server environment validator dengan `import 'server-only'`).
  13. Utilitas & Validasi:
      * `src/lib/utils.ts` (formatIDR, formatOrderNumber, `cn` utility).
      * `src/types/index.ts` (domain types).
      * `src/validation/schemas.ts` (Zod schemas selaras `api-contracts.md`).
  14. Routing App Router & Pages:
      * `src/app/globals.css` (Tailwind styles, SELA variables, touch targets, receipt @media print 58/80 mm).
      * `src/app/layout.tsx` & `src/app/not-found.tsx`.
      * `src/app/(b2b)/page.tsx` (Landing page B2B Cravio).
      * `src/app/api/health/route.ts` (Healthcheck endpoint).
      * `src/app/(auth)/login/page.tsx` (Login staf).
      * `src/app/(customer)/order/page.tsx`, `menu/page.tsx`, `quiz/page.tsx`, `cart/page.tsx`, `order/[id]/pay/page.tsx`, `track/page.tsx`, `receipt/page.tsx`.
      * `src/app/(staff)/staff/pos/page.tsx`, `staff/kds/page.tsx`, `staff/admin/page.tsx`.
  15. Pengujian Unit:
      * `tests/unit/formatting.test.ts` (4 tests).
      * `tests/unit/validation.test.ts` (6 tests).
      * `tests/unit/env-guard.test.ts` (2 tests).
  16. Rencana & Progress:
      * `plans/03 - scaffolding-and-tooling-initialization-plan.md`
      * `docs/implementation-progress.md`
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `pnpm install` $\rightarrow$ Exit code 0 (Lockfile terpasang deterministik).
  2. `pnpm run db:generate` $\rightarrow$ Exit code 0 (Prisma Client v6.19.3 tergenerasi lokal dalam 245ms).
  3. `pnpm run typecheck` (`tsc --noEmit`) $\rightarrow$ Exit code 0 (Kompilasi TypeScript strict lulus 100%).
  4. `pnpm run lint` (`next lint`) $\rightarrow$ Exit code 0 (`✔ No ESLint warnings or errors`).
  5. `pnpm run test` (`vitest run`) $\rightarrow$ Exit code 0 (3 test files lulus, 12 unit tests lulus dalam 4.04s).
  6. `pnpm run build` (`next build`) $\rightarrow$ Exit code 0 (Seluruh 13 rute berhasil dikompilasi & dioptimasi).
  7. `pnpm run test:integration` & `pnpm run test:e2e` $\rightarrow$ Exit code 0 dengan output catatan eksplisit bahwa pengujian integrasi database & E2E akan diimplementasikan pada milestone terkait (tidak dilaporkan sebagai bukti fitur palsu).
* **Hasil Kriteria:**
  * Scaffold Non-Destruktif & Berkas Aman: **PASS**
  * Pinned Dependencies & Deterministic Install: **PASS**
  * Prisma Client Generation Lokal: **PASS**
  * TypeScript Strict Typecheck: **PASS**
  * ESLint Static Analysis: **PASS**
  * Vitest Unit Tests: **PASS**
  * Next.js Production Build: **PASS**
  * Batas Server-Only Enforced: **PASS**
  * Template `.env.example` Konsisten SELA: **PASS**
  * Dokumentasi Windows PowerShell (`README.md`): **PASS**
  * Tanpa Mutasi ke Database Produksi: **PASS**
  * Version Control Git: **BLOCKED / NOT RUN** (Git CLI tidak terdaftar di PATH lokal)
* **Blocker / Kendala:**
  * Git CLI belum terdaftar di PATH sistem; riwayat versi dicatat secara transparan di berkas progress ini.
* **Langkah Berikutnya:**
  * Menunggu pengiriman **Prompt 04** dari pengguna untuk pengerjaan modul skema database relasional & migrasi Prisma ke database staging/lokal.

### Tahap 02 — Keputusan Arsitektur & Kontrak (ADR)
* **Tanggal:** 2026-10-28
* **Tujuan:** Menetapkan keputusan arsitektur modular monolith Next.js 15, menyusun 7 berkas ADR, merancang kontrak API Zod lengkap, menyusun peta rute kanonis tunggal, serta mengoptimalkan arsitektur untuk deployment **Vercel Free Tier (Hobby) Rp 0 / bulan**.
* **Berkas yang Dibuat / Diubah:**
  1. `docs/adr/README.md` (indeks katalog 7 record ADR).
  2. `docs/adr/ADR-0001-hosting-database-and-realtime.md` (hosting Vercel Free Tier Rp 0, connection pooling Supavisor, SSE auto-reconnect 25–30s, Supabase Storage 1GB).
  3. `docs/adr/ADR-0002-staff-auth-and-server-mediated-realtime.md` (auth cookie HTTP-Only via `jose` JWT, server-mediated SSE, larangan akses anon ke tabel order).
  4. `docs/adr/ADR-0003-single-canonical-route-map.md` (peta rute tunggal, eliminasi tabrakan `/`, middleware protection `/staff/*`).
  5. `docs/adr/ADR-0004-independent-payment-and-fulfillment-state-machines.md` (pemisahan enum `PaymentStatus` dan `OrderStatus`, penegakan kitchen gate PAID-only, matriks transisi status).
  6. `docs/adr/ADR-0005-transaction-integrity-idempotency-and-pricing-contracts.md` (server integer IDR, quote harga, header `Idempotency-Key`, hashing SHA-256 token guest, webhook SHA512).
  7. `docs/adr/ADR-0006-deterministic-three-step-recommendation-engine.md` (formula kuis 3 langkah SELA $W_{\text{flav}}=3, W_{\text{format}}=2, W_{\text{mood}}=1, B_{\text{seller}}=1$, threshold $S \ge 3$, top 2 hasil, tie-break 5 tingkat, zero LLM).
  8. `docs/adr/ADR-0007-staff-access-control-cash-window-and-business-resolutions.md` (password admin vs PIN staf, wewenang toggle stok barista di KDS, toleransi bayar tunai 20 mnt, refund manual kasir, harga B2B Rp2,5jt).
  9. `docs/api-contracts.md` (kontrak lengkap REST API dengan skema validasi Zod untuk seluruh endpoint publik dan staf).
  10. `docs/route-map.md` (peta rute kanonis terpadu, guard middleware, dan penanganan error).
  11. `plans/02 - architecture-decisions-and-contracts-plan.md` (rencana kerja Tahap 02 di folder plans).
  12. `docs/implementation-progress.md` (diperbarui).
* **Pemeriksaan Aktual yang Dijalankan:**
  1. `Test-Path` untuk seluruh berkas ADR, `api-contracts.md`, dan `route-map.md` $\rightarrow$ `True`.
  2. `Select-String` untuk pemindaian kebocoran kunci rahasia $\rightarrow$ `0 leaks / Clean`.
* **Hasil Kriteria:**
  * Kelengkapan 7 ADR: **PASS**
  * Spesifikasi Kontrak API Zod: **PASS**
  * Peta Rute Kanonis Bersih: **PASS**
  * Optimasi Vercel Free Tier Serverless: **PASS**
  * Version Control Git: **BLOCKED / NOT RUN** (Git executable tidak terdaftar di PATH lokal)
* **Blocker / Kendala:**
  * Git CLI belum terdaftar di PATH sandbox; pencatatan kemajuan terus dikelola terstruktur di berkas ini.
* **Langkah Berikutnya:**
  * Menunggu pengiriman **Prompt 03** dari pengguna untuk menginisialisasi repository, melakukan scaffolding Next.js 15 App Router, TypeScript strict, Prisma 6, Tailwind CSS, Zod, `jose`, dan tooling testing Vitest.

---

### Tahap 01 — Audit Dokumen & Baseline Persyaratan
* **Tanggal:** 2026-10-28
* **Hasil Kriteria:** **PASS** (Menghasilkan `spec-audit.md`, `requirements-traceability.md`, dan penunjuk `visual-direction.md`).

---

### Tahap 00 — Instruksi Induk & Inventarisasi Awal
* **Tanggal:** 2026-10-28
* **Hasil Kriteria:** **PASS** (Dokumen & skill lengkap, git status diperiksa, progress log diinisialisasi).
