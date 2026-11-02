# PROJECT CONTEXT & DECISION REGISTER
## Smart QR Menu & Sistem Rekomendasi Preferensi Konsumen

> **Lokasi Berkas:** `docs/project-context.md`  
> **Status:** Sinkronisasi Tahap Arsitektur & Tech Stack Produksi  
> **Terakhir Diperbarui:** 2026-10-27  
> **Dokumen Rujukan:** `Proposal Pengembangan Website Smart QR Menu.docx`, `docs/AGENT.md`, `PRD.md`, `docs/DESIGN.md`, dan `techstack.md`  

---

### 1. Ringkasan Status Proyek
Proyek Smart QR Menu saat ini telah menyelesaikan tahap:
1. Pembacaan sumber & penetapan kebutuhan dasar (`docs/AGENT.md`).
2. Perumusan Product Requirements Document lengkap (`PRD.md`).
3. Eksplorasi prototipe visual interaktif & penetapan arah desain SELA (`design-preview/DESIGN.md`, `design-preview/contentporary-cafe.html`).
4. Penetapan arsitektur teknologi produksi (`techstack.md`).

---

### 2. Register Keputusan Arsitektur & Produk (Decision Log)

| ID Keputusan | Judul Keputusan | Status | Pilihan yang Disepakati | Rujukan Dokumen |
|---|---|:---:|---|---|
| `DEC-001` | Identitas & Data Menu Kafe Awal | DIKONFIRMASI | Nama resmi merek kafe: **"SELA" (SELA Smart QR Menu)**. Data menu mengacu pada kurasi kopi, teh, dan kudapan kafe SELA. | `design-preview/DESIGN.md`, `AGENT.md` |
| `DEC-002` | Kategori & Hirarki Katalog Menu | DIKONFIRMASI | Kategori utama: Semua, Kopi, Non-Kopi, Makanan. | `design-preview/DESIGN.md` |
| `DEC-003` | Tata Letak & Sistem Desain Katalog | DIKONFIRMASI | **SELA Minimalist Artisanal Design System** (Warm Canvas `#FBF9F5`, Primary Accent `#924805`, Charcoal `#241E1B`, Plus Jakarta Sans + Inter). Grid 2 kolom, in-cart stepper `- 1 +`, sticky bottom tray, dan bottom nav 4 tab (Menu, Kurasi, Pesanan, Bantuan). | `design-preview/contentporary-cafe.html`, `design-preview/DESIGN.md` |
| `DEC-004` | Alur Kuis & Rekomendasi | DIKONFIRMASI | Kuis Kurasi 3 Langkah (Suasana, Rasa, Format) dengan opsi "Lewati" di header dan layar hasil kurasi dinamis (`result-recommendation.html`). | `design-preview/kuesioner-1.html`, `result-recommendation.html` |
| `DEC-005` | Mekanisme Custom Modifier | DIKONFIRMASI | Bottom sheet modal dengan pilihan radio (gula, es) dan checkbox add-on berbayar. | `AGENT.md`, `PRD.md` |
| `DEC-006` | Pajak & Service Charge | DIKONFIRMASI | 0% (Harga Netto/Final) pada baseline v1. | `AGENT.md`, `PRD.md` |
| `DEC-007` | Alur Verifikasi Pembayaran | DIKONFIRMASI | Verifikasi 100% otomatis via Payment Gateway (QRIS dinamis 15 menit). Tanpa upload bukti transfer manual. | `AGENT.md`, `PRD.md`, `architecture.md` |
| `DEC-008` | Cakupan Biaya Domain & Hosting | DIKONFIRMASI | Domain & Cloud Hosting tahun pertama ditanggung tim pengembang; hardware & MDR ditanggung kafe. | `AGENT.md`, `PRD.md` |
| `DEC-009` | Skema Parameter & Engine Kuis | DIKONFIRMASI | Weighted Tag Matching deterministik (non-AI/LLM) terkonfigurasi dinamis dari database. | `AGENT.md`, `PRD.md` |
| `DEC-010` | **Arsitektur Aplikasi & Runtime** | **DIKONFIRMASI** | **Fullstack Modular Monolith Next.js 15 (App Router, TypeScript) + PostgreSQL (Prisma ORM)**. Menghilangkan kompleksitas microservices dan dual-repo. | `techstack.md` |
| `DEC-011` | **Penyedia Payment Gateway** | **DIKONFIRMASI** | **Midtrans Core API (Charge QRIS)**. Menggunakan sandbox simulator untuk sprint 7 hari; akun produksi menyusul saat data merchant diserahkan. | `techstack.md` |
| `DEC-012` | **Strategi Real-time & Cetak Thermal** | **DIKONFIRMASI** | **Server-Sent Events (SSE) / Supabase Realtime** untuk KDS; **CSS `@media print` 58/80 mm** via dialog browser sebagai baseline universal (tanpa janji silent print tanpa uji fisik). | `techstack.md` |
| `DEC-013` | **Kitchen Gate Policy Pesanan** | **DIKONFIRMASI** | **Setelah order, pelanggan langsung bayar**. Dapur HANYA memproses pesanan setelah pembayaran lunas (`PAID`). Tidak ada proses masak sebelum uang masuk. | `architecture.md` |
| `DEC-014` | **Pemisahan Token Rahasia Pesanan dari QR Meja** | **DIKONFIRMASI** | Menggunakan `orderSecretToken` acak kriptografis untuk akses pelacak pesanan; scan QR meja publik tidak membocorkan pesanan pelanggan sebelumnya. | `architecture.md` |
| `DEC-015` | **Batas Waktu Kedaluwarsa Transaksi** | **DIKONFIRMASI** | **Batas kedaluwarsa mutlak 15 menit dari Payment Gateway**. Tanpa bukti bayar manual; jika transaksi kedaluwarsa, pesanan batal dan tidak diproses. | `architecture.md` |

