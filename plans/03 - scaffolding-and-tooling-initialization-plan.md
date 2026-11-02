# Plan: Inisialisasi Scaffolding Aplikasi & Tooling (Tahap 03)

## 1. Ringkasan & Tujuan
Rencana kerja ini menyusun inisialisasi arsitektur dasar (*scaffolding*) aplikasi web fullstack **Cravio** (dengan pilot kafe **SELA Artisanal Coffee & Bake**) berdasarkan 7 ADR dan Baseline Kontrak yang telah disetujui pada Tahap 01 dan Tahap 02.

Scaffolding ini dilakukan secara aman (*non-destructive*) tanpa menghapus berkas pengguna (`proposal/`, `.agents/`, `design-preview/`, `docs/`, `plans/`), menerapkan konfigurasi Next.js 15 App Router, TypeScript `strict: true`, Tailwind CSS v3.4, Prisma ORM 6.x, Zod 3.24, `jose` 5.x untuk JWT auth, batas arsitektur `server-only`, suite pengujian Vitest, GitHub Actions CI dasar, dan panduan Windows PowerShell.

---

## 2. Inventarisasi Berkas Pra-Scaffold & Strategi Keamanan
Berdasarkan verifikasi lingkungan:
1. Direktori induk `d:\project\project-qr\proposal` berisi dokumen proposal `.docx` (`Proposal Pengembangan Website Smart QR Menu.docx`). Berkas ini **tidak boleh disentuh atau ditimpa**.
2. Direktori `d:\project\project-qr\cravio` saat ini berisi folder `.agents/`, `design-preview/`, `docs/`, dan `plans/`. Belum ada `package.json` atau lockfile.
3. Menjalankan `pnpm create next-app .` secara langsung pada folder yang tidak kosong berisiko memicu konflik atau menimpa folder yang ada.
4. **Strategi Aman:** Membentuk berkas konfigurasi (`package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next.config.ts`, `vitest.config.ts`) secara langsung (*declarative composition*) dengan versi tersemat (*pinned versions*), kemudian menjalankan `pnpm install` dengan `BypassSandbox: true` sesuai aturan Windows Sandbox.

---

## 3. Matriks Dependensi & Pinned Versions

### Dependencies (Produksi)
| Paket | Versi | Peran / Kebutuhan |
| :--- | :--- | :--- |
| `next` | `15.1.7` | Framework fullstack App Router (ADR-0001, ADR-0003) |
| `react` | `^19.0.0` | Library UI inti Next.js 15 |
| `react-dom` | `^19.0.0` | Renderer DOM React 19 |
| `@prisma/client` | `^6.4.1` | Type-safe ORM Client untuk PostgreSQL (ADR-0001) |
| `zod` | `^3.24.2` | Validasi skema runtime API & contracts (ADR-0005, api-contracts.md) |
| `jose` | `^5.9.6` | JSON Web Token runtime universal untuk auth staf (ADR-0002) |
| `server-only` | `^0.0.1` | Penjaga batas client-server saat build time |
| `lucide-react` | `^0.475.0` | Set ikon SVG untuk UI katalog, KDS, POS, dan Admin |
| `clsx` | `^2.1.1` | Utilitas penggabungan conditional class names |
| `tailwind-merge` | `^3.0.1` | Penggabungan class Tailwind yang aman dari konflik specificity |

### DevDependencies (Pengembangan & Tooling)
| Paket | Versi | Peran / Kebutuhan |
| :--- | :--- | :--- |
| `typescript` | `^5.7.3` | Type-checking statis ketat (`strict: true`) |
| `@types/node` | `^22.13.4` | Tipe Node.js LTS |
| `@types/react` | `^19.0.10` | Tipe React 19 |
| `@types/react-dom` | `^19.0.4` | Tipe React DOM |
| `prisma` | `^6.4.1` | Prisma CLI untuk schema & migration management |
| `tailwindcss` | `^3.4.17` | Utility-first CSS framework (design tokens SELA) |
| `postcss` | `^8.5.2` | CSS transformer untuk Tailwind CSS |
| `autoprefixer` | `^10.4.20` | Vendor prefixer otomatis CSS |
| `eslint` | `^9.20.1` | Code quality linter |
| `eslint-config-next` | `15.1.7` | Aturan lint resmi Next.js 15 |
| `vitest` | `^3.0.5` | Test runner modern & cepat berbasis Vite/ESM |
| `@vitejs/plugin-react` | `^4.3.4` | Plugin React untuk Vitest |
| `@testing-library/react`| `^16.2.0` | Pengujian komponen React DOM |
| `@testing-library/jest-dom` | `^6.6.3` | Matcher DOM assertions |
| `jsdom` | `^26.0.0` | Lingkungan DOM simulasi headless untuk pengujian |
| `tsx` | `^4.19.3` | TypeScript execution runner untuk database seed & scripts |

