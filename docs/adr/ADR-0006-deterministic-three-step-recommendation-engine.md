# ADR-0006: Mesin Rekomendasi Menu Deterministik 3 Langkah SELA

## 1. Status
**ACCEPTED** (28 Oktober 2026)

## 2. Konteks & Masalah
Tujuan utama kuis kurasi rasa SELA adalah membantu pelanggan memilih menu dalam waktu $\le 30$ detik tanpa mengalami kebingungan (*decision fatigue*).

Terdapat dua diskrepansi dalam dokumen sumber:
1. **Jumlah Langkah Kuis:** Proposal awal mencantumkan 4 langkah (memasukkan Kategori sebagai langkah kuis), sedangkan prototipe visual SELA (`kuesioner-1.html` s/d `3.html`) membuktikan bahwa kuis 3 langkah jauh lebih cepat dan ergonomis di ponsel.
2. **Perbedaan Formula Pembobotan:** Dokumen `architecture.md` memuat rumus 4 dimensi (bobot 3-2-2-2), sedangkan runbook skill `preference-matching` memuat rumus 3 dimensi (bobot 3-2-1).

Dibutuhkan satu kontrak algoritma deterministik resmi yang cepat (< 10 ms), transparan, tanpa biaya API model AI/LLM pihak ketiga, dan konsisten di setiap pengujian unit.

## 3. Keputusan yang Ditetapkan

### 3.1. Struktur Kuis 3 Langkah SELA
Kuis kurasi selera resmi ditetapkan menjadi **3 Langkah Interaktif**:
1. **Langkah 1 (Suasana / Mood):** `santai`, `fokus`, `mengobrol`, `segar`.
2. **Langkah 2 (Karakter Rasa / Flavor):** `manis`, `gurih`, `pahit`, `segar`.
3. **Langkah 3 (Format & Suhu / Format & Temperature):** `es`, `hangat`, `makanan`, `kudapan`.

* **Filter Kategori:** Kategori menu (*Semua, Kopi, Non-Kopi, Makanan*) tetap dipertahankan sebagai **tab filter katalog** pada halaman menu (`/order/menu`), bukan sebagai langkah pertanyaan kuis yang redundan.
* **Tombol Lewati (*Skip*):** Selalu tampil di pojok kanan atas setiap langkah kuis. Menekan lewati langsung mengarahkan pelanggan ke katalog lengkap.

### 3.2. Formula Pembobotan Kanonis (Weighted Tag Matching)
Setiap item menu aktif yang tersedia dihitung skor relevansinya ($S$) menggunakan formula:

$$S = (W_{\text{flav}} \cdot M_{\text{flav}}) + (W_{\text{format}} \cdot M_{\text{format}}) + (W_{\text{mood}} \cdot M_{\text{mood}}) + B_{\text{seller}}$$

* $W_{\text{flav}} = 3$: Karakter rasa memiliki bobot terbesar karena merupakan preferensi sensorik utama lidah.
* $W_{\text{format}} = 2$: Format sajian (minuman dingin/hangat atau makanan/kudapan) memiliki bobot kedua.
* $W_{\text{mood}} = 1$: Konteks suasana hati memberikan bobot pelengkap.
* $B_{\text{seller}} = 1$: Poin kurasi tambahan jika menu berstatus *Best Seller* (`isBestSeller: true`).
* Nilai $M \in \{0, 1\}$ bernilai $1$ jika tag item menu cocok dengan jawaban kuis pelanggan, dan $0$ jika tidak cocok.

### 3.3. Ambang Batas Skor & Jumlah Hasil Rekomendasi
* **Ambang Batas Minimal (*Threshold*):** Menu wajib memperoleh skor minimal $S \ge 3$ untuk layak disajikan sebagai rekomendasi kurasi.
* **Jumlah Hasil Maksimal:** Menampilkan maksimal **2 menu teratas** guna menjaga fokus visual pelanggan dan mencegah kebingungan memilih.

### 3.4. Hierarki Penentu Seri Bertingkat (5-Level Tie-Breaker)
Jika terdapat dua atau lebih menu yang memiliki skor identik ($S$), urutan ditentukan secara deterministik melalui 5 tingkat:
1. Skor total ($S$) tertinggi (`score DESC`).
2. Menu dengan badge Best Seller (`isBestSeller: true` diprioritaskan).
3. Popularitas pesanan historis (`orderCount DESC` — jumlah pesanan sukses yang tercatat di database).
4. Harga menu terendah (`basePrice ASC` — memprioritaskan opsi yang lebih ekonomis bagi tamu).
5. Nama alfabetis konsisten (`name ASC` — menjamin determinisme 100% pada unit test).

### 3.5. Filter Stok & Mekanisme Fallback
1. **Filter Stok Habis (*Sold Out*):** Item dengan `isSoldOut: true` **seketika dieksklusikan** sebelum proses skoring dimulai. Menu habis dilarang direkomendasikan.
2. **Fallback Otomatis:** Jika tidak ada item yang mencapai skor minimal $S \ge 3$ (misal kombinasi tag langka atau stok habis), sistem menampilkan **2 menu Best Seller terpopuler yang tersedia** dengan copywriting ramah:
   > *"Pilihan favorit pelanggan kafe SELA yang cocok dinikmati kapan saja."*
3. **Fallback Lewati:** Jika pelanggan menekan tombol *"Lewati Kuis"*, sistem mengembalikan seluruh katalog menu tanpa filter rekomendasi.

### 3.6. Garansi Deterministik Tanpa AI / LLM
* Algoritma ditulis murni dalam fungsi TypeScript lokal (`src/lib/recommendation.ts`).
* **DILARANG KERAS memanggil API OpenAI, Gemini, Claude, atau model AI/LLM lainnya di alur kalkulasi runtime rekomendasi.**
* Waktu eksekusi kalkulasi dijamin instan ($\le 5\text{ ms}$).

## 4. Konsekuensi & Trade-Off
* **Keuntungan:** Nol biaya API pihak ketiga, nol latensi komputasi AI, hasil uji dapat diprediksi secara matematis (100% deterministic test coverage), dan transparan bagi pemilik kafe.
* **Kelemahan & Mitigasi:** Rekomendasi bergantung pada akurasi tagging menu oleh admin kafe; dimitigasi dengan form selector tag terstruktur bawaan pada dashboard Admin.

