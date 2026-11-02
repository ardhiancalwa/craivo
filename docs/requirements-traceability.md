# MATRIKS KETERLACAKAN KEBUTUHAN (REQUIREMENTS TRACEABILITY MATRIX)
## Cravio — Your craving, Perfectly Matched
### Pilot Mitra Kafe: SELA (Artisanal Coffee & Bake)

> **Lokasi Berkas:** `docs/requirements-traceability.md`  
> **Status:** Verifikasi Selesai (Release Candidate 100% Tested)  
> **Terakhir Diperbarui:** 2 November 2026  
> **Peran Penulis:** Technical Lead & Quality Assurance Engineer  
> **Dokumen Sumber:** `Proposal Pengembangan Website Smart QR Menu.docx`, `docs/PRD.md`, `docs/TRD.md`, `docs/design.md`, `docs/architecture.md`, dan `docs/spec-audit.md`.

---

## 1. Pedoman Matriks & Resolusi Alias Penomoran

Untuk menjamin tidak ada kebutuhan yang hilang akibat perbedaan penomoran antara **PRD (Business View)** dan **Design (Interaction View)**, matriks ini menetapkan **ID Kanonis Terpadu** yang memetakan sumber, ID asli, modul antarmuka, API endpoint, model data, kriteria penerimaan, dan skenario verifikasi uji secara deterministik:

```
[Sumber + ID Asli + Judul] ──> [ID KANONIS RESMI] ──> [Layar / API / Model Data] ──> [Acceptance Criteria] ──> [Bukti Uji / UAT]
```

### Tabel Rekonsiliasi Alias ID PRD vs ID Desain

| ID Kanonis | Judul Kebutuhan Terpadu | ID Asli PRD | ID Asli Desain | Catatan Rekonsiliasi |
|---|---|:---:|:---:|---|
| `REQ-CUST-01` | Deteksi Meja Otomatis via QR | `REQ-CUST-01` | `REQ-CUST-01` | Identik: deteksi parameter URL `?table=XX`. |
| `REQ-CUST-02` | Kuis Preferensi 3 Langkah & Skip | `REQ-CUST-02` | `REQ-CUST-02` | PRD awal 4 langkah diselaraskan ke 3 langkah desain. |
| `REQ-CUST-03` | Rekomendasi Menu Deterministik | `REQ-CUST-03` | `REQ-CUST-03` | Identik: tag matching non-AI/LLM, tie-break Best Seller. |
| `REQ-CUST-04` | Katalog Menu, Filter, & Pencarian | `REQ-CUST-04` | `REQ-CUST-04` | Identik: grid 2-kolom, filter kategori, search bar. |
| `REQ-CUST-05` | Kustomisasi Modifier & Catatan 100 Karakter | `REQ-CUST-05` | `REQ-CUST-05` | Batas catatan diselaraskan ke 100 karakter. |
| `REQ-CUST-06` | Keranjang Belanja & Floating Order Tray | `REQ-CUST-05` *(bagian)* | `REQ-CUST-06` | Dipecah menjadi ID mandiri untuk komponen floating tray. |
| `REQ-CUST-07` | Checkout Multi-Metode (QRIS & Tunai) | `REQ-PAY-01/03` | `REQ-CUST-07` | Menggabungkan selector metode bayar di sisi client. |
| `REQ-CUST-08` | Pelacak Pesanan Real-Time & Secret Token | `REQ-CUST-06` | `REQ-CUST-08` | Mengintegrasikan proteksi token `orderSecretToken`. |
| `REQ-CUST-09` | Struk Digital Pelanggan (E-Receipt) | `REQ-CUST-07` | `REQ-CUST-09` *(turunan)* | Tampilan struk digital mobile-friendly. |
| `REQ-PAY-01` | Integrasi QRIS Dinamis (Midtrans Core API) | `REQ-PAY-01` | `REQ-PAY-01` | Pembuatan transaksi charge QRIS 15 menit via server. |
| `REQ-PAY-02` | Verifikasi Webhook Signature SHA512 | `REQ-PAY-02` | `REQ-PAY-01` *(backend)* | Validasi keaslian callback settlement gateway. |
| `REQ-PAY-03` | Opsi Pembayaran Tunai & Tertahan di Kasir | `REQ-PAY-03` | `REQ-PAY-02` | Status `WAITING_CASHIER`, tertahan dari KDS dapur. |
| `REQ-PAY-04` | Kedaluwarsa Transaksi 15 Menit & Rekonsiliasi | `DEC-015` | `REQ-PAY-04` | Timer hitung mundur dan auto-cancellation server. |
| `REQ-PAY-05` | Idempotensi Transaksi & Anti-Double Submit | `BR-07` | `REQ-PAY-03` | Header Idempotency-Key dan deduplikasi webhook DB. |
| `REQ-OPS-01` | Antrean KDS Dapur Real-Time FIFO | `REQ-OPS-01` | `REQ-OPS-01` | Layar tablet dapur $\ge 10$" dengan urutan waktu lunas. |
| `REQ-OPS-02` | Notifikasi Audio Alert & Visual Flash | `REQ-OPS-02` | `REQ-OPS-03` | Suara chime + kilatan layar saat pesanan lunas masuk. |
| `REQ-OPS-03` | Transisi Status Alur Masak Bertahap | `REQ-OPS-03` | `REQ-OPS-02` | `QUEUED` $\rightarrow$ `COOKING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`. |
| `REQ-OPS-04` | Cetak Thermal 58/80 mm & Watermark Reprint | `REQ-OPS-04` | `REQ-OPS-04` | Layout CSS `@media print` dan banner reprint. |
| `REQ-OPS-05` | Indikator Usia Tunggu Pesanan KDS | `BR-10` *(visual)* | `REQ-OPS-05` | Pewarnaan kartu KDS: Hijau (<10m), Oranye, Merah (>20m). |
| `REQ-OPS-06` | Dashboard Kasir POS & Konfirmasi Tunai | `REQ-PAY-03` *(staf)* | `REQ-OPS-06` | Antrean khusus pembayaran tunai dan tombol konfirmasi. |
| `REQ-ADMIN-01` | CRUD Menu, Kategori, Harga, & Foto | `REQ-ADMIN-01` | `REQ-ADMIN-01` | Manajemen katalog menu, harga integer rupiah. |
| `REQ-ADMIN-02` | Quick Toggle Stok (Tersedia / Sold Out) | `REQ-ADMIN-02` | `REQ-ADMIN-02` | Sakelar status stok biner tanpa reload halaman. |
| `REQ-ADMIN-03` | Pengaturan Atribut Tag Preferensi Menu | `REQ-ADMIN-03` | `REQ-ADMIN-03` | Input tag flavor, format, mood pada item menu. |
| `REQ-ADMIN-04` | Generator Master QR Meja Siap Cetak | `REQ-ADMIN-04` | `REQ-ADMIN-04` | Generator QR resolusi tinggi (PNG/SVG) per meja. |
| `REQ-ADMIN-05` | Konfigurasi Pajak & Service Charge Dinamis | `REQ-ADMIN-05` | `REQ-ADMIN-05` | Pengaturan persentase PB1/Service (default 0%). |
| `REQ-ADMIN-06` | Manajemen Pertanyaan & Opsi Kuis Dinamis | `REQ-ADMIN-06` | `REQ-ADMIN-06` | Pengaturan opsi kuis dari database. |
| `REQ-ADMIN-07` | Ringkasan Laporan Penjualan & Omzet | `Proposal Bag. 2` | `REQ-ADMIN-07` | Laporan harian omzet, filter tanggal, ekspor CSV. |
| `REQ-B2B-01` | Landing Page Pemasaran B2B Cravio | `REQ-B2B-01` | `REQ-B2B-01` | Etalase penawaran solusi kafe, copywriting persuasif. |
| `REQ-B2B-02` | Simulator Live Demo Kuis Interaktif Mock | `REQ-B2B-02` | `REQ-B2B-02` | Widget preview kuis terisolasi tanpa order nyata. |
| `REQ-B2B-03` | Call to Action (CTA) WhatsApp Terintegrasi | `REQ-B2B-03` | `REQ-B2B-03` | Tombol floating & section ke WhatsApp resmi pengembang. |
| `REQ-B2B-04` | Transparansi Paket Investasi Rp 2.500.000 | `Proposal Bag. 5` | `REQ-B2B-04` | Tabel rincian paket komersial tahun pertama all-in. |

