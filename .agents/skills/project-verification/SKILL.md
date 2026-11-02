---
name: project-verification
description: >-
  Execute actual verification checks, TypeScript typecheck, ESLint, Vitest suites, and manual UAT scenarios for SELA Smart QR Menu. Use before declaring a task complete, after major feature implementation, or when preparing milestone reports with concrete proof and limitation boundaries.
---

# Prosedur Verifikasi Proyek & Skenario UAT (project-verification)

Skill ini memandu pelaksanaan pemeriksaan kualitas kode aktual, type checking TypeScript, linter, test runner, verifikasi skenario UAT manual, dan penyusunan laporan bukti selaras dengan *Definition of Done*.

---

## 1. Trigger (Kapan Skill Ini Digunakan)
Gunakan skill ini setiap kali Anda:
* Hendak menyatakan suatu tugas atau tiket fitur telah selesai (*Definition of Done*).
* Menyelesaikan implementasi modul besar sebelum diserahkan untuk pengujian pengguna.
* Menjalankan regresi pengujian setelah refactoring atau perubahan skema database.
* Menyiapkan laporan kemajuan berkala yang menyertakan bukti log aktual dan batasan yang belum diuji secara fisik.

---

## 2. Invarian Kejujuran Pengujian (Test Integrity)
> [!IMPORTANT] Larangan Mengarang Bukti Uji Faktual
> * **Dilarang membuat script, perintah, atau hasil uji palsu.**
> * Jika aplikasi belum di-scaffold pada saat skill ini dijalankan, tuliskan prasyarat tersebut secara transparan dan gunakan checklist inspeksi statis sampai script nyata tersedia.
> * Jangan pernah mengklaim integrasi printer fisik atau suara audio telah lulus 100% tanpa pengujian langsung pada perangkat keras nyata.

---

## 3. Input & Prasyarat

### Prasyarat Tooling
* Node.js 20 LTS terpasang.
* Lingkungan terminal Windows PowerShell.
* Status Scaffolding:
  * **Fase Pra-Scaffolding:** Lakukan inspeksi statis berkas, integritas relasi tipe TypeScript, dan keselarasan dokumentasi.
  * **Fase Pasca-Scaffolding:** Jalankan perintah eksekusi otomatis (`tsc`, `lint`, `vitest`).

### Dokumen Rujukan Wajib
* [agent.md](../../../agent.md) — Seksi 9 (Tooling & Perintah Operasional), Seksi 10 (Strategi Uji Risiko), Seksi 13 (DoD & Pelaporan).
* [design.md](../../../design.md) — Seksi 12 (Daftar Uji Visual & Interaksi UAT).
* [docs/project-context.md](../../../docs/project-context.md) — Register Keputusan `DEC-001` s/d `DEC-015`.

---

## 4. Langkah Kerja Berurutan

### Langkah 1: Evaluasi Kesiapan Lingkungan Eksekusi
Periksa apakah berkas `package.json` telah memuat script standar Next.js:
```powershell
Get-Content package.json
```
* Jika script `dev`, `build`, `lint`, `test` **belum tersedia**:
  * Tuliskan status: `"Aplikasi produksi belum di-scaffold — verifikasi otomatis ditunda hingga tahap inisialisasi Hari 1"`.
  * Lanjutkan verifikasi menggunakan checklist inspeksi statis di Langkah 3.
* Jika script **sudah tersedia**:
  * Jalankan langkah eksekusi otomatis di Langkah 2.

### Langkah 2: Eksekusi Pemeriksaan Otomatis (Jika Tool Tersedia)
Jalankan perintah PowerShell berikut secara berurutan dan catat outputnya:
```powershell
# 1. Type Safety TypeScript
npx tsc --noEmit

# 2. Linter ESLint
pnpm run lint

# 3. Test Suites Vitest
pnpm run test

# 4. Verifikasi Build Produksi
pnpm run build
```

### Langkah 3: Eksekusi 5 Skenario UAT Utama

#### Skenario 1: Alur Pemesanan Tamu & Kuis Selera
* Buka `/menu?table=07`. Pastikan nomor meja terdeteksi di header.
* Klik "Kurasi 30 Detik", jawab 3 pertanyaan kuis atau klik "Lewati".
* Pastikan menu rekomendasi muncul dengan alasan berbasis tag dan disclaimer alergi.
* Pilih menu, sesuaikan modifier (sugar/ice), dan klik "Tambah ke Pesanan".
* Pastikan floating order tray muncul di bawah dengan nominal tabular yang tepat.

#### Skenario 2: Alur Pembayaran QRIS Dinamis (Sandbox)
* Lanjut ke `/cart` $\rightarrow$ pilih metode pembayaran QRIS $\rightarrow$ klik Bayar.
* Pastikan timer countdown 15:00 menit berjalan mundur.
* Simulasikan pembayaran sukses via Midtrans Simulator.
* Pastikan webhook diterima, status berubah menjadi `PAID`, lonceng KDS berbunyi, dan halaman dialihkan ke pelacak pesanan.

#### Skenario 3: Alur Pembayaran Tunai di Kasir
* Checkout dengan opsi "Bayar Tunai di Kasir".
* Pastikan pesanan **TIDAK MUNCUL** di layar KDS Dapur (Kitchen Gate terjaga).
* Buka `/pos` $\rightarrow$ tab Antrean Tunai $\rightarrow$ klik "Konfirmasi Uang Masuk".
* Pastikan pesanan seketika mengalir ke KDS Dapur diiringi alert suara.

#### Skenario 4: Penanganan Kedaluwarsa QRIS 15 Menit
* Buka sesi pembayaran QRIS. Biarkan timer mencapai `00:00` atau kirim webhook status `expire`.
* Pastikan QR code digelapkan dengan overlay gembok dan pesanan tidak masuk ke antrean KDS Dapur.

#### Skenario 5: Quick Toggle Stok Sold Out di Admin
* Buka `/admin/menu`, matikan sakelar stok salah satu menu favorit.
* Buka katalog pelanggan di peramban lain: menu tersebut seketika turun ke opasitas 45%, foto berfilter grayscale, badge `Habis` aktif, dan tombol add terkunci.

---

## 5. Standar Pelaporan Hasil & Batasan

Setiap kali menyelesaikan sesi verifikasi, sampaikan laporan terstruktur dalam Bahasa Indonesia:
1. **Pemeriksaan yang Dijalankan:** Perintah terminal aktual yang dieksekusi beserta kode exit (`code 0`).
2. **Skenario UAT yang Diverifikasi:** Daftar skenario yang berhasil diuji.
3. **Batasan yang Belum Diuji (Limitations):**
   * *Contoh:* "Pencetakan fisik struk thermal belum diuji pada printer kertas asli karena ketiadaan perangkat keras di lingkungan lokal; baru diverifikasi via print preview browser."
   * *Contoh:* "Kredensial Midtrans masih menggunakan sandbox simulator; verifikasi merchant live menunggu KYC kafe."
4. **Status Definition of Done:** Konfirmasi pemenuhan kriteria selesai tanpa rahasia yang bocor.
