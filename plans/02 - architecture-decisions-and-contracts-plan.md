# Rencana Kerja: Keputusan Arsitektur (ADR), Kontrak API, & Route Map Cravio

## Goal Description
Menyusun keputusan arsitektur resmi (*Architecture Decision Records* / ADR), kontrak antarmuka API lengkap (*API Contracts* berbasis skema Zod), peta rute tunggal (*Single Route Map*), serta penyelarasan 7 topik teknis kritis sebelum scaffolding aplikasi Next.js 15 dimulai pada Tahap 03.

Arsitektur mempertahankan **Fullstack Modular Monolith** tanpa overengineering dan **dioptimalkan secara khusus agar dapat berjalan andal pada Vercel Free Tier (Hobby Tier) dengan biaya Rp 0 / bulan**, didukung oleh **Supabase / Neon Free Tier PostgreSQL** (dengan connection pooling) dan **Supabase Storage Free Tier** (1 GB).

---

## User Review Required

> [!IMPORTANT]
> **Keputusan Kritis yang Diformalkan dalam ADR:**
> 1. **Infrastruktur Hosting Vercel Free Tier & Optimasi Serverless (ADR-0001):**
>    - **Target Deployment:** Proyek secara resmi didesain dan dioptimalkan untuk berjalan di atas **Vercel Free Tier (Hobby Tier)** dengan biaya infrastruktur aplikasi **Rp 0 / bulan**.
>    - **Optimasi Serverless Connection Pooling:** Karena serverless functions di Vercel hidup-mati secara dinamis (*ephemeral*), koneksi database ke PostgreSQL wajib melalui **Supabase Supavisor / PgBouncer pooler** (`DATABASE_URL` port 6543 dengan parameter `?pgbouncer=true`) untuk mencegah *connection exhaustion*. Migrasi Prisma CLI menggunakan `DIRECT_URL` (port 5432).
>    - **Arsitektur Real-Time Serverless (Resilient SSE):** Untuk mengakomodasi batas durasi eksekusi function serverless di Vercel Hobby (timeout 15–60 detik), mekanisme Server-Sent Events (SSE) dirancang dengan pola **Graceful Resilient Reconnect Stream**:
>      * Server membuka `ReadableStream` dan mengirim event real-time + heartbeat setiap 10 detik.
>      * Pada durasi ~25–30 detik (sebelum batas timeout Vercel), server menutup stream secara anggun (*graceful close 200 OK*).
>      * Klien peramban (KDS dapur & tracker pelanggan) memanfaatkan mekanisme bawaan `EventSource` / stream reader yang otomatis menyambung kembali (*auto-reconnect* $\le 1$ detik) dengan mengirimkan header `Last-Event-ID` atau query parameter timestamp untuk mengambil delta pesanan tanpa terputus.
>    - **Nir-State di Memori Serverless:** Seluruh idempotensi, state pesanan, quote harga, dan log audit 100% disimpan secara persisten di database PostgreSQL ACID, menjamin konsistensi lintas instance serverless Vercel.
>    - **Penyimpanan Gambar:** Menggunakan **Supabase Storage Free Tier** (1 GB penyimpanan foto menu kafe) dengan public CDN URL langsung ke peramban pelanggan.
> 2. **Integrasi Auth Cookie Staf & Real-Time (ADR-0002):**
>    - Real-time KDS dapur dan pelacak pesanan **TIDAK MENGGUNAKAN** client-side Supabase Realtime anon key (karena cookie sesi staf Next.js tidak terbaca oleh Supabase RLS dan tabel pesanan dilarang dibuka untuk anonim publik).
>    - Real-time diimplementasikan melalui **Server-Mediated SSE Route Handlers** (`/api/staff/kds/events` dan `/api/orders/[orderId]/stream`) yang memvalidasi cookie sesi staf HTTP-Only dan token `orderSecretToken` pelanggan langsung di sisi server Next.js.
> 3. **Peta Rute Tunggal & Bersih (ADR-0003):**
>    - `/`: Landing page B2B komersial Cravio.
>    - `/order?table=XX`: Pintu masuk pemesanan pelanggan meja SELA.
>    - Sub-rute pelanggan: `/order/quiz`, `/order/menu`, `/order/cart`, `/order/[id]/pay`, `/order/[id]/track`, `/order/[id]/receipt`.
>    - Sub-rute staf: `/staff/login`, `/staff/pos`, `/staff/kitchen`, `/staff/admin`.
>    - Route groups `(b2b)`, `(customer)`, `(staff)` murni untuk partisi layout internal, tidak mengubah URL publik.
> 4. **Pemisahan Mesin Status (ADR-0004):**
>    - `PaymentStatus`: `PENDING`, `WAITING_CASHIER`, `PAID`, `EXPIRED`, `FAILED`.
>    - `OrderStatus`: `QUEUED`, `COOKING`, `READY`, `COMPLETED`, `CANCELLED`.
>    - Kitchen Gate Policy mutlak: KDS hanya menerima pesanan dengan `paymentStatus == 'PAID'`.
> 5. **Kontrak Rekomendasi 3 Langkah SELA (ADR-0006):**
>    - Mengunci formula kanonis:
>      $$\text{Skor Menu } (S) = (W_{\text{flav}} \cdot M_{\text{flav}}) + (W_{\text{format}} \cdot M_{\text{format}}) + (W_{\text{mood}} \cdot M_{\text{mood}}) + B_{\text{seller}}$$
>      dengan bobot $W_{\text{flav}}=3, W_{\text{format}}=2, W_{\text{mood}}=1, B_{\text{seller}}=1$. Ambang batas skor $S \ge 3$, maksimal 2 menu teratas, dan tie-breaker berjenjang (Best Seller $\rightarrow$ Popularitas pesanan terbanyak $\rightarrow$ Harga terendah $\rightarrow$ Nama alfabetis).