---

## 2. Matriks Lengkap Kebutuhan Fungsional (Functional Requirements)

### 2.1. Modul 1: Web App Pelanggan Meja SELA (`REQ-CUST`)

| ID Kanonis | Sumber & ID Asli | Judul Kebutuhan | Komponen UI & Rute | Endpoint API & Model Data | Acceptance Criteria (Kriteria Penerimaan) | Verifikasi & Bukti UAT |
|---|---|---|---|---|---|---|
| `REQ-CUST-01` | PRD / Desain `REQ-CUST-01` | Deteksi Meja Otomatis via QR | `HeaderTableBadge`, Guard Rute `/order?table=05` | `GET /api/tables/[tableNumber]`<br>Model: `Table` | 1. Scan QR membuka web tanpa prompt install aplikasi.<br>2. Nomor meja terbaca dari query param dan divalidasi ke DB.<br>3. Nomor meja salah/tidak aktif menampilkan pesan ramah dan mengunci tombol checkout. | **UAT-01** (Scan valid & invalid param) |
| `REQ-CUST-02` | PRD / Desain `REQ-CUST-02` | Kuis Preferensi 3 Langkah & Skip | `QuizProgressBar`, `PreferenceChipGroup`, `/order/quiz` | `GET /api/quiz/questions`<br>Model: `QuizQuestion`, `QuizOption` | 1. Menampilkan 3 langkah: Suasana $\rightarrow$ Rasa $\rightarrow$ Format.<br>2. Tombol "Lewati Kuis" selalu tampil di setiap langkah.<br>3. Klik Lewati langsung membuka katalog lengkap tanpa error. | **UAT-02** (Isi kuis & uji tombol lewati) |
| `REQ-CUST-03` | PRD / Desain `REQ-CUST-03` | Rekomendasi Menu Cerdas Deterministik | `RecommendationHeroCard`, `TasteTagBadge`, `/order/quiz/results` | `POST /api/recommendations`<br>Model: `MenuItem`, `MenuTag` | 1. Menghitung skor formula deterministik ($W_{\text{flav}}=3, W_{\text{format}}=2, W_{\text{mood}}=1$).<br>2. Maksimal 2 menu teratas ($S \ge 3$).<br>3. Menu Sold Out dilarang muncul.<br>4. Fallback Best Seller jika tidak ada yang cocok.<br>5. Nir-panggilan LLM/AI (<10ms). | **UAT-03** (Akurasi rekomendasi tag & fallback) |
| `REQ-CUST-04` | PRD / Desain `REQ-CUST-04` | Katalog Menu, Kategori, & Pencarian | `CategoryTabsScroll`, `MenuCardGrid`, `MenuSearchBar`, `/order/menu` | `GET /api/menu`<br>Model: `Category`, `MenuItem` | 1. Grid 2 kolom responsif mobile 390px.<br>2. Tab kategori (Semua, Kopi, Non-Kopi, Makanan) menyaring instan.<br>3. Search bar menyaring nama & deskripsi real-time.<br>4. Item Sold Out berstatus disabled/abu-abu. | **UAT-13, UAT-14** (Filter katalog & status sold out) |
| `REQ-CUST-05` | PRD / Desain `REQ-CUST-05` | Kustomisasi Modifier & Catatan 100 Karakter | `ModifierBottomSheet`, `RadioOptionGroup`, `NoteTextarea` | `GET /api/menu/[id]/modifiers`<br>Model: `ModifierGroup`, `ModifierOption` | 1. Modal bottom sheet ramah jempol.<br>2. Radio button untuk gula/es; checkbox untuk add-on berbayar.<br>3. Subtotal harga bertambah otomatis dan transparan.<br>4. Input catatan khusus dibatasi maksimal 100 karakter. | **UAT-04** (Kustomisasi modifier & batas catatan) |
| `REQ-CUST-06` | Desain `REQ-CUST-06` | Keranjang & Floating Order Tray | `FloatingOrderTray`, `CartDrawerSheet`, `QuantityStepper`, `/order/cart` | Local State / Sesi Klien | 1. Floating tray melekat di bawah saat ada item.<br>2. Menampilkan total item dan estimasi total bayar.<br>3. Drawer keranjang mendukung ubah quantity `[-] Qty [+]` atau hapus item. | **UAT-04** (Interaksi keranjang belanja) |
| `REQ-CUST-07` | PRD / Desain `REQ-CUST-07` | Checkout Multi-Metode (QRIS & Tunai) | `PaymentMethodSelector`, `SubmitOrderBtn`, `/order/cart` | `POST /api/orders`<br>Model: `Order`, `OrderItem` | 1. Pilihan metode pembayaran radio button: "QRIS Dinamis" atau "Bayar Tunai di Kasir".<br>2. Validasi stok sebelum pesanan dibuat.<br>3. Kalkulasi total akhir 100% dihitung server.<br>4. Tombol submit disable otomatis saat diklik. | **UAT-05, UAT-08** (Checkout QRIS & Tunai) |
| `REQ-CUST-08` | PRD `REQ-CUST-06` / Desain `REQ-CUST-08` | Pelacak Pesanan Real-Time & Token Rahasia | `OrderStatusTimeline`, `ElapsedBadge`, `/order/[orderId]/track` | `GET /api/orders/[orderId]`<br>`GET /api/orders/[orderId]/stream` (SSE) | 1. Menampilkan nomor antrean, nomor meja, dan alur status.<br>2. Layar ter-update otomatis dalam $\le 2$ detik via SSE tanpa refresh.<br>3. Akses dilindungi `orderSecretToken` di localStorage pemesan; scan ulang meja publik tidak membocorkan data. | **UAT-11, UAT-17** (Sinkronisasi status & reconnect) |
| `REQ-CUST-09` | PRD `REQ-CUST-07` | Struk Digital Pelanggan (E-Receipt) | `DigitalReceiptCard`, `SaveReceiptBtn`, `/order/[orderId]/receipt` | `GET /api/orders/[orderId]/receipt`<br>Model: `Order`, `PaymentTransaction` | 1. Memuat kop kafe, tanggal/jam, nomor meja, rincian item, subtotal, status lunas.<br>2. Tombol unduh / simpan gambar struk.<br>3. Tampilan rapi dan ramah tangkapan layar ponsel. | **UAT-08, UAT-11** (Penerbitan struk digital) |

