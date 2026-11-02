# Implementation Plan - Tahap 15: KDS Dapur (/kitchen) & Pelacak Pesanan Pelanggan (Customer Tracker)

Membangun layar **Kitchen Display System (KDS)** terpadu di rute `/kitchen` (serta `/staff/kds`) dan menyempurnakan **Pelacak Pesanan Pelanggan (*Customer Tracker*)** di `/order/[id]/track` dengan integrasi order service dan aliran real-time SSE aktual. 

Rencana ini menegakkan aturan arsitektur mutlak: KDS di server **hanya** mengambil pesanan berstatus `paymentStatus: 'PAID'` dengan fulfillment aktif yang diurutkan secara **FIFO berdasarkan `paidAt: 'asc'`**. Menyembunyikan kartu di UI saja tidak cukup; query server wajib menyaring data secara authoritative. Transisi status dapur berjalan maju secara ketat (`QUEUED` $\rightarrow$ `COOKING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`) dengan *optimistic concurrency control* (`version` check / conditional `updateMany`) untuk menangani aksi bersamaan oleh dua staf secara aman, tanpa pernah menyentuh status finansial. Antarmuka KDS dirancang ergonomis untuk jarak pandang kerja $1.5 - 2\text{ meter}$ (nomor meja $\ge 28\text{px}$, nama item $\ge 18\text{px}$, tombol aksi $\ge 56\text{px}$, timer usia dengan batas 10m/20m yang konsisten). Sistem audio dapur menyediakan tombol aktivasi gesture (mengatasi Autoplay Policy), kontrol mute dan slider volume, nada denting chime Web Audio API yang ter-dedup (initial load dan reconnect tidak membunyikan antrean lama), serta fallback visual kilat border (*border flash*). Customer Tracker memisahkan status pembayaran dan status dapur secara transparan, tahan refresh, dan menangani seluruh kondisi khusus (*token invalid*, *offline*, *expired*, *cancelled*, dan *refund review*).

---

## User Review Required

> [!IMPORTANT]
> **Rute Kanonis `/kitchen` dan Sesi Staf:**
> Rute `/kitchen` akan disediakan langsung (dengan alias `/staff/kds` dan `/staff/kitchen`) dan dilindungi oleh middleware sesi staf (`cravio_staff_token`) untuk role `BARISTA` dan `ADMIN` (serta `CASHIER` jika dual-role). Jika pengguna belum login, akan diarahkan ke `/login?redirect=/kitchen`.
>
> **Penegakan Kitchen Gate Mutlak di Server:**
> Endpoint `GET /api/staff/kds/orders` menyaring ketat:
> `where: { paymentStatus: 'PAID', orderStatus: { in: ['QUEUED', 'COOKING', 'READY'] } }, orderBy: { paidAt: 'asc' }`.
> Pesanan tunai `WAITING_CASHIER` dan pesanan QRIS `UNPAID` / `PENDING` secara fisik tidak pernah dikirim ke browser dapur.

> [!WARNING]
> **Keterbatasan Audio Perangkat Nyata (Mobile/Tablet Safari & Chrome):**
> Sesuai kebijakan keamanan browser modern (*Autoplay Policy*), Web Audio API tidak dapat berbunyi otomatis saat tab pertama kali dibuka tanpa adanya interaksi gestur pengguna (klik/sentuhan). Solusi yang kami terapkan:
> 1. Header KDS menyajikan banner/tombol mencolok: `"🔔 Aktifkan Audio Dapur"`. Saat diklik, context audio di-unlock via silent buffer.
> 2. KDS dilengkapi fallback visual berupa **animasi kilat border (*border flash pulse*)** selama 1.5–2 detik pada kartu pesanan baru, sehingga barista tetap mendapat sinyal visual seketika meskipun speaker tablet mati atau lingkungan bar sedang bising.
> 3. Pengaturan audio (status unlock, mute, volume 0–100%) dipersistensikan di `localStorage` klien.

---

## Proposed Changes