---

## Open Questions

> [!NOTE]
> Empat isu bisnis terbuka (`OPN-01` s/d `OPN-04`) dari audit Tahap 01 diformalkan resolusi baseline-nya di ADR-0007:
> 1. **Masa Tunggu Pembayaran Tunai di Kasir (`OPN-01`):** Ditetapkan **20 menit**. Jika kasir belum mengonfirmasi uang fisik dalam 20 menit sejak pesanan dibuat, sistem otomatis membatalkan pesanan (`EXPIRED / CANCELLED`).
> 2. **Otoritas Toggle Sold Out oleh Barista (`OPN-02`):** **Diizinkan**. Barista dapat mengubah status stok langsung di header KDS dengan memasukkan PIN dapur cepat guna mencegah pesanan masuk saat bahan habis mendadak.
> 3. **Format Kredensial Admin vs Staf (`OPN-03`):** Admin menggunakan **Username/Email + Password bcrypt**, sedangkan Kasir dan Barista menggunakan **PIN Cepat 4–6 Digit**.
> 4. **Penetapan Harga Publik Penawaran B2B (`OPN-04`):** Dipisahkan secara tegas: Kontrak jasa internal kafe perdana (SELA) sebesar **Rp 750.000**, sedangkan penawaran paket komersial publik B2B di landing page adalah **Rp 2.500.000**.

---

## Proposed Changes

Files grouped by component and logical order:

### 1. Architecture Decision Records (ADR)

#### [NEW] `docs/adr/README.md`
Indeks katalog ADR yang memuat daftar ketetapan arsitektur `ADR-0001` hingga `ADR-0007` dan status keputusannya.

#### [NEW] `docs/adr/ADR-0001-hosting-database-and-realtime.md`
Keputusan hosting **Vercel Free Tier (Hobby) Rp 0**, managed PostgreSQL Supabase/Neon dengan Supavisor connection pooling, adaptasi timeout serverless via Resilient SSE Streaming (siklus 25–30s auto-reconnect), Supabase Storage Free Tier (1 GB), dan strategi backup otomatis `pg_dump`.

#### [NEW] `docs/adr/ADR-0002-staff-auth-and-server-mediated-realtime.md`
Keputusan integrasi autentikasi cookie HTTP-Only via `jose` JWT dengan Server-Mediated SSE Route Handlers (`/api/staff/kds/events` dan `/api/orders/[id]/stream`), menutup akses publik anon ke tabel order database.

#### [NEW] `docs/adr/ADR-0003-single-canonical-route-map.md`
Peta rute kanonis tunggal, eliminasi konflik rute `/`, aturan query parameter meja `?table=XX`, dan konvensi route groups App Router.