---

### 2.2. Modul 2: Pembayaran Digital & Gateway (`REQ-PAY`)

| ID Kanonis | Sumber & ID Asli | Judul Kebutuhan | Komponen UI & Rute | Endpoint API & Model Data | Acceptance Criteria (Kriteria Penerimaan) | Verifikasi & Bukti UAT |
|---|---|---|---|---|---|---|
| `REQ-PAY-01` | PRD / Desain `REQ-PAY-01` | Integrasi QRIS Dinamis (Midtrans Core API) | `QRISImageRenderer`, `CountdownTimer`, `/order/[orderId]/pay` | `POST /v2/charge` (Midtrans)<br>Model: `PaymentTransaction` | 1. Memanggil Midtrans Core API dengan payload `payment_type: "qris"`.<br>2. Menampilkan gambar QR resmi dan raw EMVCo string.<br>3. Nominal QRIS persis sama dengan subtotal server.<br>4. Timer hitung mundur 15:00 menit aktif. | **UAT-05** (Generate QRIS Midtrans Sandbox) |
| `REQ-PAY-02` | PRD `REQ-PAY-02` | Verifikasi Webhook Signature SHA512 | Backend Listener | `POST /api/webhooks/midtrans`<br>Header Signature | 1. Memverifikasi signature hash SHA512: `order_id + status_code + gross_amount + ServerKey`.<br>2. Signature tidak valid ditolak HTTP 403.<br>3. Status `settlement` mengubah pembayaran menjadi `PAID` dan meneruskan pesanan ke KDS dapur seketika. | **UAT-06** (Webhook settlement otomatis) |
| `REQ-PAY-03` | PRD `REQ-PAY-03` / Desain `REQ-PAY-02` | Opsi Bayar Tunai & Gate Kasir | `CashInstructionCard`, `/order/[orderId]/pay` | `POST /api/orders` (CASH)<br>Model: `Order` | 1. Checkout tunai menghasilkan status `paymentStatus: WAITING_CASHIER`.<br>2. Pesanan muncul di dashboard kasir dengan badge menunggu pelunasan.<br>3. Pesanan **DILARANG MUNCUL** di KDS dapur sebelum kasir klik "Konfirmasi Tunai". | **UAT-08** (Alur bayar tunai tertahan di kasir) |
| `REQ-PAY-04` | Desain `REQ-PAY-04` / `DEC-015` | Kedaluwarsa Transaksi 15 Menit & Rekonsiliasi | `SessionExpiredModal`, `RetryCTA` | `POST /api/orders/[orderId]/expire`<br>Background Cron Reconciler | 1. Waktu bayar QRIS dibatasi mutlak 15 menit.<br>2. Saat timer habis, QR code terkunci dan status menjadi `EXPIRED`.<br>3. Server reconciler memverifikasi status gateway dan membatalkan pesanan kedaluwarsa secara aman. | **UAT-05, UAT-07** (Kedaluwarsa transaksi 15 menit) |
| `REQ-PAY-05` | PRD `BR-07` / Desain `REQ-PAY-03` | Idempotensi Transaksi & Anti-Duplikasi | `StatefulSubmitButton` | Header `Idempotency-Key`<br>Constraint DB Unique | 1. Klik tombol checkout berulang kali hanya membuat 1 pesanan di database.<br>2. Notifikasi webhook berulang untuk transaksi yang sama tidak menduplikasi mutasi status atau memicu audio KDS ganda. | **UAT-07** (Ketahanan webhook ganda idempoten) |

