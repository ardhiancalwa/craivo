# Implementation Plan — Tahap 14: Sinkronisasi Real-Time (SSE & Event Bus)

Rencana implementasi mekanisme sinkronisasi real-time terpadu berbasis **Server-Mediated Server-Sent Events (SSE)** dan **Durable Database Event Bus (`OutboxEvent`)** untuk KDS dapur, kasir POS, pelacak pesanan pelanggan (*customer tracker*), serta invalidasi katalog menu pada **Cravio — Your craving, Perfectly Matched** (Pilot: **SELA Artisanal Coffee & Bake**).

---

## 1. Goal Description

Membangun infrastruktur sinkronisasi real-time yang aman, cepat ($\le 2$ detik), dan tangguh untuk operasional kafe fisik tanpa melanggar batasan arsitektur serverless (Vercel Hobby Tier Rp 0) maupun membocorkan privasi pesanan antar-meja:
1. **Satu Transport Utama yang Efisien**:
   - Menggunakan **Server-Mediated SSE (`ReadableStream` Web API)** sesuai ketetapan `ADR-0001` dan `ADR-0002`.
   - Tidak membangun dua transport paralel (nir-WebSocket/Socket.io terpisah dan nir-koneksi langsung client ke Supabase).
   - **Prinsip Dasar:** Event adalah sinyal pemberitahuan (*lightweight notification*); database PostgreSQL tetap menjadi **sumber kebenaran tunggal (*single source of truth*)**.
2. **Fan-Out Terdistribusi Lintas Instance (Zero In-Memory Leak / Process Isolation)**:
   - Menghindari ketergantungan rapuh pada `EventEmitter`, `Map`, atau subscriber global dalam memori proses tunggal yang akan gagal total saat dijalankan di lingkungan serverless multi-instance atau pasca-restart instance Vercel.
   - Menggunakan tabel **`OutboxEvent` di Neon PostgreSQL** sebagai media distribusi durable terpusat. Instance A yang menerima webhook Midtrans atau kasir POS menulis `OutboxEvent`; Instance B yang melayani stream KDS dapur membaca event tersebut secara instan.
3. **Otorisasi Kanal Ketat & Proteksi Kerahasiaan Token**:
   - **Kanal Staf KDS & POS**: Terproteksi ketat oleh sesi cookie `staff_session` (`requireStaffRole`). Role staf hanya menerima event sesuai hak operasionalnya (`KDS` menerima pesanan lunas, pembatalan, dan transisi dapur; `POS` menerima antrean tunai dan pembayaran).
   - **Kanal Pelanggan (`ORDER:<orderId>`)**: Terisolasi mutlak per pesanan. Pelanggan wajib membuktikan kepemilikan via cookie `cravio_ot_<id>` atau header `X-Order-Secret-Token` (dicocokkan dengan `orderSecretTokenHash` di DB). Pelanggan **DILARANG KERAS** mendengarkan pesanan meja lain atau transaksi kafe secara global. Token kepemilikan tidak pernah dibocorkan ke query log, analitik, atau payload event.
   - **Kanal Publik Invalidasi Katalog (`CATALOG`)**: Menyiarkan event perubahan ketersediaan stok (`STOCK_TOGGLED`) dan perubahan harga (`PRICE_CHANGED`) tanpa data sensitif pesanan.
4. **Ketahanan Koneksi, Rekonsiliasi Snapshot, & SLA Real-Time**:
   - Menggunakan siklus stream anggun 25–28 detik dengan heartbeat `: ping\n\n` setiap 10 detik untuk mencegah timeout 504 Vercel.
   - Klien otomatis menyambung kembali (*auto-reconnect*) dengan *exponential backoff* dan mengirimkan `Last-Event-ID`.
   - **Rekonsiliasi Anti-Celah:** Saat reconnect atau tab browser kembali fokus (`visibilitychange`), klien mengambil snapshot data terbaru via REST API resmi dan merekonsiliasi event berdasarkan ID/versi pesanan.
   - **Degraded Fallback Indicator:** Jika SSE gagal tersambung setelah retry berkala, sistem beralih ke degraded polling dan menampilkan badge status koneksi terdegradasi secara transparan (tanpa mengklaim interval 15 detik memenuhi SLA 2 detik).
   - Target latensi normal: **$\le 2$ detik** dari mutasi status di server hingga diterima antarmuka klien.

