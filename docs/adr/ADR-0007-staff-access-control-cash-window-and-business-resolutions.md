# ADR-0007: Kontrol Akses Staf, Toleransi Tunai 20 Menit, & Resolusi Isu Terbuka

## 1. Status
**ACCEPTED** (28 Oktober 2026)

## 2. Konteks & Masalah
Pada tahap audit dokumen awal, terdapat 4 pertanyaan bisnis dan operasional yang berstatus terbuka (*OPEN*):
1. Format kredensial admin (apakah menggunakan password terenkripsi atau PIN cepat).
2. Otoritas penandaan menu habis (*Sold Out*) oleh barista langsung dari tablet dapur.
3. Batas waktu toleransi pelunasan tunai di kasir sebelum pesanan otomatis digugurkan.
4. Prosedur pembatalan dan pengembalian dana (*refund*).
5. Disambiguasi antara biaya kontrak pengembangan kafe perdana dengan harga penawaran paket komersial B2B di landing page.

## 3. Keputusan yang Ditetapkan

### 3.1. Pemisahan Kredensial Admin vs Staf Kasir/Dapur (`OPN-03`)
* **Admin / Pemilik Kafe:** Mengakses data sensitif (omzet harian, harga jual menu, dan generator QR). Menggunakan kredensial **Username / Email + Password Kuat** yang di-hash dengan `bcrypt` (salt rounds = 10).
* **Kasir & Barista Dapur:** Dituntut kecepatan saat pergantian shift di meja kasir atau bar kopi. Menggunakan **PIN Cepat 4–6 Digit** yang disimpan sebagai hash `bcrypt`. Tidak mewajibkan pengetikan password panjang di layar tablet fisik yang rentan terlihat tamu.
* **Manajemen Sesi:** Keduanya menghasilkan cookie terenkripsi HTTP-Only `staff_session` dengan masa aktif 12 jam (shift kerja).

### 3.2. Wewenang Cepat Sakelar Stok (*Sold Out*) oleh Barista di KDS (`OPN-02`)
* **Ketetapan:** **DISETUJUI & DIBERIKAN IZIN**.
* **Mekanisme:** Pada header dashboard KDS Dapur (`/staff/kitchen`), disediakan tombol menu cepat *"Kelola Stok Bahan"*.
* Barista dapat menandai item menu `isSoldOut: true` dalam waktu $\le 5$ detik dengan konfirmasi PIN staf dapur.
* **Dampak:** Responsivitas tinggi saat bahan baku (seperti susu oat atau biji kopi tertentu) mendadak habis di jam sibuk kafe (*rush hour*). Item langsung terkunci dari penambahan keranjang pelanggan tanpa perlu memanggil manajer atau admin kafe.

### 3.3. Batas Waktu Toleransi Pembayaran Tunai Kasir: 20 Menit (`OPN-01`)
* Saat pelanggan memilih metode *"Bayar Tunai di Kasir"*, pesanan dibuat dengan status `paymentStatus: WAITING_CASHIER`.
* **Batas Toleransi:** Pelanggan memiliki waktu maksimal **20 menit** untuk menuju kasir dan menyerahkan uang fisik.
* Jika melewati 20 menit kasir belum menekan tombol konfirmasi, server background task menandai pesanan sebagai `EXPIRED / CANCELLED`, menghapusnya dari antrean aktif kasir, dan membebaskan nomor meja.
* Menghilangkan penumpukan pesanan menggantung (*hanging orders*) jika tamu membatalkan niat belanja atau meninggalkan meja tanpa konfirmasi.

### 3.4. Prosedur Pembatalan & Pengembalian Dana (*Manual Refund*)
* **Pelanggan:** Tidak memiliki wewenang membatalkan pesanan secara sepihak setelah pesanan terkirim (mencegah pesanan jahat / *prank order*).
* **Kasir:** Memiliki tombol *"Batalkan Pesanan"* (*Void*) dengan validasi alasan tertulis pada sistem audit log, dengan batas toleransi sebelum pesanan masuk status `COOKING` di dapur.
* **Prosedur Refund (Pesanan QRIS Lunas):** Jika pesanan QRIS yang sudah berstatus `PAID` terpaksa dibatalkan (misal mesin espresso kafe rusak), kasir menyelesaikan pengembalian dana (*refund*) **secara manual langsung (tunai atau transfer langsung)** kepada pelanggan di tempat.
* **Larangan:** Fitur *Automated Gateway Refund API* secara tegas **di luar lingkup (out-of-scope)** pada versi 1 guna menghindari kompleksitas rekonsiliasi escrow bank.

### 3.5. Disambiguasi Komersial B2B vs Kontrak Kafe Perdana (`OPN-04`)
* **Rp 750.000:** Merupakan **Biaya Jasa Kontrak Pengembangan Awal untuk Kafe Mitra Perdana (SELA)**. Skema pembayaran: DP 50% (Rp 375.000) + Pelunasan 50% (Rp 375.000) setelah UAT. Nilai ini bersifat internal pengembang.
* **Rp 2.500.000:** Merupakan **Harga Penawaran Komersial Paket B2B Cravio** yang dipajang pada landing page publik `/` untuk pemilik kafe/restoran lain (mencakup lisensi setup sistem, hosting cloud tahun pertama, master file cetak QR akrilik, dan pelatihan staf).
* Tombol CTA WhatsApp pada landing page terhubung langsung ke nomor perwakilan komersial pengembang dengan template pesan ramah siap kirim.

## 4. Konsekuensi & Trade-Off
* **Keuntungan:** Kejelasan wewenang operasional antara kasir, barista, dan admin; dapur cepat merespons bahan habis; antrean kasir tidak tersumbat pesanan menggantung; batasan finansial B2B transparan.
* **Kelemahan & Mitigasi:** Pembatalan QRIS memerlukan penanganan uang tunai manual oleh kasir; dimitigasi dengan form pencatatan alasan void pada dashboard kasir untuk pembukuan kas harian kafe.