---

### 2.3. Modul 3: Operasional Kasir & Dapur KDS (`REQ-OPS`)

| ID Kanonis | Sumber & ID Asli | Judul Kebutuhan | Komponen UI & Rute | Endpoint API & Model Data | Acceptance Criteria (Kriteria Penerimaan) | Verifikasi & Bukti UAT |
|---|---|---|---|---|---|---|
| `REQ-OPS-01` | PRD / Desain `REQ-OPS-01` | Antrean KDS Dapur Real-Time FIFO | `KitchenBoardGrid`, `KitchenOrderCard`, `/staff/kitchen` | `GET /api/staff/kds/orders`<br>`GET /api/sse/kitchen` (SSE) | 1. Hanya me-render pesanan berstatus `PAID` (`DEC-013`).<br>2. Kartu baru muncul dalam waktu $\le 2$ detik tanpa refresh.<br>3. Urutan kartu strictly FIFO berdasarkan waktu lunas.<br>4. Nomor meja tebal $\ge 28$ px, nama item $\ge 18$ px, catatan khusus disorot jelas. | **UAT-09** (Tampilan KDS real-time) |
| `REQ-OPS-02` | PRD / Desain `REQ-OPS-03` | Notifikasi Audio Alert & Visual Flash | `AudioAlertManager`, `VisualFlashOverlay` | Web Audio API / Audio Element `chime.mp3` | 1. Memutar denting audio chime 1.5 detik saat order lunas baru masuk.<br>2. Tombol pembuka izin *"Mulai Shift / Aktifkan Audio"* untuk memenuhi browser autoplay policy.<br>3. Kilatan layar visual flash cadangan jika audio dinonaktifkan.<br>4. Deduplikasi: tidak memicu audio ganda saat reconnect. | **UAT-10** (Audio chime & tombol start shift) |
| `REQ-OPS-03` | PRD `REQ-OPS-03` / Desain `REQ-OPS-02` | Transisi Status Alur Masak Bertahap | `KitchenStatusActionBtn`, `/staff/kitchen` | `PATCH /api/staff/orders/[id]/status`<br>Model: `Order`, `AuditLog` | 1. Transisi bergerak maju: `QUEUED` $\rightarrow$ `COOKING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`.<br>2. Tombol aksi raksasa dengan tinggi sentuh $\ge 56$ px.<br>3. Perubahan status langsung tersinkronisasi ke layar pelacak pelanggan. | **UAT-11** (Transisi status KDS multi-tahap) |
| `REQ-OPS-04` | PRD / Desain `REQ-OPS-04` | Cetak Thermal 58/80 mm & Watermark Reprint | `PrintThermalDialog`, CSS `@media print` | `POST /api/staff/orders/[id]/print-count`<br>Kolom: `printCount` | 1. Memicu dialog cetak browser dengan stylesheet presisi lebar 58mm ($\approx 384$ px) dan 80mm ($\approx 576$ px).<br>2. Font monospaced, margin nol, tidak terpotong tepi.<br>3. Cetakan ke-2 dan seterusnya wajib memuat teks `*** CETAK ULANG (REPRINT) ***`. | **UAT-12** (Cetak thermal tiket dapur & struk) |
| `REQ-OPS-05` | Desain `REQ-OPS-05` | Indikator Usia Tunggu Pesanan KDS | `AgeTimerPill`, `ElapsedTimerBadge` | Client Interval Timer | 1. Kartu KDS menampilkan waktu tunggu berjalan sejak lunas.<br>2. Transformasi visual: Hijau/Netral (<10 menit), Oranye (10–20 menit), Merah berkedip (>20 menit) untuk mendeteksi pesanan terlambat. | **UAT-09** (Inspeksi visual usia kartu KDS) |
| `REQ-OPS-06` | Desain `REQ-OPS-06` | Dashboard Kasir POS & Konfirmasi Tunai | `CashierQueueGrid`, `ConfirmCashBtn`, `/staff/pos` | `POST /api/staff/orders/[id]/cash-confirm`<br>`POST /api/staff/orders/[id]/void` | 1. Menampilkan kartu antrean tunai yang membutuhkan konfirmasi uang fisik.<br>2. Tombol "Konfirmasi Tunai" mengubah status ke `PAID` dan meneruskan ke KDS.<br>3. Tombol "Batalkan Pesanan" dengan pencatatan alasan audit jika tamu batal. | **UAT-08** (Konfirmasi tunai kasir POS) |

