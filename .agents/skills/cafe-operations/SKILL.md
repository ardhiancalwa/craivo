---
name: cafe-operations
description: >-
  Implement or update kitchen display system (KDS), cashier dashboard, order state transitions (QUEUED -> COOKING -> READY -> COMPLETED), realtime SSE synchronization, reconnect resilience, audio alerts, and 58/80 mm thermal print layouts. Use when modifying staff operational flows.
---

# Prosedur Operasional Dapur KDS, Kasir, & Cetak Struk (cafe-operations)

Skill ini memandu implementasi alur kerja staf operasional kafe: tampilan display antrean dapur (KDS), validasi pesanan tunai di kasir, transisi status masak, penanganan audio alert & fallback visual, toleransi koneksi realtime, serta pencetakan struk thermal 58 mm dan 80 mm.

---

## 1. Trigger (Kapan Skill Ini Digunakan)
Gunakan skill ini setiap kali Anda:
* Mengembangkan atau memperbarui layar display dapur KDS (`/kitchen`).
* Mengembangkan atau memperbarui dashboard kasir (`/pos`).
* Mengubah transisi status siklus hidup pesanan (`QUEUED` $\rightarrow$ `COOKING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`).
* Mengonfigurasi kanal Server-Sent Events (SSE) `/api/sse/kitchen` untuk notifikasi pesanan baru.
* Menangani kebijakan browser *Autoplay Policy* untuk audio lonceng pesanan (*chime*).
* Menyusun atau merevisi format cetak thermal CSS `@media print` 58 mm dan 80 mm.
* Menangani pencetakan ulang struk belanja (*reprint notice*).

---

## 2. Invarian Operasional Mutlak
1. **Kitchen Gate on PAID (`DEC-013`):** Dapur KDS **HANYA** menampilkan pesanan yang sudah berstatus lunas (`PAID`). Makanan tidak boleh dimasak sebelum ada verifikasi uang masuk.
2. **Keterbacaan Jarak Jauh:** Tampilan KDS wajib terbaca jelas dari jarak kerja $1.5 - 2\text{ meter}$ (nomor meja $\ge 28\text{ px}$, nama item $\ge 18\text{ px}$, tombol aksi $\ge 56\text{ px}$).
3. **Penanda Cetak Ulang:** Setiap struk thermal yang dicetak lebih dari satu kali wajib mencantumkan label tebal:  
   `*** CETAK ULANG (REPRINT) ***`.
4. **Batas Verifikasi Printer Fisik:** Kode menjamin layout CSS `@media print` universal. Jangan mengklaim *silent print* otomatis telah selesai tanpa pengujian pada printer fisik langsung di kafe.

---

## 3. Input & Prasyarat

### Input
* Aliran event realtime SSE dari server (`EventSource` `/api/sse/kitchen`).
* Data pesanan terverifikasi (`PAID`) dari database.
* File audio alert `public/audio/chime.mp3`.

### Dokumen Rujukan Wajib
* [architecture.md](../../../architecture.md) — Seksi 5 (Alur Sinkronisasi Real-Time SSE) & Seksi 12 (Strategi Cetak Thermal).
* [design.md](../../../design.md) — Seksi 10 (Spesifikasi KDS & Audio Alert) & Seksi 11 (Struk Digital & Cetak 58/80 mm).
* [agent.md](../../../agent.md) — Seksi 8.2 (Keterbatasan Perangkat Keras Nyata).

---

## 4. Langkah Kerja Berurutan

### Langkah 1: Antrean KDS Dapur & Filter Status
1. Ambil pesanan aktif dari database dengan filter:
   ```typescript
   where: {
     orderStatus: 'PAID',
     kitchenStatus: { in: ['QUEUED', 'COOKING', 'READY'] }
   },
   orderBy: { paidAt: 'asc' } // Aturan ketat FIFO
   ```
2. Hitung durasi tunggu (*elapsed time*) dari `paidAt` secara berkala (interval 10 detik).
3. Terapkan pewarnaan kartu sesuai usia pesanan:
   * $< 10\text{ menit}$: Border netral `#E7E2DA`.
   * $10 - 20\text{ menit}$: Border oranye `#D97706` (Peringatan).
   * $> 20\text{ menit}$: Border merah berkedip `#BA1A1A` (Prioritas Segera).

