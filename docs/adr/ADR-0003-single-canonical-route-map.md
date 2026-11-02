# ADR-0003: Peta Rute Tunggal & Bersih (Single Canonical Route Map)

## 1. Status
**ACCEPTED** (28 Oktober 2026)

## 2. Konteks & Masalah
Pada dokumen arsitektur dan rancangan antarmuka awal, terdapat tabrakan rute (*route collision*) di mana folder `src/app/(customer)/page.tsx` dan `src/app/(b2b)/page.tsx` sama-sama mengklaim root path `/`. Selain itu, terdapat berbagai alias penamaan URL yang tidak konsisten (seperti `/kds` vs `/kitchen`, `/cashier` vs `/pos`, `/tracker` vs `/order-status`).

Diperlukan satu peta rute tunggal (*Single Canonical Route Map*) yang membedakan URL publik pemasaran B2B, pintu masuk pemesanan meja kafe fisik, dan dashboard operasional staf secara bersih.

## 3. Keputusan yang Ditetapkan

### 3.1. Struktur Peta Rute Kanonis Publik
Ditetapkan struktur URL publik resmi yang bersih tanpa ambiguitas:

```
+---------------------------------------------------------------------------------------------------+
| URL Path Publik           | Aktor & Fungsi Antarmuka                                              |
+---------------------------+-----------------------------------------------------------------------+
| /                         | [Publik] Landing Page Pemasaran B2B Cravio & Demo Kuis Interaktif     |
| /order?table=XX           | [Pelanggan Meja] Pintu Masuk Pemesanan SELA (Validasi Nomor Meja)     |
| /order/quiz               | [Pelanggan Meja] Alur Kuis Kurasi Preferensi Rasa (3 Langkah + Skip)  |
| /order/menu               | [Pelanggan Meja] Katalog Menu Lengkap, Filter Kategori, & Pencarian   |
| /order/cart               | [Pelanggan Meja] Keranjang Belanja, Modifier Gula/Es, Catatan 100 Kar |
| /order/[orderId]/pay      | [Pelanggan Meja] Pembayaran QRIS Dinamis 15 Mnt / Instruksi Kasir     |
| /order/[orderId]/track    | [Pelanggan Meja] Layar Pelacak Pesanan Real-Time (orderSecretToken)   |
| /order/[orderId]/receipt  | [Pelanggan Meja] Struk Digital Pelanggan (E-Receipt)                  |
| /staff/login              | [Staf Internal] Gerbang Login Terpadu (Password / PIN Cepat)          |
| /staff/pos                | [Kasir Kafe] Dashboard Antrean Tunai, Konfirmasi Pelunasan, Struk POS |
| /staff/kitchen            | [Dapur / Barista] KDS Antrean Masak FIFO, Audio Chime, Tombol >=56px  |
| /staff/admin              | [Owner / Admin] CRUD Menu, Toggle Stok, Config Kuis, Generator QR     |
| /api/*                    | [Backend Engine] Route Handlers Terproteksi                           |
+---------------------------------------------------------------------------------------------------+
```

### 3.2. Penggunaan Next.js 15 Route Groups
Route groups (folder dalam tanda kurung) digunakan secara murni untuk pemisahan layout dan boundary middleware di dalam `src/app/`, **tanpa memengaruhi segmen URL publik**:

```
src/app/
├── (b2b)/
│   ├── layout.tsx                # Layout Pemasaran B2B (Navbar B2B, Footer Agency)
│   └── page.tsx                  # URL: /
├── (customer)/
│   └── order/
│       ├── layout.tsx            # Layout Pelanggan Meja SELA (Header Meja, Bottom Tray)
│       ├── page.tsx              # URL: /order?table=XX (Deteksi Meja & Redirect Menu)
│       ├── quiz/page.tsx         # URL: /order/quiz
│       ├── menu/page.tsx         # URL: /order/menu
│       ├── cart/page.tsx         # URL: /order/cart
│       └── [orderId]/
│           ├── pay/page.tsx      # URL: /order/[orderId]/pay
│           ├── track/page.tsx    # URL: /order/[orderId]/track
│           └── receipt/page.tsx  # URL: /order/[orderId]/receipt
├── (staff)/
│   └── staff/
│       ├── login/page.tsx        # URL: /staff/login (Tanpa proteksi middleware)
│       ├── layout.tsx            # Layout Dashboard Staf (Sidebar / Header Shift)
│       ├── pos/page.tsx          # URL: /staff/pos (Role: CASHIER, ADMIN)
│       ├── kitchen/page.tsx      # URL: /staff/kitchen (Role: KITCHEN, ADMIN)
│       └── admin/page.tsx        # URL: /staff/admin (Role: ADMIN)
└── api/                          # URL: /api/*
```

### 3.3. Penegakan Otorisasi via Next.js Middleware (`src/middleware.ts`)
* Rute `/staff/*` (kecuali `/staff/login`) dijaga ketat oleh middleware. Jika request tidak membawa cookie valid `staff_session`, otomatis dialihkan (*redirect 307*) ke `/staff/login?from=[rute]`.
* Pembagian otorisasi role diperiksa di server component / middleware:
  * `/staff/pos`: Hanya dapat diakses oleh role `CASHIER` atau `ADMIN`.
  * `/staff/kitchen`: Hanya dapat diakses oleh role `KITCHEN` atau `ADMIN`.
  * `/staff/admin`: Hanya dapat diakses oleh role `ADMIN`.

## 4. Konsekuensi & Trade-Off
* **Keuntungan:** URL bersih, profesional, tidak ada kebingungan antara domain kafe fisik dengan halaman pemasaran agensi, isolasi layout sempurna antar persona.
* **Kelemahan & Mitigasi:** Pelanggan yang membuka `/order` tanpa query parameter `?table=XX` akan melihat halaman peringatan ramah; dimitigasi dengan penguncian nomor meja pada cookie sesi tamu saat pertama kali scan QR.