---

### 2.4. Modul 4: Panel Admin & Konfigurasi Kafe (`REQ-ADMIN`)

| ID Kanonis | Sumber & ID Asli | Judul Kebutuhan | Komponen UI & Rute | Endpoint API & Model Data | Acceptance Criteria (Kriteria Penerimaan) | Verifikasi & Bukti UAT |
|---|---|---|---|---|---|---|
| `REQ-ADMIN-01` | PRD / Desain `REQ-ADMIN-01` | CRUD Menu, Kategori, Harga, & Foto | `MenuManagementTable`, `MenuFormModal`, `/staff/admin` | `POST /api/admin/menu`<br>`PUT /api/admin/menu/[id]`<br>Model: `MenuItem` | 1. Admin dapat menambah, mengedit, dan menghapus item menu.<br>2. Validasi harga berupa integer rupiah positif.<br>3. Upload foto produk teroptimasi format WebP/JPG (maks 2MB).<br>4. Perubahan menu seketika tercermin pada katalog pelanggan. | **UAT-13** (Tambah & edit menu di katalog) |
| `REQ-ADMIN-02` | PRD / Desain `REQ-ADMIN-02` | Quick Toggle Stok (Tersedia / Sold Out) | `StockToggleSwitch`, `/staff/admin` | `PATCH /api/admin/menu/[id]/stock`<br>Model: `MenuItem` (`isSoldOut`) | 1. Toggle switch 1-klik untuk mengubah status ketersediaan item.<br>2. Item Sold Out seketika terkunci di katalog pelanggan dan dieksklusikan dari kuis rekomendasi.<br>3. Bekerja optimistik tanpa reload peramban. | **UAT-14** (Uji toggle cepat stok habis) |
| `REQ-ADMIN-03` | PRD / Desain `REQ-ADMIN-03` | Pengaturan Atribut Tag Preferensi Menu | `TagSelectorInput`, `/staff/admin` | `PUT /api/admin/menu/[id]/tags`<br>Model: `MenuTag` | 1. Form input tag multi-pilihan terstruktur (Rasa: manis, gurih, pahit, segar; Format: es, hangat, makanan; Mood: santai, fokus).<br>2. Tag tersimpan dan langsung dibaca oleh algoritma rekomendasi. | **UAT-03** (Konfigurasi tag & hasil rekomendasi) |
| `REQ-ADMIN-04` | PRD / Desain `REQ-ADMIN-04` | Generator Master QR Meja Siap Cetak | `QRGeneratorPanel`, `DownloadQRBatchBtn`, `/staff/admin` | `GET /api/admin/tables/qr-export`<br>Pustaka: `qrcode` | 1. Admin dapat men-generate QR code untuk nomor meja kafe aktif.<br>2. Resolusi tinggi minimal $600 \times 600$ px (300 DPI) memuat label teks nomor meja di bawahnya.<br>3. Opsi unduh satuan (PNG) atau unduh massal seluruh meja (ZIP/Sheet PDF). | **UAT-15** (Generate & unduh master QR meja) |
| `REQ-ADMIN-05` | PRD `REQ-ADMIN-05` / `DEC-006` | Konfigurasi Pajak & Service Charge Dinamis | `TaxConfigCard`, `/staff/admin` | `PUT /api/admin/config/tax`<br>Model: `CafeConfig` | 1. Nilai bawaan default 0% (Nett All-Inclusive).<br>2. Switch konfigurasi dapat diaktifkan untuk menetapkan pajak % dan service charge % bila kebijakan keuangan kafe berubah di masa depan. | **UAT-04** (Verifikasi pengaturan pajak dinamis) |
| `REQ-ADMIN-06` | PRD `REQ-ADMIN-06` / `DEC-009` | Manajemen Opsi Kuis Dinamis | `QuizConfigTable`, `/staff/admin` | `PUT /api/admin/quiz/options`<br>Model: `QuizOption` | 1. Admin dapat mengedit label opsi kuis dan mapping tag terkait dari dashboard tanpa mengubah kode sumber. | **UAT-02** (Pembaruan opsi kuis admin) |
| `REQ-ADMIN-07` | Proposal Bagian 2 (Modul 4) | Laporan Penjualan & Rekap Omzet Harian | `RevenueSummaryCards`, `SalesDataTable`, `/staff/admin` | `GET /api/admin/reports/sales`<br>Model: `Order` | 1. Ringkasan omzet harian total rupiah, total transaksi lunas, dan rincian metode pembayaran (QRIS vs Tunai).<br>2. Ekspor riwayat transaksi ke format CSV bersih. | **UAT-08** (Verifikasi pencatatan omzet laporan) |