---

## 2. User Review Required

> [!IMPORTANT]
> **Arsitektur Fan-Out Multi-Instance Menggunakan Database Outbox Table**:
> Sesuai instruksi Anda, sistem **TIDAK MENGGUNAKAN `EventEmitter` atau `Map` in-memory global** karena tidak akan berfungsi di lingkungan serverless multi-instance Vercel (Instance A yang menerima webhook Midtrans tidak berbagi memori dengan Instance B yang melayani stream browser). Distribusi event dilakukan melalui tabel database `outbox_events` (yang sudah memiliki indeks `[channel, aggregateId]` dan `[status, createdAt]`). Stream loop memeriksa event baru setiap 1 detik ($\le 2$ detik latency), mengirim heartbeat setiap 10 detik, dan menutup stream secara anggun pada detik ke-25 agar Vercel tidak memutuskan koneksi secara paksa.

> [!WARNING]
> **Larangan Membuka Raw Order Table ke Anonim**:
> Sesuai `ADR-0002`, tabel database transaksi `orders` tetap berstatus RLS terkunci (zero public/anon grant). Pelanggan hanya bisa mendengarkan stream pesanan miliknya sendiri melalui route handler server `/api/orders/[id]/stream` yang memverifikasi `orderSecretToken`.

---

## 3. Proposed Changes

Grouped by component layer.

### A. Real-Time Event Bus & Database Outbox Engine

#### [NEW] `src/lib/server/realtime-bus.ts`
- Modul server-only untuk manajemen publikasi dan pembacaan event:
  - `publishEvent({ channel, aggregateType, aggregateId, eventType, payload, tx? })`:
    - Menulis record ke tabel `OutboxEvent` (bisa di dalam transaksi Prisma `$transaction` yang sudah berjalan atau standalone).
    - Payload dibersihkan dari informasi rahasia.
  - `fetchNewEvents({ channel, aggregateId?, sinceId?, sinceTime?, limit? })`:
    - Mengambil event baru berdasarkan cursor `Last-Event-ID` atau timestamp.
  - `createSseStream({ request, channel, aggregateId?, onFilterEvent, maxDurationMs = 25000, pollIntervalMs = 1000 })`:
    - Membuat `ReadableStream` standar Web API dengan encoder UTF-8.
    - Menangani header `Last-Event-ID` dari request.
    - Mengirim event inisial sambutan koneksi `event: connected`.
    - Loop interval 1000 ms memeriksa event baru di database.
    - Mengirim heartbeat `: ping\n\n` setiap 10 detik.
    - Mendengarkan `request.signal.addEventListener('abort')` untuk menghentikan loop seketika saat browser ditutup / disconnect (*connection cleanup*).
    - Pada detik ke-25, menutup stream secara anggun (`controller.close()`) dengan event `event: reconnect` agar client otomatis menyambung kembali tanpa error.

---

### B. Server-Sent Events Route Handlers (SSE Endpoints)

#### [NEW] `src/app/api/staff/kds/events/route.ts`
- **Method**: `GET /api/staff/kds/events`
- **RBAC**: `requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'], request)`.
- **Kanal**: `channel: 'KDS'`.
- **Event yang Disalurkan**:
  - `ORDER_PAID`: Pesanan lunas baru (baik via QRIS webhook maupun Tunai POS), memicu penambahan kartu ke KDS dan denting audio chime.
  - `ORDER_STATUS_CHANGED`: Pembaruan status masak (`QUEUED` $\rightarrow$ `COOKING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`).
  - `ORDER_CANCELLED`: Pesanan dibatalkan (kartu langsung dihapus/ditandai batal).
