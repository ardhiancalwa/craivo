# KATALOG RECORD KEPUTUSAN ARSITEKTUR (ARCHITECTURE DECISION RECORDS)
## Cravio — Your craving, Perfectly Matched
### Pilot Mitra Kafe: SELA (Artisanal Coffee & Bake)

> **Lokasi Direktori:** `docs/adr/`  
> **Status:** Baseline Disetujui (Phase 02 Complete)  
> **Terakhir Diperbarui:** 28 Oktober 2026  
> **Peran Penulis:** Technical Lead & Software Architect  

---

## 1. Daftar Record Keputusan Arsitektur (ADR)

Berikut adalah daftar ketetapan arsitektur yang mengikat seluruh rekayasa perangkat lunak sistem Cravio:

| Nomor ADR | Judul Keputusan Arsitektur | Status | Dokumen Terkait | Ringkasan Inti |
|---|---|:---:|---|---|
| **[ADR-0001](file:///d:/project/project-qr/cravio/docs/adr/ADR-0001-hosting-database-and-realtime.md)** | Strategi Hosting Vercel Free Tier, PostgreSQL Terkelola, & Resilient SSE | **ACCEPTED** | `techstack.md`, `spec-audit.md` | Deployment Vercel Free Tier Rp 0/bln, Supabase/Neon PostgreSQL via Supavisor pooler, dan Resilient SSE Stream auto-reconnect 25–30s untuk batas timeout serverless. |
| **[ADR-0002](file:///d:/project/project-qr/cravio/docs/adr/ADR-0002-staff-auth-and-server-mediated-realtime.md)** | Integrasi Autentikasi Staf Cookie HTTP-Only & Server-Mediated SSE | **ACCEPTED** | `architecture.md`, `agent.md` | Melarang pembukaan tabel order ke anon key Supabase Realtime; seluruh streaming data KDS dan tracker pelanggan dikontrol oleh server Next.js melalui validasi cookie staf dan token `orderSecretToken`. |
| **[ADR-0003](file:///d:/project/project-qr/cravio/docs/adr/ADR-0003-single-canonical-route-map.md)** | Peta Rute Tunggal & Bersih (Single Canonical Route Map) | **ACCEPTED** | `docs/route-map.md` | Mengeliminasi tabrakan rute `/`; menetapkan `/` untuk B2B Cravio, `/order?table=XX` untuk pintu pelanggan meja SELA, serta sub-rute fungsional terisolasi. |
| **[ADR-0004](file:///d:/project/project-qr/cravio/docs/adr/ADR-0004-independent-payment-and-fulfillment-state-machines.md)** | Pemisahan Mesin Status Pembayaran & Pemrosesan Dapur | **ACCEPTED** | `architecture.md`, `PRD.md` | Pemisahan tegas `PaymentStatus` dan `OrderStatus`, penegakan mutlak Kitchen Gate Policy `PAID-only` (`DEC-013`), dan penanganan konkurensi status. |
| **[ADR-0005](file:///d:/project/project-qr/cravio/docs/adr/ADR-0005-transaction-integrity-idempotency-and-pricing-contracts.md)** | Integritas Finansial, Quote Harga, Idempotensi, & Hash Token Meja | **ACCEPTED** | `docs/api-contracts.md` | Server-authoritative integer rupiah, quote harga untuk deteksi perubahan harga saat checkout, header `Idempotency-Key`, dan SHA-256 hash untuk token guest. |
| **[ADR-0006](file:///d:/project/project-qr/cravio/docs/adr/ADR-0006-deterministic-three-step-recommendation-engine.md)** | Mesin Rekomendasi Menu Deterministik 3 Langkah SELA | **ACCEPTED** | `preference-matching` skill | Formula kanonis $W_{\text{flav}}=3, W_{\text{format}}=2, W_{\text{mood}}=1, B_{\text{seller}}=1$, ambang batas skor $S \ge 3$, top 2 rekomendasi, hierarki tie-break 5 tingkat, zero LLM/AI. |
| **[ADR-0007](file:///d:/project/project-qr/cravio/docs/adr/ADR-0007-staff-access-control-cash-window-and-business-resolutions.md)** | Kontrol Akses Staf, Toleransi Tunai 20 Menit, & Resolusi Isu Terbuka | **ACCEPTED** | `docs/project-context.md` | Admin kredensial password bcrypt vs staf PIN cepat 4–6 digit, hak toggle stok oleh barista di KDS, batas waktu tunggu tunai 20 menit, dan pemisahan harga B2B Rp2,5jt. |

---

## 2. Hubungan Antar Dokumen Rekayasa

Setiap ADR dalam direktori ini menjadi acuan mutlak bagi:
1. **Penyusunan Kontrak API:** [`docs/api-contracts.md`](file:///d:/project/project-qr/cravio/docs/api-contracts.md) mengimplementasikan skema Zod dan respon error sesuai ADR-0004 & ADR-0005.
2. **Penyusunan Peta Rute:** [`docs/route-map.md`](file:///d:/project/project-qr/cravio/docs/route-map.md) mengimplementasikan layout App Router sesuai ADR-0003.
3. **Penyusunan Skema Database Prisma (Tahap 04):** `prisma/schema.prisma` akan merefleksikan model relasional, constraint unik, dan enum status sesuai ADR-0004, ADR-0005, dan ADR-0007.

