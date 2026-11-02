# Rencana Implementasi: Rebranding Cravio, Demo Audio Chime KDS, dan Redesain Anti-AI-Slop Komponen Landing Page

Rencana ini disusun untuk merespons 5 permintaan perbaikan strategis pengguna:
1. **Logo & Nama Produk:** Mengganti identitas visual landing page menggunakan logo resmi yang berada di direktori [`logo/`](file:///d:/project/project-qr/cravio/logo) (`logo.jpeg`, `only-logo.jpeg`, `one-color.jpeg`).
2. **Eliminasi Total SELA:** Menghapus seluruh nama/sebutan `"SELA"` dari seluruh landing page B2B dan menggantinya secara konsisten dengan **"Cravio — Your craving, perfectly matched"**.
3. **Demo Audio Chime KDS:** Menambahkan tombol interaktif pada seksi *Visibilitas Barista & Dapur* yang dapat langsung membunyikan lonceng pesanan (*audio chime*) berbasis Web Audio API asli (`src/lib/audio-alert.ts`).
4. **Redesain Anti-AI-Slop Seksi KDS:** Menata ulang kartu tiket dan badge KDS yang sebelumnya kaku (*harsh green border*, badge tebal kaku, kotak cokelat) menjadi tampilan gelap editorial hangat (*warm organic dark display*) yang terinspirasi dari referensi visual pengguna (Gambar 3).
5. **Redesain Anti-AI-Slop Widget Kuis Rekomendasi:** Menata ulang kartu hasil rekomendasi dan chip badge preferensi dari tampilan generik (*dot bullet*, badge hijau tebal) menjadi kartu bersudut membulat lembut (*soft squircle tactile card*) yang terinspirasi dari referensi visual pengguna (Gambar 2).

---

## 1. Analisis Referensi & Anti-AI-Slop

Sesuai skill [`reverse-engineer-no-slop`](file:///C:/Users/ardhi/.codex/skills/reverse-engineer-no-slop/SKILL.md) dan [`no-ai-slop`](file:///C:/Users/ardhi/.codex/skills/no-ai-slop/SKILL.md):

### A. Evaluasi Komponen KDS Saat Ini vs Referensi 3
* **Masalah Aktual (Gambar 1):**
  - Border tebal warna hijau terang (`border-2 border-[rgba(30,126,52,0.7)]`) membungkus seluruh tiket MEJA 07 secara berlebihan.
  - Badge status berbentuk kotak kaku dengan border tebal (`bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded`).
  - Catatan/modifier dibungkus kotak cokelat tua dengan teks oranye terang (`bg-amber-950/60 text-amber-300 px-1.5 py-0.5 rounded`).
  - Tombol aksi berupa kotak rounded standar tanpa nuansa sentuhan fisik.
* **Arah Solusi Berdasarkan Referensi 3 (Gambar 3):**
  - Menggunakan kanvas gelap bernuansa hangat (*deep warm charcoal*) `#181614` dengan gradien ambient bara terakota halus (`radial-gradient(ellipse at top right, rgba(194, 94, 43, 0.12), transparent 65%)`).
  - Border luar ultra-tipis yang elegan: `border border-white/10` (tanpa border hijau neon melingkar).
  - Badge status diubah menjadi pill membulat translusen halus: `rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/25`.
  - Catatan koki/barista disajikan dengan tipografi kuliner bergaris aksen vertikal di kiri: `border-l-2 border-terracotta-500/70 pl-2.5 py-1 text-[11px] text-stone-300 italic bg-white/[0.03] rounded-r-md`.
  - Tombol aksi berupa pill taktil membulat penuh (`rounded-full px-4 py-2 text-xs font-semibold bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-sm active:scale-95`).

### B. Evaluasi Widget Kuis Rekomendasi Saat Ini vs Referensi 2
* **Masalah Aktual (Gambar 4):**
  - Kotak di dalam kotak bertingkat tanpa hierarki kedalaman yang organik.
  - Teks *"Simulasi / Interactive Preview • Kafe SELA"* masih memuat nama SELA.
  - Badge *"98% Cocok"* menggunakan kotak hijau terang standar AI template.
  - Tag preferensi menggunakan format bullet point bundar oranye (`• Santai`, `• Manis`, `• Creamy Gurih`) yang tampak amatir.
* **Arah Solusi Berdasarkan Referensi 2 (Gambar 2):**
  - Permukaan squircle lembut (`rounded-3xl bg-white border border-sand-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]`).
  - Tag pill minimalis dan bersih tanpa bullet dot: `rounded-full bg-sand-100 text-stone-700 px-3 py-1 text-xs font-medium border border-sand-200/60`.
  - Indikator kecocokan disajikan elegan: pill bernuansa sage-emerald lembut (`rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono text-xs font-semibold px-3 py-1`).
  - Menu rekomendasi utama disajikan dengan tipografi editorial *Instrument Serif* yang anggun, harga tabular yang presisi, dan hierarki visual yang bernapas.

---

## 2. Rincian Perubahan Kode (Proposed Changes)

### A. Aset Logo & Identitas Merek
#### [NEW] [`public/logo/logo.jpeg`](file:///d:/project/project-qr/cravio/public/logo/logo.jpeg), [`public/logo/only-logo.jpeg`](file:///d:/project/project-qr/cravio/public/logo/only-logo.jpeg), [`public/logo/one-color.jpeg`](file:///d:/project/project-qr/cravio/public/logo/one-color.jpeg)
* Berkas telah disalin dari folder `logo/` ke `public/logo/` sehingga dapat disajikan langsung oleh Next.js Image optimization.

#### [MODIFY] [`src/components/b2b/b2b-landing-view.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/b2b-landing-view.tsx)
1. **Header Sticky Navbar:**
   - Mengganti teks `SELA` dengan kombinasi logo grafis Cravio dan wordmark:
     ```tsx
     <Link href="/" className="flex items-center gap-2.5 group">
       <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-sand-200 shadow-xs">
         <Image
           src="/logo/only-logo.jpeg"
           alt="Cravio Logo"
           fill
           sizes="32px"
           className="object-cover"
         />
       </div>
       <div className="flex flex-col">
         <span className="font-editorial text-2xl font-normal tracking-tight text-charcoal-950 group-hover:text-terracotta-600 transition-colors leading-none">
           craivo
         </span>
         <span className="text-[9px] font-sans text-stone-500 font-medium tracking-wide">
           your craving, perfectly matched
         </span>
       </div>
     </Link>
     ```
2. **Footer Section:**
   - Menampilkan lockup logo Cravio dengan tagline resmi.
   - Mengubah copyright menjadi: `© {new Date().getFullYear()} Cravio. Hak cipta dilindungi.`
   - Mengubah teks pilot partner menjadi: `Cravio — Your craving, perfectly matched`.

---

### B. Eliminasi Seluruh Sebutan "SELA" pada Landing Page B2B
File-file berikut akan diperbarui secara komprehensif:

1. **[`src/app/(b2b)/page.tsx`](file:///d:/project/project-qr/cravio/src/app/(b2b)/page.tsx):**
   - Title & OpenGraph: Mengganti `'SELA Smart QR Menu'` dengan `'Cravio — Your craving, perfectly matched | Platform Pemesanan Meja Kafe & Resto'`.
   - Default fallback nama bisnis kafe: `'Cravio'`.
   - Template pesan WhatsApp: Mengganti `'kafe SELA'` dengan `'platform Cravio'`.

2. **[`src/components/b2b/hero-flow-motion.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/hero-flow-motion.tsx):**
   - Mengganti teks `"Tampilan Pengguna Meja — Kafe SELA"` menjadi `"Tampilan Pengguna Meja — Cravio"`.

3. **[`src/components/b2b/customer-journey-section.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/customer-journey-section.tsx):**
   - Mengganti `"KAFE SELA"` pada kartu akrilik meja QR menjadi `"CRAVIO"`.
   - Mengganti `"SELA House Blend"` menjadi `"Cravio House Blend"`.

4. **[`src/components/b2b/catalog-and-qr-section.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/catalog-and-qr-section.tsx):**
   - Mengganti `"KAFE SELA"` pada pratinjau akrilik meja 300 DPI menjadi `"CRAVIO"`.

5. **[`src/components/b2b/consultation-modal.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/consultation-modal.tsx):**
   - Mengganti `"Nomor Bisnis Kafe SELA"` menjadi `"Nomor Bisnis Cravio"`.

6. **[`src/components/b2b/demo-menu-dataset.ts`](file:///d:/project/project-qr/cravio/src/components/b2b/demo-menu-dataset.ts):**
   - Mengganti deskripsi Kopi Susu Aren: `"Espresso blend SELA berpadu..."` menjadi `"Espresso blend khas berpadu gula aren organik dan susu segar."`.

7. **[`src/components/b2b/demo-quiz-simulator.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/demo-quiz-simulator.tsx):**
   - Mengganti `"• Kafe SELA"` menjadi `"• Cravio"`.

8. **[`src/components/b2b/pricing-breakdown.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/pricing-breakdown.tsx):**
   - Menghapus referensi sebutan SELA pada disclaimer ruang lingkup.

---

### C. Seksi KDS: Demo Audio Chime & Redesain Anti-AI-Slop
#### [MODIFY] [`src/components/b2b/kds-preview-section.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/kds-preview-section.tsx)

1. **Integrasi Demo Audio Chime Nyata (Web Audio API):**
   - Mengimpor `audioAlert` dari `@/lib/audio-alert`.
   - Membuat fungsi `handlePlayAudioDemo`:
     ```tsx
     const [isAudioPlaying, setIsAudioPlaying] = React.useState(false)

     const handlePlayAudioDemo = async () => {
       setIsAudioPlaying(true)
       await audioAlert.unlockAudio()
       audioAlert.playChime()
       setTimeout(() => setIsAudioPlaying(false), 1200)
     }
     ```
   - Menyematkan tombol interaktif di header KDS:
     ```tsx
     <button
       type="button"
       onClick={handlePlayAudioDemo}
       aria-label="Uji suara lonceng pesanan masuk"
       className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-stone-200 transition-all active:scale-95 cursor-pointer shadow-sm group"
     >
       <Volume2 className={cn("w-3.5 h-3.5 text-terracotta-400", isAudioPlaying && "animate-bounce text-amber-400")} />
       <span>{isAudioPlaying ? 'Lonceng Berbunyi... 🔔' : 'Uji Audio Chime Dapur'}</span>
     </button>
     ```

2. **Rekonstruksi Kartu Tiket KDS (Gaya Referensi 3):**
   - Mengganti border hijau neon yang kasar dengan kartu berlatar `#1A1816` dengan border `border-white/10`.
   - Memberikan aksen status aktif yang halus via `radial-gradient` lembut di sudut kartu tiket.
   - Status tag: pill membulat `rounded-full px-2.5 py-0.5 text-[10px] font-mono tracking-wider`.
   - Modifier dan catatan: disajikan dalam blok bergaris aksen kiri terakota (`border-l-2 border-terracotta-500/70 pl-2.5 py-1 text-[11px] text-stone-300 italic bg-white/[0.03] rounded-r-md`), bukan blok kotak cokelat tebal.
   - Tombol status pesanan: pill membulat `rounded-full px-4 py-2 text-xs font-semibold bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-sm transition-transform active:scale-95`.

---

### D. Widget Kuis Demonstrasi: Redesain Anti-AI-Slop
#### [MODIFY] [`src/components/b2b/demo-quiz-simulator.tsx`](file:///d:/project/project-qr/cravio/src/components/b2b/demo-quiz-simulator.tsx)

1. **Header & Status Breadcrumb:**
   - Tag simulasi di sudut kanan atas:
     ```tsx
     <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-white text-stone-700 border border-sand-200/80 shadow-xs flex items-center gap-1.5">
       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
       <span>Simulasi / Interactive Preview • Cravio</span>
     </span>
     ```
   - Segmented breadcrumb bar: Menata ulang progress langkah dengan pill kapsul modern dan animasi halus.

2. **Kartu Hasil Rekomendasi (Gaya Referensi 2):**
   - Pembungkus kartu: `rounded-3xl bg-white border border-sand-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-7 space-y-5`.
   - Match Score Pill: `rounded-full px-3 py-1 text-xs font-semibold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200/60`.
   - Item Rekomendasi Utama:
     - Nama item disorot dengan tipografi editorial *Instrument Serif* (`font-editorial text-2xl font-normal text-charcoal-950`).
     - Harga menggunakan font monospace terakota `text-base font-bold tabular-nums text-terracotta-600`.
     - Tag preferensi: pill membulat bersih tanpa dot bullet (`rounded-full bg-sand-100/80 text-stone-700 px-3 py-1 text-xs font-medium border border-sand-200/60`).
   - Kartu Alternatif: Bentuk kartu squircle horizontal minimalis dengan efek hover lift halus (`whileHover={{ y: -2 }}`).

---

### E. Penyesuaian Asersi Test Suite
#### [MODIFY] [`tests/integration/b2b-landing-page.test.ts`](file:///d:/project/project-qr/cravio/tests/integration/b2b-landing-page.test.ts)
* Memperbarui baris 82:
  ```ts
  // Dari:
  expect(screen.getByText(/pilot mitra: sela artisanal coffee & bake/i)).toBeInTheDocument()
  // Menjadi:
  expect(screen.getByText(/cravio — your craving, perfectly matched/i)).toBeInTheDocument()
  ```
* Memastikan seluruh 4 test integrasi B2B tetap lulus 100%.

---

## 3. Rencana Verifikasi (Verification Plan)

### A. Pengujian Otomatis
1. **TypeScript Type Safety:**
   `npx tsc --noEmit` $\rightarrow$ Exit Code `0`.
2. **ESLint Static Analysis:**
   `pnpm run lint` $\rightarrow$ Exit Code `0` (✔ No ESLint warnings or errors).
3. **Pengujian Integrasi Landing Page:**
   `pnpm exec vitest run tests/integration/b2b-landing-page.test.ts` $\rightarrow$ 4 passed.
4. **Full Test Suite:**
   `pnpm run test` $\rightarrow$ 43 test files passed, 100% PASS.
5. **Next.js Production Build:**
   `pnpm run build` $\rightarrow$ Exit Code `0`.

### B. Verifikasi Manual (UAT Scenarios)
1. **Verifikasi Logo & Branding:**
   - Buka landing page pada browser.
   - Periksa navbar: logo Cravio (`only-logo.jpeg`) dan wordmark `craivo` dengan tagline `your craving, perfectly matched` tampil rapi dan proporsional.
   - Periksa footer: logo dan tagline Cravio tampil konsisten, tidak ada lagi kata "SELA".
2. **Verifikasi Audio Demo KDS:**
   - Buka seksi *Visibilitas Barista & Dapur*.
   - Klik tombol *"Uji Audio Chime Dapur"*.
   - Dengarkan nada lonceng dua-nada akustik (880 Hz $\rightarrow$ 1320 Hz) berdentang jelas melalui speaker peramban tanpa jeda atau error.
3. **Verifikasi Desain KDS (Anti-AI-Slop):**
   - Amati kartu KDS: tidak ada lagi border hijau neon melingkar yang kaku. Kartu bernuansa gelap hangat dengan border `border-white/10`, badge pill halus, dan catatan kuliner beraksen garis terakota di kiri.
4. **Verifikasi Widget Kuis (Anti-AI-Slop):**
   - Jalankan kuis 3 langkah.
   - Amati layar hasil: kartu squircle lembut membulat (`rounded-3xl`), tag preferensi berupa pill bersih tanpa bullet point oranye yang canggung, dan tipografi editorial yang anggun.