- **Header**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`

#### [NEW] `src/app/api/staff/pos/events/route.ts`
- **Method**: `GET /api/staff/pos/events`
- **RBAC**: `requireStaffRole(['CASHIER', 'ADMIN'], request)`.
- **Kanal**: `channel: 'POS'`.
- **Event yang Disalurkan**:
  - `NEW_CASH_ORDER`: Pesanan tunai baru dibuat tamu (`WAITING_CASHIER`), otomatis muncul di antrean tunai kasir.
  - `ORDER_PAID`: Pesanan lunas via QRIS (kasir melihat update riwayat tanpa reload).
  - `ORDER_CANCELLED`: Pesanan dibatalkan.

#### [NEW] `src/app/api/orders/[id]/stream/route.ts`
- **Method**: `GET /api/orders/[id]/stream`
- **Otorisasi**: Memverifikasi kepemilikan pesanan menggunakan `verifyOrderAccess(orderId, token)`.
  - Token diekstrak dari cookie `cravio_ot_<id>`, cookie `cravio_ot`, header `X-Order-Secret-Token`, atau query param `token`.
  - Jika token salah atau tidak ada: kembalikan **HTTP 403 Forbidden**.
- **Kanal**: `channel: 'ORDER:${orderId}'`.
- **Event yang Disalurkan**:
  - `ORDER_STATUS_CHANGED`: Status pesanan berubah (`QUEUED`, `COOKING`, `READY`, `COMPLETED`, `CANCELLED`).
  - `PAYMENT_CONFIRMED`: Pembayaran terkonfirmasi lunas (`PAID`).
  - Tanpa kebocoran data meja lain.

#### [NEW] `src/app/api/menu/stream/route.ts`
- **Method**: `GET /api/menu/stream`
- **Akses**: Publik (Katalog Menu).
- **Kanal**: `channel: 'CATALOG'`.
- **Event yang Disalurkan**:
  - `STOCK_TOGGLED`: Menu tertentu habis / tersedia kembali (`menuItemId`, `isAvailable`).
  - `PRICE_CHANGED`: Perubahan harga menu / modifier.
  - Client pelanggan di halaman katalog menu dan keranjang memperbarui data tanpa spam polling.

---

### C. Kitchen Status Transitions & API KDS

#### [NEW] `src/app/api/staff/orders/[id]/status/route.ts`
- **Method**: `PATCH /api/staff/orders/[id]/status`
- **RBAC**: `requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'], request)`.
- **Payload**: `{ status: 'COOKING' | 'READY' | 'COMPLETED' }`.
- **Aturan Bisnis & Kitchen Gate (`DEC-013`)**:
  - Pesanan **WAJIB berstatus `paymentStatus === 'PAID'`**. Pesanan belum bayar dilarang keras diubah statusnya (HTTP 400 `ORDER_NOT_PAID`).
  - Matriks Transisi Sah:
    - `QUEUED` $\rightarrow$ `COOKING`
    - `COOKING` $\rightarrow$ `READY`
    - `READY` $\rightarrow$ `COMPLETED`
  - Optimistic locking: `version: { increment: 1 }`.
  - Publikasikan dua `OutboxEvent`:
    1. `channel: 'KDS'`, `eventType: 'ORDER_STATUS_CHANGED'` (untuk semua tablet dapur).
    2. `channel: 'ORDER:${order.id}'`, `eventType: 'ORDER_STATUS_CHANGED'` (untuk tracker pelanggan).
  - Catat `AuditLog: ORDER_STATUS_TRANSITION`.

#### [NEW] `src/app/api/staff/kds/orders/route.ts`
- **Method**: `GET /api/staff/kds/orders`
- **RBAC**: `requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'], request)`.
- **Logika**:
  - Mengambil seluruh pesanan aktif dapur yang berstatus:
    $$\text{paymentStatus} = \text{'PAID'} \quad \text{AND} \quad \text{orderStatus} \in [\text{'QUEUED'}, \text{'COOKING'}, \text{'READY'}]$$
  - Menghitung waktu tunggu dapur (*kitchen wait time*).

