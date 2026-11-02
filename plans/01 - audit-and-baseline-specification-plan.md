# Rencana Kerja: Audit 9 Dokumen & Penetapan Baseline Spesifikasi Cravio — Your craving, Perfectly Matched

## Goal Description
Melaksanakan tahap audit menyeluruh terhadap 9 dokumen spesifikasi, prototipe `design-preview/`, dokumen proposal resmi, serta 6 unit skill harness Antigravity sebelum penulisan kode aplikasi dimulai.

Produk yang dibangun adalah **Cravio — Your craving, Perfectly Matched** (sistem Smart QR Menu & kurasi preferensi rasa), dengan entitas kafe percontohan perdana adalah **SELA** (*Artisanal Coffee & Bake*).

Tujuan utama tahap ini adalah:
1. Menyusun pemetaan lokasi kanonis seluruh dokumen dan mengeliminasi risiko duplikasi file yang membingungkan.
2. Membedakan secara tegas antara rencana dokumen (*document plan*) dengan implementasi aktual (*actual code/state*).
3. Menganalisis dan mendokumentasikan resolusi atau status keterbukaan (`OPEN`) untuk 13 area diskrepansi/konflik kritis (nama produk Cravio & kafe SELA, kuis 3 langkah, formula rekomendasi, kitchen gate PAID-only, model state ganda, rute bertabrakan, batas catatan, dsb.).
4. Menghasilkan dua dokumen fondasi:
   - [`docs/spec-audit.md`](file:///d:/project/project-qr/cravio/docs/spec-audit.md): Laporan audit spesifikasi mendalam, resolusi konflik, dan koreksi infrastruktur 2026.
   - [`docs/requirements-traceability.md`](file:///d:/project/project-qr/cravio/docs/requirements-traceability.md): Matriks keterlacakan lengkap (Sumber + ID Asli + Judul $\rightarrow$ ID Kanonis $\rightarrow$ Komponen/API/Data $\rightarrow$ Acceptance Criteria $\rightarrow$ Bukti Uji/UAT).
5. Memperbarui [`docs/implementation-progress.md`](file:///d:/project/project-qr/cravio/docs/implementation-progress.md) untuk merefleksikan pencapaian Tahap 01.

---

## User Review Required

> [!IMPORTANT]
> **Keputusan Baseline Kritis yang Diterapkan pada Tahap Ini:**
> 1. **Identitas Nama Produk & Kafe Mitra:** Nama resmi produk/platform adalah **Cravio — Your craving, Perfectly Matched**. Entitas kafe operasional perdana (*single-tenant pilot*) adalah **SELA** (*Artisanal Coffee & Bake*). Nama varian lama (*Cravia, Kala Senja*) diselaraskan: produk disebut **Cravio**, dan kafe klien disebut **SELA**.
> 2. **Kuis Selera 3 Langkah:** Baseline resmi kuis pelanggan adalah **3 Langkah** (*Suasana $\rightarrow$ Karakter Rasa $\rightarrow$ Format & Suhu Penyajian*) dengan tombol *Lewati/Skip* di setiap langkah. Kategori menu (*Kopi, Non-Kopi, Makanan*) tetap berfungsi sebagai filter katalog di halaman menu, bukan langkah kuis yang berulang.
> 3. **Kitchen Gate Policy (`DEC-013`):** Layar KDS dapur **HANYA** menampilkan pesanan yang telah lunas (`paymentStatus == PAID`). Pesanan tunai tertahan di antrean kasir sampai uang fisik diterima dan dikonfirmasi kasir. Tidak ada proses memasak sebelum pembayaran terkonfirmasi.
> 4. **Pemisahan Model State:** Memisahkan secara tegas `OrderStatus` (`QUEUED`, `COOKING`, `READY`, `COMPLETED`, `CANCELLED`) dan `PaymentStatus` (`PENDING`, `WAITING_CASHIER`, `PAID`, `EXPIRED`, `FAILED`).
> 5. **Otoritas Harga di Server:** Seluruh kalkulasi harga, modifier, dan total dihitung di server dalam satuan integer Rupiah tanpa desimal.

> [!WARNING]
> **Status Duplikasi `design.md` vs `visual-direction.md`:**
> Berkas [`docs/visual-direction.md`](file:///d:/project/project-qr/cravio/docs/visual-direction.md) terbukti 100% identik dengan [`docs/design.md`](file:///d:/project/project-qr/cravio/docs/design.md) (keduanya berukuran 57.686 bytes). Untuk mencegah divergensi pemeliharaan ganda, [`docs/design.md`](file:///d:/project/project-qr/cravio/docs/design.md) ditetapkan sebagai **Acuan Visual Utama**, sementara [`docs/visual-direction.md`](file:///d:/project/project-qr/cravio/docs/visual-direction.md) akan diubah menjadi berkas penunjuk (*pointer*) resmi yang merujuk langsung ke `design.md`.

---

## Open Questions

> [!NOTE]
> Empat isu bisnis berikut tidak memiliki keputusan final dalam dokumen sumber dan ditandai sebagai status **`OPEN`** dengan usulan teknis dari Technical Lead:
> 
> 1. **Batas Waktu Toleransi Pembayaran Tunai di Kasir (`OPN-01`):**  
>    *Berapa lama pesanan tunai di kasir ditoleransi sebelum dibatalkan otomatis?*  
>    *Rekomendasi:* **20 menit**. Jika pelanggan tidak datang melunasi ke kasir dalam 20 menit, pesanan otomatis berstatus `EXPIRED / CANCELLED` untuk mencegah antrean kasir menggantung.
> 2. **Hak Ubah Stok Menu Habis (*Sold Out*) oleh Barista Dapur (`OPN-02`):**  
>    *Apakah barista dapur berhak menekan toggle Sold Out langsung dari layar KDS?*  
>    *Rekomendasi:* **Ya, diizinkan**. Tombol cepat toggle stok ditempatkan pada header KDS terproteksi PIN dapur agar responsivitas saat bahan habis seketika ter-update ke katalog pelanggan tanpa menunggu admin.
> 3. **Format Kredensial Login Admin vs Kasir/Dapur (`DEC-005` vs `techstack.md`):**  
>    *Apakah Admin menggunakan Username + Password terenkripsi atau PIN 4-6 digit?*  
>    *Rekomendasi:* **Admin menggunakan Username/Email + Password bcrypt**, sedangkan **Kasir dan Dapur menggunakan PIN cepat 4–6 digit**.
> 4. **Penetapan Harga Publik Penawaran B2B:**  
>    *Dokumen proposal menyebut nilai kontrak jasa kafe pertama Rp750.000, sedangkan landing page B2B menampilkan paket penawaran Rp2.500.000.*  
>    *Rekomendasi:* Bedakan secara eksplisit antara **biaya kontrak pengembangan kafe pertama (Rp750.000)** dan **harga paket penawaran komersial jasa B2B Cravio ke kafe lain (Rp2.500.000)**.

---

## Proposed Changes

Files grouped by area of responsibility:

### 1. Dokumentasi Audit & Penyelarasan Spesifikasi

#### [NEW] `docs/spec-audit.md`
Laporan audit komparatif komprehensif yang mencakup:
- **Inventarisasi Dokumen & Status Realitas:** Membedakan klaim proposal (Gantt `done`, status production ready) dari realitas kode saat ini (repositori kosong dari scaffolding aplikasi).
- **Pemetaan Lokasi Kanonis Berkas:** Menetapkan hierarki resmi penyimpanan dokumen acuan di root `docs/`.
- **Analisis Mendalam 13 Area Konflik:**
  1. Merek: Produk **Cravio — Your craving, Perfectly Matched** & Kafe Mitra **SELA** vs nama lama (*Cravia/Kala Senja*)
  2. Kuis: 3 langkah (Suasana $\rightarrow$ Rasa $\rightarrow$ Format) vs 4 langkah
  3. Rumus Rekomendasi: Penyelarasan rumus $W_{\text{cat}}=3, W_{\text{flav}}=2, W_{\text{mood}}=2, W_{\text{temp}}=2$ vs formula skill, serta aturan tie-break
  4. Kitchen Gate: KDS hanya menerima `PAID` (pesanan tunai tidak masuk dapur sebelum kasir konfirmasi)
  5. State Machine: Pemisahan `orderStatus` dan `paymentStatus`
  6. Rute: Disambiguasi `/` untuk landing page B2B Cravio dan `/order?table=XX` untuk pintu pelanggan meja SELA
  7. Autentikasi Staf: Password admin vs PIN cepat kasir/KDS
  8. Catatan Pelanggan: Batas 100 karakter
  9. Komersial: Kontrak Rp750rb vs Paket B2B Rp2,5jt
  10. Privasi QR Meja: Pemisahan nomor meja publik dan token sesi kriptografis `orderSecretToken`
  11. Deteksi Perubahan Harga: Validasi quote harga server saat checkout
  12. Koreksi Infrastruktur 2026: Vercel Hobby (non-komersial), Node.js LTS (v24), Supabase Backup Pro vs Free, penanganan latensi expiry QRIS Midtrans
  13. Jadwal Gantt: Pelurusan status aktual 0% kode aplikasi
- **Tabel Register Keputusan & Status:** `CONFIRMED` (`DEC-001` s/d `DEC-015`), `PROPOSED`, dan `OPEN`.

#### [NEW] `docs/requirements-traceability.md`
Matriks keterlacakan menyeluruh untuk 100% kebutuhan sistem:
- Menghubungkan setiap kebutuhan:
  $$\text{Sumber Dokumen} + \text{ID Asli} + \text{Judul} \longrightarrow \text{ID Kanonis} \longrightarrow \text{Layar/API/Entity Data} \longrightarrow \text{Acceptance Criteria} \longrightarrow \text{Skenario UAT}$$
- Pemetaan seluruh taksonomi kebutuhan:
  - Modul Pelanggan: `REQ-CUST-01` s/d `REQ-CUST-08`
  - Modul Pembayaran: `REQ-PAY-01` s/d `REQ-PAY-04`
  - Modul Operasional: `REQ-OPS-01` s/d `REQ-OPS-06`
  - Modul Admin: `REQ-ADMIN-01` s/d `REQ-ADMIN-07`
  - Modul B2B: `REQ-B2B-01` s/d `REQ-B2B-04`
  - Kebutuhan Nonfungsional: `REQ-NFR-01` s/d `REQ-NFR-08`
- Tabel rekonsiliasi alias ID kebutuhan yang bentrok antara `PRD.md` dan `design.md`.

---

### 2. Standarisasi Acuan Visual & Rencana Kerja

#### [MODIFY] `docs/visual-direction.md`
Mengubah duplikasi file 57KB menjadi berkas penunjuk resmi (*canonical pointer*) ke [`docs/design.md`](file:///d:/project/project-qr/cravio/docs/design.md), menjelaskan peran historisnya dan menjamin integritas desain terpusat.

#### [NEW] `plans/audit-and-baseline-specification-plan.md`
Salinan rencana kerja teknis yang disimpan di folder `plans/` sesuai instruksi pengguna.

#### [MODIFY] `docs/implementation-progress.md`
Memperbarui log pengerjaan:
- Mengubah status Tahap 01 menjadi `PASS`.
- Mencatat berkas baru yang dihasilkan (`docs/spec-audit.md`, `docs/requirements-traceability.md`).
- Mencatat temuan audit, status blocker, dan kesiapan melangkah ke Tahap 02 (ADR & Kontrak Arsitektur).

---

## Verification Plan

### Automated Checks
* **Validasi Lokasi Berkas:** Memeriksa keberadaan fisik seluruh berkas yang dibuat dan dimodifikasi via PowerShell:
  ```powershell
  Test-Path docs/spec-audit.md, docs/requirements-traceability.md, docs/visual-direction.md, plans/audit-and-baseline-specification-plan.md
  ```
* **Pemeriksaan Konsistensi Teks:** Memastikan tidak ada token rahasia, secret key dummy berformat live, atau token pesanan yang tersimpan di file dokumentasi:
  ```powershell
  Select-String -Path docs/*.md -Pattern "SB-Mid-server-[a-zA-Z0-9]+" -CaseSensitive
  ```

### Manual Verification
1. **Verifikasi Keterlacakan Matriks:** Memastikan setiap ID dari PRD (`REQ-CUST-01` s/d `REQ-B2B-03`), Desain (`REQ-CUST-01` s/d `REQ-OPS-06`), dan 17 skenario UAT memiliki padanan baris kanonis pada `docs/requirements-traceability.md`.
2. **Verifikasi Resolusi 13 Konflik:** Memeriksa bahwa setiap poin konflik pada `docs/spec-audit.md` memiliki status resolusi yang beralasan (`CONFIRMED`, `PROPOSED`, atau `OPEN`).
3. **Verifikasi Penunjuk Visual Direction:** Membuka `docs/visual-direction.md` dan memastikan link penunjuk mengarah tepat ke `docs/design.md`.