### Metadata Engine & Package Manager
```json
{
  "packageManager": "pnpm@11.13.1",
  "engines": {
    "node": ">=20.9.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## 4. Tata Letak Domain & Struktur Folder (`src/`)

```
d:\project\project-qr\cravio/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI dasar (frozen-lockfile, lint, typecheck, build)
├── prisma/
│   ├── schema.prisma            # Model data relasional PostgreSQL (ADR-0001, ADR-0004, ADR-0005)
│   └── seed.ts                  # Database seeder SELA (kategori, menu, meja, staf default)
├── public/
│   └── favicon.ico              # Aset statis favicon
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx     # Layar login staf (PIN/Password)
│   │   ├── (b2b)/
│   │   │   └── page.tsx         # Landing page B2B Cravio
│   │   ├── (customer)/
│   │   │   ├── order/
│   │   │   │   └── page.tsx     # QR landing resolver (/order?table=XX)
│   │   │   ├── menu/
│   │   │   │   └── page.tsx     # Katalog menu SELA & filter
│   │   │   ├── quiz/
│   │   │   │   └── page.tsx     # Kuis rekomendasi 3 langkah
│   │   │   ├── cart/
│   │   │   │   └── page.tsx     # Keranjang & checkout
│   │   │   └── order/
│   │   │       └── [id]/
│   │   │           ├── pay/
│   │   │           │   └── page.tsx      # Pembayaran QRIS / Cash instruction
│   │   │           ├── track/
│   │   │           │   └── page.tsx      # Realtime tracker status pesanan
│   │   │           └── receipt/
│   │   │               └── page.tsx      # E-receipt & cetak 58/80 mm
│   │   ├── (staff)/
│   │   │   └── staff/
│   │   │       ├── pos/
│   │   │       │   └── page.tsx          # POS Kasir & konfirmasi tunai
│   │   │       ├── kds/
│   │   │       │   └── page.tsx          # Kitchen Display System (PAID-only)
│   │   │       └── admin/
│   │   │           └── page.tsx          # Admin menu, sold-out toggle, analytics
│   │   ├── api/
│   │   │   └── health/
│   │   │       └── route.ts              # Health check endpoint
│   │   ├── globals.css          # Token warna SELA, typography, media print
│   │   ├── layout.tsx           # Root layout HTML, Plus Jakarta Sans font
│   │   └── not-found.tsx        # 404 handler
│   ├── components/
│   │   ├── ui/                  # Atomik UI (Button, Input, Badge, Modal, Card)
│   │   ├── customer/            # Komponen pelanggan (MenuCard, CartTray, QuizModal)
│   │   └── staff/               # Komponen staf (KdsCard, PosOrderRow)
│   ├── lib/
│   │   ├── server/              # Server-only boundary helpers
│   │   │   ├── db.ts            # Prisma client singleton (import 'server-only')
│   │   │   ├── auth.ts          # Jose JWT verify & sign (import 'server-only')
│   │   │   └── env.ts           # Typed environment variable validator
│   │   └── utils.ts             # Format rupiah, cn() helper (client/server safe)
│   ├── types/
│   │   ├── index.ts             # Tipe global & domain entities
│   │   └── contracts.ts         # Tipe DTO API request/response
│   └── validation/
│       └── schemas.ts           # Zod schema definitions (api-contracts.md)
├── tests/
│   ├── setup.ts                 # Setup testing-library/jest-dom
│   └── unit/
│       ├── formatting.test.ts   # Uji unit utilitas format IDR & helper
│       └── env-guard.test.ts    # Uji boundary server-only
├── .env.example                 # Template environment variables lengkap SELA
├── .gitignore                   # Standard Next.js/Prisma/Node ignore
├── eslint.config.mjs            # Konfigurasi ESLint Flat Config
├── next.config.ts               # Konfigurasi Next.js 15
├── postcss.config.mjs           # Konfigurasi PostCSS Tailwind
├── tailwind.config.ts           # Konfigurasi tema token desain SELA
├── tsconfig.json                # Konfigurasi TypeScript strict dengan alias @/*
├── vitest.config.ts             # Konfigurasi Vitest runner
└── README.md                    # Dokumentasi lengkap setup Windows PowerShell
```

---

## 5. Batas Keamanan Server-Only (`server-only`)
Untuk mencegah kebocoran kredensial (database URL, secret JWT, Midtrans Server Key) ke client bundle browser:
1. Paket `server-only` dipasang pada dependensi proyek.
2. Setiap modul server pada `src/lib/server/` memuat baris pertama:
   ```typescript
   import 'server-only'
   ```
3. Jika modul ini secara tidak sengaja diimpor ke file Client Component (`'use client'`), compiler Next.js akan langsung menghentikan build dengan error fatal.
4. Nilai sensitif tidak diberi prefix `NEXT_PUBLIC_`. Prefix `NEXT_PUBLIC_` hanya diizinkan untuk konfigurasi publik non-rahasia (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CAFE_NAME`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_CAFE_SLUG`).

---

## 6. Daftar Script `package.json`

| Nama Script | Perintah | Tujuan / Keterangan |
| :--- | :--- | :--- |
| `dev` | `next dev` | Menjalankan local development server Next.js pada port 3000 |
| `build` | `next build` | Build produksi Next.js App Router |
| `start` | `next start` | Menjalankan build produksi pada lingkungan hosting |
| `lint` | `next lint` | Menjalankan ESLint untuk static code analysis |
| `typecheck` | `tsc --noEmit` | Validasi tipe TypeScript strict penuh tanpa emisi file |
| `test` | `vitest run` | Menjalankan test suite unit Vitest satu kali |
| `test:watch` | `vitest` | Menjalankan test suite Vitest dalam mode watch interaktif |
| `test:integration` | `echo "Catatan: Test integrasi database akan ditambahkan pada milestone modul API" && exit 0` | Placeholder eksplisit sesuai aturan kejujuran pengujian |
| `test:e2e` | `echo "Catatan: E2E Playwright akan ditambahkan pada milestone pengujian end-to-end" && exit 0` | Placeholder eksplisit tanpa mengklaim telah berjalan |
| `db:generate` | `prisma generate` | Membuat tipe Prisma Client lokal secara deterministik |
| `db:migrate:dev` | `prisma migrate dev` | Menjalankan migrasi database di lingkungan lokal |
| `db:migrate:deploy` | `prisma migrate deploy` | Menjalankan migrasi database di lingkungan CI / staging |
| `db:seed` | `tsx prisma/seed.ts` | Mengisi data dummy master SELA untuk testing lokal |

---

## 7. Desain Konfigurasi Inti

### A. `tailwind.config.ts` (Token SELA)
- Menetapkan palette warna kanonis SELA dari `docs/design.md`:
  - `brand`: `#2C1810` (Espresso Dark), `accent`: `#C67D3E` (Warm Amber Gold), `cream`: `#FBF9F5` (Canvas Background), `surface`: `#FFFFFF`, `border`: `#E5E0D8`.
  - Status alert: `success: #16A34A`, `danger: #DC2626`, `warning: #D97706`, `info: #2563EB`.