---

### D. Event Emission Hookups pada Mutator yang Ada

#### [MODIFY] `src/lib/server/order-service.ts`
- Saat pesanan tunai baru dibuat di `createOrderFromQuote()`:
  - Terbitkan `OutboxEvent`:
    - `channel: 'POS'`, `eventType: 'NEW_CASH_ORDER'` (agar kasir langsung melihat pesanan tunai baru di antrean).

#### [MODIFY] `src/app/api/staff/menu/[id]/stock/route.ts`
- Saat stok menu diubah (`isAvailable` true/false):
  - Terbitkan `OutboxEvent`:
    - `channel: 'CATALOG'`, `eventType: 'STOCK_TOGGLED'`, payload: `{ menuItemId: menu.id, isAvailable: parsed.data.isAvailable }`.

#### [MODIFY] `src/app/api/staff/menu/[id]/price/route.ts`
- Saat harga menu diubah:
  - Terbitkan `OutboxEvent`:
    - `channel: 'CATALOG'`, `eventType: 'PRICE_CHANGED'`, payload: `{ menuItemId: menu.id, newPrice }`.

---

### E. Client-Side Real-Time Hook & Resilient Reconnection

#### [NEW] `src/lib/hooks/use-realtime-stream.ts`
- Hook React kustom yang sangat tangguh:
  - Parameter: `{ url, onEvent, onReconnectSync, fallbackPollIntervalMs = 10000 }`.
  - State:
    - `connectionStatus`: `'CONNECTED'` | `'CONNECTING'` | `'STALE'` | `'DEGRADED_POLLING'` | `'OFFLINE'`.
    - `lastEventId`: string cursor.
    - `latencyMs`: estimasi waktu transmisi event.
  - Fitur:
    - Menghubungkan SSE via `new EventSource(url, { withCredentials: true })` atau stream reader fetch (jika custom headers diperlukan).
    - Memantau heartbeat: jika tidak ada ping selama >20 detik, tandai status sebagai `'STALE'` dan re-connect.
    - Penanganan `visibilitychange`: saat tab browser diaktifkan kembali oleh barista/kasir/tamu, panggil `onReconnectSync()` untuk menyinkronkan snapshot terbaru dari REST API terotorisasi.
    - Exponential backoff reconnect: 500ms, 1s, 2s, 4s, maks 10s.
    - Fallback polling jika SSE berulang kali gagal dengan status visual `'DEGRADED_POLLING'`.
    - Pembersihan koneksi (*cleanup*): menutup `EventSource` saat komponen di-unmount.

#### [NEW] `src/lib/audio-alert.ts`
- Generator suara audio alert (chime) menggunakan **Web Audio API**:
  - Menghasilkan dua nada harmonik lonceng kafe (dua nada sine wave 880 Hz $\rightarrow$ 1760 Hz dengan *exponential decay*).
  - Berjalan 100% lokal di browser tanpa ketergantungan file aset eksternal `.mp3` yang rentan gagal dimuat.
  - Penanganan kebijakan autoplay browser: mengaktifkan audio context saat interaksi pertama pengguna.

---

### F. Integrasi Komponen UI

#### [MODIFY] `src/app/(staff)/staff/pos/pos-client-view.tsx`
- Mengganti polling statis dengan `useRealtimeStream('/api/staff/pos/events')`.
- Menampilkan indikator status koneksi real-time di header kartu POS (hijau `Terhubung Realtime`, kuning `Menyambungkan...`, oranye `Polling Terdegradasi`).
- Memperbarui antrean tunai seketika saat event `NEW_CASH_ORDER` atau `ORDER_PAID` tiba.