---

### 2.5. Modul 5: Landing Page Promosi B2B Cravio (`REQ-B2B`)

| ID Kanonis | Sumber & ID Asli | Judul Kebutuhan | Komponen UI & Rute | Endpoint API & Model Data | Acceptance Criteria (Kriteria Penerimaan) | Verifikasi & Bukti UAT |
|---|---|---|---|---|---|---|
| `REQ-B2B-01` | PRD / Desain `REQ-B2B-01` | Landing Page Pemasaran B2B Cravio | `HeroSection`, `FeatureShowcase`, `PricingTable`, Rute `/` | Client-Side Static / RSC | 1. Mempromosikan solusi Cravio — Your craving, Perfectly Matched.<br>2. Tampilan responsif sempurna di mobile 360px hingga desktop 1920px.<br>3. Tidak memuat data rahasia internal kafe mitra (`DEC-001`). | **UAT-16** (Inspeksi landing page B2B) |
| `REQ-B2B-02` | PRD / Desain `REQ-B2B-02` | Simulator Live Demo Kuis Mock Interaktif | `InteractiveQuizDemoWidget`, Rute `/` | Client In-Memory State (Mock Dataset) | 1. Komponen simulasi kuis interaktif disematkan di landing page.<br>2. Pengunjung dapat memilih opsi kuis dan melihat hasil rekomendasi sampel seketika.<br>3. Terisolasi 100%: dilarang membuat transaksi nyata ke database operasional. | **UAT-16** (Simulasi demo kuis mock) |
| `REQ-B2B-03` | PRD / Desain `REQ-B2B-03` | Call to Action (CTA) WhatsApp Terintegrasi | `FloatingWhatsAppBtn`, `SectionCTABtn`, Rute `/` | Tautan Protokol `https://wa.me/...` | 1. Tombol CTA terpasang di navbar, hero section, bawah widget kuis, dan footer.<br>2. Membuka aplikasi WhatsApp dengan nomor resmi dan format pesan konsultasi terisi otomatis. | **UAT-16** (Klik CTA WhatsApp sales) |
| `REQ-B2B-04` | Proposal Bagian 5 / Desain `REQ-B2B-04` | Transparansi Paket Investasi Rp 2.500.000 | `PricingPackageCard`, Rute `/` | Client-Side Static | 1. Menampilkan rincian paket investasi komersial Rp 2.500.000 all-in tahun pertama secara transparan tanpa biaya tersembunyi. | **UAT-16** (Tampilan paket komersial) |

---

## 3. Matriks Kebutuhan Nonfungsional (Non-Functional Requirements / NFR)

