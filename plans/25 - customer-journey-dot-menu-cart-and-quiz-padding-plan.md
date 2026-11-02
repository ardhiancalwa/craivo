# Rencana Implementasi: Penghapusan Titik Pulsa Alur Pelanggan, Perbaikan Pengurangan Jumlah Menu, dan Padding Bawah Halaman Kurasi

Rencana teknis ini disusun untuk merespons 3 temuan spesifik pengguna yang didukung oleh bukti tangkapan layar visual:
1. **Customer Journey Section:** Menghilangkan titik pulsa tengah (*traveling light pulse*) yang menutupi angka langkah (`01`–`05`).
2. **Katalog Menu (`/menu?table=07`):** Memperbaiki kontrol kuantitas menu (*inline stepper*) pada kartu menu agar total pesanan dan subtotal berkurang secara semestinya saat kuantitas dikurangi.
3. **Halaman Kurasi Kuis (`/quiz`):** Menyesuaikan padding bawah dan struktur flex agar tautan *"Lihat Menu Lengkap"* dan tombol navigasi langkah tidak tertutup oleh navigasi bawah (*CustomerBottomNav*).

---

## 1. Analisis Akar Masalah (Root Cause Analysis)

### Masalah 1: Titik Pulsa Menutupi Angka Langkah (Customer Journey)
* **Bukti Visual:** Tangkapan layar pertama menunjukkan bulatan oranye dengan cincin putih (*traveling light pulse*) berada tepat di pusat lingkaran hitam langkah aktif (*"04 Pembayaran"*), sehingga angka `"04"` tertutupi secara total.
* **Akar Masalah di Kode:** Pada [`src/components/b2b/customer-journey-section.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/customer-journey-section.tsx) baris 195–205:
  ```tsx
  {/* Traveling Light Pulse Indicator */}
  {!prefersReducedMotion && isPlaying && (
    <motion.div
      className="absolute top-[18px] -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-terracotta-500 shadow-[0_0_12px_#C25E2B] border-2 border-white pointer-events-none z-20"
      initial={false}
      animate={{
        left: `${10 + activeStepIndex * 20}%`,
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    />
  )}
  ```
  Elemen ini menggunakan `z-20` sementara tombol lingkaran angka menggunakan `z-10`. Titik ini dirender tepat di koordinat `top-[18px]` dan `left: ${10 + activeStepIndex * 20}%`, yang merupakan koordinat pusat lingkaran aktif, sehingga secara harfiah menimpa angka di dalamnya.

### Masalah 2: Pengurangan Jumlah Produk pada `/menu?table=07` Tidak Berfungsi
* **Bukti Visual:** Tangkapan layar kedua menunjukkan nampan pesanan melayang (*Floating Order Tray*): *"4 Total Pesanan Rp110.000 Lihat Keranjang >"*. Saat tombol minus `−` diklik, total pesanan tidak berkurang.
* **Akar Masalah di Kode:** Pada [`src/components/menu/menu-card.tsx`](file:///d:/project/project-qr/cravio/src/components/menu/menu-card.tsx) baris 136–147:
  ```tsx
  ) : cartQty > 0 ? (
    <div onClick={(e) => e.stopPropagation()}>
      <QuantityStepper
        value={cartQty}
        onChange={(newQty) => {
          if (newQty > cartQty) {
            addItem(item)
          }
        }}
        min={0}
        variant="inline"
      />
    </div>
  ) : (
  ```
  Fungsi `onChange` pada `QuantityStepper` **hanya** mengecek `if (newQty > cartQty) { addItem(item) }`. Ketika pengguna menekan tombol minus `−` (`newQty < cartQty`, misalnya dari 4 ke 3, atau 1 ke 0), kode tersebut **tidak melakukan apa pun sama sekali**. Perubahan kuantitas tidak dikirim ke `useCart()`, sehingga `items`, `totalItems`, dan `subtotal` tetap berada di nilai lama.

### Masalah 3: Konten Bagian Bawah Kurasi Tertutup Bottom Navbar
* **Bukti Visual:** Tangkapan layar ketiga menunjukkan navigasi bawah pelanggan (*CustomerBottomNav*: Menu, Kurasi, Pesanan, Bantuan) menimpa teks *"Lihat Menu Lengkap"* dan tombol aksi *"Lanjut Langkah 2 →"*.
* **Akar Masalah di Kode:**
  1. Pada [`src/app/(customer)/quiz/quiz-stepper.tsx`](file:///d:/project/project-qr/cravio/src/app/(customer)/quiz/quiz-stepper.tsx) baris 144:
     ```tsx
     <main className="min-h-screen px-4 py-6 max-w-lg mx-auto flex flex-col justify-between">
     ```
     Kombinasi `min-h-screen` dengan `flex flex-col justify-between` memaksakan tinggi kontainer menjadi $100\text{vh}$.
  2. Footer kuis (`<footer className="pt-4 border-t ...">`) didorong ke dasar viewport dengan padding bawah hanya `py-6` ($24\text{ px}$).
  3. Sementara itu, [`src/components/shells/customer-bottom-nav.tsx`](file:///d:/project/project-qr/cravio/src/components/shells/customer-bottom-nav.tsx) memiliki posisi `fixed bottom-0` dengan tinggi $\sim 64\text{ px}$ ditambah area aman perangkat (`pb-safe`).
  4. Akibatnya, `CustomerBottomNav` menutupi $64\text{ px} - 24\text{ px} = 40\text{ px}$ bagian bawah konten kuis.
  5. Terdapat juga tag semantik ganda `<main>` di dalam `<main>` dari [`src/app/(customer)/layout.tsx`](file:///d:/project/project-qr/cravio/src/app/(customer)/layout.tsx).

---

## 2. Perubahan yang Diusulkan (Proposed Changes)

### Komponen B2B: Customer Journey Section
#### [MODIFY] [`src/components/b2b/customer-journey-section.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/customer-journey-section.tsx)
* Hapus blok `<motion.div className="... traveling light pulse ..."/>` (baris 195–205).
* Tetapkan visual yang bersih:
  * Garis abu-abu dasar (*Base Track Line*) `left: 10%`, `right: 10%`, `top-[18px] -translate-y-1/2`.
  * Garis gradien terakota aktif (*Active Line*) `width: ${activeStepIndex * 20}%`.
  * 5 lingkaran milestone nomor `01`–`05` dengan angka tajam dan jelas:
    * Langkah aktif disorot dengan `bg-charcoal-950 text-white scale-110 ring-4 ring-terracotta-500/20`.
    * Tanpa ada titik/elemen dekoratif apa pun yang menimpa angka.

---

### Menu & Cart System: MenuCard & CartContext
#### [MODIFY] [`src/components/menu/menu-card.tsx`](file:///d:/project/project-qr/cravio/src/components/menu/menu-card.tsx)
* Ambil `items` dan `updateQuantity` dari `useCart()`:
  ```tsx
  const { addItem, getItemQuantity, items, updateQuantity } = useCart()
  ```
* Perbarui handler `onChange` pada `QuantityStepper`:
  ```tsx
  <QuantityStepper
    value={cartQty}
    onChange={(newQty) => {
      if (newQty > cartQty) {
        addItem(item)
      } else if (newQty < cartQty) {
        const targetItem = items.find((it) => it.menuItemId === item.id)
        if (targetItem) {
          updateQuantity(targetItem.cartItemId, newQty)
        }
      }
    }}
    min={0}
    variant="inline"
  />
  ```
* **Alur Perilaku:**
  * Saat `newQty < cartQty` dan `newQty > 0`: `updateQuantity(cartItemId, newQty)` mengupdate kuantitas item, menghitung ulang `itemSubtotal = unitPrice * newQty`, dan menginvalidasi quote aktif.
  * Saat `newQty === 0`: `updateQuantity(cartItemId, 0)` secara otomatis memfilter/menghapus item dari `items` (sesuai logika `quantity <= 0` pada `cart-context.tsx`).
  * Nilai `cartQty` kembali menjadi `0`, dan UI secara reaktif kembali menampilkan tombol `+` (*Pilih/Tambah*).
  * `totalItems` dan `subtotal` pada keranjang berkurang secara instan di `FloatingOrderTray`.

#### [MODIFY] [`src/lib/cart-context.tsx`](file:///d:/project/project-qr/cravio/src/lib/cart-context.tsx)
* Tambahkan helper opsional `decreaseItem(menuItemId: string)` pada `CartContextType` untuk konsistensi API context:
  ```tsx
  const decreaseItem = React.useCallback(
    (menuItemId: string) => {
      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((it) => it.menuItemId === menuItemId)
        if (existingIndex === -1) return prevItems

        const existing = prevItems[existingIndex]
        if (!existing) return prevItems

        if (existing.quantity <= 1) {
          return prevItems.filter((_, idx) => idx !== existingIndex)
        }

        const updated = [...prevItems]
        const newQty = existing.quantity - 1
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          itemSubtotal: existing.unitPrice * newQty,
        }
        return updated
      })
      invalidateQuote()
    },
    [invalidateQuote]
  )
  ```

---

### Tampilan Pelanggan: Halaman Kurasi Kuis (`/quiz`)
#### [MODIFY] [`src/app/(customer)/quiz/quiz-stepper.tsx`](file:///d:/project/project-qr/cravio/src/app/(customer)/quiz/quiz-stepper.tsx)
1. Ganti pembungkus utama `<main className="min-h-screen px-4 py-6 max-w-lg mx-auto flex flex-col justify-between">` menjadi:
   ```tsx
   <div className="w-full flex-1 flex flex-col justify-between pb-28 max-w-lg mx-auto min-h-[calc(100dvh-180px)]">
   ```
2. Ganti pembungkus tampilan hasil rekomendasi (`if (recommendationResult)`) dari `<main className="min-h-screen px-4 py-6 max-w-lg mx-auto">` menjadi:
   ```tsx
   <div className="w-full pb-28 max-w-lg mx-auto space-y-6">
   ```
3. Footer navigasi kuis (`<footer className="pt-4 border-t ...">`):
   Dengan padding bawah `pb-28` ($112\text{ px}$), tautan *"Lihat Menu Lengkap"* dan tombol *"Lanjut Langkah 2 →"* / *"Lihat Rekomendasi ✨"* memiliki jarak vertikal bebas sebesar $48\text{ px}$ di atas `CustomerBottomNav` ($64\text{ px}$), sehingga tidak akan tertutup atau terpotong pada semua ukuran layar mobile.

#### [MODIFY] [`src/app/(customer)/quiz/page.tsx`](file:///d:/project/project-qr/cravio/src/app/(customer)/quiz/page.tsx)
* Ubah `<div className="bg-cream min-h-screen">` menjadi `<div className="bg-cream w-full">` untuk mencegah pembengkakan tinggi dokumen di luar layout induk.

---

## 3. Rencana Verifikasi (Verification Plan)

### A. Pengujian Otomatis
1. **TypeScript Type Safety:**
   `npx tsc --noEmit` $\rightarrow$ Memastikan tidak ada ketidakcocokan tipe pada `useCart`, `MenuCard`, atau `QuizStepper`.
2. **ESLint Static Analysis:**
   `pnpm run lint` $\rightarrow$ Memastikan kode bersih tanpa unused variables atau pelanggaran hook.
3. **Pengujian Unit & Integrasi:**
   * `pnpm exec vitest run tests/integration/b2b-landing-page.test.ts` $\rightarrow$ Memastikan asersi seksi B2B tetap lulus.
   * `pnpm exec vitest run tests/unit/recommendation-engine.test.ts` $\rightarrow$ Memastikan engine kuis tetap stabil.
   * `pnpm run test` $\rightarrow$ Memastikan seluruh test suite (42 file, 365+ test) lulus 100%.

### B. Verifikasi Manual (UAT Scenarios)
1. **Customer Journey Timeline:**
   * Buka landing page pada desktop/tablet.
   * Amati langkah `01` s/d `05`. Pastikan teks angka terbaca jelas di tengah lingkaran hitam/oranye tanpa ada bulatan oranye/putih yang menimpa angka.
2. **Menu Cart Quantity Decrement (`/menu?table=07`):**
   * Tambahkan produk non-modifier (misalnya *"Espresso Single"* atau *"Croissant"*).
   * Tekan tombol `+` hingga kuantitas mencapai 3 atau 4. Amati *Floating Order Tray*: Total dan subtotal bertambah.
   * Tekan tombol `−`. Verifikasi kuantitas berkurang menjadi 3, lalu 2, lalu 1. Total pesanan dan subtotal di nampan melayang berkurang secara sinkron.
   * Tekan tombol `−` sekali lagi saat kuantitas 1. Verifikasi produk hilang dari keranjang dan tombol kartu menu kembali menjadi tombol `+` awal.
3. **Kurasi Layout Spacing (`/quiz?table=07`):**
   * Buka halaman kurasi di viewport mobile (misal 390px iPhone / 360px Android).
   * Gulir ke bagian paling bawah pertanyaan langkah 1, 2, dan 3.
   * Verifikasi teks *"Lihat Menu Lengkap"* dan tombol *"Lanjut Langkah 2 →"* / *"Lihat Rekomendasi ✨"* berada seutuhnya di atas bilah navigasi bawah (*Menu, Kurasi, Pesanan, Bantuan*).
   * Buka hasil rekomendasi dan periksa tombol *"🔄 Ulangi Kurasi"* dan *"Lihat Semua Menu Lengkap →"* tetap dapat diklik tanpa tertutup bilah navigasi.