#### [NEW] `src/app/(staff)/staff/kds/kds-client-view.tsx` & [MODIFY] `page.tsx`
- Antarmuka KDS interaktif penuh:
  - 3 Kolom: **Antrean Masak (`QUEUED`)**, **Sedang Dimasak (`COOKING`)**, **Siap Saji (`READY`)**.
  - Target sentuh tablet $\ge 56\text{ px}$ (`kds-touch`).
  - Audio alert denting chime saat pesanan lunas baru masuk (`ORDER_PAID`).
  - Tombol aksi transisi: `Mulai Buat (COOKING)`, `Siap Saji (READY)`, `Selesai (COMPLETED)`.
  - Indikator status stream koneksi real-time.

#### [NEW] `src/app/(customer)/order/[id]/track/tracker-client-view.tsx` & [MODIFY] `page.tsx`
- Antarmuka pelacak pesanan pelanggan real-time:
  - Menghubungkan stream ke `/api/orders/${orderId}/stream`.
  - Step indicator otomatis bergerak aktif dari Step 1 $\rightarrow$ Step 2 $\rightarrow$ Step 3 seketika saat dapur menekan tombol status tanpa perlu refresh browser.

---

## 4. Verification Plan

### Automated Tests
1. **Real-Time Sync Integration Test (`tests/integration/realtime-sync.test.ts`)**:
   - `pnpm run test tests/integration/realtime-sync.test.ts`
   - **Skenario 1: Durable Outbox Bus & Cursor**:
     - Publikasi event menulis ke DB; query dengan cursor `Last-Event-ID` hanya mengembalikan event baru.
   - **Skenario 2: Simulasi Multi-Instance Fan-Out**:
     - Instance A menulis `OutboxEvent` ke DB secara independen.
     - Instance B (stream reader) membaca event tersebut tanpa shared in-memory state dalam tempo $\le 2$ detik.
   - **Skenario 3: Zero Event Loss pada Reconnect & Restart**:
     - Stream diputus; event baru dimasukkan ke DB; client menyambung ulang dengan `Last-Event-ID` dan menerima event yang tertinggal.
   - **Skenario 4: RBAC KDS & POS Stream**:
     - Request anonim ditolak 401. Role non-staf ditolak 403. Staf sah menerima stream.
   - **Skenario 5: Customer Order Stream Isolation**:
     - Pelanggan tanpa token atau dengan token meja lain ditolak 403 Forbidden.
     - Pelanggan dengan token sah hanya menerima event pesanan miliknya.
   - **Skenario 6: Penegakan Kitchen Gate pada Transisi Status**:
     - Order belum lunas (`WAITING_CASHIER` / `UNPAID`) ditolak saat dicoba diubah ke `COOKING` (400 Bad Request).
     - Order lunas (`PAID`) sukses berpindah status `QUEUED -> COOKING -> READY -> COMPLETED` dan memancarkan event ke KDS dan tracker.
   - **Skenario 7: Invalidasi Katalog**:
     - Toggle stok dan ubah harga memancarkan event ke kanal `CATALOG`.
   - **Skenario 8: Benchmark Latensi Real-Time**:
     - Mengukur selisih waktu publikasi event di DB hingga pembacaan di stream reader: terbukti $\le 2.0$ detik.

2. **Full Automated Quality Gates**:
   - `pnpm run test tests/unit`
   - `pnpm run test tests/integration --fileParallelism=false`
   - `pnpm run typecheck`
   - `pnpm exec eslint src`
   - `pnpm run build`

### Manual Verification
1. Buka 2 tab browser: Tab 1 `/staff/kds` (login Barista), Tab 2 `/cart` (Tamu Meja 04).
2. Lakukan checkout pesanan di Tab 2 dengan metode QRIS / Tunai.
3. Konfirmasi pembayaran (via simulator / POS).
4. Verifikasi di Tab 1 (KDS): kartu pesanan otomatis muncul dalam $\le 2$ detik dan audio chime berbunyi.
5. Di Tab 1, klik "Mulai Buat".
6. Di Tab 2 (Pelacak Pesanan `/order/[id]/track`), verifikasi status langsung berubah menjadi "Sedang Disiapkan" secara real-time tanpa refresh.
7. Di Tab 1, ubah stok menu menjadi Habis; verifikasi badge di katalog menu langsung ter-update.