### Langkah 2: Transisi Status Pesanan di Dapur
Sediakan tombol aksi satu ketukan berukuran tinggi minimal $56\text{ px}$:
1. `QUEUED` $\rightarrow$ Klik `"Mulai Dibuat"` $\rightarrow$ `COOKING` (KDS berubah warna amber, timer berjalan).
2. `COOKING` $\rightarrow$ Klik `"Siap Saji"` $\rightarrow$ `READY` (Notifikasi terkirim ke pelacak pelanggan, kartu berpindah ke seksi siap antar).
3. `READY` $\rightarrow$ Klik `"Selesai"` $\rightarrow$ `COMPLETED` (Tiket hilang dari antrean aktif, tercatat selesai di riwayat).

### Langkah 3: Penanganan Autoplay Audio Alert & Fallback Visual
1. Saat dashboard KDS pertama kali dimuat, tampilkan banner izin di header: `"Klik untuk mengaktifkan lonceng pesanan dapur"`.
2. Saat tombol diklik, putar silent audio buffer untuk membuka izin *Autoplay Policy* pada Web Audio API.
3. Saat ada event SSE pesanan baru lunas masuk:
   * Putar audio chime lonceng (`chime.mp3`).
   * **Fallback Visual:** Memicu kilatan visual (*visual border flash*) selama $1.5\text{ detik}$ pada kartu pesanan baru untuk mengantisipasi speaker tablet mati atau lingkungan bar yang bising.

### Langkah 4: Dashboard Kasir & Konfirmasi Pembayaran Tunai
1. Kasir memiliki tab terpisah: `Antrean Tunai (Cash Queue)`.
2. Saat tamu meja datang ke kasir, kasir memeriksa nomor meja dan nominal uang fisik.
3. Kasir menekan tombol `Konfirmasi Uang Masuk`:
   * Mengirim request `POST /api/pos/orders/[id]/confirm-cash`.
   * Status pesanan berubah menjadi `PAID`.
   * Tiket pesanan seketika muncul di antrean KDS Dapur diiringi denting chime.

### Langkah 5: Layout Cetak Thermal 58 mm & 80 mm
Gunakan CSS `@media print` universal pada halaman struk:
```css
@media print {
  @page { margin: 0; size: auto; }
  body { font-family: 'Courier New', monospace; font-size: 11pt; color: #000; width: 100%; }
  .no-print { display: none !important; }
}
```
* **Lebar 58 mm:** Maksimal 32 karakter per baris.
* **Lebar 80 mm:** Maksimal 48 karakter per baris.
* **Reprint Notice:** Jika `order.printCount > 0`, cetak teks tebal di baris paling atas:  
  `*** CETAK ULANG (REPRINT) ***`  
  Tambahkan counter `printCount` di database setiap kali tombol cetak ditekan.

---

## 5. Validasi & Pengujian Operasional

### Checklist Uji Operasional KDS & Kasir
- [ ] Pesanan berstatus `PENDING` atau tunai yang belum dikonfirmasi kasir **TIDAK MUNCUL** di layar KDS Dapur.
- [ ] Menekan tombol konfirmasi tunai di kasir memicu munculnya tiket baru di KDS Dapur tanpa reload halaman.
- [ ] Tombol status KDS mudah ditekan dan memiliki tinggi $\ge 56\text{ px}$.
- [ ] Header KDS menampilkan indikator status koneksi SSE (*Online* vs *Menghubungkan kembali...*).
- [ ] Buka dialog browser print (`Ctrl+P`): teks struk rapi, monospace, tidak terpotong margin, dan mencantumkan header reprint jika dicetak ulang.

---

## 6. Tindakan Bila Menemui Hambatan
* Jika koneksi SSE terputus di jaringan lokal kafe, terapkan mekanisme *exponential backoff reconnect* otomatis (retry tiap 3s, 6s, 12s) dan sediakan tombol manual `Muat Ulang Antrean`.
* Jangan menjanjikan integrasi cetak langsung tanpa dialog (silent ESC/POS) sebelum ada pengujian langsung pada perangkat fisik printer thermal kasir di lokasi.