| ID NFR | Kategori | Spesifikasi Kebutuhan | Metode Uji & Batas Ambang | Skenario UAT Terkait |
|---|---|---|---|:---:|
| `REQ-NFR-01` | **Responsivitas Viewport** | Antarmuka beradaptasi tanpa cacat visual pada ponsel 360px–430px, tablet 768px–1024px, dan desktop $\ge 1280$px. | Emulasi peramban; horizontal overflow nol; touch target $\ge 44$px (mobile) dan $\ge 56$px (KDS). | Seluruh UAT |
| `REQ-NFR-02` | **Performa Pemuatan (LCP)** | Halaman katalog menu terbuka instan di peramban ponsel pelanggan. | Audit Lighthouse pada jaringan 4G standar; target LCP $\le 2.5$ detik. | UAT-01, UAT-04 |
| `REQ-NFR-03` | **Latensi Real-time KDS** | Pesanan lunas muncul di layar KDS dapur dalam hitungan detik. | Pengukuran timestamp event server ke tampilan klien; latensi $\le 2.0$ detik. | UAT-09 |
| `REQ-NFR-04` | **Integritas Finansial Server** | Total transaksi dihitung 100% oleh server; manipulasi nominal di payload klien ditolak mentah-mentah. | Automated security test; injeksi payload harga palsu wajib menghasilkan error validasi. | UAT-04, UAT-05 |
| `REQ-NFR-05` | **Autoplay Audio Policy** | Suara lonceng alert berbunyi andal di tablet dapur tanpa terblokir proteksi peramban. | Uji interaksi tombol "Mulai Shift / Aktifkan Audio" saat pertama kali membuka dashboard KDS. | UAT-10 |
| `REQ-NFR-06` | **Universal Printer Layout** | Format cetak struk rapi pada lebar kertas 58mm dan 80mm via dialog peramban standar. | Uji cetak Print to PDF ukuran kustom 58/80 mm; teks monospaced tidak terpotong tepi. | UAT-12 |
| `REQ-NFR-07` | **Ketahanan Jaringan (Reconnect)** | Sistem pulih otomatis setelah sinyal internet Wi-Fi kafe sempat terputus sesaat. | Matikan koneksi 10 detik lalu aktifkan kembali; SSE reconnect dan menarik snapshot state terbaru. | UAT-17 |
| `REQ-NFR-08` | **Nir-Bocoran Secret (Zero Secret)** | Kredensial rahasia server (Server Key Midtrans, JWT Secret, DB URL) dilarang bocor ke client bundle. | Regex scan bundle frontend; variabel publik hanya menggunakan prefix `NEXT_PUBLIC_`. | Seluruh UAT |

---

## 4. Pemetaan 17 Skenario UAT Terhadap Seluruh Kebutuhan