```
cravio/
├── src/
│   ├── lib/
│   │   └── audio-alert.ts                             # [MODIFY] Kontrol unlock gesture, volume, mute, & synthesizer
│   ├── middleware.ts                                  # [MODIFY] Daftarkan rute /kitchen ke perimeter staf
│   ├── app/
│   │   ├── (staff)/
│   │   │   ├── kitchen/
│   │   │   │   └── page.tsx                           # [NEW] Rute /kitchen untuk staf dapur & barista
│   │   │   ├── staff/
│   │   │   │   ├── kitchen/
│   │   │   │   │   └── page.tsx                       # [NEW] Alias kanonis /staff/kitchen
│   │   │   │   └── kds/
│   │   │   │       └── kds-client-view.tsx            # [MODIFY] UI KDS jarak kerja, batas usia 10/20m, audio & dedup
│   │   ├── (customer)/
│   │   │   └── order/
│   │   │       └── [id]/
│   │   │           └── track/
│   │   │               └── tracker-client-view.tsx    # [MODIFY] Pemisahan pembayaran vs dapur, refund review, offline
│   │   └── api/
│   │       └── staff/
│   │           └── orders/
│   │               └── [id]/
│   │                   └── status/
│   │                       └── route.ts               # [MODIFY] Conditional updateMany & optimistic lock concurrency
├── tests/
│   └── integration/
│       └── kds-fulfillment-and-tracker.test.ts        # [NEW] 12 skenario pengujian integrasi KDS & tracker
└── plans/
    └── 15 - kitchen-display-and-customer-tracker-plan.md # [NEW] Dokumen rencana tersimpan di repositori
```

---

### 1. Engine Audio Alert KDS & Web Audio API

#### [MODIFY] `src/lib/audio-alert.ts`
* Menambahkan state internal: `isUnlocked: boolean`, `isMuted: boolean`, `volume: number` (0.0 s/d 1.0).
* Menyediakan method `unlockAudio(): Promise<boolean>` yang me-resume AudioContext pada gesture pengguna dan memutar silent buffer sekejap.
* Menyediakan method `setVolume(vol: number)` dan `setMuted(muted: boolean)`.
* Menyimpan preferensi volume dan mute di `localStorage` (`cravio_kds_audio_config`).
* Method `playChime()` menghormati volume dan kondisi mute, menghasilkan nada harmonik lembut 880Hz $\rightarrow$ 1320Hz / 1760Hz.

---

### 2. Backend Server & Concurrency Safety

#### [MODIFY] `src/app/api/staff/orders/[id]/status/route.ts`
* Menegakkan **Optimistic Concurrency Control** dengan conditional update database atomic:
  ```typescript
  const result = await tx.order.updateMany({
    where: {
      id: orderId,
      orderStatus: currentStatus, // Status sebelum transisi
      paymentStatus: 'PAID',       // Kitchen Gate guard
      version: order.version,      // Optimistic lock version counter
    },
    data: {
      orderStatus: targetStatus,
      version: { increment: 1 },
      ...(targetStatus === 'COMPLETED' ? { completedAt: now } : {}),
    },
  })
  ```
* Jika `result.count === 0`:
  * Ambil data order terbaru di database:
    * Jika `freshOrder.orderStatus === targetStatus`: kembalikan status `200 OK` (idempoten sukses, request kedua staf tidak menimbulkan error).
    * Jika status telah maju melampaui `targetStatus` (misal: order sudah `READY` saat staf 1 mencoba klik `COOKING`): kembalikan HTTP `409 Conflict` dengan kode `CONCURRENT_MODIFICATION` dan pesan ramah: `"Status pesanan telah diperbarui oleh staf lain menjadi [status]."`.
* Memastikan status pembayaran **TIDAK PERNAH DIUBAH** (`paymentStatus` tetap `'PAID'`).
* Menerbitkan event `ORDER_STATUS_CHANGED` ke channel `KDS` dan `ORDER:<id>`.
* Mencatat riwayat ke tabel `AuditLog`.

#### [MODIFY] `src/middleware.ts`
* Menambahkan `/kitchen/:path*` ke dalam `matcher` config middleware Next.js.
* Memverifikasi cookie sesi staf `cravio_staff_token`. Jika role bukan `BARISTA` atau `ADMIN`, arahkan ke rute yang sesuai (misal: `CASHIER` diarahkan ke `/staff/pos`).

---

### 3. Tampilan KDS Dapur (`/kitchen` & `/staff/kds`)

#### [NEW] `src/app/(staff)/kitchen/page.tsx` & `src/app/(staff)/staff/kitchen/page.tsx`
* Server Component yang mengimpor dan merender `KdsClientView`.
* Memuat metadata halaman resmi: `"KDS Dapur & Barista | SELA Artisanal Coffee & Bake"`.

