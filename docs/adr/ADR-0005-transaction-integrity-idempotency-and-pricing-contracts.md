# ADR-0005: Integritas Finansial, Quote Harga, Idempotensi, & Hash Token Meja

## 1. Status
**ACCEPTED** (28 Oktober 2026)

## 2. Konteks & Masalah
Sebagai aplikasi pemesanan dan pembayaran kafe mandiri, sistem menghadapi berbagai risiko finansial dan keamanan transaksi:
1. **Manipulasi Harga oleh Klien (*Price Tampering*):** Pengguna jahat dapat memodifikasi payload HTTP untuk mengirimkan nominal tagihan palsu (misal Rp 1.000 untuk tagihan Rp 100.000).
2. **Perubahan Harga Katalog saat Pelanggan Berbelanja:** Jika admin menaikkan harga menu saat pelanggan sedang menyusun keranjang belanja, transaksi tidak boleh diproses secara diam-diam tanpa persetujuan pelanggan.
3. **Pemesanan Ganda Akibat Jaringan (*Double Submit*):** Pelanggan yang menekan tombol *Checkout* dua kali secara cepat atau retry jaringan dapat menyebabkan dua pesanan identik dibuat di database.
4. **Privasi QR Meja Publik:** Siapapun dapat memotret kode QR fisik meja kafe. Tidak boleh ada data pesanan atau riwayat pembayaran yang bocor hanya karena seseorang mengetahui nomor meja.
5. **Serangan Webhook Palsu (*Fake Webhook Injection*):** Pihak ketiga dapat menembak endpoint callback pembayaran untuk menandai pesanan lunas secara ilegal.

## 3. Keputusan yang Ditetapkan

### 3.1. Kalkulasi Harga Sisi Server & Snapshot Permanen
* **Server-Authoritative:** Klien **DILARANG** mengirimkan total harga rupiah ke server. Klien hanya mengirimkan array:
  ```json
  [
    { "menuItemId": "ks-latte", "selectedModifierOptionIds": ["opt-sugar-50", "opt-oat"], "quantity": 2 }
  ]
  ```
* **Mata Uang Integer IDR Murni:** Seluruh harga dasar, modifier, subtotal, dan total bayar dihitung dan disimpan dalam satuan integer Rupiah tanpa desimal (contoh: `28000`).
* **Price Snapshotting:** Saat pesanan dibuat, server merekam snapshot nama dan harga pada tabel `OrderItem` dan `OrderItemModifier`:
  * `priceSnapshot`: Harga dasar item saat transaksi.
  * `additionalPriceSnapshot`: Biaya tambahan modifier saat transaksi.
  Perubahan harga di katalog admin di masa depan tidak akan pernah mengubah riwayat transaksi historis, laporan keuangan, atau struk lama.

### 3.2. Deteksi Perubahan Harga via Quote Server (`PRICE_CHANGED`)
* Sebelum checkout, klien meminta quote harga via `POST /api/orders/quote` yang menghasilkan `quoteHash` dan timestamp masa berlaku quote.
* Saat checkout dieksekusi di `POST /api/orders`, server memverifikasi ulang harga setiap item terhadap database:
  * Jika harga di database telah berubah oleh admin sejak quote dibuat, server menolak transaksi dengan kode error `PRICE_CHANGED` dan mengembalikan rincian nominal terbaru.
  * Klien menampilkan pop-up transparan: *"Harga menu [Nama] telah diperbarui menjadi Rp XX.000. Lanjutkan pemesanan?"*.

### 3.3. Idempotensi Mutlak Berbasis Database (`Idempotency-Key`)
* Klien menyertakan header `Idempotency-Key: <UUIDv4>` pada setiap request pembuatan pesanan.
* Server mencatat kunci tersebut pada tabel `IdempotencyRecord` dengan constraint `UNIQUE("key", "scope")`:
  ```prisma
  model IdempotencyRecord {
    id          String   @id @default(uuid())
    key         String   @unique
    scope       String   // misal: "CREATE_ORDER"
    statusCode  Int
    responseBody Json
    createdAt   DateTime @default(now())
  }
  ```
* Jika request dengan key yang sama tiba dalam waktu 24 jam, server langsung mengembalikan `responseBody` yang tersimpan tanpa membuat pesanan baru di database.

### 3.4. Token Rahasia Pelanggan Kriptografis (`orderSecretToken`)
* QR meja fisik bersifat publik. Akses ke pesanan dilindungi token rahasia acak 256-bit:
  ```typescript
  import crypto from 'node:crypto';
  const rawToken = crypto.randomBytes(32).toString('hex'); // 64 karakter hex
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  ```
* **Penyimpanan:** Database hanya menyimpan `orderSecretTokenHash` (SHA-256). Token mentah `rawToken` hanya dikirimkan satu kali ke peramban pemesan saat pesanan dibuat dan disimpan di `localStorage`.
* **Validasi:** Endpoint pelacak pesanan (`/order/[id]/track`), detail pesanan, dan SSE stream pelanggan wajib menyertakan token via header `X-Order-Secret-Token` atau query parameter `?token=...`. Request tanpa hash yang cocok ditolak `403 Forbidden`.

### 3.5. Verifikasi Keamanan Webhook Midtrans (SHA512)
* Webhook Midtrans wajib diverifikasi menggunakan signature hash SHA512:
  $$\text{Expected Signature} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{MIDTRANS\_SERVER\_KEY})$$
* Jika signature tidak cocok, server mengembalikan respon `401 Unauthorized` dan mengabaikan payload.
* Jika status pesanan di database sudah `PAID` (notifikasi duplikat), server langsung membalas `200 OK` tanpa memicu mutasi status atau audio lonceng dapur ulang.

### 3.6. Format Respon & Error API Terstandar
Seluruh respon API mengikuti skema konsisten:
```json
// Respon Sukses:
{
  "success": true,
  "data": { ... }
}

// Respon Error:
{
  "success": false,
  "error": {
    "code": "PRICE_CHANGED",
    "message": "Harga satu atau beberapa menu telah diperbarui. Silakan konfirmasi ulang.",
    "details": { "updatedTotal": 32000 }
  }
}
```

## 4. Konsekuensi & Trade-Off
* **Keuntungan:** Nol celah manipulasi harga oleh klien, bebas duplikasi pesanan saat jaringan lambat, privasi tamu meja terjamin 100%, dan tahan serangan webhook palsu.
* **Kelemahan & Mitigasi:** Menambah 1 tabel `IdempotencyRecord`; dimitigasi dengan job pembersihan (*cleanup*) berkala untuk record yang berusia $>24$ jam.

