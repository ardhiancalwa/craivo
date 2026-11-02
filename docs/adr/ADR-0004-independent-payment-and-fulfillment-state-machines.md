# ADR-0004: Pemisahan Mesin Status Pembayaran & Pemrosesan Dapur

## 1. Status
**ACCEPTED** (28 Oktober 2026)

## 2. Konteks & Masalah
Operasional kafe fisik melibatkan dua alur hidup yang memiliki aktor, pemicu, dan tanggung jawab hukum yang berbeda:
1. **Siklus Finansial (Payment Lifecycle):** Berhubungan dengan payment gateway Midtrans dan penerimaan uang fisik di kasir.
2. **Siklus Fisik Hidangan (Fulfillment Lifecycle):** Berhubungan dengan juru masak dapur dan barista yang meracik pesanan.

Mencampur kedua siklus ini ke dalam satu kolom status tunggal (seperti `status: "PENDING" | "COOKING" | "PAID"`) menimbulkan celah keamanan operasional yang fatal: makanan bisa mulai dimasak sebelum uang diterima kasir, atau webhook settlement dapat menimpa status dapur yang sedang meracik hidangan.

## 3. Keputusan yang Ditetapkan

### 3.1. Dua Mesin Status Independen (Two Independent State Machines)
Database PostgreSQL memisahkan status ke dalam dua enum relasional yang independen:

```prisma
enum PaymentStatus {
  PENDING           // Menunggu pembayaran QRIS gateway
  WAITING_CASHIER   // Menunggu pelunasan tunai fisik di kasir
  PAID              // Pembayaran terverifikasi lunas 100% sah
  EXPIRED           // Melewati batas waktu toleransi (15 mnt QRIS / 20 mnt Tunai)
  FAILED            // Pembayaran ditolak gateway / dibatalkan
}

enum OrderStatus {
  QUEUED            // Masuk antrean dapur setelah lunas (Kitchen Gate)
  COOKING           // Barista / Koki sedang meracik hidangan
  READY             // Hidangan siap saji / siap diantar ke meja
  COMPLETED         // Pesanan telah diserahkan ke meja pelanggan
  CANCELLED         // Pesanan dibatalkan (oleh Kasir / sistem auto-cancel)
}
```

### 3.2. Penegakan Mutlak Kitchen Gate Policy (`DEC-013`)
* **Aturan Baku:** Layar KDS Dapur **HANYA** menampilkan pesanan yang memenuhi kriteria predikat:
  $$\text{paymentStatus} = \text{'PAID'} \quad \text{AND} \quad \text{orderStatus} \in [\text{'QUEUED'}, \text{'COOKING'}, \text{'READY'}]$$
* Pesanan tunai yang baru dibuat (`paymentStatus: WAITING_CASHIER`) tertahan di kasir. Dapur tidak pernah melihat atau memasak pesanan ini sebelum kasir menerima uang dan mengklik *"Konfirmasi Tunai"*.

### 3.3. Matriks Transisi Status Terpadu (State Transition Table)

| Dari State | Menuju State | Pemicu (Actor / Event) | Prasyarat (Preconditions) | Efek Samping (Side Effects) |
|---|---|---|---|---|
| *None* | `Payment: PENDING`<br>`Order: QUEUED` *(hidden)* | Pelanggan klik "Checkout QRIS" | Meja aktif, stok tersedia, quote harga valid | Generate QRIS Midtrans 15 mnt, simpan `orderSecretToken` |
| *None* | `Payment: WAITING_CASHIER`<br>`Order: QUEUED` *(hidden)* | Pelanggan klik "Checkout Tunai" | Meja aktif, stok tersedia, quote harga valid | Masuk antrean kasir POS, timer toleransi 20 mnt aktif |
| `Payment: PENDING` | `Payment: PAID`<br>`Order: QUEUED` *(visible)* | Webhook Midtrans (`settlement`) | Signature SHA512 cocok, gross amount cocok | **Trigger KDS Antrean Masak + Denting Audio Chime** |
| `Payment: WAITING_CASHIER` | `Payment: PAID`<br>`Order: QUEUED` *(visible)* | Kasir klik "Konfirmasi Tunai" | Kasir membawa cookie valid, uang diterima | Catat `cashierId` ke AuditLog, **Trigger KDS + Chime** |
| `Order: QUEUED` | `Order: COOKING` | Barista klik "Mulai Buat" | `PaymentStatus == PAID` | Ubah warna kartu KDS, dorong event SSE ke pelacak tamu |
| `Order: COOKING` | `Order: READY` | Barista klik "Siap Saji" | `PaymentStatus == PAID` | Kartu KDS berpindah ke kolom Siap Saji, notifikasi ke tamu |
| `Order: READY` | `Order: COMPLETED` | Staf klik "Selesai" | Hidangan telah sampai di meja | Kartu KDS masuk riwayat selesai, struk digital final |
| `Payment: PENDING` | `Payment: EXPIRED`<br>`Order: CANCELLED` | Gateway webhook `expire` / Reconciler | Batas waktu 15:00 menit terlampaui | Kunci tampilan QRIS, kirim status batal ke pelanggan |
| `Payment: WAITING_CASHIER` | `Payment: EXPIRED`<br>`Order: CANCELLED` | Auto-cancel kasir | Batas waktu 20:00 menit terlampaui | Hapus dari antrean kasir aktif, catat audit log |
| `Order: QUEUED / COOKING` | `Order: CANCELLED` | Kasir klik "Void / Batalkan" | Staf role CASHIER/ADMIN, input alasan | Hapus dari antrean KDS, catat refund manual jika sudah bayar |

### 3.4. Penanganan Konkurensi & Idempotensi (Optimistic Locking)
* **Pencegahan Konflik Dua Staf:** Mutasi status dapur menggunakan conditional SQL update pada Prisma:
  ```typescript
  const updated = await prisma.order.updateMany({
    where: { id: orderId, orderStatus: currentExpectedStatus },
    data: { orderStatus: nextStatus, updatedAt: new Date() },
  });
  if (updated.count === 0) {
    throw new ConcurrencyConflictError("Status pesanan telah diubah oleh staf lain.");
  }
  ```
* **Idempotensi Webhook Callback:** Jika webhook notifikasi kedua untuk `orderId` yang sama masuk saat status sudah `PAID`, server mencatat audit log dan merespons `200 OK` tanpa memicu chime KDS ganda.

## 4. Konsekuensi & Trade-Off
* **Keuntungan:** Integritas finansial terjamin 100%, dapur terproteksi dari kerugian memasak pesanan bodong/batal, data audit transaksi sangat bersih dan mudah direkonsiliasi.
* **Kelemahan & Mitigasi:** Membutuhkan penulisan query filter yang konsisten di repository layer; dimitigasi dengan pembungkusan fungsi domain `orderService.getKitchenOrders()` yang sudah terkunci filter statusnya.

