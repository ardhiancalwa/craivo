---
name: smart-menu-ui
description: >-
  Implement or revise user interface screens, components, and responsive layouts for SELA Smart QR Menu based on design.md and design-preview. Use when building or styling customer, cashier, KDS, admin, or B2B landing pages, adjusting mobile/desktop viewports, or refining interaction states (default, loading, error, sold out).
---

# Prosedur Implementasi Antarmuka UI (smart-menu-ui)

Skill ini memandu implementasi dan revisi komponen antarmuka pengguna pada proyek SELA Smart QR Menu agar selalu konsisten dengan sistem desain resmi pada [design.md](../../../design.md).

---

## 1. Trigger (Kapan Skill Ini Digunakan)
Gunakan skill ini setiap kali Anda:
* Membuat atau mengubah halaman rute antarmuka (`(customer)`, `(staff)`, atau `(b2b)`).
* Mengimplementasikan komponen UI baru (kartu menu, drawer modifier, floating order tray, kartu KDS, dll.).
* Menyesuaikan responsivitas tampilan untuk mobile ($360\text{ px} - 430\text{ px}$), tablet ($768\text{ px} - 1024\text{ px}$), atau desktop ($1280\text{ px}+$).
* Menangani variasi status visual (*loading skeleton, active tap, disabled, sold-out, error*).

---

## 2. Input & Prasyarat

### Prasyarat
* **Status Aplikasi:** Next.js 15 App Router dan Tailwind CSS telah di-scaffold.
  * *Jika aplikasi belum di-scaffold:* Buat struktur komponen sebagai modul terisolasi atau file komponen React TypeScript standar di `src/components/`, mengacu pada checklist prasyarat di [agent.md](../../../agent.md).
* **Isolasi Prototipe:** Jangan mengimpor berkas dari `design-preview/`. Prototipe tersebut adalah simulator visual terpisah.

### Dokumen Rujukan Wajib
* [design.md](../../../design.md) — Panduan desain visual lengkap (Token warna, tipografi, komponen, sitemap, microcopy).
* [architecture.md](../../../architecture.md) — Pemisahan rute publik vs staf dan kontrak API.
* [design-preview/DESIGN.md](../../../design-preview/DESIGN.md) & [design-preview/contentporary-cafe.html](../../../design-preview/contentporary-cafe.html) — Referensi visual layout Meja 07, in-cart stepper, dan floating tray.

---

## 3. Langkah Kerja Berurutan

### Langkah 1: Identifikasi Layar & Komponen Target
Tentukan ID layar dari [design.md](../../../design.md) (Seksi 6):
* `SCR-CUST-01` s/d `09`: Katalog pelanggan, kuis, modifier, checkout, bayar, tracking.
* `SCR-POS-01` & `02`: Dashboard kasir, antrean tunai, modal cetak struk.
* `SCR-KDS-01`: Display antrean dapur & lonceng pesanan.
* `SCR-ADM-01` s/d `05`: Login staf, katalog menu, sakelar stok, generator QR meja.
* `SCR-B2B-01`: Landing page pemasaran & kalkulator paket.

### Langkah 2: Tentukan Batas Server vs Client Component
* Gunakan **Server Component** (default) untuk layout, static header, dan fetching data awal.
* Tambahkan direktif `"use client"` **hanya** jika komponen membutuhkan:
  * State interaktif (`useState`, `useReducer`).
  * Event handler peramban (`onClick`, `onChange`, `onSubmit`).
  * Web API peramban (`localStorage`, Web Audio API, `window.print`).

### Langkah 3: Terapkan Token Warna & Tipografi SELA
Gunakan utility class Tailwind CSS yang telah dipetakan ke token SELA:
* Kanvas Latar: `bg-surface` (`#FBF9F5`)
* Kartu & Permukaan: `bg-surface-container-lowest` (`#FFFFFF`) dengan border `border-outline-variant` (`#E7E2DA`)
* Teks Utama: `text-on-surface` (`#1B1C1A`)
* Teks Sekunder: `text-on-surface-variant` (`#544339`)
* Aksen Terakota: `text-primary` / `bg-primary` (`#924805`)
* Floating Tray / Stepper: `bg-inverse-surface` (`#241E1B`) teks `text-inverse-on-surface` (`#FBF9F5`)
* Status Sukses: `text-status-paid` (`#1E7E34`)
* Status Proses: `text-status-cooking` (`#D97706`)
* Status Batal / Sold Out: `text-status-error` (`#BA1A1A`)
* Angka Harga & Timer: Wajib menyertakan `tabular-nums` atau `font-price-tabular` (`Inter` semibold).

### Langkah 4: Bangun Seluruh Variasi Status (States)
1. **Default:** Tampilan bersih, kontras tajam.
2. **Hover / Active:** Efek tekan fisik ringan (`active:scale-95 transition-transform duration-120`).
3. **Loading:** Skeleton placeholder beranimasi shimmer lembut (`animate-pulse bg-surface-container`), dilarang membiarkan layar kosong tanpa feedback.
4. **Disabled / Sold Out:** Kartu menu turun ke opasitas $45\%$, foto diberi `filter: grayscale(80%)`, badge abu-abu `Habis`, tombol add dinonaktifkan (`disabled`).
5. **Error:** Pesan kesalahan ramah dalam Bahasa Indonesia dengan border merah lembut `#BA1A1A`.

### Langkah 5: Terapkan Standar Aksesibilitas & Ergonomi Sentuh
* **Target Sentuh:** Minimal $44 \times 44\text{ px}$ untuk seluruh tombol interaktif mobile.
* **Tombol KDS Dapur:** Tinggi tombol minimal $\ge 56\text{ px}$ agar ramah sentuhan tangan barista yang sibuk.
* **Dual Encoding:** Status pesanan tidak boleh hanya dibedakan warna; wajib sertakan ikon + label teks.
* **Focus Ring:** Sertakan `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
* **Reduced Motion:** Hormati `@media (prefers-reduced-motion: reduce)`.

---

## 4. Validasi & Pengujian

### Pemeriksaan Mandiri (Self-Check Checklist)
- [ ] Viewport mobile 390px (baseline iPhone) menampilkan grid 2-kolom tanpa overflow horizontal.
- [ ] Floating order tray memiliki padding aman iOS `pb-safe` (`env(safe-area-inset-bottom)`).
- [ ] Angka harga tertulis rapi dalam format rupiah: `Rp28.000` (tanpa sen desimal, tabular numerals sejajar).
- [ ] Microcopy menggunakan Bahasa Indonesia yang santun sesuai panduan di [design.md](../../../design.md).
- [ ] Rekomendasi memuat disclaimer alergi bahan pangan.
- [ ] Jika tool testing tersedia: jalankan `pnpm run lint` dan verifikasi bahwa tidak ada error styling atau JSX unescaped entities.

---

## 5. Tindakan Bila Menemui Hambatan
* Jika terdapat kontradiksi tata letak antara prototipe `design-preview/` dengan `design.md`, **ikuti panduan `design.md`** sebagai single source of truth arsitektur resmi.
* Jika membutuhkan penambahan warna atau ikon di luar palet SELA, konsultasikan ke pengguna terlebih dahulu; jangan mengarang token warna baru di luar sistem desain.
