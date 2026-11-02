# INDEKS PROSEDUR KERJA & KATALOG SKILL ANTIGRAVITY (SKILS.MD)
## SELA Smart QR Menu & Sistem Rekomendasi Preferensi Konsumen

> **Lokasi File:** `skils.md` (Root Repository)  
> **Status:** Indeks Prosedur Resmi Proyek  
> **Terakhir Diperbarui:** 2026-10-27  
> **Peran Penulis:** Developer Experience Engineer  
> **Lingkungan Harness:** Google Antigravity (Workspace Scope Customization)  

---

## 1. Perbedaan Mendasar: Indeks Dokumentasi vs Harness Skill

Untuk mencegah kerancuan peran dokumen:
1. **Berkas `skils.md` (Dokumen Ini):**  
   Adalah **indeks, katalog, dan dokumentasi prosedur kerja berulang** tingkat repositori. Berkas ini bukan daftar bahasa/framework dan bukan deklarasi bahwa AI memiliki kemampuan gaib tanpa instruksi.
2. **Direktori `.agents/skills/<nama-skill>/SKILL.md` (Skill Harness Antigravity):**  
   Adalah unit keahlian modular (*runbook*) yang dapat ditemukan secara otomatis oleh harness Antigravity melalui mekanisme traversing workspace. Setiap skill memuat frontmatter YAML (`name` dan `description`) serta langkah-langkah kerja berurutan yang dapat dieksekusi secara mandiri saat konteks tugas terkait terpicu.

---

## 2. Tabel Master Katalog Skill Antigravity

Berikut adalah enam skill proyek yang telah diimplementasikan pada repositori ini:

| Nama Skill | Kapan Digunakan (Trigger) | Input & Dokumen Rujukan | Output yang Dihasilkan | Prasyarat | Lokasi File | Bukti Selesai yang Diharapkan |
|---|---|---|---|---|---|---|
| **`smart-menu-ui`** | Membangun/merevisi tampilan antarmuka pelanggan, kasir, KDS, admin, atau B2B; menyesuaikan layout responsif mobile 390px / tablet / desktop; menangani status visual (*loading skeleton, disabled, sold-out*). | [design.md](file:///d:/project/project-qr/design.md), [agent.md](file:///d:/project/project-qr/agent.md), dan referensi visual [design-preview/DESIGN.md](file:///d:/project/project-qr/design-preview/DESIGN.md). | Komponen React TypeScript, layout responsif, styling token SELA, modal drawer, dan floating order tray. | Next.js 15 App Router & Tailwind CSS siap digunakan (atau checklist komponen pra-scaffolding). | [`.agents/skills/smart-menu-ui/SKILL.md`](file:///d:/project/project-qr/.agents/skills/smart-menu-ui/SKILL.md) | Layar mobile 390px tampil rapi tanpa overflow horizontal; touch target $\ge 44\text{ px}$; status sold out menurunkan opasitas $45\%$ dengan foto grayscale; lolos linting ESLint. |
| **`preference-matching`** | Mengubah rumus scoring rekomendasi menu, menambah/menyesuaikan bobot tag kuis (*mood, flavor, format*), menangani seri (*tie-break*), fallback menu habis, atau tombol skip. | [architecture.md](file:///d:/project/project-qr/architecture.md) (Seksi 6), [docs/PRD.md](file:///d:/project/project-qr/docs/PRD.md) (REQ-CUST-02/03), dan [agent.md](file:///d:/project/project-qr/agent.md) (Seksi 7). | Fungsi kalkulasi deterministik `calculateRecommendationScore()`, tag synthesizer, dan disclaimer alergi. | Schema `MenuTag` pada database relasional (atau mock fixture untuk pengujian unit). | [`.agents/skills/preference-matching/SKILL.md`](file:///d:/project/project-qr/.agents/skills/preference-matching/SKILL.md) | Unit test deterministik lulus: input kuis identik menghasilkan rekomendasi konsisten; menu sold out terfilter; penanganan lewati mengembalikan seluruh katalog; zero LLM calls. |
| **`order-payment-integrity`** | Membuat/memodifikasi alur checkout, kalkulasi harga server-authoritative, charge QRIS via Midtrans Core API Sandbox, verifikasi webhook signature SHA512, idempotensi transaksi, dan expiry 15 menit. | [architecture.md](file:///d:/project/project-qr/architecture.md) (Seksi 8 & 9), [techstack.md](file:///d:/project/project-qr/techstack.md) (Seksi 4), dan [docs/project-context.md](file:///d:/project/project-qr/docs/project-context.md) (`DEC-007`, `DEC-013`, `DEC-015`). | Route handlers `/api/orders`, `/api/payments/qris`, `/api/payments/cash`, `/api/webhooks/midtrans`, serta token pelacak `orderSecretToken`. | Variabel lingkungan Midtrans Sandbox terkonfigurasi di `.env.local` (tanpa rahasia produksi). | [`.agents/skills/order-payment-integrity/SKILL.md`](file:///d:/project/project-qr/.agents/skills/order-payment-integrity/SKILL.md) | Total belanja dihitung 100% oleh server; webhook callback palsu ditolak 403; callback settlement duplikat ditangani secara idempotent; expiry timer 15:00 membatalkan pesanan otomatis. |
| **`cafe-operations`** | Mengembangkan/memperbarui KDS dapur, dashboard kasir, alur konfirmasi bayar tunai, transisi status masak FIFO, denting audio chime & kilatan visual, serta layout cetak struk thermal 58/80 mm. | [architecture.md](file:///d:/project/project-qr/architecture.md) (Seksi 5 & 12), [design.md](file:///d:/project/project-qr/design.md) (Seksi 10 & 11), dan [agent.md](file:///d:/project/project-qr/agent.md) (Seksi 8.2). | Antarmuka `/kitchen` dan `/pos`, event listener SSE, modul unlock audio buffer, stylesheet `@media print` 58/80 mm, dan label REPRINT. | Endpoint SSE `/api/sse/kitchen` aktif dan file audio lonceng `public/audio/chime.mp3` tersedia. | [`.agents/skills/cafe-operations/SKILL.md`](file:///d:/project/project-qr/.agents/skills/cafe-operations/SKILL.md) | Dapur hanya memunculkan pesanan lunas (`PAID`); pesanan tunai tertahan di kasir sampai dikonfirmasi; tombol KDS $\ge 56\text{ px}$; struk cetak ulang berlabel `*** CETAK ULANG (REPRINT) ***`. |
| **`access-control-review`** | Mengaudit dan menguji hak akses staf (*Role-Based Access Control*), isolasi token sesi tamu antar-meja, autentikasi rute API terproteksi, sanitasi upload aset foto, dan pencegahan kebocoran kredensial. | [architecture.md](file:///d:/project/project-qr/architecture.md) (Seksi 11), [agent.md](file:///d:/project/project-qr/agent.md) (Seksi 6 & 11), dan [techstack.md](file:///d:/project/project-qr/techstack.md) (Seksi 6). | Middleware otorisasi session JWT, pengecekan role di server, penguncian endpoint dengan `x-order-secret-token`, dan checklist audit sanitasi secret. | File `src/middleware.ts` dan konfigurasi environment terisolasi. | [`.agents/skills/access-control-review/SKILL.md`](file:///d:/project/project-qr/.agents/skills/access-control-review/SKILL.md) | Akses rute `/admin` tanpa cookie dialihkan ke `/login`; akses pesanan tanpa secret token ditolak 403/404; scan regex kode membuktikan zero hardcoded secret keys. |
| **`project-verification`** | Menjalankan seluruh pemeriksaan kualitas aktual (typecheck, lint, test) dan 5 skenario UAT manual utama sebelum menyatakan tiket selesai (*Definition of Done*), lalu menyusun laporan bukti aktual. | [agent.md](file:///d:/project/project-qr/agent.md) (Seksi 9, 10, & 13), [design.md](file:///d:/project/project-qr/design.md) (Seksi 12), dan [docs/project-context.md](file:///d:/project/project-qr/docs/project-context.md). | Laporan kemajuan terstruktur dalam Bahasa Indonesia berisi bukti log terminal aktual, checklist UAT, dan batasan keterbatasan perangkat fisik. | Terminal Windows PowerShell siap pakai; script tooling Next.js tersedia (atau checklist statis pra-scaffolding). | [`.agents/skills/project-verification/SKILL.md`](file:///d:/project/project-qr/.agents/skills/project-verification/SKILL.md) | Seluruh perintah otomatis lulus dengan exit code 0; skenario UAT tervalidasi; keterbatasan fisik (printer/audio riil) dilaporkan secara jujur tanpa rekayasa hasil. |

---

## 3. Rincian Prosedur Operasional Proyek

### 3.1. Prosedur 1: Implementasi Antarmuka UI SELA (`smart-menu-ui`)
1. **Tujuan:** Menjamin seluruh tampilan antarmuka setia pada sistem desain SELA Minimalist Artisanal.
2. **Aturan Server/Client:** Komponen tata letak utama berstatus Server Component; tambahkan `"use client"` hanya jika ada state lokal atau event browser.
3. **Standar Token:**
   * Kanvas: `bg-surface` (`#FBF9F5`)
   * Kartu: `bg-surface-container-lowest` (`#FFFFFF`) dengan border hairline `border-outline-variant` (`#E7E2DA`)
   * Teks: `text-on-surface` (`#1B1C1A`), sekunder `text-on-surface-variant` (`#544339`)
   * Aksen: `text-primary` (`#924805`)
   * Floating dock: `bg-inverse-surface` (`#241E1B`)
4. **Target Sentuh & Aksesibilitas:** Area sentuh minimal $44 \times 44\text{ px}$ di mobile dan $\ge 56\text{ px}$ untuk tombol aksi status KDS dapur. Seluruh status menggunakan *dual-encoding* (ikon + teks).

### 3.2. Prosedur 2: Kurasi Rekomendasi Preferensi Selera (`preference-matching`)
1. **Tujuan:** Menghasilkan rekomendasi menu yang relevan berdasarkan jawaban kuis selera 3 langkah.
2. **Formula Bobot:**
   $$\text{Skor Menu} = (\text{Flavor Match} \times 3) + (\text{Format Match} \times 2) + (\text{Mood Match} \times 1)$$
3. **Filter Ketersediaan & Seri:**
   * Hanya menu dengan `isAvailable: true` yang diproses.
   * Seri (*tie-break*) dipecahkan berjenjang: Best Seller $\rightarrow$ Penjualan Tertinggi $\rightarrow$ Harga Terendah.
4. **Fallback & Penanganan Skip:** Jika seluruh rekomendasi habis, kembalikan Best Seller aktif. Jika pelanggan menekan tombol "Lewati", kembalikan seluruh katalog menu standar tanpa filter. Wajib menyertakan disclaimer alergi bahan pangan.
5. **Invarian:** Dilarang mengintegrasikan model LLM/AI pihak ketiga ke alur kalkulasi runtime.

### 3.3. Prosedur 3: Integritas Pesanan & Transaksi Midtrans (`order-payment-integrity`)
1. **Tujuan:** Menjamin keabsahan nominal rupiah, mencegah kecurangan client, dan mengotomasi verifikasi pembayaran digital.
2. **Kalkulasi Server-Authoritative:** Server membaca harga menu dan modifier langsung dari database; nilai integer rupiah dikunci sebelum dikirim ke payment gateway.
3. **Integrasi Midtrans Core API (Sandbox):** Membuat charge QRIS dinamis berbatas waktu 15 menit. Menghasilkan `orderSecretToken` kriptografis acak untuk disimpan di `localStorage` peramban pemesan.
4. **Webhook Security:** Verifikasi signature hash SHA512:
   $$\text{Expected Hash} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$
   Tolak dengan status 403 jika hash tidak valid.
5. **Idempotensi & Expiry:** Callback duplikat tidak memicu mutasi ulang atau duplicate chime di dapur. Status `expire` dari Midtrans membatalkan pesanan secara otomatis tanpa masuk antrean masak.

### 3.4. Prosedur 4: Operasional Dapur KDS, Kasir, & Cetak Struk (`cafe-operations`)
1. **Tujuan:** Mengelola alur penyiapan hidangan di dapur, validasi uang tunai kasir, dan pencetakan struk belanja.
2. **Kitchen Gate Policy (`DEC-013`):** KDS Dapur hanya menampilkan pesanan yang telah berstatus `PAID`. Pesanan tunai tertahan di antrean kasir sampai staf kasir menekan tombol konfirmasi.
3. **Urutan FIFO & Pewarnaan:** Kartu antrean KDS tersusun urut waktu bayar lunas. Border kartu bertransformasi: netral ($<10$ mnt), oranye ($10-20$ mnt), merah berkedip ($>20$ mnt).
4. **Autoplay Audio & Fallback:** Sediakan banner pembuka izin audio browser di dashboard KDS. Sediakan kilatan visual layar (*visual flash*) $1.5$ detik jika speaker tablet mati.
5. **Format Cetak Struk Thermal:** Menggunakan CSS `@media print` universal dengan lebar 32 karakter (58mm) dan 48 karakter (80mm). Cetak ulang wajib memunculkan banner: `*** CETAK ULANG (REPRINT) ***`.

### 3.5. Prosedur 5: Audit Kontrol Akses & Sanitasi Secret (`access-control-review`)
1. **Tujuan:** Mengamankan rute internal staf, memisahkan privasi antar-meja tamu, dan mencegah kebocoran kredensial.
2. **Otorisasi Server:** Validasi hak akses role (`ADMIN`, `CASHIER`, `KITCHEN`) dilakukan di server via middleware session/JWT cookie HTTP-only. Dilarang menggunakan role switcher publik di lingkungan produksi.
3. **Isolasi Meja Tamu (`DEC-014`):** Pelacak pesanan hanya dapat diakses oleh peramban yang memiliki `orderSecretToken` yang cocok. Pelanggan baru yang memindai QR meja publik tidak dapat melihat riwayat pesanan sebelumnya.
4. **Sanitasi Unggah Berkas & Secret:** Upload foto menu dibatasi 2 MB (JPEG/PNG/WEBP) dengan nama file UUID acak. Variabel privat tidak boleh menggunakan prefix `NEXT_PUBLIC_`.

### 3.6. Prosedur 6: Eksekusi Verifikasi Proyek & Skenario UAT (`project-verification`)
1. **Tujuan:** Memvalidasi seluruh fungsi sistem terhadap *Definition of Done* sebelum pelaporan ke pengguna.
2. **Invarian Kejujuran Pengujian:** Jika aplikasi belum di-scaffold, laporkan prasyarat tersebut dan gunakan checklist inspeksi statis. Dilarang mengarang script atau hasil eksekusi terminal palsu.
3. **Eksekusi Otomatis (Saat Tooling Aktif):** Menjalankan `npx tsc --noEmit`, `pnpm run lint`, `pnpm run test`, dan `pnpm run build` di terminal PowerShell.
4. **5 Skenario UAT:**
   * Skenario 1: Pesan Meja 07 + Kuis Kurasi + Add Modifier.
   * Skenario 2: Bayar QRIS Sandbox + Webhook Settlement + Masuk KDS.
   * Skenario 3: Bayar Tunai di Kasir + Gate KDS Tertahan + Konfirmasi Kasir.
   * Skenario 4: Expiry QRIS 15 Menit + Auto Cancel.
   * Skenario 5: Quick Toggle Sold Out di Admin + Refleksi Seketika di Katalog.
5. **Pelaporan Keterbatasan:** Laporkan hal yang belum diuji pada perangkat keras fisik (printer thermal nyata atau audio di lingkungan riil) secara transparan.

---

## 4. Status Verifikasi Terhadap Harness Antigravity

* **Struktur Direktori:**  
  Sesuai dokumentasi resmi Antigravity Customization System (`C:\Users\ardhi\.gemini\antigravity\builtin\skills\agy-customizations\docs\skills.md`), unit skill modular dalam cakupan proyek (*workspace scope*) diletakkan pada:  
  `./.agents/skills/<nama-skill>/SKILL.md`  
* **Integritas Frontmatter:**  
  Seluruh enam file `SKILL.md` telah dilengkapi frontmatter YAML valid dengan atribut `name` (lowercase-hyphenated) dan `description` (format third-person yang menjelaskan pemicu penggunaan secara eksplisit).
* **Isolasi Lingkungan:**  
  Seluruh skill dikonfigurasi murni di dalam repositori `project-qr`. Tidak ada modifikasi yang dilakukan pada konfigurasi global pengguna (`~/.gemini/config/`).
