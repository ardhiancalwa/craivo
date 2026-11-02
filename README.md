# Cravio — Your craving, Perfectly Matched
> **Pilot Kafe Perdana:** SELA Artisanal Coffee & Bake  
> **Arsitektur:** Fullstack Modular Monolith (Next.js 15 App Router, TypeScript strict, Tailwind CSS v3.4, Prisma ORM, PostgreSQL)

---

## 1. Ringkasan Sistem
Cravio adalah platform Smart QR Menu dan manajemen operasional kafe yang mengintegrasikan pemesanan mandiri tamu meja, kurasi selera deterministik 3-langkah (Suasana $\rightarrow$ Rasa $\rightarrow$ Format), pembayaran QRIS dinamis & tunai terverifikasi, Kitchen Display System (KDS) *PAID-only*, dan Point of Sale (POS) kasir dalam satu basis kode modular.

---

## 2. Prasyarat Sistem & Lingkungan
* **Sistem Operasi:** Windows (PowerShell) / Linux / macOS
* **Node.js:** v20.9.0+ LTS (atau v22/v24)
* **Package Manager:** `pnpm` (v9.0.0+ / v11.13+)
* **Database:** PostgreSQL (Supabase / Neon via Supavisor pooler untuk Vercel Serverless)

---

## 3. Panduan Setup Lokal (Windows PowerShell)

### Langkah 1: Kloning & Buka Direktori
Buka terminal Windows PowerShell:
```powershell
Set-Location -Path "d:\project\project-qr\cravio"
```
*Catatan:* Jika eksekusi skrip PowerShell dibatasi oleh kebijakan Windows, jalankan sesi dengan bypass execution policy:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Langkah 2: Salin Variabel Lingkungan
Salin template konfigurasi `.env.example` ke `.env.local`:
```powershell
Copy-Item .env.example .env.local
```
Sesuaikan nilai `DATABASE_URL`, `JWT_SECRET`, dan kredensial Midtrans Sandbox pada `.env.local`.

### Langkah 3: Pasang Dependensi
```powershell
pnpm install
```
*Catatan Khusus pnpm v11+ di Windows:*
Jika pnpm menampilkan konfirmasi persetujuan build script pihak ketiga, jalankan:
```powershell
pnpm approve-builds --all
```

### Langkah 4: Generate Prisma Client Lokal
Buat definisi tipe Prisma Client secara lokal (tanpa perlu koneksi langsung ke database produksi):
```powershell
pnpm run db:generate
```

### Langkah 5: Jalankan Server Pengembangan
```powershell
pnpm run dev
```
Aplikasi akan berjalan pada `http://localhost:3000`.

---

## 4. Daftar Perintah & Skrip Operasional

| Skrip | Perintah | Fungsi / Keterangan |
| :--- | :--- | :--- |
| `pnpm run dev` | `next dev` | Menjalankan local development server Next.js pada port 3000 |
| `pnpm run build` | `next build` | Melakukan kompilasi dan build produksi Next.js App Router |
| `pnpm run start` | `next start` | Menjalankan build produksi pada lingkungan hosting |
| `pnpm run lint` | `next lint` | Memeriksa kualitas kode statis melalui ESLint Flat Config |
| `pnpm run typecheck` | `tsc --noEmit` | Validasi tipe TypeScript strict penuh |
| `pnpm run test` | `vitest run` | Menjalankan unit test suites Vitest |
| `pnpm run test:watch` | `vitest` | Menjalankan pengujian interaktif dalam mode watch |
| `pnpm run test:integration` | Placeholder | Uji integrasi database (ditambahkan pada milestone API) |
| `pnpm run test:e2e` | Placeholder | Uji E2E Playwright (ditambahkan pada milestone pengujian end-to-end) |
| `pnpm run db:generate` | `prisma generate` | Menghasilkan type-safe Prisma Client secara lokal |
| `pnpm run db:migrate:dev` | `prisma migrate dev` | Menjalankan migrasi database di lingkungan pengembangan lokal |
| `pnpm run db:migrate:deploy`| `prisma migrate deploy` | Menjalankan migrasi skema database di lingkungan staging/produksi |
| `pnpm run db:seed` | `tsx prisma/seed.ts` | Mengisi data master awal SELA (meja, menu, kategori, staf default) |

---

## 5. Batas Arsitektur & Keamanan (`server-only`)
1. **Perlindungan Kredensial Server:** Seluruh modul yang mengakses database (`prisma`), pembuatan/verifikasi token JWT (`jose`), dan gateway pembayaran (`midtrans`) dilindungi dengan deklarasi impor:
   ```typescript
   import 'server-only'
   ```
   Jika modul rahasia diimpor ke Client Component (`'use client'`), compiler Next.js akan langsung menggagalkan proses build secara fatal (*build-time fail-safe*).
2. **Isolasi Variabel Lingkungan:** Variabel privat tanpa prefix `NEXT_PUBLIC_` tidak pernah dikompilasi ke browser bundle.
3. **Kitchen Gate (DEC-013):** KDS Dapur hanya menampilkan pesanan dengan status `PaymentStatus = PAID`. Pesanan tunai tertahan di antrean kasir POS hingga uang diverifikasi.
4. **Proteksi Akses Meja (DEC-005):** Pemesanan publik melalui QR code meja wajib diverifikasi dengan token pesanan (`orderSecretToken`) atau hak akses staf berwenang.

---

## 6. Prosedur Verifikasi Kualitas Kode
Sebelum membuat pull request atau menandai tiket selesai:
```powershell
# 1. Validasi Tipe Statis
pnpm run typecheck

# 2. Analisis Linter
pnpm run lint

# 3. Eksekusi Unit Test
pnpm run test

# 4. Verifikasi Build Produksi
pnpm run build
```

---

## 7. Struktur Navigasi Kanonis (Route Map)
* `/` — Landing Page B2B Cravio
* `/order?table=XX` — Resolusi QR code meja tamu
* `/menu?table=XX` — Katalog menu digital SELA
* `/quiz?table=XX` — Kuis kurasi selera 3-langkah
* `/cart?table=XX` — Keranjang & opsi checkout (QRIS / Tunai)
* `/order/[id]/pay` — Instruksi pembayaran QRIS dinamis (countdown 15 menit)
* `/order/[id]/track` — Pelacak status pesanan realtime
* `/order/[id]/receipt` — E-receipt & cetak struk thermal 58/80 mm
* `/login` — Portal login autentikasi staf (PIN / Password)
* `/staff/pos` — Layar kasir (konfirmasi bayar tunai & POS)
* `/staff/kds` — Kitchen Display System dapur (PAID-only live queue)
* `/staff/admin` — Panel administrasi kafe (quick toggle stok sold-out & menu)