#### [NEW] `docs/adr/ADR-0004-independent-payment-and-fulfillment-state-machines.md`
Pemisahan enum `PaymentStatus` dan `OrderStatus`, tabel matriks transisi status, aktor pemegang wewenang, prasyarat transisi, pencatatan audit log, dan penanganan konkurensi (optimistic locking).

#### [NEW] `docs/adr/ADR-0005-transaction-integrity-idempotency-and-pricing-contracts.md`
Kontrak validasi quote harga server-authoritative, mekanisme idempotensi `Idempotency-Key`, penerbitan dan hashing `orderSecretToken`, pencatatan percobaan transaksi Midtrans, penanganan webhook SHA512, dan format error terstandar.

#### [NEW] `docs/adr/ADR-0006-deterministic-three-step-recommendation-engine.md`
Formula pembobotan 3 langkah kuis SELA, ambang batas $S \ge 3$, batasan 2 rekomendasi teratas, hierarki tie-break 5 tingkat, aturan filter stok habis, fallback Best Seller, dan garansi zero LLM/AI.

#### [NEW] `docs/adr/ADR-0007-staff-access-control-cash-window-and-business-resolutions.md`
Ketetapan pembagian kredensial admin vs staf, otorisasi toggle stok di KDS, batas waktu toleransi tunai 20 menit, prosedur pembatalan/refund manual kasir, dan disambiguasi harga B2B.

---

### 2. Spesifikasi Kontrak API & Peta Rute

#### [NEW] `docs/api-contracts.md`
Spesifikasi lengkap seluruh endpoint REST API:
- Skema validasi Zod untuk request body, query parameter, dan response body.
- Definisi tipe TypeScript untuk seluruh payload.
- Error codes terstandar (`VALIDATION_ERROR`, `TABLE_INACTIVE`, `PRICE_CHANGED`, `ORDER_EXPIRED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`).
- Contoh payload request dan response untuk seluruh endpoint.

#### [NEW] `docs/route-map.md`
Dokumentasi pemetaan rute aplikasi Next.js 15:
- Hirarki rute publik pelanggan, staf internal, dan pemasaran B2B.
- Aturan middleware Next.js (`src/middleware.ts`) untuk proteksi rute `/staff/*`.
- Penanganan query parameter meja `?table=XX` dan session guard.

---

### 3. Rencana Kerja & Catatan Kemajuan

#### [NEW] `plans/architecture-decisions-and-contracts-plan.md`
Salinan rencana kerja Tahap 02 yang disimpan pada folder `plans/` sesuai instruksi pengguna.

#### [MODIFY] `docs/implementation-progress.md`
Memperbarui log pengerjaan: mencatat penyelesaian Tahap 02, mendokumentasikan berkas ADR dan kontrak baru, dan memvalidasi kesiapan scaffolding Tahap 03.

---

## Verification Plan

### Automated Checks
* **Validasi Eksistensi Berkas:** Memeriksa keberadaan fisik seluruh berkas ADR, `api-contracts.md`, dan `route-map.md`:
  ```powershell
  Test-Path docs/adr/README.md, docs/adr/ADR-0001-hosting-database-and-realtime.md, docs/api-contracts.md, docs/route-map.md, plans/architecture-decisions-and-contracts-plan.md
  ```
* **Pemindaian Keamanan Kredensial:** Memastikan tidak ada token rahasia live yang bocor ke dokumen kontrak:
  ```powershell
  Select-String -Path docs/*.md, docs/adr/*.md -Pattern "SB-Mid-server-[a-zA-Z0-9]{10,}" -ErrorAction SilentlyContinue
  ```

### Manual Verification
1. **Verifikasi Kompatibilitas Vercel Free Tier:** Memastikan pola Server-Sent Events (SSE) di `ADR-0001` dan `api-contracts.md` dirancang dengan siklus chunked auto-reconnect 25–30s untuk menjamin kelancaran streaming pada batas durasi function serverless Vercel Hobby.
2. **Verifikasi Kelengkapan Skema Zod:** Memastikan setiap endpoint publik dan staf memiliki skema validasi Zod eksplisit.
3. **Verifikasi Keselarasan Rute:** Memastikan `route-map.md` selaras 100% dengan taksonomi `spec-audit.md` dan `requirements-traceability.md`.
