# SPESIFIKASI KONTRAK REST API & SKEMA ZOD (API-CONTRACTS.MD)
## Cravio — Your craving, Perfectly Matched
### Pilot Mitra Kafe: SELA (Artisanal Coffee & Bake)

> **Lokasi Berkas:** `docs/api-contracts.md`  
> **Status:** Baseline Disetujui (Phase 02 Complete)  
> **Terakhir Diperbarui:** 28 Oktober 2026  
> **Peran Penulis:** Technical Lead & API Architect  
> **Acuan Dokumen:** [`docs/adr/ADR-0004-independent-payment-and-fulfillment-state-machines.md`](file:///d:/project/project-qr/cravio/docs/adr/ADR-0004-independent-payment-and-fulfillment-state-machines.md) dan [`docs/adr/ADR-0005-transaction-integrity-idempotency-and-pricing-contracts.md`](file:///d:/project/project-qr/cravio/docs/adr/ADR-0005-transaction-integrity-idempotency-and-pricing-contracts.md).

---

## 1. Standar Desain API & Format Respon Global

Semua endpoint API beroperasi melalui protokol HTTPS, menerima dan mengembalikan data dalam format JSON, memvalidasi input secara ketat menggunakan skema Zod, dan mengembalikan nilai nominal moneter dalam satuan **Integer Rupiah (IDR)** tanpa pecahan sen/desimal.

### 1.1. Format Respon Terstandar (Envelope Pattern)

#### A. Format Respon Sukses (HTTP 200 / 201)
```json
{
  "success": true,
  "data": { ... }
}
```

#### B. Format Respon Error (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_ENUM",
    "message": "Pesan ramah pengguna dalam Bahasa Indonesia",
    "details": null
  }
}
```

### 1.2. Daftar Kode Error Baku (Error Code Enum)

| Kode Error | HTTP Status | Keterangan Penyebab |
|---|:---:|---|
| `VALIDATION_FAILED` | 400 | Payload request gagal validasi skema Zod (misal: catatan > 100 karakter). |
| `TABLE_NOT_FOUND` | 404 | Nomor meja tidak terdaftar dalam master data meja kafe. |
| `TABLE_INACTIVE` | 403 | Meja fisik sedang berstatus tutup / nonaktif oleh admin. |
| `ITEM_SOLD_OUT` | 409 | Menu yang dipilih telah habis (*Sold Out*) saat checkout. |
| `PRICE_CHANGED` | 409 | Harga menu di katalog telah diperbarui admin sejak quote dibuat; butuh konfirmasi. |
| `ORDER_NOT_FOUND` | 404 | ID pesanan tidak ditemukan di database. |
| `ORDER_EXPIRED` | 410 | Batas waktu pembayaran (15 mnt QRIS / 20 mnt Tunai) telah habis. |
| `UNAUTHORIZED` | 401 | Cookie staf tidak ada, kedaluwarsa, atau signature webhook salah. |
| `FORBIDDEN` | 403 | Role staf tidak berhak mengakses rute, atau `orderSecretToken` salah. |
| `CONCURRENCY_CONFLICT`| 409 | Status pesanan telah diubah lebih dulu oleh staf lain (optimistic locking). |
| `INTERNAL_SERVER_ERROR` | 500 | Terjadi kegagalan server yang tidak terduga. |

---

## 2. Endpoint Domain Pelanggan & Meja (`/api/*`)

### 2.1. Validasi Meja: `GET /api/tables/[tableNumber]`
* **Aktor:** Pelanggan Meja (Unauthenticated).
* **Fungsi:** Memvalidasi keberadaan nomor meja saat scan QR dan menerbitkan token sesi meja.
* **Skema Validasi Zod (Params):**
  ```typescript
  import { z } from 'zod';

  export const TableParamsSchema = z.object({
    tableNumber: z.string().trim().min(1).max(10),
  });
  ```
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "table": {
        "id": 5,
        "number": "05",
        "label": "Meja 05 (Indoor Bar)",
        "isActive": true
      },
      "tableSessionToken": "ey..." // JWT Sesi Meja (berlaku 12 jam)
    }
  }
  ```

---

### 2.2. Query Katalog Menu: `GET /api/menu`
* **Aktor:** Pelanggan Meja & Staf.
* **Fungsi:** Mengambil seluruh kategori aktif dan item menu yang tersedia, beserta opsi modifier.
* **Query Params (Opsional):**
  ```typescript
  export const MenuQuerySchema = z.object({
    category: z.string().optional(),
    search: z.string().max(50).optional(),
  });
  ```
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "categories": [
        { "id": "semua", "name": "Semua Menu", "displayOrder": 0 },
        { "id": "kopi", "name": "Kopi", "displayOrder": 1 },
        { "id": "non-kopi", "name": "Non-Kopi", "displayOrder": 2 },
        { "id": "makanan", "name": "Makanan", "displayOrder": 3 }
      ],
      "items": [
        {
          "id": "ks-latte",
          "categoryId": "kopi",
          "name": "Kopi Susu SELA",
          "description": "Espresso blend spesial dengan gula aren organik dan susu segar.",
          "basePrice": 28000,
          "imageUrl": "https://cdn.supabase.co/.../kopi-susu.webp",
          "isBestSeller": true,
          "isSoldOut": false,
          "tags": ["manis", "es", "santai"],
          "modifierGroups": [
            {
              "id": "grp-sugar",
              "name": "Tingkat Gula",
              "selectionType": "RADIO",
              "isRequired": true,
              "options": [
                { "id": "opt-s-100", "name": "Normal Sugar (100%)", "additionalPrice": 0 },
                { "id": "opt-s-50", "name": "Less Sugar (50%)", "additionalPrice": 0 },
                { "id": "opt-s-0", "name": "No Sugar (0%)", "additionalPrice": 0 }
              ]
            },
            {
              "id": "grp-milk",
              "name": "Pilihan Susu",
              "selectionType": "RADIO",
              "isRequired": false,
              "options": [
                { "id": "opt-m-dairy", "name": "Fresh Milk", "additionalPrice": 0 },
                { "id": "opt-m-oat", "name": "Oat Milk (+Rp 6.000)", "additionalPrice": 6000 }
              ]
            }
          ]
        }
      ]
    }
  }
  ```

---

### 2.3. Rekomendasi Menu Deterministik: `POST /api/recommendations`
* **Aktor:** Pelanggan Meja.
* **Fungsi:** Mengalkulasi rekomendasi tag matching 3 langkah secara deterministik (< 10 ms).
* **Skema Request Body (Zod):**
  ```typescript
  export const RecommendationInputSchema = z.object({
    mood: z.enum(['santai', 'fokus', 'mengobrol', 'segar']),
    flavor: z.enum(['manis', 'gurih', 'pahit', 'segar']),
    format: z.enum(['es', 'hangat', 'makanan', 'kudapan']),
  });
  ```
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "recommendations": [
        {
          "id": "ks-latte",
          "name": "Kopi Susu SELA",
          "basePrice": 28000,
          "imageUrl": "https://cdn.supabase.co/.../kopi-susu.webp",
          "score": 6,
          "matchReason": "Cocok untuk suasana santai dengan rasa manis dan sensasi es segar pilihanmu!"
        }
      ],
      "isFallback": false
    }
  }
  ```

---

### 2.4. Permintaan Quote Harga: `POST /api/orders/quote`
* **Aktor:** Pelanggan Meja (Sebelum Checkout).
* **Fungsi:** Menghitung subtotal resmi di server dan menerbitkan token quote.
* **Skema Request Body (Zod):**
  ```typescript
  export const OrderItemInputSchema = z.object({
    menuItemId: z.string().min(1),
    selectedModifierOptionIds: z.array(z.string()).default([]),
    quantity: z.number().int().min(1).max(50),
    notes: z.string().max(100).optional().default(''),
  });

  export const QuoteRequestSchema = z.object({
    tableNumber: z.string().min(1).max(10),
    items: z.array(OrderItemInputSchema).min(1),
  });
  ```
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "subtotalAmount": 62000,
      "taxAmount": 0,
      "totalAmount": 62000,
      "quoteHash": "a1b2c3d4e5...",
      "expiresAt": "2026-10-28T14:40:00.000Z"
    }
  }
  ```

---

### 2.5. Pembuatan Pesanan: `POST /api/orders`
* **Aktor:** Pelanggan Meja.
* **Header Wajib:**
  * `Idempotency-Key: <UUIDv4>`
  * `X-Table-Session-Token: <JWT>`
* **Skema Request Body (Zod):**
  ```typescript
  export const CreateOrderRequestSchema = z.object({
    tableNumber: z.string().min(1).max(10),
    paymentMethod: z.enum(['QRIS', 'CASH']),
    customerNotes: z.string().max(100).optional().default(''),
    quoteHash: z.string().min(1),
    items: z.array(OrderItemInputSchema).min(1),
  });
  ```
* **Respon Sukses 201 Created (Metode QRIS):**
  ```json
  {
    "success": true,
    "data": {
      "orderId": "ord_99a81c7e-b4af-44b8",
      "orderNumber": "SELA-261028-014",
      "tableNumber": "05",
      "paymentMethod": "QRIS",
      "paymentStatus": "PENDING",
      "orderStatus": "QUEUED",
      "subtotalAmount": 62000,
      "totalAmount": 62000,
      "qrisData": {
        "qrString": "00020101021226680016ID.CO.GOPAY...",
        "qrImageUrl": "https://api.sandbox.midtrans.com/v2/qris/ord_99a81c7e/qr-code",
        "expiresAt": "2026-10-28T14:45:00.000Z"
      },
      "orderSecretToken": "sec_b7c2d9e0f1a34567..." // Disimpan di localStorage pemesan
    }
  }
  ```
* **Respon Sukses 201 Created (Metode Tunai di Kasir):**
  ```json
  {
    "success": true,
    "data": {
      "orderId": "ord_22b71f3a-c5cd-44c9",
      "orderNumber": "SELA-261028-015",
      "tableNumber": "05",
      "paymentMethod": "CASH",
      "paymentStatus": "WAITING_CASHIER",
      "orderStatus": "QUEUED",
      "totalAmount": 62000,
      "cashInstructions": "Silakan tunjukkan Nomor Meja 05 atau Nomor Pesanan SELA-261028-015 ke meja kasir untuk melunasi pembayaran tunai.",
      "orderSecretToken": "sec_88d1f2e4a6b54321..."
    }
  }
  ```

---

### 2.6. Detail Pesanan Pelanggan: `GET /api/orders/[orderId]`
* **Header Wajib:** `X-Order-Secret-Token: sec_...` (atau query param `?token=...`).
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "orderId": "ord_99a81c7e-b4af-44b8",
      "orderNumber": "SELA-261028-014",
      "tableNumber": "05",
      "paymentMethod": "QRIS",
      "paymentStatus": "PAID",
      "orderStatus": "COOKING",
      "createdAt": "2026-10-28T14:30:00.000Z",
      "paidAt": "2026-10-28T14:32:15.000Z",
      "items": [
        {
          "name": "Kopi Susu SELA",
          "priceSnapshot": 28000,
          "quantity": 2,
          "modifiers": [
            { "name": "Less Sugar (50%)", "additionalPriceSnapshot": 0 },
            { "name": "Oat Milk", "additionalPriceSnapshot": 6000 }
          ],
          "subtotal": 68000
        }
      ],
      "totalAmount": 68000
    }
  }
  ```

---

### 2.7. Aliran SSE Pelacakan Pesanan: `GET /api/orders/[orderId]/stream`
* **Query Params Wajib:** `?token=sec_...`
* **Response Header:**
  * `Content-Type: text/event-stream`
  * `Cache-Control: no-cache, no-transform`
  * `Connection: keep-alive`
* **Format Event SSE:**
  ```text
  event: order_update
  data: {"orderId":"ord_99a81c7e","orderStatus":"COOKING","updatedAt":"2026-10-28T14:35:00.000Z"}

  event: heartbeat
  data: {"timestamp":1793198110}
  ```

---

## 3. Endpoint Eksternal: Webhook Payment Gateway

### 3.1. Webhook Midtrans: `POST /api/webhooks/midtrans`
* **Aktor:** Server Midtrans Gateway.
* **Fungsi:** Menerima notifikasi pelunasan QRIS otomatis.
* **Skema Validasi Zod (Payload):**
  ```typescript
  export const MidtransWebhookSchema = z.object({
    order_id: z.string(),
    status_code: z.string(),
    gross_amount: z.string(),
    signature_key: z.string(),
    transaction_status: z.string(),
    payment_type: z.string(),
    transaction_time: z.string().optional(),
    settlement_time: z.string().optional(),
  });
  ```
* **Logika Keamanan:**
  1. Hashing SHA512: `SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)`.
  2. Tolak dengan `401 Unauthorized` jika signature tidak cocok.
  3. Jika `transaction_status === "settlement" || transaction_status === "capture"`:
     * Ubah `paymentStatus` menjadi `PAID`.
     * Pancarkan event real-time `NEW_PAID_ORDER` ke KDS Dapur.
* **Respon Sukses 200 OK:** `{ "status": "ok" }`

---

## 4. Endpoint Staf Terotentikasi (`/api/staff/*` & `/api/admin/*`)

### 4.1. Login Staf: `POST /api/staff/auth/login`
* **Skema Request Body (Zod):**
  ```typescript
  export const StaffLoginSchema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('ADMIN'),
      username: z.string().min(3),
      password: z.string().min(6),
    }),
    z.object({
      type: z.literal('PIN'),
      role: z.enum(['CASHIER', 'KITCHEN']),
      pin: z.string().regex(/^\d{4,6}$/, 'PIN harus berupa 4-6 digit angka'),
    }),
  ]);
  ```
* **Respon Sukses 200 OK:**
  * Menyetel cookie `staff_session` (HTTP-Only, Secure, SameSite=Lax, Max-Age=43200 detik).
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "stf-01", "displayName": "Kasir Pagi", "role": "CASHIER" }
    }
  }
  ```

---

### 4.2. Aliran Real-time KDS: `GET /api/staff/kds/events`
* **Header Wajib:** Cookie `staff_session` (Role `KITCHEN`, `CASHIER`, atau `ADMIN`).
* **Response Header:** `Content-Type: text/event-stream`.
* **Format Event SSE:**
  ```text
  event: new_paid_order
  data: {"orderId":"ord_99a81c7e","orderNumber":"SELA-261028-014","tableNumber":"05","totalAmount":68000,"paidAt":"2026-10-28T14:32:15.000Z","items":[{"name":"Kopi Susu SELA","quantity":2,"notes":"less sugar"}]}

  event: order_status_changed
  data: {"orderId":"ord_99a81c7e","orderStatus":"COOKING","staffId":"stf-02"}
  ```

---

### 4.3. Pembaruan Status Alur Dapur: `PATCH /api/staff/orders/[orderId]/status`
* **Header Wajib:** Cookie `staff_session` (Role `KITCHEN`, `CASHIER`, atau `ADMIN`).
* **Skema Request Body (Zod):**
  ```typescript
  export const UpdateOrderStatusSchema = z.object({
    status: z.enum(['COOKING', 'READY', 'COMPLETED', 'CANCELLED']),
    cancelReason: z.string().max(150).optional(),
  });
  ```
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "orderId": "ord_99a81c7e",
      "orderStatus": "COOKING",
      "updatedAt": "2026-10-28T14:35:00.000Z"
    }
  }
  ```

---

### 4.4. Konfirmasi Tunai Kasir: `POST /api/staff/orders/[orderId]/cash-confirm`
* **Header Wajib:** Cookie `staff_session` (Role `CASHIER` atau `ADMIN`).
* **Fungsi:** Mengonfirmasi penerimaan uang tunai fisik dari tamu, mengubah `paymentStatus` menjadi `PAID`, mencatat log audit, dan meneruskan pesanan ke KDS dapur.
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "orderId": "ord_22b71f3a-c5cd-44c9",
      "paymentStatus": "PAID",
      "orderStatus": "QUEUED",
      "confirmedBy": "Kasir Pagi",
      "paidAt": "2026-10-28T14:40:00.000Z"
    }
  }
  ```

---

### 4.5. Quick Toggle Stok Habis (Sold Out): `PATCH /api/admin/menu/[id]/stock`
* **Header Wajib:** Cookie `staff_session` (Role `ADMIN` atau `KITCHEN` dengan PIN).
* **Skema Request Body (Zod):**
  ```typescript
  export const StockToggleSchema = z.object({
    isSoldOut: z.boolean(),
  });
  ```
* **Respon Sukses 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "menuItemId": "ks-latte",
      "name": "Kopi Susu SELA",
      "isSoldOut": true,
      "updatedAt": "2026-10-28T14:42:00.000Z"
    }
  }
  ```