| ID UAT | Nama Skenario Pengujian UAT | ID Kebutuhan yang Diverifikasi | Kriteria Kelulusan (Pass Criteria) | Status Aktual |
|---|---|---|---|:---:|
| **UAT-01** | Pindai QR Meja Valid & Tanpa Parameter | `REQ-CUST-01`, `REQ-NFR-01` | Meja valid terdeteksi; URL tanpa meja menampilkan peringatan dan mengunci checkout. | **PASS** — [table-admin-and-qr.test.ts](../tests/integration/table-admin-and-qr.test.ts#L30-L75), [table-validation.test.ts](../tests/unit/table-validation.test.ts#L10-L45) |
| **UAT-02** | Kuis Preferensi & Tombol Lewati (*Skip*) | `REQ-CUST-02`, `REQ-ADMIN-06` | Kuis 3 langkah lancar; tombol skip langsung membuka katalog lengkap tanpa hambatan. | **PASS** — [quiz-api.test.ts](../tests/integration/quiz-api.test.ts#L15-L60), [admin-quiz-tax-reports.test.ts](../tests/integration/admin-quiz-tax-reports.test.ts#L180-L240) |
| **UAT-03** | Akurasi Rekomendasi Tag & Fallback | `REQ-CUST-03`, `REQ-ADMIN-03` | Menghasilkan rekomendasi menu yang cocok; item sold out tidak muncul; fallback Best Seller aktif. | **PASS** — [recommendation-engine.test.ts](../tests/unit/recommendation-engine.test.ts#L25-L160) |
| **UAT-04** | Kustomisasi Modifier & Catatan Khusus | `REQ-CUST-04`, `REQ-CUST-05`, `REQ-NFR-04` | Subtotal modifier bertambah tepat; catatan dibatasi 100 karakter; total dihitung server. | **PASS** — [quote-api.test.ts](../tests/integration/quote-api.test.ts#L40-L120), [cart-pricing.test.ts](../tests/unit/cart-pricing.test.ts#L10-L70) |
| **UAT-05** | Pembuatan QRIS Dinamis Otomatis | `REQ-CUST-07`, `REQ-PAY-01`, `REQ-PAY-04` | Kode QRIS Midtrans muncul dengan nominal belanja persis & timer hitung mundur 15:00. | **PASS** — [midtrans-qris.test.ts](../tests/integration/midtrans-qris.test.ts#L130-L195), [e2e-real-sandbox-and-cash.test.ts](../tests/integration/e2e-real-sandbox-and-cash.test.ts#L20-L85) |
| **UAT-06** | Callback Webhook Verifikasi Otomatis | `REQ-PAY-02`, `REQ-OPS-01` | Simulasi payment di Sandbox mengubah status pesanan ke `PAID` secara instan tanpa reload. | **PASS** — [midtrans-webhook.test.ts](../tests/integration/midtrans-webhook.test.ts#L80-L150), [e2e-real-sandbox-and-cash.test.ts](../tests/integration/e2e-real-sandbox-and-cash.test.ts#L90-L140) |
| **UAT-07** | Ketahanan Webhook Ganda (Idempoten) | `REQ-PAY-02`, `REQ-PAY-05` | Payload webhook berulang untuk order yang sama tidak memicu duplikasi pesanan/audio ganda. | **PASS** — [midtrans-webhook.test.ts](../tests/integration/midtrans-webhook.test.ts#L155-L210), [idempotency-fingerprint.test.ts](../tests/unit/idempotency-fingerprint.test.ts#L15-L80) |
| **UAT-08** | Alur Pembayaran Tunai & Tertahan di Kasir | `REQ-PAY-03`, `REQ-OPS-06`, `REQ-CUST-09` | Pesanan tunai menunggu kasir; tertahan dari dapur; lunas dan masuk KDS setelah kasir konfirmasi. | **PASS** — [pos-cashier.test.ts](../tests/integration/pos-cashier.test.ts#L210-L340), [e2e-real-sandbox-and-cash.test.ts](../tests/integration/e2e-real-sandbox-and-cash.test.ts#L150-L240) |
| **UAT-09** | Kartu Pesanan KDS Real-Time & Usia | `REQ-OPS-01`, `REQ-OPS-05`, `REQ-NFR-03` | Kartu muncul $\le 2$ detik di KDS strictly FIFO; nomor meja $\ge 28$px; indikator usia bertransformasi. | **PASS** — [kds-fulfillment-and-tracker.test.ts](../tests/integration/kds-fulfillment-and-tracker.test.ts#L90-L170), [pre-uat-audit-and-benchmarks.test.ts](../tests/integration/pre-uat-audit-and-benchmarks.test.ts#L80-L140) |
| **UAT-10** | Audio Alert Lonceng & Tombol Mulai Shift | `REQ-OPS-02`, `REQ-NFR-05` | Bunyi lonceng berdentang saat order lunas masuk; visual flash aktif; tombol start shift berfungsi. | **PASS** — [ui-components.test.tsx](../tests/unit/ui-components.test.tsx#L40-L95), [realtime-sync.test.ts](../tests/integration/realtime-sync.test.ts#L120-L180) |
| **UAT-11** | Transisi Status KDS & Pelacak Pelanggan | `REQ-OPS-03`, `REQ-CUST-08` | Klik tombol KDS $\ge 56$px memajukan status; layar ponsel pelanggan ter-update seketika via SSE. | **PASS** — [kds-fulfillment-and-tracker.test.ts](../tests/integration/kds-fulfillment-and-tracker.test.ts#L180-L260), [realtime-sync.test.ts](../tests/integration/realtime-sync.test.ts#L50-L115) |
| **UAT-12** | Cetak Struk Thermal 58/80 mm & Reprint | `REQ-OPS-04`, `REQ-NFR-06` | Layout cetak presisi 58/80 mm tidak terpotong margin; cetakan ke-2 memiliki teks `*** REPRINT ***`. | **PASS** — [receipt-and-thermal-print.test.ts](../tests/integration/receipt-and-thermal-print.test.ts#L40-L160) *(Catatan: Printer fisik = BLOCKED, terverifikasi via print stylesheet & PDF engine)* |
| **UAT-13** | Tambah Menu Baru & Edit Harga di Admin | `REQ-ADMIN-01`, `REQ-CUST-04` | Menu baru dan perubahan harga di admin langsung muncul di katalog pelanggan secara sah. | **PASS** — [menu-catalog-api.test.ts](../tests/integration/menu-catalog-api.test.ts#L20-L90), [admin-quiz-tax-reports.test.ts](../tests/integration/admin-quiz-tax-reports.test.ts#L40-L110) |
| **UAT-14** | Sakelar Cepat Stok Habis (Sold Out) | `REQ-ADMIN-02`, `REQ-CUST-04` | Mengubah stok ke Sold Out seketika mendisable tombol tambah dan mengecualikan dari kuis. | **PASS** — [menu-catalog-api.test.ts](../tests/integration/menu-catalog-api.test.ts#L95-L140) |
| **UAT-15** | Generator Master QR Meja Siap Cetak | `REQ-ADMIN-04` | Men-generate seluruh file QR meja ($600 \times 600$ px) berlabel nomor meja dalam format ZIP/PNG. | **PASS** — [qr-generator.test.ts](../tests/unit/qr-generator.test.ts#L20-L80), [table-admin-and-qr.test.ts](../tests/integration/table-admin-and-qr.test.ts#L120-L180) |
| **UAT-16** | Live Demo Kuis & CTA WhatsApp di Landing B2B | `REQ-B2B-01` s/d `REQ-B2B-04` | Halaman B2B responsif; widget kuis mock berjalan interaktif; klik CTA membuka chat WhatsApp. | **PASS** — [b2b-landing-page.test.ts](../tests/integration/b2b-landing-page.test.ts#L15-L80), [b2b-demo-isolation.test.ts](../tests/unit/b2b-demo-isolation.test.ts#L20-L90) |
| **UAT-17** | Pemulihan Sambungan Putus (Offline Reconnect) | `REQ-NFR-07`, `REQ-CUST-08` | Muncul indikator koneksi terputus saat offline; setelah online, state langsung tersinkronisasi kembali. | **PASS** — [realtime-sync.test.ts](../tests/integration/realtime-sync.test.ts#L190-L260) |