---

### 3. Asumsi Sementara yang Terdampak & Diperbarui

1. **Infrastruktur Hosting & Database:**
   * *Sebelumnya:* Mengasumsikan opsi sewa VPS mandiri atau PaaS.
   * *Diperbarui (`DEC-010`):* Ditetapkan menggunakan **Vercel Hobby Tier + Supabase/Neon Free Tier PostgreSQL** untuk efisiensi biaya Rp 0 pada fase awal, dengan kemampuan migrasi fleksibel ke VPS Docker (Coolify) jika kuota terlampaui.
2. **Ketergantungan Pembayaran Digital:**
   * *Sebelumnya:* Membuka opsi Midtrans atau Xendit secara setara.
   * *Diperbarui (`DEC-011`):* Ditetapkan **Midtrans Core API** sebagai jalur utama berkat kemudahan pendaftaran merchant perorangan dan ketersediaan simulator QRIS interaktif publik untuk pengujian sprint 7 hari.
3. **Pencetakan Thermal:**
   * *Sebelumnya:* Mengasumsikan dukungan universal printer 58/80 mm.
   * *Diperbarui (`DEC-012`):* Ditegaskan bahwa baseline garansi teknis adalah layout cetak presisi CSS `@media print` melalui dialog print sistem operasi. Integrasi Web Bluetooth ESC/POS bersifat *progressive enhancement* opsional dan tidak menjamin *silent print* otomatis pada semua perangkat keras fisik tanpa pengujian langsung.

---

### 4. Ketergantungan Eksternal Terbuka (Pending External Dependencies)
1. **KTP & Buku Tabungan Kafe:** Diperlukan untuk pengajuan KYC Midtrans Production.
2. **Pilihan Nama Domain Kafe:** Diperlukan saat pendaftaran nama domain resmi.
3. **Model & Merk Printer Fisik Kafe:** Diperlukan saat sesi serah terima Hari ke-7 di lokasi kafe.
