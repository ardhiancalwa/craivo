---
name: access-control-review
description: >-
  Review, audit, and test role-based access control (RBAC), guest table isolation, orderSecretToken verification, realtime stream authentication, file upload security, and secret leak prevention. Use when securing API routes, adding staff authentication, or performing security audits.
---

# Prosedur Audit Kontrol Akses & Keamanan Sistem (access-control-review)

Skill ini memandu peninjauan hak akses berbasis peran (*Role-Based Access Control*), isolasi sesi tamu antar-meja, verifikasi token rahasia pesanan, autentikasi rute staf, sanitasi upload aset, dan pencegahan kebocoran kredensial rahasia.

---

## 1. Trigger (Kapan Skill Ini Digunakan)
Gunakan skill ini setiap kali Anda:
* Menambahkan atau memodifikasi endpoint API staf (`/api/admin/*`, `/api/kitchen/*`, `/api/pos/*`).
* Meninjau atau mengonfigurasi Next.js Middleware autentikasi session/JWT.
* Memverifikasi perlindungan privasi pelacak pesanan pelanggan meja.
* Menangani upload foto produk menu di panel admin.
* Melakukan audit keamanan sebelum rilis atau serah terima sistem.

---

## 2. Invarian Keamanan Mutlak
1. **Server-Enforced Roles:** Pemeriksaan hak akses staf wajib diverifikasi di sisi server via session/JWT HTTP-only cookie. Tidak boleh mengandalkan role switcher atau manipulasi state frontend!
2. **Isolasi Meja Publik (`DEC-014`):** Kode QR meja fisik bersifat publik. Riwayat pesanan dan status pelacakan wajib dilindungi oleh `orderSecretToken` kriptografis di peramban pemesan. Pelanggan baru yang memindai meja tidak boleh melihat pesanan orang lain.
3. **Zero Secrets Leak:** `MIDTRANS_SERVER_KEY`, `JWT_SECRET`, dan connection string database tidak boleh bocor ke client bundle, git commit, atau log publik.

---

## 3. Input & Prasyarat

### Input
* Middleware Next.js (`src/middleware.ts`).
* Route handlers API staf dan pelanggan.
* Konfigurasi environment variables (`.env.example`).

### Dokumen Rujukan Wajib
* [architecture.md](../../../architecture.md) — Seksi 11 (Arsitektur Keamanan, Trust Boundaries, & Mitigasi Risiko).
* [agent.md](../../../agent.md) — Seksi 6 (Invarian Keamanan) & Seksi 10 (Strategi Pengujian Risiko).
* [techstack.md](../../../techstack.md) — Seksi 6 (Matriks Autentikasi Staf).

---

## 4. Langkah Kerja Berurutan

### Langkah 1: Audit Proteksi Rute Staf (Middleware & Handlers)
1. Periksa `src/middleware.ts`:
   * Seluruh rute yang diawali `/admin`, `/pos`, `/kitchen` wajib memeriksa cookie session JWT yang valid.
   * Jika tidak ada cookie atau token kedaluwarsa, arahkan peramban ke `/login`.
2. Periksa otorisasi spesifik peran (*Role Authorization*):
   * `KITCHEN`: Hanya diizinkan mengakses `/kitchen` dan endpoint transisi status KDS.
   * `CASHIER`: Hanya diizinkan mengakses `/pos`, antrean tunai, reprint, dan pembatalan pesanan.
   * `ADMIN`: Memiliki hak akses menyeluruh ke seluruh modul manajemen kafe.

### Langkah 2: Audit Privasi Pelacak Pesanan Tamu Meja (`orderSecretToken`)
1. Periksa endpoint `GET /api/orders/[id]`:
   * Wajib menerima header `x-order-secret-token` atau cookie terenkripsi yang sesuai.
   * Server mencocokkan token dengan kolom `secretToken` di tabel `ORDER`.
   * Jika token tidak cocok dan user bukan staf terautentikasi, **kembalikan respons `404 Not Found` atau `403 Forbidden`**.
   * Jangan pernah mengembalikan detail tagihan hanya berdasarkan nomor meja publik!

### Langkah 3: Audit Keamanan Upload Foto Menu
1. Periksa handler upload gambar di panel admin:
   * **Validasi MIME Type:** Hanya izinkan `image/jpeg`, `image/png`, dan `image/webp`.
   * **Validasi Ukuran File:** Batasi maksimal 2 MB per berkas.
   * **Sanitasi Nama Berkas:** Gunakan penamaan acak berbasis UUID (contoh: `menu-7f8b9a2c.webp`), hindari menggunakan nama file asli pengguna untuk mencegah serangan *path traversal*.

### Langkah 4: Audit Pencegahan Kebocoran Kredensial (Secret Hygiene)
1. Periksa berkas `.env.example`:
   * Pastikan hanya berisi dummy template tanpa nilai rahasia produksi.
2. Periksa prefix variabel:
   * Variabel rahasia (`MIDTRANS_SERVER_KEY`, `JWT_SECRET`, `DATABASE_URL`) **DILARANG MENGGUNAKAN PREFIX `NEXT_PUBLIC_`**.
   * Hanya variabel publik aman seperti `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` yang boleh di-expose ke browser.

---

## 5. Validasi & Pengujian Keamanan

### Checklist Pengujian Keamanan (Security Audit Checklist)
- [ ] Coba akses `http://localhost:3000/admin` pada peramban mode incognito tanpa login: wajib dialihkan ke `/login`.
- [ ] Coba kirim `GET /api/orders/order-123` tanpa header `x-order-secret-token`: wajib ditolak dengan status 403 atau 404.
- [ ] Coba login dengan akun staf ber-role `KITCHEN`, lalu akses `/admin/settings`: wajib ditolak dengan status 403 Forbidden.
- [ ] Jalankan pencarian regex pada direktori `src/` untuk memastikan tidak ada string rahasia ter-hardcode:
  ```powershell
  Select-String -Path "src/**/*" -Pattern "SB-Mid-server-", "postgres://"
  ```

---

## 6. Tindakan Bila Menemui Hambatan
* Jika ditemukan celah keamanan di mana token pelacak pesanan bocor di URL publik, segera lakukan refactoring agar token disimpan murni di `localStorage` peramban pemesan.
* Jangan pernah melemahkan proteksi rute middleware hanya untuk mempermudah demonstrasi visual. Keamanan produksi adalah aturan mutlak.