- Ukuran minimum interaksi sentuh:
  - Utility class kustom: `min-h-touch` (44px untuk mobile tamu) dan `min-h-touch-kds` (56px untuk layar dapur).
- Typography: font sans Plus Jakarta Sans, font serif Playfair Display.

### B. `tsconfig.json`
- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`.
- Path alias: `@/*` mengarah ke `./src/*`.
- Target: `ES2022`, moduleResolution: `bundler`.

### C. `prisma/schema.prisma`
- Provider: `postgresql`.
- Relasi entitas:
  - `Table`: Meja kafe (nomor meja, QR slug, status).
  - `Category`: Kategori menu (Kopi, Non-Kopi, Makanan).
  - `MenuItem`: Menu produk (nama, harga IDR, stok `isAvailable`, tag selera).
  - `ModifierGroup` & `ModifierOption`: Opsi modifikasi (sugar, ice, topping).
  - `Order`: Master pesanan (`orderNumber`, `orderSecretToken`, `orderStatus`, `paymentStatus`, `tableId`).
  - `OrderItem` & `OrderItemModifier`: Snapshot transaksi permanen.
  - `PaymentAttempt`: Riwayat percobaan pembayaran (Midtrans QRIS / Tunai).
  - `StaffUser`: Akun staf (Kasir, Barista, Admin) dengan PIN/Password hash.
  - `IdempotencyRecord`: Pencatatan kunci idempoten untuk mencegah double charge / double checkout.
  - `AuditLog`: Log transisi status operasional.

### D. `.env.example`
- Memuat seluruh variabel lingkungan yang dibutuhkan sistem Cravio / SELA dengan nilai placeholder yang jelas dan panduan keamanan.

### E. CI Dasar GitHub Actions (`.github/workflows/ci.yml`)
- Trigger pada event `push` dan `pull_request` branch `main`.
- Menggunakan Node 20 / 22 LTS dan `pnpm/action-setup`.
- Menjalankan secara berurutan: `pnpm install --frozen-lockfile` $\rightarrow$ `pnpm run db:generate` $\rightarrow$ `pnpm run lint` $\rightarrow$ `pnpm run typecheck` $\rightarrow$ `pnpm run test` $\rightarrow$ `pnpm run build`.
- Tidak bergantung pada database produksi (menggunakan dummy URL untuk `db:generate` dan build).

---

## 8. Panduan Setup Windows PowerShell (`README.md`)
Menjelaskan secara gamblang:
1. Prasyarat sistem: Node.js 20+ LTS, pnpm 9+ / 11+.
2. Prosedur inisialisasi environment: `Copy-Item .env.example .env.local`.
3. Instalasi dependensi: `pnpm install`.
4. Generate Prisma: `pnpm run db:generate`.
5. Menjalankan local server: `pnpm run dev`.
6. Menjalankan uji kualitas kode: `pnpm run lint`, `npx tsc --noEmit`, `pnpm run test`, `pnpm run build`.
7. Catatan khusus sandbox Windows PowerShell: Menghindari script execution policy error via `-ExecutionPolicy Bypass`.

---

## 9. Rencana Eksekusi & Langkah Kerja
1. **Langkah 1:** Buat berkas `package.json` dengan pinned dependencies dan skrip yang lengkap.
2. **Langkah 2:** Buat berkas konfigurasi compiler & linter: `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`.
3. **Langkah 3:** Jalankan `pnpm install` di Windows dengan `BypassSandbox: true` (sesuai aturan instalasi pnpm di Windows sandbox).
4. **Langkah 4:** Buat skema awal `prisma/schema.prisma` dan jalankan `pnpm run db:generate` untuk menghasilkan Prisma Client.
5. **Langkah 5:** Bangun struktur direktori `src/`, layout root Next.js, `globals.css` dengan token SELA, modul `src/lib/server/db.ts` dengan `server-only`, utilitas `src/lib/utils.ts`, dan skema validasi `src/validation/schemas.ts`.
6. **Langkah 6:** Buat berkas pengujian unit `tests/unit/formatting.test.ts` dan jalankan `pnpm run test`.
7. **Langkah 7:** Buat berkas template `.env.example`, `.gitignore`, dan `.github/workflows/ci.yml`.
8. **Langkah 8:** Tulis dokumentasi komprehensif di `README.md` dengan instruksi Windows PowerShell.
9. **Langkah 9:** Jalankan verifikasi aktual: `tsc --noEmit`, `pnpm run lint`, `pnpm run test`, dan `pnpm run build`.
10. **Langkah 10:** Catat hasil nyata pada `docs/implementation-progress.md` dan sajikan laporan verifikasi.

---

## 10. Kriteria Keberhasilan (Definition of Done Tahap 03)
- [ ] Berkas `proposal/` dan berkas pengguna lainnya tetap aman tanpa modifikasi tak diinginkan.
- [ ] `package.json` dan `pnpm-lock.yaml` terpasang secara deterministik dengan dependensi tersemat.
- [ ] `pnpm run db:generate` berhasil menghasilkan Prisma Client lokal.
- [ ] `npx tsc --noEmit` lulus tanpa kesalahan kompilasi tipe TypeScript.
- [ ] `pnpm run lint` lulus tanpa warning / error ESLint.
- [ ] `pnpm run test` (Vitest) berhasil mengeksekusi uji unit smoke dan utilitas format.
- [ ] `pnpm run build` berhasil melakukan static page generation untuk Next.js 15 App Router.
- [ ] Script yang belum memiliki test fisik (`test:integration`, `test:e2e`) diberi label transparan tanpa klaim palsu.
- [ ] `.env.example` konsisten menggunakan identitas Cravio & SELA tanpa membocorkan rahasia.
- [ ] `README.md` memandu setup Windows PowerShell secara akurat.