#### [MODIFY] `src/app/(staff)/staff/kds/kds-client-view.tsx`
* **Keterbacaan Jarak Jauh (1.5 – 2 Meter):**
  * Nomor Meja: `text-[28px] md:text-3xl font-serif font-black tracking-tight text-brand`.
  * Nama Item: `text-[18px] md:text-xl font-bold text-brand leading-snug`.
  * Modifier & Racikan: Diberi bullet point jelas dengan warna kontras olive `#544339`.
  * Catatan Dapur / Barista: Kotak kontras dengan border dan latar amber terang (`bg-amber-100 text-amber-950 font-bold`).
* **Konsistensi Batas Usia Pesanan (Elapsed Time):**
  * `< 10 menit`: **Normal** $\rightarrow$ Border netral `#E7E2DA`, timer netral abu/hijau.
  * `10 – 20 menit`: **Perhatian** $\rightarrow$ Border oranye amber `#D97706`, ikon peringatan `⚠️`, label teks `"Perhatian"`.
  * `> 20 menit`: **Prioritas Segera** $\rightarrow$ Border merah marun `#BA1A1A`, badge merah `"Prioritas Segera"`, animasi denyut lembut (dinonaktifkan jika `prefers-reduced-motion: reduce`).
* **Ergonomi Sentuh:**
  * Seluruh tombol aksi transisi status dapur berukuran tinggi $\ge 56\text{px}$ (`min-h-[56px] text-base font-bold`).
* **Panel Kontrol Audio Dapur di Header:**
  * Jika audio belum di-unlock: Menampilkan banner tombol `"🔔 Aktifkan Audio Dapur"` berwarna aksen untuk membuka AudioContext.
  * Jika sudah aktif: Menampilkan tombol toggle `"🔊 Suara Aktif"` / `"🔇 Mute"` dan slider volume mini (0–100%).
  * Tombol manual `"🔔 Tes Chime"`.
* **Dedup Audio & Pencegahan Bunyi Massal:**
  * Menggunakan `initialLoadedIdsRef`: saat snapshot antrean pertama kali dimuat, seluruh ID pesanan dicatat ke set tanpa membunyikan audio sama sekali.
  * Hanya pesanan baru yang tiba melalui SSE `ORDER_PAID` atau belum ada di set yang akan membunyikan chime.
  * Saat reconnect SSE terjadi, tidak memicu bunyi berulang.
* **Fallback Visual (Border Flash):**
  * Pesanan yang baru tiba mendapatkan state `newlyArrivedOrderIds` dengan kelas `animate-flash-border` selama 2 detik untuk menarik perhatian barista meskipun audio dalam keadaan mute.

---

### 4. Pelacak Pesanan Pelanggan (`/order/[id]/track`)

#### [MODIFY] `src/app/(customer)/order/[id]/track/tracker-client-view.tsx`
* **Pemisahan Jelas Status Pembayaran vs Status Dapur:**
  * **Kartu 1: Status Pembayaran:**
    * `PAID`: Badge Lunas hijau, tanggal/jam bayar, nominal total snapshot.
    * `WAITING_CASHIER`: Badge kuning Menunggu Kasir, petunjuk membawa nomor pesanan ke meja kasir.
    * `UNPAID` / `PENDING`: Badge Menunggu QRIS, tombol `"Lanjutkan Pembayaran →"` dengan countdown 15 menit.
    * `EXPIRED`: Badge Waktu Habis merah, penjelasan batas pembayaran telah lewat.
  * **Kartu 2: Status Progres Dapur (4-Step Progression):**
    * Step 1: Diterima (`QUEUED`) - Dapur telah menerima tiket pesanan lunas.
    * Step 2: Sedang Diracik (`COOKING`) - Barista/koki sedang menyiapkan menu.
    * Step 3: Siap Disajikan (`READY`) - Pesanan siap dan sedang diantar ke Meja pelanggan.
    * Step 4: Selesai (`COMPLETED`) - Pesanan telah selesai disajikan di meja.
  * **Kartu 3: Penanganan Khusus Pembatalan & Refund Review:**
    * Jika `orderStatus === 'CANCELLED'`:
      * Jika `paymentStatus === 'PAID'` (kasus pembatalan setelah lunas di kasir): Menampilkan kartu **"Pesanan Dibatalkan — Menunggu Pengembalian Dana Kasir"** dengan latar amber-oranye ramah. Memberitahukan bahwa kasir kafe sedang memproses pengembalian uang fisik (*manual cash refund*) secara langsung di kasir tanpa kebingungan.
      * Jika belum bayar: Menampilkan kartu pesanan dibatalkan standar.
