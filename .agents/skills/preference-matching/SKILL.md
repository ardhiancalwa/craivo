---
name: preference-matching
description: >-
  Modify, verify, or test the customer preference curation quiz algorithm, weighted tag matching, scoring, tie-breaking, and stock fallback logic. Use when updating recommendation scoring, adding new taste/mood/format tags, tuning tag weights, or testing deterministic menu recommendations without external AI/LLMs.
---

# Prosedur Kurasi Rekomendasi Preferensi Selera (preference-matching)

Skill ini memandu implementasi, penyesuaian bobot, dan pengujian algoritma kurasi rekomendasi menu SELA Smart QR Menu berdasarkan pencocokan tag deterministik tanpa model AI/LLM pihak ketiga.

---

## 1. Trigger (Kapan Skill Ini Digunakan)
Gunakan skill ini setiap kali Anda:
* Mengubah atau mengoptimalkan logika perhitungan skor rekomendasi menu.
* Menambahkan atau memodifikasi tag rasa (*sweet, bitter, creamy*), suasana/mood (*relax, focus, refresh*), atau suhu/format (*iced, hot*).
* Menyesuaikan bobot (*weight*) kategori pertanyaan kuis.
* Memperbaiki logika penanganan seri (*tie-break*) atau fallback saat menu habis (*sold-out*).
* Menulis atau menjalankan unit test untuk memastikan output rekomendasi bersifat deterministik.

---

## 2. Invarian Mutlak (Non-Negotiable)
> [!CAUTION] Dilarang Menggunakan Layanan AI / LLM Eksternal
> Algoritma kurasi preferensi konsumen **100% deterministik** berbasis pencocokan bobot tag (*Weighted Tag Matching*).  
> **Dilarang keras menyertakan dependensi OpenAI, Gemini, atau model AI pihak ketiga ke dalam alur runtime rekomendasi menu.**

---

## 3. Input & Prasyarat

### Input
* Jawaban kuis pelanggan dari 3 langkah kurasi selera:
  * `mood`: `RELAX` | `FOCUS` | `REFRESH`
  * `flavor`: `SWEET_CREAMY` | `ACIDIC_FRUITY` | `BOLD_BITTER`
  * `format`: `ICED` | `HOT`
* Data menu aktif dari database yang memuat relasi tag preferensi (`MenuTag`).

### Dokumen Rujukan Wajib
* [architecture.md](../../../architecture.md) — Seksi 6: Mesin Rekomendasi Preferensi Berbasis Tag.
* [docs/PRD.md](../../../docs/PRD.md) — Kebutuhan `REQ-CUST-02` (Kuis) dan `REQ-CUST-03` (Rekomendasi).
* [design.md](../../../design.md) — Seksi 6.1 (Layar Hasil Kurasi `SCR-CUST-03`) dan Seksi 8 (Microcopy Alasan Rekomendasi).
* [agent.md](../../../agent.md) — Seksi 7: Aturan Mesin Rekomendasi Selera.

---

## 4. Langkah Kerja Berurutan

### Langkah 1: Normalisasi Jawaban Kuis
Validasi dan petakan jawaban kuis ke dalam array tag pencocokan standar menggunakan schema Zod:
```typescript
interface QuizAnswers {
  mood?: 'RELAX' | 'FOCUS' | 'REFRESH';
  flavor?: 'SWEET_CREAMY' | 'ACIDIC_FRUITY' | 'BOLD_BITTER';
  format?: 'ICED' | 'HOT';
}
```

### Langkah 2: Hitung Bobot Tag Menu (*Scoring Function*)
Gunakan rumus bobot resmi proyek:
$$\text{Skor Menu} = \sum (\text{Tag Cocok} \times \text{Bobot Kategori})$$
* Bobot Default:
  * Rasa (`flavor`): **Bobot 3** (faktor penentu utama kenikmatan).
  * Format/Suhu (`format`): **Bobot 2** (faktor kenyamanan fisik minuman).
  * Suasana/Mood (`mood`): **Bobot 1** (faktor pengarah kurasi).

### Langkah 3: Filter Ketersediaan (*In-Stock Guard*)
Hanya menu dengan status ketersediaan aktif (`isAvailable: true`) yang berhak masuk ke dalam proses perangkingan. Menu yang berstatus *Sold Out* wajib diabaikan dari nominasi rekomendasi utama.

### Langkah 4: Terapkan Aturan Tie-Break Konsisten
Jika dua atau lebih menu menghasilkan skor yang sama, urutkan dengan aturan berjenjang:
1. Prioritas 1: Menu bertanda *Best Seller / Favorit* (`isFeatured: true`).
2. Prioritas 2: Total kuantitas penjualan historis tertinggi (`orderCount DESC`).
3. Prioritas 3: Harga nominal rupiah terendah (`price ASC`).

### Langkah 5: Sediakan Fallback Dinamis
* **Kasus Seluruh Menu Cocok Habis:** Jika seluruh menu yang cocok dengan kuis berstatus *Sold Out*, kembalikan 2 menu *Best Seller* yang saat ini tersedia dengan alasan: `"Menu racikan ini sedang habis, berikut opsi favorit serupa yang tersedia hari ini."`.
* **Kasus Tombol "Lewati" Ditekan:** Jika pelanggan mengklik tombol `Lewati` di layar kuis, sistem langsung mengembalikan katalog lengkap tanpa memaksakan hasil kuis.

### Langkah 6: Sintesis Alasan Rekomendasi & Disclaimer Alergi
Buat teks alasan singkat yang transparan berdasarkan tag yang cocok (contoh: `"Dipilih karena memadukan espresso arabika dengan rasa manis aren seimbang dan kesegaran es."`).  
**Wajib menyertakan disclaimer:** `"Rekomendasi disajikan berdasarkan preferensi rasa yang Anda pilih. Harap konfirmasikan alergi bahan pangan ke staf kafe kami."`

---

## 5. Validasi & Pengujian

### Uji Kasus Unit Deterministik (Vitest / Test Checklist)
1. **Uji Konsistensi Output:** Input yang sama wajib menghasilkan menu rekomendasi nomor 1 yang identik pada 100x pengujian berulang.
2. **Uji Filter Menu Habis:** Tandai menu rekomendasi utama menjadi `isAvailable: false`, pastikan menu tersebut tidak muncul dan menu urutan berikutnya naik menggantikannya.
3. **Uji Penanganan Skip:** Panggil fungsi rekomendasi dengan payload kosong (`{}`), pastikan sistem tidak melempar error dan mengembalikan daftar menu favorit/katalog.

```powershell
# Jalankan test suite rekomendasi jika test runner telah di-scaffold:
pnpm run test tests/unit/recommendation.test.ts
```

---

## 6. Tindakan Bila Menemui Hambatan
* Jika terdapat permintaan untuk menambahkan integrasi LLM/AI ke kuis rekomendasi, tolak dan tegaskan invarian proposal serta [agent.md](../../../agent.md) Seksi 7.
* Jika bobot tag menghasilkan rekomendasi yang bias atau tidak merata, lakukan penyesuaian bobot pada file konfigurasi `src/lib/recommendation.ts` dan catat perubahannya pada dokumen arsitektur.