* **Resilience & Offline Indicator:**
  * Menampilkan badge koneksi live vs offline.
  * Menyediakan tombol `"Periksa Status Terbaru"` untuk re-fetch manual jika koneksi internet pelanggan lambat/terputus.
* **Isolasi Meja Ketat:**
  * Tetap terisolasi 100% pada `orderId` spesifik yang terverifikasi via `orderSecretToken`. Tidak menampilkan riwayat pelanggan sebelumnya di meja yang sama.

---

## Verification Plan

### Automated Tests

Jalankan suite pengujian integrasi baru dan seluruh suite regresi:

```powershell
# 1. Jalankan pengujian integrasi khusus KDS & Tracker (Live Neon DB)
pnpm run test tests/integration/kds-fulfillment-and-tracker.test.ts

# 2. Jalankan seluruh unit tests
pnpm run test tests/unit

# 3. Jalankan seluruh integration tests berurutan
pnpm run test tests/integration --fileParallelism=false

# 4. Strict Typecheck
pnpm run typecheck

# 5. Linter Check
pnpm exec eslint src tests

# 6. Next.js Production Build
pnpm run build
```

Skenario pengujian yang tercakup dalam `tests/integration/kds-fulfillment-and-tracker.test.ts`:
1. **Kitchen Gate Enforcement:** Pesanan tunai `WAITING_CASHIER` dan pesanan QRIS `UNPAID` tidak pernah muncul di `GET /api/staff/kds/orders`.
2. **FIFO Sorting:** Pesanan yang `paidAt` lebih awal selalu berada di urutan pertama antrean dapur.
3. **Optimistic Locking & Concurrency Guard:** Dua request `PATCH /status` paralel dengan versi yang sama menghasilkan 1 mutasi sukses dan 1 respon konflik/idempoten aman.
4. **Alur Transisi Berurutan:** `QUEUED -> COOKING -> READY -> COMPLETED` sukses dan memicu `OutboxEvent`.
5. **Penolakan Transisi Ilegal:** Percobaan lompat status (misal `QUEUED -> COMPLETED`) atau mundur (`READY -> QUEUED`) ditolak 400 `INVALID_STATUS_TRANSITION`.
6. **Invarian Finansial:** Progres dapur tidak pernah mengubah `paymentStatus` (tetap `PAID`).
7. **Pemisahan Status Tracker:** Payload tracker membedakan status pembayaran dan fulfillment.
8. **Tracker Isolation:** Akses tracker tanpa token atau dengan token pesanan lain ditolak 403.
9. **Refund Review Tracker:** Pesanan `PAID` yang dibatalkan menampilkan indikator review refund tanpa mengubah `paymentStatus`.

### Manual Verification
1. Buka browser di `/kitchen` (atau `/staff/kds`):
   * Periksa ukuran nomor meja ($\ge 28\text{px}$), nama item ($\ge 18\text{px}$), dan tinggi tombol aksi ($\ge 56\text{px}$).
   * Klik tombol `"🔔 Aktifkan Audio Dapur"` $\rightarrow$ pastikan status berubah menjadi `"🔊 Suara Aktif"` dan kontrol volume muncul.
   * Uji tombol `"🔔 Tes Chime"` $\rightarrow$ dengarkan denting lonceng harmonik Web Audio API.
2. Buat pesanan tunai baru di tab lain:
   * Sebelum dikonfirmasi di kasir, pastikan tiket **TIDAK MUNCUL** di KDS.
   * Konfirmasi pembayaran di `/staff/pos` $\rightarrow$ perhatikan tiket seketika muncul di KDS diiringi denting lonceng dan kilatan border visual.
3. Transisikan status di KDS:
   * Klik `"Mulai Buat"` $\rightarrow$ status kartu berpindah ke kolom `"Sedang Dimasak"`.
   * Klik `"Siap Saji"` $\rightarrow$ kartu berpindah ke kolom `"Siap Disajikan"`.
   * Klik `"Selesai"` $\rightarrow$ kartu keluar dari tampilan antrean aktif.
4. Periksa Customer Tracker di `/order/[id]/track`:
   * Perhatikan status pembayaran dan step progression dapur terpisah jelas dan bergerak secara real-time tanpa reload halaman.

